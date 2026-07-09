-- Fix double payment for INV-693630
-- The duplicate payment PAY-972535 needs to be reversed

-- 1. Reverse account balances (Cash in Hand decreased, Accounts Receivable increased)
UPDATE accounts 
SET balance = balance - 450 
WHERE id = 'cc000000-0000-0000-0000-000000000002'; -- Cash in Hand

UPDATE accounts 
SET balance = balance + 450 
WHERE id = 'cc000000-0000-0000-0000-000000000004'; -- Accounts Receivable

-- 2. Delete journal lines for the duplicate payment's journal entry
DELETE FROM journal_lines 
WHERE journal_entry_id = 'c7ce4144-5388-4961-98e1-840ae8ba86fd';

-- 3. Delete the journal entry for the duplicate payment
DELETE FROM journal_entries 
WHERE id = 'c7ce4144-5388-4961-98e1-840ae8ba86fd';

-- 4. Delete the duplicate payment record
DELETE FROM payments 
WHERE id = 'd59c5204-d1fd-440e-9828-6d559daf23b4';

-- 5. Update invoice - correct the amount_paid (balance_due is generated)
-- Original: total=1000, payments were 50+450+450=950, but should be 50+450=500
UPDATE invoices 
SET amount_paid = 500,
    status = 'partially_paid'
WHERE id = '37861df6-6531-48b5-a514-bb02d3e183d0';

-- 6. Update customer outstanding_balance (should be 500)
UPDATE customers 
SET outstanding_balance = 500 
WHERE id = 'a005c624-fd50-4dcb-bc04-3f6e2ccd13a0';
