import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface CaptureSettings {
  devices: string[];
  maxPages: number;
  allPages: boolean;
  excludePopups: boolean;
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

    // 既に初期化済みの場合はスキップ
    if (state.isInitialized) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await get().fetchFavorites(userId);

      // Realtime購読を開始
      const unsubscribe = get().subscribeToRealtime(userId);

      set({ isInitialized: true, isLoading: false });

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

    const channel = supabase
      .channel('favorites_global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorite_sites',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useFavorites] Realtime event:', payload.eventType, payload);

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
    set((state) => ({
      favorites: [favorite, ...state.favorites],
    }));
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
