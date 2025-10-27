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
 */
export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディ取得とバリデーション
    const body: CaptureRequest = await request.json();
    const { url, options } = body;

    if (!url || !options) {
      return NextResponse.json(
        { error: 'URLとオプションは必須です' },
        { status: 400 }
      );
    }

    // URLバリデーション
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '有効なURLを入力してください' },
        { status: 400 }
      );
    }

    // 2. 認証チェック
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

    // 3. capture_historyレコード作成（永久保存）
    const historyData: InsertCaptureHistory = {
      user_id: user.id,
      base_url: url,
      page_count: options.max_pages || 1,
      metadata: {
        devices: options.devices,
        max_pages: options.max_pages,
        exclude_popups: options.exclude_popups,
      },
    };

    const { data: history, error: historyError } = await supabaseAdmin
      .from('capture_history')
      .insert(historyData)
      .select()
      .single();

    if (historyError) {
      console.error('History creation error:', historyError);
      return NextResponse.json(
        { error: '履歴の作成に失敗しました' },
        { status: 500 }
      );
    }

    // 4. active_projectsレコード作成（24時間後に期限切れ）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const projectData: InsertActiveProject = {
      history_id: history.id,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
      storage_path: `${user.id}/${history.id}`,
      download_count: 0,
      status: 'processing',
      progress: 0,
      error_message: null,
    };

    const { data: project, error: projectError } = await supabaseAdmin
      .from('active_projects')
      .insert(projectData)
      .select()
      .single();

    if (projectError) {
      console.error('Project creation error:', projectError);
      return NextResponse.json(
        { error: 'プロジェクトの作成に失敗しました' },
        { status: 500 }
      );
    }

    // 5. Edge Functionを呼び出す（非同期処理）
    // TODO: Phase 4でSupabase Edge Function実装後に有効化
    /*
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/capture-screenshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            project_id: project.id,
            url,
            options,
          }),
        }
      );
    } catch (edgeFunctionError) {
      console.error('Edge Function invocation error:', edgeFunctionError);
      // Edge Functionのエラーはプロジェクト作成を妨げない（非同期処理のため）
    }
    */

    // 6. レスポンス返却
    const response: CaptureResponse = {
      project_id: project.id,
      history_id: history.id,
      expires_at: expiresAt.toISOString(),
      status: 'processing',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Capture API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}