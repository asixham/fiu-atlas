-- Create the classes table for FIU class schedule data
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL,
  days TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  building_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  instructor TEXT,
  start_date TEXT,
  end_date TEXT,
  campus TEXT NOT NULL DEFAULT 'MMC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_classes_building ON public.classes(building_name);
CREATE INDEX IF NOT EXISTS idx_classes_room ON public.classes(building_name, room_number);
CREATE INDEX IF NOT EXISTS idx_classes_days ON public.classes(days);

-- Enable RLS but allow public read access (no auth required for viewing class data)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read class data (public information)
CREATE POLICY "Allow public read access to classes" 
  ON public.classes 
  FOR SELECT 
  USING (true);
