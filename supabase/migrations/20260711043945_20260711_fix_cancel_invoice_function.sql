/*
# Fix Cancel Invoice Function

1. Bug Fix
- Replaced `Number(v_payment.amount)` with `v_payment.amount::numeric` — `Number()` is JavaScript, not PostgreSQL
- This was causing "function number(numeric) does not exist" error when cancelling invoices with payments

2. Enhancement
- Added check for delivered invoices: if invoice has any delivery with status 'delivered', cancellation is blocked
- This protects against reversing stock for goods already delivered to the customer
*/

CREATE OR REPLACE FUNCTION public.cancel_invoice(
  p_invoice_id uuid,
  p_reason text DEFAULT NULL,
  p_cancelled_by text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invoice RECORD;
  v_ar_account uuid;
  v_revenue_account uuid;
  v_cogs_account uuid;
  v_inventory_account uuid;
  v_default_wh uuid;
  v_item RECORD;
  v_qty numeric;
  v_cost numeric;
  v_payment RECORD;
  v_total_payments numeric := 0;
  v_has_deliveries boolean;
  v_has_returns boolean;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Invoice is already cancelled');
  END IF;

  IF v_invoice.status = 'draft' THEN
    UPDATE invoices SET status = 'cancelled', updated_at = now() WHERE id = p_invoice_id;
    INSERT INTO invoice_edit_history (invoice_id, invoice_number, edited_by_name, change_type, reason, snapshot_before, snapshot_after)
    VALUES (p_invoice_id, v_invoice.invoice_number, p_cancelled_by, 'cancelled', p_reason,
      json_build_object('status', v_invoice.status, 'total_amount', v_invoice.total_amount),
      json_build_object('status', 'cancelled'));
    RETURN json_build_object('success', true, 'message', 'Draft invoice cancelled (no reversals needed)');
  END IF;

  -- Block if invoice has completed deliveries
  SELECT EXISTS(
    SELECT 1 FROM deliveries WHERE invoice_id = p_invoice_id AND status = 'delivered'
  ) INTO v_has_deliveries;
  IF v_has_deliveries THEN
    RETURN json_build_object('success', false, 'error', 'Cannot cancel invoice with completed deliveries. Please handle the delivery first.');
  END IF;

  -- Block if invoice has sales returns
  SELECT EXISTS(
    SELECT 1 FROM sales_returns WHERE invoice_id = p_invoice_id
  ) INTO v_has_returns;
  IF v_has_returns THEN
    RETURN json_build_object('success', false, 'error', 'Cannot cancel invoice with linked sales returns. Please process a refund or remove the return first.');
  END IF;

  -- Get accounts
  SELECT id INTO v_ar_account FROM accounts WHERE code = '1100' LIMIT 1;
  SELECT id INTO v_revenue_account FROM accounts WHERE code = '4000' LIMIT 1;
  SELECT id INTO v_cogs_account FROM accounts WHERE code = '5000' LIMIT 1;
  SELECT id INTO v_inventory_account FROM accounts WHERE code = '1200' LIMIT 1;

  SELECT id INTO v_default_wh FROM warehouses WHERE is_default = true AND is_active = true LIMIT 1;
  IF v_default_wh IS NULL THEN
    SELECT id INTO v_default_wh FROM warehouses WHERE is_active = true LIMIT 1;
  END IF;

  -- 1. Restore stock
  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id LOOP
    v_qty := COALESCE(v_item.base_quantity, v_item.quantity);
    IF v_default_wh IS NOT NULL THEN
      UPDATE inventory_items
      SET quantity_on_hand = quantity_on_hand + v_qty, updated_at = now()
      WHERE product_id = v_item.product_id AND warehouse_id = v_default_wh;

      IF NOT FOUND THEN
        INSERT INTO inventory_items (product_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_incoming)
        VALUES (v_item.product_id, v_default_wh, v_qty, 0, 0);
      END IF;

      INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, unit_cost, reference_type, reference_id, reference_number, notes)
      VALUES (v_item.product_id, v_default_wh, 'return_in', v_qty, COALESCE(v_item.cost_price, 0), 'invoice_cancel', p_invoice_id, v_invoice.invoice_number, 'Stock restoration - invoice cancelled');
    END IF;
  END LOOP;

  -- 2. Reverse AR + Revenue
  IF v_ar_account IS NOT NULL AND v_revenue_account IS NOT NULL AND v_invoice.total_amount > 0 THEN
    PERFORM post_journal_entry(
      'REVERSAL - Accounts Receivable - Invoice ' || v_invoice.invoice_number || ' CANCELLED',
      COALESCE(v_invoice.invoice_date, CURRENT_DATE),
      'invoice_cancel', p_invoice_id,
      json_build_array(
        json_build_object('account_id', v_ar_account, 'debit', 0, 'credit', v_invoice.total_amount, 'description', 'Reverse AR for cancelled invoice ' || v_invoice.invoice_number),
        json_build_object('account_id', v_revenue_account, 'debit', v_invoice.total_amount, 'credit', 0, 'description', 'Reverse revenue for cancelled invoice ' || v_invoice.invoice_number)
      )::json,
      v_invoice.customer_id
    );
  END IF;

  -- 3. Reverse COGS
  IF v_cogs_account IS NOT NULL AND v_inventory_account IS NOT NULL THEN
    FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id LOOP
      v_qty := COALESCE(v_item.base_quantity, v_item.quantity);
      v_cost := COALESCE(v_item.cost_price, 0);
      IF v_qty * v_cost > 0 THEN
        PERFORM post_journal_entry(
          'REVERSAL - COGS - Invoice ' || v_invoice.invoice_number || ' CANCELLED',
          COALESCE(v_invoice.invoice_date, CURRENT_DATE),
          'invoice_cancel', p_invoice_id,
          json_build_array(
            json_build_object('account_id', v_cogs_account, 'debit', 0, 'credit', v_qty * v_cost, 'description', 'Reverse COGS for cancelled invoice ' || v_invoice.invoice_number),
            json_build_object('account_id', v_inventory_account, 'debit', v_qty * v_cost, 'credit', 0, 'description', 'Reverse inventory release for cancelled invoice ' || v_invoice.invoice_number)
          )::json,
          v_invoice.customer_id
        );
      END IF;
    END LOOP;
  END IF;

  -- 4. Reverse payments — FIXED: use ::numeric cast instead of Number()
  FOR v_payment IN SELECT * FROM payments WHERE reference_type = 'invoice' AND reference_id = p_invoice_id LOOP
    v_total_payments := v_total_payments + v_payment.amount::numeric;

    INSERT INTO payments (
      payment_number, payment_type, payment_method, amount, payment_date,
      reference_type, reference_id, reference_number, notes, status
    ) VALUES (
      'REV-' || COALESCE(v_payment.payment_number, 'PAY'),
      CASE WHEN v_payment.payment_type = 'received' THEN 'refund' ELSE 'payment' END,
      v_payment.payment_method,
      v_payment.amount,
      CURRENT_DATE,
      'invoice_cancel', p_invoice_id,
      v_invoice.invoice_number,
      'Reversal payment for cancelled invoice ' || v_invoice.invoice_number,
      'completed'
    );
  END LOOP;

  -- 5. Update invoice status
  UPDATE invoices SET status = 'cancelled', balance_due = 0, updated_at = now() WHERE id = p_invoice_id;

  -- 6. Record in edit history
  INSERT INTO invoice_edit_history (invoice_id, invoice_number, edited_by_name, change_type, reason, snapshot_before, snapshot_after)
  VALUES (p_invoice_id, v_invoice.invoice_number, p_cancelled_by, 'cancelled', p_reason,
    json_build_object('status', v_invoice.status, 'total_amount', v_invoice.total_amount, 'amount_paid', v_invoice.amount_paid),
    json_build_object('status', 'cancelled', 'total_amount', v_invoice.total_amount, 'amount_paid', 0));

  -- 7. Update customer balance
  IF v_invoice.customer_id IS NOT NULL THEN
    UPDATE customers SET outstanding_balance = (
      SELECT COALESCE(SUM(balance_due), 0) FROM invoices
      WHERE customer_id = v_invoice.customer_id AND status IN ('sent', 'partially_paid', 'unpaid', 'overdue')
    ), updated_at = now() WHERE id = v_invoice.customer_id;
  END IF;

  RETURN json_build_object(
    'success', true, 'message', 'Invoice cancelled successfully',
    'invoice_number', v_invoice.invoice_number,
    'stock_restored', true, 'journal_reversed', true,
    'payments_reversed', v_total_payments > 0,
    'total_payments_reversed', v_total_payments
  );
END;
$function$;
