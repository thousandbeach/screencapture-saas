import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import { ActiveProject } from '@/lib/types';

/**
 * プロジェクトダウンロードAPI
 * GET /api/projects/[id]/download
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'プロジェクトIDは必須です' },
        { status: 400 }
      );
    }

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

    // 2. プロジェクト情報取得（履歴データも含む）
    const { data: project, error: projectError } = await supabase
      .from('active_projects')
      .select('*, capture_history(*)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません' },
        { status: 404 }
      );
    }

    const typedProject = project as ActiveProject & {
      capture_history: { base_url: string; created_at: string };
    };

    // 3. プロジェクトステータスチェック
    if (typedProject.status !== 'completed') {
      return NextResponse.json(
        { error: 'プロジェクトはまだ処理中です' },
        { status: 400 }
      );
    }

    // 4. 期限切れチェック
    const now = new Date();
    const expiresAt = new Date(typedProject.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'プロジェクトの有効期限が切れています' },
        { status: 410 }
      );
    }

    // 5. ストレージから画像一覧取得
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('screenshots')
      .list(typedProject.storage_path);

    if (listError) {
      console.error('Storage list error:', listError);
      return NextResponse.json(
        { error: 'ファイルの取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: '画像ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // 6. ZIPファイル作成
    const zip = new JSZip();

    for (const file of files) {
      const filePath = `${typedProject.storage_path}/${file.name}`;

      const { data: fileData, error: downloadError } =
        await supabaseAdmin.storage.from('screenshots').download(filePath);

      if (downloadError) {
        console.error(`File download error (${file.name}):`, downloadError);
        continue; // エラーがあってもスキップして続行
      }

      if (fileData) {
        // BlobをArrayBufferに変換
        const arrayBuffer = await fileData.arrayBuffer();
        zip.file(file.name, arrayBuffer);
      }
    }

    // 7. ZIPをBlobに変換
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6, // 圧縮レベル（1-9、デフォルトは6）
      },
    });

    // 8. ダウンロードカウント更新
    await supabaseAdmin
      .from('active_projects')
      .update({
        download_count: typedProject.download_count + 1,
      })
      .eq('id', projectId);

    // 9. ZIPファイル返却
    const arrayBuffer = await zipBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ファイル名を生成（履歴データのURLから）
    const baseUrl = typedProject.capture_history.base_url;
    const urlObj = new URL(baseUrl);
    const domain = urlObj.hostname.replace(/\./g, '_');
    const timestamp = new Date(typedProject.created_at)
      .toISOString()
      .split('T')[0];
    const filename = `screenshots_${domain}_${timestamp}.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
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