'use client';

import { useState } from 'react';
import { useAuth } from '@/stores/useAuth';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Camera, CheckCircle } from 'lucide-react';

type AuthMode = 'signin' | 'signup';

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const { signIn, signUp, loading, error, successMessage, clearError, clearSuccessMessage } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    clearSuccessMessage();

    // バリデーション
    if (!email || !password) {
      setLocalError('メールアドレスとパスワードを入力してください');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('パスワードが一致しません');
      return;
    }

    if (password.length < 6) {
      setLocalError('パスワードは6文字以上で入力してください');
      return;
    }

    try {
      if (mode === 'signin') {
        console.log('Attempting sign in with:', email);
        await signIn(email, password);
        console.log('Sign in successful');
      } else {
        console.log('Attempting sign up with:', email);
        await signUp(email, password);
        console.log('Sign up successful');

        // サインアップ成功後、ログインモードに切り替え
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      // エラーはuseAuthのstateに保存される
      console.error('Auth error:', err);
      console.error('Error message:', err?.message);
      console.error('Error details:', JSON.stringify(err, null, 2));

      // エラーメッセージを日本語化
      if (err?.code === 'email_not_confirmed') {
        setLocalError('メールアドレスの確認が完了していません。受信したメールから確認リンクをクリックしてください。');
      } else if (err?.message?.includes('Invalid login credentials')) {
        setLocalError('メールアドレスまたはパスワードが正しくありません。');
      } else if (err?.message) {
        setLocalError(err.message);
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setLocalError('');
    clearError();
    clearSuccessMessage();
    setPassword('');
    setConfirmPassword('');
  };

  const displayError = localError || error?.message;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md p-8 rounded-2xl shadow-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="gradient-primary p-3 rounded-xl shadow-lg">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            ScreenCapture SaaS
          </h1>
          <p className="text-gray-700 dark:text-gray-300">
            {mode === 'signin' ? 'アカウントにログイン' : '新規アカウント作成'}
          </p>
        </div>

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mb-6 glass rounded-lg p-4 border-l-4 border-green-500 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-700 dark:text-green-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {displayError && (
          <div className="mb-6 glass rounded-lg p-4 border-l-4 border-red-500 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{displayError}</p>
            </div>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
              メールアドレス
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-700 dark:text-gray-300" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 glass border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="your@email.com"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* パスワード */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
              パスワード
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-700 dark:text-gray-300" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 glass border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="••••••••"
                disabled={loading}
                required
                minLength={6}
              />
            </div>
          </div>

          {/* パスワード確認（サインアップ時のみ） */}
          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                パスワード（確認）
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-700 dark:text-gray-300" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 glass border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 gradient-primary text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>処理中...</span>
              </>
            ) : (
              <>
                {mode === 'signin' ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>ログイン</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>アカウント作成</span>
                  </>
                )}
              </>
            )}
          </button>
        </form>

        {/* モード切り替え */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            disabled={loading}
          >
            {mode === 'signin'
              ? 'アカウントをお持ちでない方はこちら'
              : '既にアカウントをお持ちの方はこちら'}
          </button>
        </div>

        {/* 注意事項 */}
        {mode === 'signup' && (
          <div className="mt-6 glass rounded-lg p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-800 dark:text-gray-200">
              アカウント作成後、確認メールを送信します。
              メール内のリンクをクリックして、アカウントを有効化してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}