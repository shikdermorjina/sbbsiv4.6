/*
# Fix Payments Reference Type Constraint

1. Modified Constraints
- `payments.reference_type` CHECK constraint: added 'invoice_cancel' and 'invoice_edit' to the allowed values
- This allows the cancel_invoice and edit_invoice functions to create reversal payment records

2. Important Notes
- The old constraint only allowed: invoice, purchase_order, advance, refund, receivable, payable
- New constraint adds: invoice_cancel, invoice_edit
- No data is lost — only the constraint is widened
*/

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_reference_type_check;

ALTER TABLE payments ADD CONSTRAINT payments_reference_type_check
  CHECK (reference_type = ANY (ARRAY['invoice', 'purchase_order', 'advance', 'refund', 'receivable', 'payable', 'invoice_cancel', 'invoice_edit']));
