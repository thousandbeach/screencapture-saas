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

    // 5. スクリーンショット取得処理
    // TODO: Next.js API Routes + Puppeteerで実装
    //
    // 【実装方針】
    // Supabase Edge Functionsではなく、この関数内で直接Puppeteerを実行します。
    //
    // 【理由】
    // - Deno環境でのPuppeteer実行は、Chromiumバイナリ配置が困難
    // - Next.js（Node.js環境）ならpuppeteer-core + @sparticuz/chromiumで簡単
    // - Vercelで動作保証あり、デバッグも容易
    //
    // 【実装手順】
    // 1. パッケージインストール:
    //    pnpm add puppeteer-core @sparticuz/chromium
    //    pnpm add -D @types/node
    //
    // 2. バックグラウンド処理化:
    //    - 即座に200 OKを返却（レスポンス返却後も処理継続）
    //    - または、別のAPI Route（/api/screenshot-worker）に処理を委譲
    //
    // 3. Puppeteer実装:
    //    ```typescript
    //    import puppeteer from 'puppeteer-core';
    //    import chromium from '@sparticuz/chromium';
    //
    //    const browser = await puppeteer.launch({
    //      args: chromium.args,
    //      executablePath: await chromium.executablePath(),
    //      headless: chromium.headless,
    //    });
    //
    //    for (const device of options.devices) {
    //      const page = await browser.newPage();
    //      await page.setViewport(DEVICE_VIEWPORTS[device]);
    //      await page.goto(url, { waitUntil: 'networkidle2' });
    //
    //      const screenshot = await page.screenshot({
    //        type: 'webp',
    //        quality: 85,
    //        fullPage: true,
    //      });
    //
    //      // Supabase Storageにアップロード
    //      const uploadPath = `${project.storage_path}/${device}_${Date.now()}.webp`;
    //      await supabaseAdmin.storage
    //        .from('screenshots')
    //        .upload(uploadPath, screenshot);
    //
    //      // プログレス更新
    //      await supabaseAdmin
    //        .from('active_projects')
    //        .update({ progress: Math.round((++completed / total) * 100) })
    //        .eq('id', project.id);
    //    }
    //
    //    // ステータスをcompletedに更新
    //    await supabaseAdmin
    //      .from('active_projects')
    //      .update({ status: 'completed', progress: 100 })
    //      .eq('id', project.id);
    //    ```
    //
    // 【注意事項】
    // - Vercel Serverless Functionsの実行時間制限: 60秒（Hobby）、300秒（Pro）
    // - メモリ制限: 1024MB（Hobby）、3008MB（Pro）
    // - 大量ページの場合はタイムアウトに注意
    //
    // 【Edge Function（Deno）を使わない理由】
    // - capture-screenshot/index.tsは参考実装として残すが、実行しない
    // - 下記のコードはコメントアウト（Edge Functionを呼び出さない）
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