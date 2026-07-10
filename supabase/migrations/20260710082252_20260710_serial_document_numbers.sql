/*
# Serial Document Number Sequences

Replaces all Date.now()-based number generation with proper PostgreSQL sequences.

## New Sequences
- invoice_seq        → INV-000001
- pos_seq            → POS-000001
- payment_seq        → PAY-000001
- delivery_seq       → DLV-000001
- journal_entry_seq  (already exists, reuse it)
- purchase_order_seq → PO-000001
- purchase_pay_seq   → POPAY-000001
- sales_return_seq   (already handled by generate_sales_return_number, replaced here)

## New/Updated Functions
- generate_invoice_number()
- generate_pos_number()
- generate_payment_number()
- generate_delivery_number()
- generate_journal_number()
- generate_purchase_order_number()
- generate_purchase_payment_number()
- generate_return_number() (replaces generate_sales_return_number)

## Notes
- Sequences use IF NOT EXISTS so this is safe to re-run.
- journal_entry_seq already exists from accounting automation migration — we just ensure it starts at 1 if never used.
*/

-- ─── Sequences ────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pos_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS delivery_seq START 1;
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS purchase_payment_seq START 1;
-- journal_entry_seq and sales_return sequences exist; keep them but add wrappers below

-- Sync invoice_seq to actual max so we don't generate duplicates on existing data
DO $$
DECLARE
  max_inv INTEGER;
  max_pos INTEGER;
  max_pay INTEGER;
  max_dlv INTEGER;
  max_po  INTEGER;
BEGIN
  -- Invoice
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_inv FROM invoices WHERE invoice_number ~ '^INV-[0-9]+$';
  IF max_inv > 0 THEN PERFORM setval('invoice_seq', max_inv); END IF;

  -- POS
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_pos FROM invoices WHERE invoice_number ~ '^POS-[0-9]+$';
  IF max_pos > 0 THEN PERFORM setval('pos_seq', max_pos); END IF;

  -- Payment (both sale and purchase payments)
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(payment_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_pay FROM payments WHERE payment_number ~ '^PAY-[0-9]+$';
  IF max_pay > 0 THEN PERFORM setval('payment_seq', max_pay); END IF;

  -- Delivery
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(delivery_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_dlv FROM deliveries WHERE delivery_number ~ '^DLV-[0-9]+$';
  IF max_dlv > 0 THEN PERFORM setval('delivery_seq', max_dlv); END IF;

  -- Purchase Order
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(po_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_po FROM purchase_orders WHERE po_number ~ '^PO-[0-9]+$';
  IF max_po > 0 THEN PERFORM setval('purchase_order_seq', max_po); END IF;
END $$;

-- ─── Generator Functions ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_pos_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'POS-' || LPAD(nextval('pos_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'PAY-' || LPAD(nextval('payment_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'DLV-' || LPAD(nextval('delivery_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_journal_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'JE-' || LPAD(nextval('journal_entry_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'PO-' || LPAD(nextval('purchase_order_seq')::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION generate_purchase_payment_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'POPAY-' || LPAD(nextval('purchase_payment_seq')::TEXT, 6, '0');
END $$;

-- Replace the MAX()+1 sales return function with a proper sequence
CREATE SEQUENCE IF NOT EXISTS sales_return_seq START 1;

DO $$
DECLARE max_sr INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(return_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
    INTO max_sr FROM sales_returns WHERE return_number ~ '^SR-[0-9]+$';
  IF max_sr > 0 THEN PERFORM setval('sales_return_seq', max_sr); END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_sales_return_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'SR-' || LPAD(nextval('sales_return_seq')::TEXT, 6, '0');
END $$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION generate_invoice_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_pos_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_delivery_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_journal_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_purchase_order_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_purchase_payment_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_sales_return_number() TO anon, authenticated;
