import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  CaptureRequest,
  CaptureResponse,
  InsertCaptureHistory,
  InsertActiveProject,
} from '@/lib/types';

/**
 * スクリーンショット取得API
 * POST /api/capture
 *
 * Cloud Runに処理を委譲する形に変更
 */
export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディ取得とバリデーション
    const body: CaptureRequest = await request.json();
    const { url, options } = body;

    console.log('[Capture API] Received request:', JSON.stringify({ url, options }, null, 2));

    if (!url || !options) {
      return NextResponse.json(
        { error: 'URLとオプションは必須です' },
        { status: 400 }
      );
    }

    // URLバリデーション
    try {
      new URL(url);
      if (!url.match(/^https?:\/\/.+/)) {
        throw new Error('Invalid URL format');
      }
    } catch (error) {
      return NextResponse.json(
        { error: '有効なURLを入力してください' },
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
      console.error('[Capture API] Auth error:', authError);
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    console.log('[Capture API] Authenticated user:', user.id);

    // 3. capture_historyレコード作成
    const historyData: InsertCaptureHistory = {
      user_id: user.id,
      base_url: url,
      page_count: options.all_pages ? 300 : (options.max_pages || 1),
      metadata: {
        devices: options.devices || ['desktop'],
        max_pages: options.max_pages || 1,
        all_pages: options.all_pages || false,
        exclude_popups: options.exclude_popups ?? true,
      },
    };

    const { data: history, error: historyError } = await supabaseAdmin
      .from('capture_history')
      .insert(historyData)
      .select()
      .single();

    if (historyError) {
      console.error('[Capture API] History insert error:', historyError);
      return NextResponse.json(
        { error: '履歴の作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('[Capture API] Created capture_history:', history.id);

    // 4. active_projectsレコード作成
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const projectData: InsertActiveProject = {
      history_id: history.id,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
      storage_path: `${user.id}/${history.id}`,
      status: 'processing',
      progress: 0,
      download_count: 0,
      error_message: null,
    };

    const { data: project, error: projectError } = await supabaseAdmin
      .from('active_projects')
      .insert(projectData)
      .select()
      .single();

    if (projectError) {
      console.error('[Capture API] Project insert error:', projectError);
      return NextResponse.json(
        { error: 'プロジェクトの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('[Capture API] Created active_project:', project.id);

    // 5. Cloud Runに処理を委譲（非同期）
    const cloudRunUrl = process.env.CLOUD_RUN_API_URL?.trim();

    console.log('[Capture API] CLOUD_RUN_API_URL:', cloudRunUrl);
    console.log('[Capture API] Sending request to Cloud Run with projectId:', project.id);

    if (!cloudRunUrl) {
      console.error('[Capture API] CLOUD_RUN_API_URL not configured');

      // Cloud Run URLが未設定の場合はエラーステータスに更新
      await supabaseAdmin
        .from('active_projects')
        .update({
          status: 'error',
          error_message: 'Cloud Run API URLが設定されていません',
        })
        .eq('id', project.id);

      return NextResponse.json(
        { error: 'Cloud Run APIが設定されていません' },
        { status: 500 }
      );
    }

    // Cloud Runにリクエスト送信（非同期、レスポンスを待たない）
    const cloudRunRequestUrl = `${cloudRunUrl}/api/capture`;
    console.log('[Capture API] Sending request to:', cloudRunRequestUrl);
    console.log('[Capture API] Request body:', JSON.stringify({ projectId: project.id, urls: [url], options }));

    // waitUntil を使ってLambda終了後も処理を継続
    const fetchPromise = fetch(cloudRunRequestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        projectId: project.id,
        urls: [url], // TODO: クロール機能実装後は複数URL対応
        options,
      }),
    })
      .then(async (response) => {
        console.log('[Capture API] Cloud Run response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Capture API] Cloud Run error response:', errorText);
          throw new Error(`Cloud Run returned ${response.status}: ${errorText}`);
        }
        console.log('[Capture API] Cloud Run request succeeded');
      })
      .catch(async (error) => {
        console.error('[Capture API] Cloud Run request error:', error);

        // エラー時はステータス更新（awaitして確実に書き込む）
        await supabaseAdmin
          .from('active_projects')
          .update({
            status: 'error',
            error_message: `Fetch error: ${error.message}`,
          })
          .eq('id', project.id);
      });

    // waitUntilでLambda終了後も処理を継続させる
    if (request.waitUntil) {
      request.waitUntil(fetchPromise);
    }

    console.log('[Capture API] Delegated to Cloud Run');

    // 6. レスポンス返却（即座に）
    const response: CaptureResponse = {
      project_id: project.id,
      history_id: history.id,
      expires_at: expiresAt.toISOString(),
      status: 'processing',
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('[Capture API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '予期しないエラーが発生しました',
      },
      { status: 500 }
    );
  }
}