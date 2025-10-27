// @ts-nocheck
// Supabase Edge Function: cleanup-expired
// 期限切れプロジェクトの自動削除処理

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORSプリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 認証チェック（Cron Jobからの呼び出しのみ許可）
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Supabase Client初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    console.log(`[cleanup-expired] Starting cleanup at ${now}`);

    // 1. 期限切れプロジェクト取得
    const { data: expiredProjects, error: fetchError } = await supabase
      .from('active_projects')
      .select('id, storage_path')
      .lt('expires_at', now);

    if (fetchError) {
      console.error('[cleanup-expired] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch expired projects' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!expiredProjects || expiredProjects.length === 0) {
      console.log('[cleanup-expired] No expired projects found');
      return new Response(
        JSON.stringify({
          deleted: 0,
          timestamp: now,
          message: 'No expired projects',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[cleanup-expired] Found ${expiredProjects.length} expired projects`
    );

    let deletedCount = 0;
    let storageDeletedCount = 0;

    // 2. 各プロジェクトのストレージから画像削除
    for (const project of expiredProjects) {
      try {
        // ストレージ内のファイル一覧取得
        const { data: files, error: listError } = await supabase.storage
          .from('screenshots')
          .list(project.storage_path);

        if (listError) {
          console.error(
            `[cleanup-expired] List error for ${project.id}:`,
            listError
          );
          continue;
        }

        if (files && files.length > 0) {
          // ファイルパス配列作成
          const filePaths = files.map(
            (f) => `${project.storage_path}/${f.name}`
          );

          // ストレージから削除
          const { error: removeError } = await supabase.storage
            .from('screenshots')
            .remove(filePaths);

          if (removeError) {
            console.error(
              `[cleanup-expired] Remove error for ${project.id}:`,
              removeError
            );
          } else {
            storageDeletedCount += files.length;
            console.log(
              `[cleanup-expired] Deleted ${files.length} files from ${project.storage_path}`
            );
          }
        }
      } catch (error) {
        console.error(
          `[cleanup-expired] Storage cleanup error for ${project.id}:`,
          error
        );
      }
    }

    // 3. データベースから期限切れプロジェクト削除
    const { data: deleted, error: deleteError } = await supabase
      .from('active_projects')
      .delete()
      .lt('expires_at', now)
      .select();

    if (deleteError) {
      console.error('[cleanup-expired] Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete projects from database' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    deletedCount = deleted?.length || 0;

    // 4. ヘルスチェック記録更新
    await supabase.from('health_checks').insert({
      status: 'active',
      checked_at: now,
    });

    console.log(
      `[cleanup-expired] Cleanup complete: ${deletedCount} projects, ${storageDeletedCount} files`
    );

    return new Response(
      JSON.stringify({
        deleted: deletedCount,
        files_deleted: storageDeletedCount,
        timestamp: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[cleanup-expired] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});