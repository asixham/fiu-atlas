-- Add insert and delete policies for seeding
-- Allow public insert access for seeding
CREATE POLICY "Allow public insert" ON classes
  FOR INSERT
  WITH CHECK (true);

-- Allow public delete access for re-seeding
CREATE POLICY "Allow public delete" ON classes
  FOR DELETE
  USING (true);
