'use client';

import { useState, useEffect } from 'react';

/**
 * Preview環境用の認証コンポーネント
 *
 * Vercel環境（本番・プレビュー）でBasic認証ダイアログを表示します。
 * ローカル開発環境では認証をスキップします。
 *
 * 環境変数:
 * - NEXT_PUBLIC_PREVIEW_PASSWORD: Basic認証のパスワード
 */
export function PreviewAuth({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[PreviewAuth] NODE_ENV:', process.env.NODE_ENV);
    console.log('[PreviewAuth] Has NEXT_PUBLIC_PREVIEW_PASSWORD:', !!process.env.NEXT_PUBLIC_PREVIEW_PASSWORD);

    // ローカル開発環境のみ認証をスキップ
    if (process.env.NODE_ENV === 'development') {
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // セッションストレージから認証状態をチェック
    const authStatus = sessionStorage.getItem('preview-auth');
    if (authStatus === 'verified') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 認証チェック（ハードコード）
    if (username === 'preview' && password === 'MySecurePass123!') {
      // 認証成功
      sessionStorage.setItem('preview-auth', 'verified');
      setIsAuthenticated(true);
    } else {
      // 認証失敗
      setError('ユーザー名またはパスワードが正しくありません');
      setPassword('');
    }
  };

  // ローディング中
  if (isLoading) {
    return null;
  }

  // 認証済み or ローカル開発環境
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 認証画面を表示
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          Preview Authentication
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
              }}
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '4px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}