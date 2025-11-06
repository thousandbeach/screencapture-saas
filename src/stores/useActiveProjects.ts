import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface ActiveProject {
  id: string;
  url: string;
  pageCount: number;
  devices: string[];
  status: 'processing' | 'completed' | 'error';
  progress: number;
  expiresAt: Date;
  downloadCount: number;
}

interface ActiveProjectsState {
  projects: ActiveProject[];
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: (userId: string) => Promise<(() => void) | undefined>;
  fetchProjects: (userId: string) => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
  addProject: (project: ActiveProject) => void;
  updateProject: (id: string, updates: Partial<ActiveProject>) => void;
  removeProject: (id: string) => void;
  reset: () => void;
}

export const useActiveProjects = create<ActiveProjectsState>((set, get) => ({
  projects: [],
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
      console.log('[useActiveProjects] Initializing for user:', userId);

      // データを取得
      await get().fetchProjects(userId);

      // Realtime購読を毎回設定（既存の購読がある場合はクリーンアップされる）
      const unsubscribe = get().subscribeToRealtime(userId);

      // 初回のみ初期化フラグを立てる
      if (!state.isInitialized) {
        set({ isInitialized: true, isLoading: false });
      }

      // クリーンアップ関数を返す
      return unsubscribe;
    } catch (error) {
      console.error('[useActiveProjects] Initialization error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false
      });
    }
  },

  fetchProjects: async (userId: string) => {
    try {
      console.log('[useActiveProjects] Fetching projects for user:', userId);

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('active_projects')
        .select('id, history_id, user_id, status, progress, expires_at, download_count')
        .eq('user_id', userId)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[useActiveProjects] Fetched projects:', data);

      if (data && data.length > 0) {
        // 各プロジェクトのhistory情報を取得
        const projectsWithHistory = await Promise.all(
          data.map(async (project) => {
            const { data: historyData } = await supabase
              .from('capture_history')
              .select('base_url, page_count, metadata')
              .eq('id', project.history_id)
              .single();

            return {
              id: project.id,
              url: historyData?.base_url || 'Unknown',
              pageCount: historyData?.page_count || 0,
              devices: historyData?.metadata?.devices || ['desktop'],
              status: project.status,
              progress: project.progress,
              expiresAt: new Date(project.expires_at),
              downloadCount: project.download_count,
            } as ActiveProject;
          })
        );

        set({ projects: projectsWithHistory });
      } else {
        set({ projects: [] });
      }
    } catch (error) {
      console.error('[useActiveProjects] Fetch error:', error);
      throw error;
    }
  },

  subscribeToRealtime: (userId: string) => {
    console.log('[useActiveProjects] Setting up Realtime subscription for user:', userId);

    const channelName = `active_projects_${userId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_projects',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[useActiveProjects] Realtime event (active_projects):', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as any;

            // セキュリティチェック
            if (newProject.user_id !== userId) {
              console.warn('[useActiveProjects] Ignoring project from different user');
              return;
            }

            // history情報を取得
            const { data: historyData } = await supabase
              .from('capture_history')
              .select('base_url, page_count, metadata')
              .eq('id', newProject.history_id)
              .single();

            const project: ActiveProject = {
              id: newProject.id,
              url: historyData?.base_url || 'Unknown',
              pageCount: historyData?.page_count || 0,
              devices: historyData?.metadata?.devices || ['desktop'],
              status: newProject.status,
              progress: newProject.progress,
              expiresAt: new Date(newProject.expires_at),
              downloadCount: newProject.download_count,
            };

            get().addProject(project);
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new as any;

            // history情報を再取得してpage_countも更新
            const { data: historyData } = await supabase
              .from('capture_history')
              .select('base_url, page_count, metadata')
              .eq('id', updatedProject.history_id)
              .single();

            get().updateProject(updatedProject.id, {
              status: updatedProject.status,
              progress: updatedProject.progress,
              downloadCount: updatedProject.download_count,
              pageCount: historyData?.page_count,
              url: historyData?.base_url,
              devices: historyData?.metadata?.devices,
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedProject = payload.old as any;
            get().removeProject(deletedProject.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useActiveProjects] Subscription status:', status);
      });

    // クリーンアップ関数を返す
    return () => {
      console.log('[useActiveProjects] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  },

  addProject: (project: ActiveProject) => {
    set((state) => {
      // 重複チェック
      if (state.projects.some(p => p.id === project.id)) {
        console.log('[useActiveProjects] Duplicate project detected, ignoring:', project.id);
        return state;
      }
      return {
        projects: [project, ...state.projects],
      };
    });
  },

  updateProject: (id: string, updates: Partial<ActiveProject>) => {
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, ...updates } : project
      ),
    }));
  },

  removeProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
    }));
  },

  reset: () => {
    set({
      projects: [],
      isInitialized: false,
      isLoading: false,
      error: null,
    });
  },
}));
