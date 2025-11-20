import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface CaptureSettings {
  devices: string[];
  maxPages: number;
  allPages: boolean;
  excludePopups: boolean;
  basicAuth?: {
    username: string;
    password: string;
  };
}

export interface FavoriteSite {
  id: string;
  url: string;
  title: string;
  captureCount: number;
  settings?: CaptureSettings;
}

interface FavoritesState {
  favorites: FavoriteSite[];
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: (userId: string) => Promise<(() => void) | undefined>;
  fetchFavorites: (userId: string) => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
  addFavorite: (favorite: FavoriteSite) => void;
  updateFavorite: (id: string, updates: Partial<FavoriteSite>) => void;
  removeFavorite: (id: string) => void;
  reset: () => void;
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  favorites: [],
  isInitialized: false,
  isLoading: false,
  error: null,

  initialize: async (userId: string) => {
    const state = get();

    // 初回のみローディング状態を管理
    if (!state.isInitialized) {
      set({ isLoading: true, error: null });
    }

    try {
      console.log('[useFavorites] Initializing for user:', userId);

      // データを取得
      await get().fetchFavorites(userId);

      // Realtime購読を毎回設定（既存の購読がある場合はクリーンアップされる）
      const unsubscribe = get().subscribeToRealtime(userId);

      // 初回のみ初期化フラグを立てる
      if (!state.isInitialized) {
        set({ isInitialized: true, isLoading: false });
      }

      // クリーンアップ関数を返す
      return unsubscribe;
    } catch (error) {
      console.error('[useFavorites] Initialization error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false
      });
    }
  },

  fetchFavorites: async (userId: string) => {
    try {
      console.log('[useFavorites] Fetching favorites for user:', userId);

      const { data, error } = await supabase
        .from('favorite_sites')
        .select('id, url, title, settings')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[useFavorites] Fetched favorites:', data);

      if (data) {
        // 各お気に入りの使用回数を並行取得
        const favoritesWithCount = await Promise.all(
          data.map(async (item) => {
            const { count } = await supabase
              .from('capture_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('base_url', item.url);

            return {
              id: item.id,
              url: item.url,
              title: item.title || new URL(item.url).hostname,
              captureCount: count || 0,
              settings: item.settings as CaptureSettings | undefined,
            };
          })
        );

        set({ favorites: favoritesWithCount });
      } else {
        set({ favorites: [] });
      }
    } catch (error) {
      console.error('[useFavorites] Fetch error:', error);
      throw error;
    }
  },

  subscribeToRealtime: (userId: string) => {
    console.log('[useFavorites] Setting up Realtime subscription for user:', userId);

    const channelName = `favorites_${userId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      // favorite_sites テーブルの変更を監視
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorite_sites',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useFavorites] favorite_sites event:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newFavorite = payload.new as any;

            // セキュリティチェック
            if (newFavorite.user_id !== userId) {
              console.warn('[useFavorites] Ignoring favorite from different user');
              return;
            }

            // 使用回数を取得
            const { count } = await supabase
              .from('capture_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('base_url', newFavorite.url);

            const favorite: FavoriteSite = {
              id: newFavorite.id,
              url: newFavorite.url,
              title: newFavorite.title || new URL(newFavorite.url).hostname,
              captureCount: count || 0,
              settings: newFavorite.settings as CaptureSettings | undefined,
            };

            get().addFavorite(favorite);
          } else if (payload.eventType === 'UPDATE') {
            const updatedFavorite = payload.new as any;

            get().updateFavorite(updatedFavorite.id, {
              title: updatedFavorite.title,
              settings: updatedFavorite.settings as CaptureSettings | undefined,
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedFavorite = payload.old as any;
            get().removeFavorite(deletedFavorite.id);
          }
        }
      )
      // capture_history テーブルの変更を監視（取得回数の更新用）
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'capture_history',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useFavorites] capture_history INSERT event:', payload);

          const newCapture = payload.new as any;
          const capturedUrl = newCapture.base_url;

          // このURLがお気に入りに登録されているか確認
          const state = get();
          const favorite = state.favorites.find(f => f.url === capturedUrl);

          if (favorite) {
            console.log('[useFavorites] Updating capture count for:', capturedUrl);
            // データベースから最新の取得回数を再取得
            const { count } = await supabase
              .from('capture_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('base_url', capturedUrl);

            // 取得回数を更新
            get().updateFavorite(favorite.id, {
              captureCount: count || 0,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useFavorites] Subscription status:', status);
      });

    // クリーンアップ関数を返す
    return () => {
      console.log('[useFavorites] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  },

  addFavorite: (favorite: FavoriteSite) => {
    set((state) => {
      // 重複チェック
      if (state.favorites.some(f => f.id === favorite.id)) {
        console.log('[useFavorites] Duplicate favorite detected, ignoring:', favorite.id);
        return state;
      }
      return {
        favorites: [favorite, ...state.favorites],
      };
    });
  },

  updateFavorite: (id: string, updates: Partial<FavoriteSite>) => {
    set((state) => ({
      favorites: state.favorites.map((favorite) =>
        favorite.id === id ? { ...favorite, ...updates } : favorite
      ),
    }));
  },

  removeFavorite: (id: string) => {
    set((state) => ({
      favorites: state.favorites.filter((favorite) => favorite.id !== id),
    }));
  },

  reset: () => {
    set({
      favorites: [],
      isInitialized: false,
      isLoading: false,
      error: null,
    });
  },
}));
