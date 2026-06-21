/*
# Fix Purchase Order Received Quantities

## Problem
Purchase order items have received_quantity = 0 even though their parent PO 
has status 'received' or 'partially_received'. This happened because GRNs 
updated stock and PO status but did not update item-level received_quantity.

## Fix
Set received_quantity = quantity for all items belonging to fully received POs.
For partially_received POs, set received_quantity = quantity as a safe default
since we cannot determine the exact split without historical GRN line data.
*/

UPDATE purchase_order_items poi
SET received_quantity = poi.quantity
FROM purchase_orders po
WHERE poi.purchase_order_id = po.id
  AND po.status IN ('received', 'partially_received')
  AND poi.received_quantity = 0
  AND poi.quantity > 0;
