import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  CaptureRequest,
  CaptureResponse,
  InsertCaptureHistory,
  InsertActiveProject,
} from '@/lib/types';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// デバイス別ビューポート設定
const DEVICE_VIEWPORTS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 480, height: 800 },
};

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

    // 5. スクリーンショット取得処理（バックグラウンド実行）
    // レスポンスを即座に返し、スクリーンショット取得は非同期で実行
    (async () => {
      let browser;
      try {
        console.log(`[Screenshot] Starting capture for project ${project.id}`);

        // Puppeteerブラウザ起動
        browser = await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        });

        console.log('[Screenshot] Browser launched successfully');

        const devices = options.devices || ['desktop'];
        const totalScreenshots = devices.length;
        let completedScreenshots = 0;

        // デバイスごとにスクリーンショット取得
        for (const device of devices) {
          console.log(`[Screenshot] Capturing ${device} screenshot`);

          const page = await browser.newPage();

          // ビューポート設定
          const viewport = DEVICE_VIEWPORTS[device];
          if (viewport) {
            await page.setViewport(viewport);
          }

          // ページ遷移
          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000, // 30秒タイムアウト
          });

          // スクリーンショット取得
          const screenshot = await page.screenshot({
            type: 'webp',
            quality: 85,
            fullPage: true,
          });

          // Supabase Storageにアップロード
          const uploadPath = `${project.storage_path}/${device}_${Date.now()}.webp`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('screenshots')
            .upload(uploadPath, screenshot, {
              contentType: 'image/webp',
            });

          if (uploadError) {
            console.error(`[Screenshot] Upload error for ${device}:`, uploadError);
            throw uploadError;
          }

          console.log(`[Screenshot] Uploaded ${device} screenshot: ${uploadPath}`);

          // ページクローズ
          await page.close();

          // プログレス更新
          completedScreenshots++;
          const progress = Math.round((completedScreenshots / totalScreenshots) * 100);

          await supabaseAdmin
            .from('active_projects')
            .update({ progress })
            .eq('id', project.id);

          console.log(`[Screenshot] Progress: ${progress}%`);
        }

        // すべて完了 - ステータスをcompletedに更新
        await supabaseAdmin
          .from('active_projects')
          .update({
            status: 'completed',
            progress: 100,
          })
          .eq('id', project.id);

        console.log(`[Screenshot] Project ${project.id} completed successfully`);
      } catch (error) {
        console.error(`[Screenshot] Error for project ${project.id}:`, error);

        // エラー時はステータスをerrorに更新
        await supabaseAdmin
          .from('active_projects')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'スクリーンショット取得に失敗しました',
          })
          .eq('id', project.id);
      } finally {
        // ブラウザクローズ
        if (browser) {
          await browser.close();
          console.log('[Screenshot] Browser closed');
        }
      }
    })(); // 即座に実行（awaitなし）

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