import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全環境Basic認証Middleware
 *
 * Vercel上のすべての環境（本番・プレビュー）でBasic認証を適用します。
 * ローカル開発環境のみ認証をスキップします。
 *
 * 環境変数:
 * - PREVIEW_PASSWORD: Basic認証のパスワード（Vercel環境変数で設定）
 *
 * 保護対象:
 * - production: Basic認証あり ✅
 * - preview (dev, feature/*): Basic認証あり ✅
 * - development (ローカル): 認証なし
 */
export function middleware(request: NextRequest) {
  // ローカル開発環境のみ認証をスキップ
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Vercel上のすべての環境（本番・プレビュー）でBasic認証を適用
  const basicAuth = request.headers.get('authorization');

  // デバッグログ
  console.log('[Middleware] Environment:', process.env.NODE_ENV);
  console.log('[Middleware] Has PREVIEW_PASSWORD:', !!process.env.PREVIEW_PASSWORD);
  console.log('[Middleware] Has authorization header:', !!basicAuth);

  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      console.log('[Middleware] Received user:', user);
      console.log('[Middleware] Password length:', pwd?.length);
      console.log('[Middleware] Expected password length:', process.env.PREVIEW_PASSWORD?.length);
      console.log('[Middleware] Passwords match:', pwd === process.env.PREVIEW_PASSWORD);

      // ユーザー名: preview、パスワード: 環境変数
      if (user === 'preview' && pwd === process.env.PREVIEW_PASSWORD) {
        console.log('[Middleware] Authentication successful');
        return NextResponse.next();
      } else {
        console.log('[Middleware] Authentication failed - credentials mismatch');
      }
    } catch (error) {
      // Base64デコードエラーの場合は認証失敗として扱う
      console.error('[Middleware] Basic auth parsing error:', error);
    }
  } else {
    console.log('[Middleware] No authorization header provided');
  }

  // 認証失敗: 401レスポンスを返す
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area", charset="UTF-8"',
    },
  });
}

/**
 * Middlewareを適用するパスの設定
 *
 * すべてのパスに適用（/_next/static、/_next/image、/favicon.icoは除外）
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};