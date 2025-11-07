import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * キャプチャキャンセルAPI
 * PUT /api/cancel?project_id=xxx
 */
export async function PUT(request: NextRequest) {
  try {
    // クエリパラメータからproject_idを取得
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_idが必要です' },
        { status: 400 }
      );
    }

    // 認証チェック
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

    // プロジェクト情報を取得
    const { data: project, error: projectError } = await supabaseAdmin
      .from('active_projects')
      .select('id, user_id, status')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません' },
        { status: 404 }
      );
    }

    // 権限チェック
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    // ステータスチェック（processing中のみキャンセル可能）
    if (project.status !== 'processing') {
      return NextResponse.json(
        { error: `ステータスが ${project.status} のプロジェクトはキャンセルできません` },
        { status: 400 }
      );
    }

    // ステータスをcancelledに更新
    const { error: updateError } = await supabaseAdmin
      .from('active_projects')
      .update({
        status: 'cancelled',
        error_message: 'ユーザーによりキャンセルされました',
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Cancel error:', updateError);
      return NextResponse.json(
        { error: 'キャンセルに失敗しました' },
        { status: 500 }
      );
    }

    console.log(`[Cancel] Project ${projectId} cancelled by user ${user.id}`);

    return NextResponse.json({
      success: true,
      project_id: projectId,
      status: 'cancelled',
    });
  } catch (error) {
    console.error('Cancel API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}