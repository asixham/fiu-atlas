import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.MAPBOX_TOKEN;
  
  if (!token) {
    return NextResponse.json({ token: null }, { status: 200 });
  }
  
  return NextResponse.json({ token });
}
