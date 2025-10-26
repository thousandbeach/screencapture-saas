import { create } from 'zustand';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  successMessage: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => (() => void) | undefined;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  successMessage: null,

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
      set({ loading: true, error: null, successMessage: null });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // メール確認後に自動ログイン
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // セッションがある場合のみユーザーをセット（メール確認不要の場合）
      // セッションがない場合は、メール確認待ち
      if (data.session) {
        set({ user: data.user, loading: false });
      } else {
        set({
          user: null,
          loading: false,
          successMessage: 'アカウントを作成しました。確認メールを送信しましたので、メールボックスを確認してリンクをクリックしてください。'
        });
      }
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

  /**
   * 成功メッセージをクリア
   */
  clearSuccessMessage: () => {
    set({ successMessage: null });
  },
}));