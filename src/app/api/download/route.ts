import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import JSZip from 'jszip';

/**
 * スクリーンショットダウンロードAPI
 * GET /api/download?project_id=xxx
 */
export async function GET(request: NextRequest) {
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

    // プロジェクト情報と履歴情報を取得
    const { data: project, error: projectError } = await supabaseAdmin
      .from('active_projects')
      .select(`
        id,
        user_id,
        storage_path,
        status,
        download_count,
        history_id,
        capture_history (
          base_url,
          page_count,
          captured_at,
          metadata
        )
      `)
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

    // ステータスチェック
    if (project.status !== 'completed') {
      return NextResponse.json(
        { error: 'プロジェクトが完了していません' },
        { status: 400 }
      );
    }

    // ストレージからファイル一覧を取得
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('screenshots')
      .list(project.storage_path);

    if (listError || !files || files.length === 0) {
      console.error('List error:', listError);
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // ZIPファイルを作成
    const zip = new JSZip();

    // メタデータファイルを追加
    const historyData = project.capture_history as any;
    if (historyData) {
      const fileMapping = historyData.metadata?.file_mapping || [];

      const metadata = {
        url: historyData.base_url,
        captured_at: historyData.captured_at,
        page_count: historyData.page_count,
        settings: historyData.metadata,
        project_id: projectId,
        download_date: new Date().toISOString(),
        files: fileMapping,
      };

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      // 人間が読みやすいREADMEも追加
      let readme = `ScreenCapture - キャプチャ情報
==================

ベースURL: ${historyData.base_url}
取得日時: ${new Date(historyData.captured_at).toLocaleString('ja-JP')}
ページ数: ${historyData.page_count}
ダウンロード日時: ${new Date().toLocaleString('ja-JP')}

`;

      // ファイルとURLのマッピング情報を追加
      if (fileMapping.length > 0) {
        readme += '\n【ファイルとURLの対応】\n';
        readme += '==================\n\n';

        fileMapping.forEach((mapping: any) => {
          readme += `${mapping.filename}\n`;
          readme += `  └ URL: ${mapping.url}\n`;
          readme += `  └ デバイス: ${mapping.device}\n\n`;
        });
      }

      readme += '\nこのフォルダには、上記URLのスクリーンショットが含まれています。\n';
      readme += '詳細な設定情報は metadata.json をご確認ください。\n';

      zip.file('README.txt', readme);
    }

    // 各ファイルをダウンロードしてZIPに追加
    for (const file of files) {
      const filePath = `${project.storage_path}/${file.name}`;

      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('screenshots')
        .download(filePath);

      if (downloadError) {
        console.error(`Download error for ${filePath}:`, downloadError);
        continue;
      }

      if (fileData) {
        // BlobをArrayBufferに変換
        const arrayBuffer = await fileData.arrayBuffer();
        zip.file(file.name, arrayBuffer);
      }
    }

    // ZIPファイルを生成
    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });

    // ダウンロード回数を更新
    await supabaseAdmin
      .from('active_projects')
      .update({ download_count: project.download_count + 1 })
      .eq('id', projectId);

    // ZIPファイルを返す
    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="screenshots_${projectId}.zip"`,
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