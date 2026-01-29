import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'atlas-admin-2026';

export async function POST(request: NextRequest) {
  try {
    // Verify admin password
    const authHeader = request.headers.get('X-Admin-Password');
    if (authHeader !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csvContent } = body;

    if (!csvContent) {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    
    const classes: Array<{
      class_name: string;
      days: string;
      start_time: string;
      end_time: string;
      building_name: string;
      room_number: string;
      instructor: string;
      start_date: string;
      end_date: string;
      campus: string;
    }> = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Handle CSV parsing with quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length < 6) continue;
      
      const className = values[0] || '';
      const timeStr = values[1] || '';
      const location = values[2] || '';
      const instructor = values[3] || '';
      const dateRange = values[4] || '';
      const campus = values[5] || '';
      
      // Parse time: "Mo 8:00AM - 10:40AM" or "MoWe 8:00AM - 9:15AM"
      const timeMatch = timeStr.match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))$/);
      if (!timeMatch) continue;
      
      const days = timeMatch[1];
      const startTime = timeMatch[2];
      const endTime = timeMatch[3];
      
      // Parse location: "Green Library 100"
      const locationMatch = location.match(/^(.+?)\s+(\d+[A-Za-z]?)$/);
      if (!locationMatch) continue;
      
      const buildingName = locationMatch[1].trim();
      const roomNumber = locationMatch[2];
      
      // Parse date range: "01/05/2026 - 04/18/2026"
      const dateMatch = dateRange.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})$/);
      let startDate = '';
      let endDate = '';
      
      if (dateMatch) {
        try {
          // Convert MM/DD/YYYY to YYYY-MM-DD
          const [startM, startD, startY] = dateMatch[1].split('/');
          const [endM, endD, endY] = dateMatch[2].split('/');
          startDate = `${startY}-${startM}-${startD}`;
          endDate = `${endY}-${endM}-${endD}`;
        } catch {
          // Skip if date parsing fails
        }
      }
      
      classes.push({
        class_name: className,
        days,
        start_time: startTime,
        end_time: endTime,
        building_name: buildingName,
        room_number: roomNumber,
        instructor,
        start_date: startDate,
        end_date: endDate,
        campus,
      });
    }
    
    // Clear existing data - use gte on a text column to match all rows
    await supabase.from('classes').delete().gte('class_name', '');
    
    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < classes.length; i += batchSize) {
      const batch = classes.slice(i, i + batchSize);
      const { error } = await supabase.from('classes').insert(batch);
      
      if (error) {
        console.error('Error inserting batch:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      inserted += batch.length;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Seeded ${inserted} classes from uploaded file`,
      total: classes.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
