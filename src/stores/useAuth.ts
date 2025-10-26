import { create } from 'zustand';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: AuthError | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => void;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  /**
   * メールアドレスとパスワードでログイン
   */
  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({ user: data.user, loading: false });
    } catch (error) {
      set({ error: error as AuthError, loading: false });
      throw error;
    }
  },

  /**
   * 新規ユーザー登録
   */
  signUp: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // メール確認後に自動ログイン
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      set({ user: data.user, loading: false });
    } catch (error) {
      set({ error: error as AuthError, loading: false });
      throw error;
    }
  },

  /**
   * ログアウト
   */
  signOut: async () => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      set({ user: null, loading: false });
    } catch (error) {
      set({ error: error as AuthError, loading: false });
      throw error;
    }
  },

  /**
   * 認証状態の初期化とリスナー設定
   */
  initialize: () => {
    // 現在のセッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        user: session?.user ?? null,
        loading: false
      });
    });

    // 認証状態変更のリスナー設定
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ user: session?.user ?? null });
      }
    );

    // クリーンアップ関数を返す
    return () => subscription.unsubscribe();
  },

  /**
   * エラーをクリア
   */
  clearError: () => {
    set({ error: null });
  },
}));