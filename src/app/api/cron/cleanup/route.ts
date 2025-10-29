import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * 期限切れプロジェクトクリーンアップAPI
 * GET /api/cron/cleanup
 *
 * Vercel Cronから1日1回（毎日0時）に呼び出される
 * - expires_atが現在時刻より前のactive_projectsを削除
 * - 対応するSupabase Storageのスクリーンショットも削除
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Cron Secret検証（セキュリティ対策）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cleanup] Starting cleanup job...');

    // 2. 期限切れのプロジェクトを取得
    const now = new Date().toISOString();
    const { data: expiredProjects, error: fetchError } = await supabaseAdmin
      .from('active_projects')
      .select('id, storage_path')
      .lt('expires_at', now);

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired projects:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch expired projects' },
        { status: 500 }
      );
    }

    if (!expiredProjects || expiredProjects.length === 0) {
      console.log('[Cleanup] No expired projects found');
      return NextResponse.json({
        message: 'No expired projects to clean up',
        deleted: 0,
      });
    }

    console.log(`[Cleanup] Found ${expiredProjects.length} expired projects`);

    // 3. 各プロジェクトのストレージを削除
    let deletedFiles = 0;
    let deletedProjects = 0;

    for (const project of expiredProjects) {
      console.log(`[Cleanup] Processing project ${project.id}...`);

      // 3a. ストレージからファイル一覧を取得
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from('screenshots')
        .list(project.storage_path);

      if (listError) {
        console.error(`[Cleanup] Error listing files for project ${project.id}:`, listError);
        continue;
      }

      if (files && files.length > 0) {
        // 3b. ファイルを削除
        const filePaths = files.map(file => `${project.storage_path}/${file.name}`);
        const { error: deleteError } = await supabaseAdmin.storage
          .from('screenshots')
          .remove(filePaths);

        if (deleteError) {
          console.error(`[Cleanup] Error deleting files for project ${project.id}:`, deleteError);
        } else {
          deletedFiles += files.length;
          console.log(`[Cleanup] Deleted ${files.length} files from project ${project.id}`);
        }
      }

      // 3c. フォルダも削除を試みる（空の場合のみ削除される）
      try {
        await supabaseAdmin.storage
          .from('screenshots')
          .remove([project.storage_path]);
      } catch (e) {
        // フォルダ削除のエラーは無視（フォルダが空でない場合は削除されない）
      }

      // 4. active_projectsテーブルからレコードを削除
      const { error: deleteProjectError } = await supabaseAdmin
        .from('active_projects')
        .delete()
        .eq('id', project.id);

      if (deleteProjectError) {
        console.error(`[Cleanup] Error deleting project ${project.id}:`, deleteProjectError);
      } else {
        deletedProjects++;
        console.log(`[Cleanup] Deleted project ${project.id}`);
      }
    }

    const response = {
      message: 'Cleanup completed successfully',
      deleted_projects: deletedProjects,
      deleted_files: deletedFiles,
      processed: expiredProjects.length,
    };

    console.log('[Cleanup] Cleanup job completed:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Cleanup] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}