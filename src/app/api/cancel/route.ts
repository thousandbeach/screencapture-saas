import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * キャプチャキャンセルAPI
 * PUT /api/cancel?project_id=xxx
 *
 * Cloud Runに処理を委譲する形に変更
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. クエリパラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_idは必須です' },
        { status: 400 }
      );
    }

    // 2. 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    // 3. Cloud Runに処理を委譲
    const cloudRunUrl = process.env.CLOUD_RUN_API_URL;

    if (!cloudRunUrl) {
      return NextResponse.json(
        { error: 'Cloud Run APIが設定されていません' },
        { status: 500 }
      );
    }

    // Cloud Runにリクエスト送信（同期、レスポンスを待つ）
    const response = await fetch(`${cloudRunUrl}/api/cancel?project_id=${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Cancel API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'キャンセルに失敗しました',
      },
      { status: 500 }
    );
  }
}