/*
# Invoice Edit History System

1. New Tables
- `invoice_edit_history`
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, FK to invoices, NOT NULL) — which invoice was edited
  - `invoice_number` (text, NOT NULL) — snapshot of invoice number for quick display
  - `edited_by` (uuid, nullable, FK to profiles) — who made the edit
  - `edited_by_name` (text, nullable) — editor display name snapshot
  - `edited_at` (timestamptz, default now()) — when the edit happened
  - `change_type` (text, NOT NULL) — 'header_edit' | 'item_added' | 'item_removed' | 'item_modified' | 'full_edit'
  - `field_changed` (text, nullable) — which specific field changed (e.g. 'customer_id', 'unit_price', 'quantity')
  - `old_value` (jsonb, nullable) — snapshot of the old state (header fields or item fields)
  - `new_value` (jsonb, nullable) — snapshot of the new state
  - `reason` (text, nullable) — mandatory reason for non-draft edits
  - `snapshot_before` (jsonb, nullable) — full invoice + items snapshot before edit
  - `snapshot_after` (jsonb, nullable) — full invoice + items snapshot after edit
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `invoices`
  - Added `edit_count` (integer, NOT NULL, default 0) — quick badge display in list

3. Security
- Enable RLS on `invoice_edit_history`
- Allow anon + authenticated full CRUD (matching existing invoices policy pattern — no sign-in screen in this app)

4. Indexes
- `idx_invoice_edit_history_invoice_id` on (invoice_id, edited_at DESC) — fast per-invoice lookup
- `idx_invoice_edit_history_edited_at` on (edited_at DESC) — fast period-based reporting

5. Important Notes
- The `edit_count` column on invoices defaults to 0 and is incremented by the client after each successful edit.
- The `invoice_edit_history` table stores both header-level and item-level change records.
- `snapshot_before` / `snapshot_after` store the complete invoice state (header + items array) as JSONB for full audit traceability.
- This table is separate from `activity_logs` to provide richer, invoice-specific querying by period, editor, and change type.
*/

-- ============================================================
-- 1. Create invoice_edit_history table
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  edited_by_name text,
  edited_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  field_changed text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  snapshot_before jsonb,
  snapshot_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE invoice_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_edit_history_select" ON invoice_edit_history;
CREATE POLICY "invoice_edit_history_select" ON invoice_edit_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "invoice_edit_history_insert" ON invoice_edit_history;
CREATE POLICY "invoice_edit_history_insert" ON invoice_edit_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_edit_history_update" ON invoice_edit_history;
CREATE POLICY "invoice_edit_history_update" ON invoice_edit_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_edit_history_delete" ON invoice_edit_history;
CREATE POLICY "invoice_edit_history_delete" ON invoice_edit_history FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. Add edit_count column to invoices
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'edit_count'
  ) THEN
    ALTER TABLE invoices ADD COLUMN edit_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoice_edit_history_invoice_id
  ON invoice_edit_history (invoice_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_edit_history_edited_at
  ON invoice_edit_history (edited_at DESC);
