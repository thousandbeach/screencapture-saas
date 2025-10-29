import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  CaptureRequest,
  CaptureResponse,
  InsertCaptureHistory,
  InsertActiveProject,
} from '@/lib/types';

// デバイス別ビューポート設定
const DEVICE_VIEWPORTS: Record<string, { width: number; height: number; isMobile?: boolean; hasTouch?: boolean }> = {
  desktop: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
  tablet: { width: 1024, height: 768, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }, // iPhone 14 Pro サイズに変更
};

// デバイス別User-Agent設定
const DEVICE_USER_AGENTS: Record<string, string> = {
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  tablet: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
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

    console.log('[Capture API] Received request:', JSON.stringify({ url, options }, null, 2));

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
      let browser: Awaited<ReturnType<typeof import('puppeteer').default.launch>> | undefined;
      try {
        console.log(`[Screenshot] Starting capture for project ${project.id}`);

        // Puppeteerブラウザ起動
        // Vercel環境では@sparticuz/chromiumを使用、ローカルではデフォルトのChromiumを使用
        const isVercel = process.env.VERCEL === '1';

        if (isVercel) {
          // Vercel環境: puppeteer-core + @sparticuz/chromium
          const puppeteerCore = (await import('puppeteer-core')).default;
          const chromium = (await import('@sparticuz/chromium')).default;

          browser = await puppeteerCore.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
          });
        } else {
          // ローカル環境: puppeteerのChromiumを使用
          const puppeteer = (await import('puppeteer')).default;

          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });
        }

        console.log('[Screenshot] Browser launched successfully');

        // URL収集（クロール機能 - BFS）
        const urlsToCrawl: string[] = [];
        const baseUrl = new URL(url);
        const maxPages = options.max_pages || 1;

        // URLを正規化（クエリパラメータとフラグメントを除去）
        const normalizeUrl = (urlString: string): string => {
          try {
            const parsed = new URL(urlString);
            return `${parsed.origin}${parsed.pathname}`;
          } catch {
            return urlString;
          }
        };

        if (maxPages > 1) {
          // 複数ページ取得の場合: BFS（幅優先探索）でクロール
          console.log(`[Crawl] Starting BFS crawl for max ${maxPages} pages`);

          const visited = new Set<string>();
          const queue: string[] = [url];
          visited.add(normalizeUrl(url));

          while (queue.length > 0 && urlsToCrawl.length < maxPages) {
            const currentUrl = queue.shift()!;
            urlsToCrawl.push(currentUrl);

            console.log(`[Crawl] Visiting ${currentUrl} (${urlsToCrawl.length}/${maxPages})`);

            // このページからリンクを収集
            if (urlsToCrawl.length < maxPages) {
              const tempPage = await browser!.newPage();

              try {
                await tempPage.goto(currentUrl, {
                  waitUntil: 'networkidle0',
                  timeout: 30000,
                });

                // ページ内のすべてのリンクを抽出
                const links = await tempPage.evaluate(() => {
                  return Array.from(document.querySelectorAll('a[href]'))
                    .map(a => (a as HTMLAnchorElement).href)
                    .filter(href => href && href.startsWith('http'));
                });

                // 同一オリジンの未訪問URLをキューに追加
                links.forEach(link => {
                  try {
                    const linkUrl = new URL(link);
                    if (linkUrl.origin === baseUrl.origin) {
                      const normalized = normalizeUrl(link);
                      if (!visited.has(normalized)) {
                        visited.add(normalized);
                        queue.push(link);
                      }
                    }
                  } catch {
                    // 無効なURLは無視
                  }
                });

                console.log(`[Crawl] Found ${links.length} links, queue size: ${queue.length}`);
              } catch (error) {
                console.error(`[Crawl] Error visiting ${currentUrl}:`, error);
              } finally {
                await tempPage.close();
              }
            }
          }

          console.log(`[Crawl] Completed: ${urlsToCrawl.length} pages discovered`);
        } else {
          // 単一ページ取得
          urlsToCrawl.push(url);
        }

        // 実際の取得ページ数でhistoryを更新
        await supabaseAdmin
          .from('capture_history')
          .update({ page_count: urlsToCrawl.length })
          .eq('id', history.id);

        const devices = options.devices || ['desktop'];
        const totalScreenshots = urlsToCrawl.length * devices.length;
        let completedScreenshots = 0;

        // 各URLについて、各デバイスでスクリーンショット取得（順次実行）
        await urlsToCrawl.reduce(async (previousPromise, pageUrl) => {
          await previousPromise;
          console.log(`[Screenshot] Processing URL: ${pageUrl}`);

          await devices.reduce(async (prevDevicePromise, device) => {
            await prevDevicePromise;
            console.log(`[Screenshot] Capturing ${device} screenshot for ${pageUrl}`);

            const page = await browser!.newPage();

            // デバイスエミュレーション設定
            const viewport = DEVICE_VIEWPORTS[device] || DEVICE_VIEWPORTS.desktop;
            const userAgent = DEVICE_USER_AGENTS[device] || DEVICE_USER_AGENTS.desktop;

            console.log(`[Screenshot] Device: ${device}, Viewport:`, viewport);
            console.log(`[Screenshot] User-Agent:`, userAgent);

            // Chrome DevToolsと同じレベルのデバイスエミュレーション
            await page.emulate({
              viewport: {
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: device === 'mobile' ? 2 : device === 'tablet' ? 2 : 1,
                isMobile: viewport.isMobile || false,
                hasTouch: viewport.hasTouch || false,
                isLandscape: false,
              },
              userAgent: userAgent,
            });

            console.log(`[Screenshot] Emulation set for ${device}`);

            // ページ遷移（より厳密な待機条件）
            console.log(`[Screenshot] Navigating to ${pageUrl} for ${device}`);
            await page.goto(pageUrl, {
              waitUntil: 'networkidle0',
              timeout: 60000,
            });

            console.log(`[Screenshot] Page loaded for ${device}`);

            // JavaScript実行とレンダリングの完了を待つ
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log(`[Screenshot] Wait completed for ${device}`);

            // ポップアップ除外処理
            if (options.exclude_popups) {
              await page.evaluate(() => {
                // OneTrust、Cookiebot、その他のクッキー同意モーダル/ポップアップのセレクター
                const specificSelectors = [
                  '#onetrust-consent-sdk',
                  '#onetrust-banner-sdk',
                  '.onetrust-pc-dark-filter',
                  '#CybotCookiebotDialog',
                  '.cookiebot-dialog',
                  '#cookie-banner',
                  '#cookie-consent',
                  '#cookiebanner',
                ];

                // 特定のセレクターを強制的に削除
                specificSelectors.forEach(selector => {
                  try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                      el.remove();
                    });
                  } catch (e) {
                    // エラーは無視
                  }
                });

                // 一般的なパターンマッチングセレクター
                const patternSelectors = [
                  '[role="dialog"]',
                  '[class*="cookie"]',
                  '[class*="consent"]',
                  '[class*="gdpr"]',
                  '[class*="modal"]',
                  '[class*="popup"]',
                  '[id*="cookie"]',
                  '[id*="consent"]',
                  '[id*="gdpr"]',
                  '[id*="modal"]',
                  '[id*="popup"]',
                ];

                // セレクターに一致する要素を非表示にする
                patternSelectors.forEach(selector => {
                  try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                      const htmlEl = el as HTMLElement;
                      // モーダルやポップアップっぽい要素のみ除外（z-indexが高い、positionがfixed/absoluteなど）
                      const style = window.getComputedStyle(htmlEl);
                      if (
                        style.position === 'fixed' ||
                        style.position === 'absolute' ||
                        parseInt(style.zIndex) > 1000
                      ) {
                        htmlEl.style.display = 'none';
                      }
                    });
                  } catch (e) {
                    // エラーは無視
                  }
                });

                // overlayやbackdropも除外
                const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"], [class*="Overlay"], [class*="Backdrop"]');
                overlays.forEach(el => {
                  const htmlEl = el as HTMLElement;
                  const style = window.getComputedStyle(htmlEl);
                  if (style.position === 'fixed' || style.position === 'absolute') {
                    htmlEl.style.display = 'none';
                  }
                });
              });

              console.log(`[Screenshot] Excluded popups for ${device}`);
            }

            // スクリーンショット取得
            console.log(`[Screenshot] Taking screenshot for ${device}...`);
            const screenshot = await page.screenshot({
              type: 'webp',
              quality: 85,
              fullPage: true,
            });

            console.log(`[Screenshot] Screenshot buffer size for ${device}: ${screenshot.length} bytes`);

            if (!screenshot || screenshot.length === 0) {
              console.error(`[Screenshot] Empty screenshot buffer for ${device}`);
              throw new Error(`スクリーンショットが空です (${device})`);
            }

            // Supabase Storageにアップロード
            const uploadPath = `${project.storage_path}/${device}_${Date.now()}.webp`;
            console.log(`[Screenshot] Uploading ${device} screenshot to ${uploadPath}...`);

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
          }, Promise.resolve());
        }, Promise.resolve());

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