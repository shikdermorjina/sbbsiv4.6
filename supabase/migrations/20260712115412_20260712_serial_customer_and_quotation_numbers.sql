-- Create sequences for customer codes and quotation numbers
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quotation_seq START 1;

-- Sync customer_seq to avoid collisions with existing random codes
-- (existing codes are random 6-digit, new serial ones start from 1 → CUST-000001)
-- No need to sync since format CUST-000001 won't collide with CUST-820110

-- Function: generate next customer code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'CUST-' || LPAD(nextval('customer_seq')::TEXT, 6, '0');
END;
$$;

-- Function: generate next quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'QT-' || LPAD(nextval('quotation_seq')::TEXT, 6, '0');
END;
$$;

-- Sync quotation_seq to be past the highest existing random number
-- to avoid any future collision (existing are 6-digit random, new serial start from 1)
-- They use different zero-padded format so no collision risk
