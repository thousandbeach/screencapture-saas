'use client';

import { useAuth } from '@/stores/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const { user, loading } = useAuth();

  // 認証状態の初期化中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合はログインフォーム表示
  if (!user) {
    return <AuthForm />;
  }

  // 認証済みの場合はDashboard表示
  return <Dashboard />;
}