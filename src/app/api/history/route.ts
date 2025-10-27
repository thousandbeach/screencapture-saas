import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CaptureHistory } from '@/lib/types';

/**
 * 履歴取得API
 * GET /api/history
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 2. クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // limitの範囲チェック（最大100件）
    const validLimit = Math.min(Math.max(limit, 1), 100);

    // 3. 履歴データ取得
    const { data, error, count } = await supabase
      .from('capture_history')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('captured_at', { ascending: false })
      .range(offset, offset + validLimit - 1);

    if (error) {
      console.error('History fetch error:', error);
      return NextResponse.json(
        { error: '履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 4. レスポンス返却
    return NextResponse.json({
      history: data as CaptureHistory[],
      total: count || 0,
      limit: validLimit,
      offset,
    });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}