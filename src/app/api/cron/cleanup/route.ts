import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron Job用クリーンアップAPI
 * GET /api/cron/cleanup
 * Vercel Cron Jobsから1日1回（毎日0時）に呼び出される
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック（Vercel Cron Jobsからのみ許可）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabase Edge Function呼び出し
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-expired`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Cleanup Edge Function error:', error);
      return NextResponse.json(
        { error: 'Cleanup failed' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Cron cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}