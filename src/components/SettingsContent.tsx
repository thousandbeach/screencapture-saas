'use client';

import { useState } from 'react';
import {
  User, Bell, Palette,
  Mail, Key, Moon, Sun, Check
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useDarkMode } from '@/stores/useDarkMode';
import { supabase } from '@/lib/supabase';

interface SettingsContentProps {
  user: SupabaseUser;
}

export function SettingsContent({ user }: SettingsContentProps) {
  const { darkMode, toggleDarkMode } = useDarkMode();

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Notifications (placeholder for future implementation)
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      // 現在のメールアドレスと同じかチェック
      if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
        setEmailError('現在と同じメールアドレスです');
        setEmailLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) {
        // Supabaseのエラーメッセージを判定
        if (error.message.includes('already') || error.message.includes('exists')) {
          throw new Error('このメールアドレスは既に使用されています');
        }
        throw error;
      }

      setEmailSuccess('確認メールを送信しました。メールボックスを確認してください。');
      setNewEmail('');
    } catch (error: any) {
      setEmailError(error.message || 'メールアドレスの変更に失敗しました');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('パスワードは6文字以上である必要があります');
      setPasswordLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess('パスワードを変更しました');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'パスワードの変更に失敗しました');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <h1 className={`text-3xl font-bold mb-8 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        設定
      </h1>

      {/* Account Settings */}
      <section className="glass-strong rounded-xl shadow-xl p-6 mb-6">
        <h2 className={`text-xl font-semibold mb-4 flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          <User className="h-5 w-5 mr-2 text-blue-600" />
          アカウント設定
        </h2>

        {/* Current Email Display */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            現在のメールアドレス
          </label>
          <div className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
            {user.email}
          </div>
        </div>

        {/* Email Change Form */}
        <form onSubmit={handleEmailChange} className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className={`text-lg font-medium mb-4 flex items-center ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            <Mail className="h-4 w-4 mr-2" />
            メールアドレスの変更
          </h3>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                新しいメールアドレス
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="new-email@example.com"
              />
            </div>

            {emailSuccess && (
              <div className="flex items-center p-3 rounded-lg bg-green-100 text-green-800 text-sm">
                <Check className="h-4 w-4 mr-2" />
                {emailSuccess}
              </div>
            )}

            {emailError && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">
                {emailError}
              </div>
            )}

            <button
              type="submit"
              disabled={emailLoading || !newEmail}
              className={`px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg transition-all ${
                (emailLoading || !newEmail) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {emailLoading ? '変更中...' : 'メールアドレスを変更'}
            </button>
          </div>
        </form>

        {/* Password Change Form */}
        <form onSubmit={handlePasswordChange}>
          <h3 className={`text-lg font-medium mb-4 flex items-center ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            <Key className="h-4 w-4 mr-2" />
            パスワードの変更
          </h3>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                新しいパスワード
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="6文字以上"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="パスワードを再入力"
              />
            </div>

            {passwordSuccess && (
              <div className="flex items-center p-3 rounded-lg bg-green-100 text-green-800 text-sm">
                <Check className="h-4 w-4 mr-2" />
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className={`px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg transition-all ${
                (passwordLoading || !newPassword || !confirmPassword) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {passwordLoading ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>
        </form>
      </section>

      {/* Notification Settings */}
      <section className="glass-strong rounded-xl shadow-xl p-6 mb-6">
        <h2 className={`text-xl font-semibold mb-4 flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          <Bell className="h-5 w-5 mr-2 text-blue-600" />
          通知設定
        </h2>
        <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          通知機能は今後実装予定です
        </p>
        <div className="space-y-4 opacity-50 pointer-events-none">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-300 dark:border-gray-600">
            <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              ブラウザ通知
            </span>
            <input
              type="checkbox"
              checked={browserNotifications}
              onChange={(e) => setBrowserNotifications(e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded"
              disabled
            />
          </label>
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-300 dark:border-gray-600">
            <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              メール通知
            </span>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded"
              disabled
            />
          </label>
        </div>
      </section>

      {/* Display Settings */}
      <section className="glass-strong rounded-xl shadow-xl p-6">
        <h2 className={`text-xl font-semibold mb-4 flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          <Palette className="h-5 w-5 mr-2 text-blue-600" />
          表示設定
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center">
              {darkMode ? <Moon className="h-5 w-5 mr-3 text-blue-500" /> : <Sun className="h-5 w-5 mr-3 text-yellow-500" />}
              <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                ダークモード
              </span>
            </div>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={toggleDarkMode}
              className="h-5 w-5 text-blue-600 rounded"
            />
          </label>
        </div>
      </section>
    </>
  );
}