import { NextResponse } from 'next/server';

export async function GET() {
  const cloudRunUrl = process.env.CLOUD_RUN_API_URL;

  return NextResponse.json({
    CLOUD_RUN_API_URL: cloudRunUrl,
    CLOUD_RUN_API_URL_length: cloudRunUrl?.length,
    CLOUD_RUN_API_URL_charCodes: cloudRunUrl?.split('').map(c => c.charCodeAt(0)),
  });
}