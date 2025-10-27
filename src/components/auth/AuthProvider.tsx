'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuth((state) => state.initialize);

  useEffect(() => {
    // 認証状態の初期化とリスナー設定
    const unsubscribe = initialize();

    // クリーンアップ
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initialize]);

  return <>{children}</>;
}