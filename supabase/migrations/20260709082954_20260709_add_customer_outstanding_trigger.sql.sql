-- Add triggers to update customer outstanding_balance automatically

-- Function to update customer outstanding balance
CREATE OR REPLACE FUNCTION update_customer_outstanding_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_new_balance numeric;
BEGIN
  -- Get customer_id from invoice
  IF TG_OP = 'DELETE' THEN
    v_customer_id := OLD.customer_id;
  ELSE
    v_customer_id := NEW.customer_id;
  END IF;
  
  IF v_customer_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate new outstanding balance: sum of all unpaid invoice balances
  SELECT COALESCE(SUM(balance_due), 0) INTO v_new_balance
  FROM invoices
  WHERE customer_id = v_customer_id
  AND status IN ('sent', 'partially_paid', 'unpaid', 'overdue');
  
  -- Update customer record
  UPDATE customers 
  SET outstanding_balance = v_new_balance,
      updated_at = now()
  WHERE id = v_customer_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add triggers to invoices table
DROP TRIGGER IF EXISTS trg_invoice_customer_balance ON invoices;
CREATE TRIGGER trg_invoice_customer_balance
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_customer_outstanding_balance();

-- Function to update customer balance after payment
CREATE OR REPLACE FUNCTION update_customer_balance_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_new_balance numeric;
BEGIN
  -- Only process received payments for invoices
  IF NEW.payment_type != 'received' OR NEW.reference_type != 'invoice' THEN
    RETURN NEW;
  END IF;
  
  -- Get customer from invoice
  SELECT customer_id INTO v_customer_id FROM invoices WHERE id = NEW.reference_id;
  
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate new outstanding balance
  SELECT COALESCE(SUM(balance_due), 0) INTO v_new_balance
  FROM invoices
  WHERE customer_id = v_customer_id
  AND status IN ('sent', 'partially_paid', 'unpaid', 'overdue');
  
  -- Update customer record
  UPDATE customers 
  SET outstanding_balance = v_new_balance,
      updated_at = now()
  WHERE id = v_customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to payments table
DROP TRIGGER IF EXISTS trg_payment_customer_balance ON payments;
CREATE TRIGGER trg_payment_customer_balance
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION update_customer_balance_after_payment();

-- Now recalculate all customer outstanding balances
UPDATE customers c
SET outstanding_balance = COALESCE(
  (SELECT SUM(balance_due) FROM invoices 
   WHERE customer_id = c.id 
   AND status IN ('sent', 'partially_paid', 'unpaid', 'overdue')),
  0
);
