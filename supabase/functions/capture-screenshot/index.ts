// @ts-nocheck
// ⚠️ このEdge Functionは使用しません ⚠️
//
// 【理由】
// Deno環境でのPuppeteer実行は以下の問題があります：
// 1. Chromiumブラウザバイナリを手動で配置する必要がある
// 2. バイナリサイズが100MB以上で、ホスティングが困難
// 3. Deno + Puppeteerの実装事例が少なく、トラブルシューティングが困難
// 4. ローカル環境とSupabase環境の差異が大きく、デバッグが困難
//
// 【代替実装】
// Next.js API Routes（Node.js環境）でPuppeteerを実行します。
// - 実装場所: src/app/api/capture/route.ts
// - 使用パッケージ: puppeteer-core + @sparticuz/chromium
// - Vercel Serverless Functionsで動作（完全無料）
// - ローカルでのデバッグが容易
// - 本番運用実績が豊富
//
// 【このファイルの位置づけ】
// - 将来的にエッジコンピューティング環境が改善された場合の参考実装として保持
// - 現時点では実行されません
//
// Supabase Edge Function: capture-screenshot
// スクリーンショット取得処理（モック実装 - 使用しない）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface CaptureRequest {
  project_id: string;
  url: string;
  options: {
    devices: string[];
    max_pages: number;
    all_pages: boolean;
    exclude_popups: boolean;
  };
}

serve(async (req) => {
  // CORSプリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // リクエストボディ取得
    const { project_id, url, options }: CaptureRequest = await req.json();

    if (!project_id || !url || !options) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Supabase Client初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // プロジェクト情報取得
    const { data: project, error: projectError } = await supabase
      .from('active_projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Phase 4.5 - 実際のスクリーンショット取得処理
    // 現時点では外部APIサービスの利用を推奨（例: Screenshotone, ApiFlash）
    // Puppeteerの代わりに外部サービスを使用することで、
    // Deno環境でのブラウザ実行の複雑さを回避できます

    // モック実装: ステータスを'completed'に更新
    console.log(`[capture-screenshot] Processing: ${url}`);
    console.log(`[capture-screenshot] Devices: ${options.devices.join(', ')}`);
    console.log(`[capture-screenshot] Max pages: ${options.max_pages}`);

    // プログレス更新（モック）
    for (let i = 0; i <= 100; i += 20) {
      await supabase
        .from('active_projects')
        .update({ progress: i })
        .eq('id', project_id);

      // 遅延（実際の処理をシミュレート）
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // ステータスを'completed'に更新
    const { error: updateError } = await supabase
      .from('active_projects')
      .update({
        status: 'completed',
        progress: 100,
      })
      .eq('id', project_id);

    if (updateError) {
      console.error('[capture-screenshot] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update project status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: 実際のスクリーンショット取得処理を実装
    // 1. 外部スクリーンショットAPIを呼び出し
    // 2. 画像をダウンロード
    // 3. WebP形式に変換（必要に応じて）
    // 4. Supabase Storageにアップロード
    /*
    const screenshots = [];
    for (const device of options.devices) {
      const screenshot = await captureScreenshot(url, device);
      const uploadPath = `${project.storage_path}/${device}_${Date.now()}.webp`;

      await supabase.storage
        .from('screenshots')
        .upload(uploadPath, screenshot);

      screenshots.push({ device, path: uploadPath });
    }
    */

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        status: 'completed',
        message: 'Mock implementation - screenshots not actually captured',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[capture-screenshot] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});