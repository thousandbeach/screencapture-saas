import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import JSZip from 'jszip';

/**
 * ZIPダウンロードAPI
 * GET /api/download/[projectId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;

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

    // 2. プロジェクト情報取得
    const { data: project, error: projectError } = await supabaseAdmin
      .from('active_projects')
      .select('*, history:capture_history!inner(base_url)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません' },
        { status: 404 }
      );
    }

    // ステータスチェック
    if (project.status !== 'completed') {
      return NextResponse.json(
        { error: 'スクリーンショットの取得が完了していません' },
        { status: 400 }
      );
    }

    // 期限チェック
    if (new Date(project.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'プロジェクトの有効期限が切れています' },
        { status: 410 }
      );
    }

    // 3. Storageからファイル一覧取得
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('screenshots')
      .list(project.storage_path);

    if (listError) {
      console.error('Storage list error:', listError);
      return NextResponse.json(
        { error: 'ファイル一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'ダウンロード可能なファイルがありません' },
        { status: 404 }
      );
    }

    // 4. ZIPファイル作成
    const zip = new JSZip();

    // 各ファイルをZIPに追加
    for (const file of files) {
      const filePath = `${project.storage_path}/${file.name}`;

      // ファイルダウンロード
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('screenshots')
        .download(filePath);

      if (downloadError) {
        console.error(`Download error for ${filePath}:`, downloadError);
        continue; // エラーがあってもスキップして続行
      }

      if (fileData) {
        // ZIPに追加
        const arrayBuffer = await fileData.arrayBuffer();
        zip.file(file.name, arrayBuffer);
      }
    }

    // ZIP生成
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });

    // 5. ダウンロードカウント更新
    await supabaseAdmin
      .from('active_projects')
      .update({ download_count: project.download_count + 1 })
      .eq('id', projectId);

    // 6. レスポンス返却
    const baseUrl = project.history.base_url.replace(/https?:\/\//, '').replace(/\//g, '_');
    const filename = `${baseUrl}_${projectId.substring(0, 8)}.zip`;

    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBlob.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}