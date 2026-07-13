-- Backfill unit_name on invoice_items where it is NULL, using the product's base unit
UPDATE invoice_items ii
SET unit_name = p.unit
FROM products p
WHERE ii.product_id = p.id
  AND ii.unit_name IS NULL
  AND p.unit IS NOT NULL
  AND p.unit <> '';

-- Backfill unit_name on quotation_items where it is NULL
UPDATE quotation_items qi
SET unit_name = p.unit
FROM products p
WHERE qi.product_id = p.id
  AND qi.unit_name IS NULL
  AND p.unit IS NOT NULL
  AND p.unit <> '';

-- Backfill unit_name on delivery_items where it is NULL
UPDATE delivery_items di
SET unit_name = p.unit
FROM products p
WHERE di.product_id = p.id
  AND di.unit_name IS NULL
  AND p.unit IS NOT NULL
  AND p.unit <> '';
