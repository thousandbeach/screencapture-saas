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

  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      // ユーザー名: preview、パスワード: 環境変数
      if (user === 'preview' && pwd === process.env.PREVIEW_PASSWORD) {
        return NextResponse.next();
      }
    } catch (error) {
      // Base64デコードエラーの場合は認証失敗として扱う
      console.error('Basic auth parsing error:', error);
    }
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