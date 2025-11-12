const express = require('express');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const JSZip = require('jszip');

const app = express();
app.use(express.json());

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS設定（Vercelからのリクエストのみ許可）
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // 許可するオリジンのパターン
  const isAllowedOrigin =
    // ローカル開発環境
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:3001' ||
    // Vercel本番・プレビュー（.vercel.app ドメイン）
    (origin && origin.endsWith('.vercel.app')) ||
    // 環境変数で指定されたURL（httpsプレフィックス付き）
    (process.env.VERCEL_URL && (
      origin === process.env.VERCEL_URL ||
      origin === `https://${process.env.VERCEL_URL}` ||
      origin === `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
    ));

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// 認証ミドルウェア
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// スクリーンショット取得API
app.post('/api/capture', authenticate, async (req, res) => {
  const { projectId, urls, options } = req.body;
  const userId = req.user.id;

  console.log('[Capture] Starting capture for project:', projectId);

  let browser;

  try {
    // Puppeteer起動
    console.log('[Capture] Launching browser...');

    // Cloud Run環境では /usr/bin/chromium を使用、ローカルではPuppeteerのデフォルトを使用
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    // Cloud Run環境かどうかを判定（環境変数 K_SERVICE が設定されている）
    if (process.env.K_SERVICE) {
      launchOptions.executablePath = '/usr/bin/chromium';
      console.log('[Capture] Using Cloud Run Chromium: /usr/bin/chromium');
    } else {
      console.log('[Capture] Using Puppeteer default Chrome');
    }

    browser = await puppeteer.launch(launchOptions);

    console.log('[Capture] Browser launched successfully');

    const devices = options.devices || ['desktop'];
    const totalScreenshots = urls.length * devices.length;
    let completedScreenshots = 0;

    // ファイルマッピング情報
    const fileMapping = [];

    // 各URLについて、各デバイスでスクリーンショット取得
    let pageIndex = 0;

    for (const pageUrl of urls) {
      pageIndex++;

      for (const device of devices) {
        console.log(`[Capture] Processing: ${pageUrl} (${device})`);

        console.log(`[Capture] Creating new page...`);
        const page = await browser.newPage();

        // デバイス設定
        const viewports = {
          desktop: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
          tablet: { width: 1024, height: 768, isMobile: true, hasTouch: true },
          mobile: { width: 480, height: 800, isMobile: true, hasTouch: true }
        };

        console.log(`[Capture] Setting viewport for ${device}...`);
        await page.setViewport(viewports[device]);

        // ページ読み込み
        console.log(`[Capture] Navigating to ${pageUrl}...`);
        await page.goto(pageUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        console.log(`[Capture] Page loaded successfully`);

        // スクリーンショット取得
        console.log(`[Capture] Taking screenshot...`);
        const screenshot = await page.screenshot({
          type: 'webp',
          quality: 85,
          fullPage: true
        });
        console.log(`[Capture] Screenshot captured (${screenshot.byteLength} bytes)`);

        // Supabase Storageにアップロード
        const filename = `${device}_${Date.now()}.webp`;
        const uploadPath = `${userId}/${projectId}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(uploadPath, screenshot, {
            contentType: 'image/webp'
          });

        if (uploadError) {
          console.error('[Capture] Upload error:', uploadError);
          throw uploadError;
        }

        // ファイルマッピング情報を保存
        fileMapping.push({
          filename,
          url: pageUrl,
          device,
          pageIndex
        });

        console.log(`[Capture] Uploaded: ${uploadPath}`);

        await page.close();

        // プログレス更新
        completedScreenshots++;
        const progress = Math.round((completedScreenshots / totalScreenshots) * 100);

        await supabase
          .from('active_projects')
          .update({ progress })
          .eq('id', projectId);
      }
    }

    // 完了ステータスに更新
    await supabase
      .from('active_projects')
      .update({
        status: 'completed',
        progress: 100,
        file_mapping: fileMapping
      })
      .eq('id', projectId);

    console.log('[Capture] Completed successfully');

    res.json({
      success: true,
      projectId,
      screenshotCount: completedScreenshots
    });

  } catch (error) {
    console.error('[Capture] Error:', error);

    // エラーステータスに更新
    await supabase
      .from('active_projects')
      .update({
        status: 'error',
        error_message: error.message
      })
      .eq('id', projectId);

    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// ダウンロードAPI
app.get('/api/download', authenticate, async (req, res) => {
  const { project_id } = req.query;
  const userId = req.user.id;

  try {
    // プロジェクト情報取得
    const { data: project, error } = await supabase
      .from('active_projects')
      .select('*, capture_history(*)')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ストレージから画像一覧取得
    const { data: files } = await supabase.storage
      .from('screenshots')
      .list(`${userId}/${project_id}`);

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No files found' });
    }

    // ZIPファイル作成
    const zip = new JSZip();

    for (const file of files) {
      const { data: fileData } = await supabase.storage
        .from('screenshots')
        .download(`${userId}/${project_id}/${file.name}`);

      if (fileData) {
        zip.file(file.name, fileData);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // ダウンロードカウント更新
    await supabase
      .from('active_projects')
      .update({ download_count: project.download_count + 1 })
      .eq('id', project_id);

    // ZIPファイルを返す
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="screenshots_${project_id}.zip"`);
    res.send(zipBuffer);

  } catch (error) {
    console.error('[Download] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// キャンセルAPI
app.put('/api/cancel', authenticate, async (req, res) => {
  const { project_id } = req.query;
  const userId = req.user.id;

  try {
    // プロジェクト存在確認
    const { data: project, error: fetchError } = await supabase
      .from('active_projects')
      .select('id, status')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'processing') {
      return res.status(400).json({ error: 'Project is not processing' });
    }

    // ステータスをcancelledに更新
    const { error: updateError } = await supabase
      .from('active_projects')
      .update({ status: 'cancelled' })
      .eq('id', project_id);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Project cancelled' });

  } catch (error) {
    console.error('[Cancel] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`[Server] Cloud Run API listening on port ${port}`);
});