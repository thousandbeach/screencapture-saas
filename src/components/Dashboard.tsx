'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, Download, Star, Globe, Play, RefreshCw, Plus,
  Settings, Search, Bell, Database, FileImage, TrendingUp,
  Loader2, AlertTriangle, Info, X, Camera, Menu,
  LayoutDashboard, History, Moon, Sun, LogOut
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { useDarkMode } from '@/stores/useDarkMode';
import { useAuth } from '@/stores/useAuth';
import { useActiveProjects } from '@/stores/useActiveProjects';
import { useFavorites } from '@/stores/useFavorites';
import type { ActiveProject } from '@/stores/useActiveProjects';
import type { FavoriteSite, CaptureSettings } from '@/stores/useFavorites';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { shallow } from 'zustand/shallow';

// Types
interface HistoryItem {
  id: string;
  url: string;
  pageCount: number;
  capturedAt: Date;
}

// Utility functions
const getTimeLeft = (expiresAt: Date) => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours;
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const validateUrl = (urlString: string): boolean => {
  // URLの正規表現パターン: http(s)://で始まり、ドメイン名を含む
  const urlPattern = /^https?:\/\/([\w-]+(\.[\w-]+)+|localhost)(:\d+)?(\/.*)?$/i;
  return urlPattern.test(urlString);
};

// Main Dashboard Component
const Dashboard: React.FC = () => {
  // Zustand stores - セレクタ関数を使用して各プロパティを個別に監視
  const activeProjects = useActiveProjects(state => state.projects);
  const initializeProjects = useActiveProjects(state => state.initialize);
  const favorites = useFavorites(state => state.favorites);
  const initializeFavorites = useFavorites(state => state.initialize);

  console.log('[Dashboard RENDER] activeProjects:', activeProjects.length, 'favorites:', favorites.length);

  // Log Zustand store data whenever it changes (for debugging)
  useEffect(() => {
    console.log('[Dashboard] activeProjects from Zustand:', activeProjects);
  }, [activeProjects]);

  useEffect(() => {
    console.log('[Dashboard] favorites from Zustand:', favorites);
  }, [favorites]);

  // Local state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({
    monthlyCaptures: 0,
    totalPages: 0,
    favoritesCount: 0,
    storageUsage: 0,
  });

  // Log stats whenever it changes (for debugging)
  useEffect(() => {
    console.log('[Stats] Current stats state:', stats);
  }, [stats]);

  const [url, setUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [captureSettings, setCaptureSettings] = useState<CaptureSettings>({
    devices: ['desktop'],
    maxPages: 1,
    allPages: false,
    excludePopups: true, // デフォルトでポップアップを除外
  });
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Initialize Zustand stores
  useEffect(() => {
    if (!user) return;

    console.log('[Dashboard] INIT useEffect triggered');

    let cleanupProjects: (() => void) | undefined;
    let cleanupFavorites: (() => void) | undefined;

    // 非同期で初期化してクリーンアップ関数を取得
    const initStores = async () => {
      cleanupProjects = await initializeProjects(user.id);
      cleanupFavorites = await initializeFavorites(user.id);
    };

    initStores();

    // クリーンアップ関数を返す
    return () => {
      console.log('[Dashboard] INIT Cleaning up Zustand stores');
      if (cleanupProjects) cleanupProjects();
      if (cleanupFavorites) cleanupFavorites();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // user.id のみに依存（initializeProjects/Favoritesは安定している）

  // 取得履歴をロード
  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      console.log('[History] Fetching history for user:', user.id, 'limit:', historyLimit, 'search:', searchQuery);

      // クエリ構築
      let query = supabase
        .from('capture_history')
        .select('id, base_url, page_count, created_at')
        .eq('user_id', user.id);

      // 検索フィルター適用
      if (searchQuery) {
        query = query.ilike('base_url', `%${searchQuery}%`);
      }

      const { data, error} = await query
        .order('created_at', { ascending: false })
        .limit(historyLimit);

      if (error) {
        console.error('[History] Error fetching history:', error);
        console.error('[History] Error details:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        return;
      }

      console.log('[History] Fetched history data:', data);

      if (data) {
        setHistory(
          data.map((item) => ({
            id: item.id,
            url: item.base_url,
            pageCount: item.page_count,
            capturedAt: new Date(item.created_at),
          }))
        );

        // 取得したデータ数がlimit未満なら、これ以上データがない
        setHasMoreHistory(data.length >= historyLimit);
      }
    };

    fetchHistory();

    // Realtime購読で履歴の更新を監視
    const channelName = `history_changes_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'capture_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[History] New capture detected:', payload);
          console.log('[History] Refetching history...');
          fetchHistory();
        }
      )
      .subscribe((status) => {
        console.log('[History] Realtime subscription status:', status);
      });

    return () => {
      console.log('[History] Cleaning up history subscription');
      supabase.removeChannel(channel);
    };
  }, [user, historyLimit, searchQuery]);

  // 統計データをロード
  useEffect(() => {
    if (!user) return;

    console.log('[Stats] useEffect triggered for user:', user.id);

    const fetchStats = async () => {
      console.log('[Stats] fetchStats called');

      // 今月の取得回数
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyCount } = await supabase
        .from('capture_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      // 総ページ数
      const { data: historyData } = await supabase
        .from('capture_history')
        .select('page_count')
        .eq('user_id', user.id);

      const totalPages = historyData?.reduce((sum, item) => sum + (item.page_count || 0), 0) || 0;

      // お気に入り数は既に取得済みのfavorites変数から取得
      const newStats = {
        monthlyCaptures: monthlyCount || 0,
        totalPages: totalPages,
        favoritesCount: favorites.length,
        storageUsage: 0, // TODO: ストレージ使用率は後で実装
      };

      console.log('[Stats] Calculated stats:', newStats);
      console.log('[Stats] Setting stats state...');

      setStats(newStats);

      console.log('[Stats] setStats called with:', newStats);
    };

    fetchStats();

    // Realtime購読で統計データを自動更新
    const channel = supabase
      .channel(`stats_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'capture_history',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('[Stats] New capture detected, refetching stats...');
          fetchStats();
        }
      )
      .subscribe((status) => {
        console.log('[Stats] Realtime subscription status:', status);
      });

    return () => {
      console.log('[Stats] Cleaning up stats subscription');
      supabase.removeChannel(channel);
    };
  }, [user, favorites]); // favorites変更時も統計を再計算

  const handleCapture = async () => {
    if (!url || isCapturing) return;

    try {
      setIsCapturing(true);

      // URLバリデーション
      if (!validateUrl(url)) {
        alert('有効なURLを入力してください（http://またはhttps://で始まる完全なURLが必要です）');
        return;
      }

      // トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      // API呼び出し
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url,
          options: {
            devices: captureSettings.devices,
            max_pages: captureSettings.allPages ? 300 : captureSettings.maxPages,
            all_pages: captureSettings.allPages,
            exclude_popups: captureSettings.excludePopups,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'スクリーンショット取得に失敗しました');
      }

      // 成功 - Realtimeが自動的にプロジェクトを追加するのを待つ
      console.log('[Capture] Screenshot request successful, project_id:', data.project_id);
      alert('スクリーンショット取得を開始しました！\nリアルタイムで進捗が更新されます。');
      setUrl(''); // URLクリア

    } catch (error) {
      console.error('Capture error:', error);
      alert(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCapture();
    }
  };

  const handleRecapture = async (historyId: string) => {
    try {
      console.log('[Recapture] Starting recapture for history:', historyId);

      // 履歴データを取得
      const { data: historyData, error: historyError } = await supabase
        .from('capture_history')
        .select('base_url, metadata')
        .eq('id', historyId)
        .single();

      if (historyError || !historyData) {
        console.error('[Recapture] Error fetching history:', historyError);
        alert('履歴データの取得に失敗しました');
        return;
      }

      console.log('[Recapture] History data:', historyData);

      // URLバリデーション
      if (!validateUrl(historyData.base_url)) {
        alert('履歴に保存されているURLが不正です');
        return;
      }

      // 元の設定を取得
      const metadata = historyData.metadata as any;
      const devices = metadata?.devices || ['desktop'];
      const maxPages = metadata?.max_pages || 1;
      const allPages = metadata?.all_pages || false;
      const excludePopups = metadata?.exclude_popups !== false; // デフォルトtrue

      // トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      // API呼び出し
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url: historyData.base_url,
          options: {
            devices: devices,
            max_pages: maxPages,
            all_pages: allPages,
            exclude_popups: excludePopups,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'スクリーンショット取得に失敗しました');
      }

      // 成功
      console.log('[Recapture] Screenshot request successful, project_id:', data.project_id);
      alert('スクリーンショット再取得を開始しました！\nリアルタイムで進捗が更新されます。');

    } catch (error) {
      console.error('[Recapture] Error:', error);
      alert(error instanceof Error ? error.message : '再取得に失敗しました');
    }
  };

  const handleFavoriteClick = async (favoriteId: string) => {
    const favorite = favorites.find(f => f.id === favoriteId);
    if (!favorite) return;

    // お気に入りの設定を現在のフォームに適用
    setUrl(favorite.url);
    if (favorite.settings) {
      setCaptureSettings({
        devices: favorite.settings.devices,
        maxPages: favorite.settings.maxPages,
        allPages: favorite.settings.allPages,
        excludePopups: favorite.settings.excludePopups,
      });
    }
  };

  const handleAddToFavorites = async (targetUrl?: string) => {
    const urlToAdd = targetUrl || url;

    if (!user || !urlToAdd) {
      alert('URLを入力してください');
      return;
    }

    // URLバリデーション
    if (!validateUrl(urlToAdd)) {
      alert('有効なURLを入力してください（http://またはhttps://で始まる完全なURLが必要です）');
      return;
    }

    // サーバー側で既に登録されているかチェック
    const { data: existingFavorites, error: checkError } = await supabase
      .from('favorite_sites')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', urlToAdd)
      .maybeSingle();

    if (checkError) {
      console.error('[Favorites] Error checking existing favorite:', checkError);
      alert('お気に入りの確認に失敗しました');
      return;
    }

    if (existingFavorites) {
      console.log('[Favorites] URL already exists in favorites:', urlToAdd);
      alert('このURLは既にお気に入りに登録されています');
      return;
    }

    const customName = prompt('お気に入りの名前を入力（空欄でURLを使用）:');
    if (customName === null) return; // キャンセル

    const { error } = await supabase
      .from('favorite_sites')
      .insert({
        user_id: user.id,
        url: urlToAdd,
        title: customName || null,
        settings: {
          devices: captureSettings.devices,
          maxPages: captureSettings.maxPages,
          allPages: captureSettings.allPages,
          excludePopups: captureSettings.excludePopups,
        },
      });

    if (error) {
      console.error('[Favorites] Error adding favorite:', error);
      alert('お気に入りの追加に失敗しました');
      return;
    }

    alert('お気に入りに追加しました');
    // Realtimeで自動的にリストが更新されるため、手動での再取得は不要
  };

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData('text/plain', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const droppedUrl = e.dataTransfer.getData('text/plain');
    if (droppedUrl) {
      await handleAddToFavorites(droppedUrl);
    }
  };

  // URL入力欄へのドロップハンドラー
  const handleDropOnUrlInput = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedUrl = e.dataTransfer.getData('text/plain');
    if (droppedUrl) {
      // 既存のURLを置き換え（現在は単一URL仕様）
      setUrl(droppedUrl);
    }
  };

  const handleDragOverUrlInput = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDownload = async (projectId: string) => {
    try {
      // トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      // ダウンロードAPI呼び出し
      const response = await fetch(`/api/download?project_id=${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ダウンロードに失敗しました');
      }

      // Blobとしてダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshots_${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // ダウンロード回数を更新（Realtimeで自動更新される）
      console.log('[Download] Successfully downloaded project:', projectId);
    } catch (error) {
      console.error('Download error:', error);
      alert(error instanceof Error ? error.message : 'ダウンロードに失敗しました');
    }
  };

  const handleCancel = async (projectId: string) => {
    if (!confirm('キャプチャを中断しますか？\n処理を中止しますが、既に取得した画像は保持されます。')) {
      return;
    }

    try {
      // トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      // キャンセルAPI呼び出し
      const response = await fetch(`/api/cancel?project_id=${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'キャンセルに失敗しました');
      }

      console.log('[Cancel] Successfully cancelled project:', projectId);
    } catch (error) {
      console.error('Cancel error:', error);
      alert(error instanceof Error ? error.message : 'キャンセルに失敗しました');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onCloseAction={() => setSidebarOpen(false)}
        darkMode={darkMode}
        activeProjectsCount={activeProjects.filter(p => p.status === 'completed').length}
        favoritesCount={favorites.length}
        user={user}
      />

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}
      >
        {/* Header */}
        <header className="glass-strong sticky top-0 z-30 shadow-lg">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                {/* Hamburger Menu Button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-gray-500 hover:text-gray-700 lg:hidden"
                >
                  <Menu className="h-6 w-6" />
                </button>

                {/* Desktop Sidebar Toggle */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden lg:block text-gray-500 hover:text-gray-700"
                >
                  <Menu className="h-6 w-6" />
                </button>

                <div className="flex items-center space-x-2 lg:hidden">
                  <Camera className="h-6 w-6 text-blue-600" />
                  <h1 className="text-xl font-bold">ScreenCapture</h1>
                </div>

                <span className="hidden md:inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                  完全無料版
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleDarkMode}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <button className={darkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-500 hover:text-gray-700'}>
                  <Bell className="h-5 w-5" />
                </button>
                <div className="hidden sm:flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {user?.email || 'user@example.com'}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="ログアウト"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Action Bar */}
        <div className="glass-strong rounded-xl shadow-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                URLを入力してスクリーンショットを取得
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onDragOver={handleDragOverUrlInput}
                  onDrop={handleDropOnUrlInput}
                  placeholder="https://example.com"
                  className={`flex-1 px-3 py-2 glass rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 ${
                    darkMode ? 'text-gray-100 border-gray-600' : 'text-gray-900 border-gray-300'
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCapture}
                    disabled={isCapturing || !url}
                    className={`flex-1 sm:flex-initial px-4 py-2 gradient-primary text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center ${
                      (isCapturing || !url) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isCapturing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        処理中...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        取得開始
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className={`px-3 py-2 rounded-lg transition-all flex items-center justify-center ${
                      darkMode
                        ? 'bg-gray-700/70 text-gray-100 hover:bg-gray-600/70 border border-gray-600'
                        : 'bg-white/70 text-gray-900 hover:bg-white/90 border border-gray-300'
                    }`}
                  >
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">詳細設定</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="今月の取得回数"
            value={stats.monthlyCaptures.toLocaleString()}
            icon={<TrendingUp />}
            color="blue"
            darkMode={darkMode}
          />
          <StatsCard
            title="総ページ数"
            value={stats.totalPages.toLocaleString()}
            icon={<FileImage />}
            color="green"
            darkMode={darkMode}
          />
          <StatsCard
            title="お気に入り"
            value={stats.favoritesCount.toString()}
            icon={<Star />}
            color="yellow"
            darkMode={darkMode}
          />
          <StatsCard
            title="ストレージ使用率"
            value={`${stats.storageUsage}%`}
            icon={<Database />}
            color="purple"
            darkMode={darkMode}
          />
        </div>

        {/* 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Projects */}
          <div className="glass-strong rounded-xl shadow-xl">
            <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-white/20'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  <Download className="h-5 w-5 mr-2 text-blue-600" />
                  ダウンロード可能
                </h2>
                <span className="text-xs gradient-secondary text-white px-2 py-1 rounded-full">
                  最大48時間
                </span>
              </div>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>取得済みのプロジェクト</p>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {activeProjects.map((project) => (
                <ActiveProjectCard
                  key={project.id}
                  project={project}
                  onDownload={handleDownload}
                  onCancel={handleCancel}
                  darkMode={darkMode}
                />
              ))}
            </div>
          </div>

          {/* Favorites */}
          <div className="glass-strong rounded-xl shadow-xl">
            <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-white/20'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  <Star className="h-5 w-5 mr-2 text-yellow-500" />
                  お気に入り
                </h2>
                <button
                  onClick={() => handleAddToFavorites()}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>よく使うサイト</p>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {favorites.map((favorite) => (
                <FavoriteCard
                  key={favorite.id}
                  favorite={favorite}
                  onClick={handleFavoriteClick}
                  darkMode={darkMode}
                />
              ))}
              <button
                onClick={() => handleAddToFavorites()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full p-3 rounded-lg border-2 border-dashed transition-colors ${
                isDraggingOver
                  ? 'border-blue-500 bg-blue-100/20 scale-105'
                  : darkMode
                  ? 'border-gray-600 hover:border-blue-400 hover:bg-gray-800/50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <div className={`text-center ${isDraggingOver ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Plus className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">{isDraggingOver ? 'ドロップして追加' : 'お気に入りを追加'}</p>
                </div>
              </button>
            </div>
          </div>

          {/* History */}
          <div className="glass-strong rounded-xl shadow-xl">
            <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-white/20'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  <Clock className="h-5 w-5 mr-2 text-blue-600" />
                  取得履歴
                </h2>
                <button
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>過去のキャプチャ（永続保存）</p>

              {/* Search Input */}
              {isSearchVisible && (
                <div className="mt-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setHistoryLimit(10); // 検索時は最初の10件にリセット
                      }}
                      placeholder="URLで検索..."
                      className={`w-full px-3 py-2 pl-9 glass rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-sm ${
                        darkMode ? 'text-gray-100 border-gray-600' : 'text-gray-900 border-gray-300'
                      }`}
                    />
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200/50 ${
                          darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {history.length === 0 && searchQuery ? (
                <div className="text-center py-8">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    検索結果が見つかりませんでした
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <HistoryCard
                    key={item.id}
                    item={item}
                    onRecapture={handleRecapture}
                    onDragStart={handleDragStart}
                    darkMode={darkMode}
                  />
                ))
              )}
              {hasMoreHistory && (
                <button
                  onClick={() => setHistoryLimit(prev => prev + 10)}
                  className={`w-full mt-4 p-2 text-sm text-blue-600 rounded transition-colors ${
                    darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-blue-50'
                  }`}
                >
                  もっと見る
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <AlertBanner darkMode={darkMode} />
      </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={captureSettings}
        onSave={setCaptureSettings}
        darkMode={darkMode}
      />
    </div>
  );
};

// Component: Stats Card
const StatsCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  darkMode: boolean;
}> = ({ title, value, icon, color, darkMode }) => {
  const colorMap: Record<string, { gradient: string; text: string }> = {
    blue: { gradient: 'gradient-primary', text: 'text-white' },
    green: { gradient: 'bg-gradient-to-br from-green-400 to-emerald-600', text: 'text-white' },
    yellow: { gradient: 'bg-gradient-to-br from-yellow-400 to-orange-500', text: 'text-white' },
    purple: { gradient: 'bg-gradient-to-br from-purple-500 to-indigo-600', text: 'text-white' },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="glass-strong rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{value}</p>
        </div>
        <div className={`${colors.gradient} p-3 rounded-lg shadow-md`}>
          <div className={colors.text}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

// Component: Active Project Card
const ActiveProjectCard: React.FC<{
  project: ActiveProject;
  onDownload: (id: string) => void;
  onCancel: (id: string) => void;
  darkMode: boolean;
}> = ({ project, onDownload, onCancel, darkMode }) => {
  const timeLeft = getTimeLeft(project.expiresAt);
  const isUrgent = timeLeft <= 2;
  const isWarning = timeLeft <= 6;

  return (
    <div className={`glass rounded-lg p-3 transition-all ${
      darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-200/40'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{project.url}</p>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {project.pageCount}ページ • {project.devices.length}デバイス
          </p>
        </div>
        {project.status === 'completed' && (
          <span className="text-xs bg-gradient-to-r from-green-400 to-emerald-500 text-white px-2 py-1 rounded">完了</span>
        )}
        {project.status === 'processing' && (
          <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded animate-pulse">
            処理中
          </span>
        )}
        {project.status === 'cancelled' && (
          <span className="text-xs bg-gradient-to-r from-gray-400 to-gray-500 text-white px-2 py-1 rounded">
            キャンセル
          </span>
        )}
        {project.status === 'error' && (
          <span className="text-xs bg-gradient-to-r from-red-500 to-pink-600 text-white px-2 py-1 rounded">
            エラー
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        {project.status === 'processing' ? (
          <>
            <div className={`flex items-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              <span>{project.progress}% 完了</span>
            </div>
            <button
              onClick={() => onCancel(project.id)}
              className="px-3 py-1 bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs rounded hover:shadow-lg transition-all flex items-center"
            >
              <X className="h-3 w-3 mr-1" />
              キャンセル
            </button>
          </>
        ) : project.status === 'cancelled' ? (
          <div className={`flex items-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <X className="h-3 w-3 mr-1" />
            <span>ユーザーによりキャンセルされました</span>
          </div>
        ) : project.status === 'error' ? (
          <div className="flex items-center text-xs text-red-600 flex-1 min-w-0">
            <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">{project.errorMessage || 'エラーが発生しました'}</span>
          </div>
        ) : (
          <>
            <div className={`flex items-center text-xs ${isUrgent ? 'text-red-600' : isWarning ? 'text-orange-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isUrgent && <AlertTriangle className="h-3 w-3 mr-1" />}
              <Clock className="h-3 w-3 mr-1" />
              <span>残り {timeLeft}時間</span>
            </div>
            {project.status === 'completed' && (
              <button
                onClick={() => onDownload(project.id)}
                className="px-3 py-1 gradient-primary text-white text-xs rounded hover:shadow-lg transition-all flex items-center"
              >
                <Download className="h-3 w-3 mr-1" />
                ZIP
              </button>
            )}
          </>
        )}
      </div>
      <div className="mt-2 w-full glass rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            project.status === 'processing' ? 'gradient-animated' :
            project.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
            project.status === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-500' :
            project.status === 'cancelled' ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
            isUrgent ? 'bg-gradient-to-r from-red-500 to-pink-500' :
            isWarning ? 'bg-gradient-to-r from-orange-400 to-yellow-500' :
            'bg-gradient-to-r from-green-400 to-emerald-500'
          }`}
          style={{ width: `${
            project.status === 'processing' ? project.progress :
            project.status === 'completed' ? 100 :
            project.status === 'error' ? 100 :
            project.status === 'cancelled' ? project.progress :
            (timeLeft / 24) * 100
          }%` }}
        />
      </div>
    </div>
  );
};

// Component: Favorite Card
const FavoriteCard: React.FC<{
  favorite: FavoriteSite;
  onClick: (id: string) => void;
  darkMode: boolean;
}> = ({ favorite, onClick, darkMode }) => {
  return (
    <button
      onClick={() => onClick(favorite.id)}
      className={`w-full text-left p-3 rounded-lg glass transition-all group relative ${
        darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-200/50'
      }`}
      title={favorite.url}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Globe className="h-4 w-4 text-blue-500 group-hover:text-blue-700 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{favorite.title}</p>
            <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{favorite.url}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <span className="text-xs gradient-secondary text-white px-2 py-1 rounded whitespace-nowrap">
            {favorite.captureCount}回
          </span>
          <Play className="h-4 w-4 text-blue-500 group-hover:text-blue-700" />
        </div>
      </div>
      {favorite.settings && (
        <div className="mt-2 flex flex-wrap gap-1">
          {favorite.settings.allPages && (
            <span className="text-xs gradient-primary text-white px-2 py-0.5 rounded">全ページ</span>
          )}
          {favorite.settings.devices.length === 3 && (
            <span className="text-xs gradient-primary text-white px-2 py-0.5 rounded">3デバイス</span>
          )}
          {favorite.settings.excludePopups && (
            <span className="text-xs gradient-primary text-white px-2 py-0.5 rounded">ポップアップ除外</span>
          )}
        </div>
      )}
    </button>
  );
};

// Component: History Card
const HistoryCard: React.FC<{
  item: HistoryItem;
  onRecapture: (id: string) => void;
  onDragStart: (e: React.DragEvent, url: string) => void;
  darkMode: boolean;
}> = ({ item, onRecapture, onDragStart, darkMode }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.url)}
      className={`group flex items-center justify-between p-2 rounded glass transition-all cursor-move ${
        darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-200/40'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.url}</p>
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {item.pageCount}ページ • {formatTime(item.capturedAt)}
        </p>
      </div>
      <button
        onClick={() => onRecapture(item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 gradient-primary rounded text-white"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
};

// Component: Alert Banner
const AlertBanner: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="mt-6 glass-strong rounded-xl p-4 shadow-lg">
      <div className="flex items-start">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
        <div className="flex-1">
          <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            無料サービスについて
          </p>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            スクリーンショットは最大48時間で自動削除されます。必要な画像は早めにダウンロードしてください。
            履歴データは永続的に保存されるため、いつでも再取得可能です。
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-blue-600 hover:text-blue-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Component: Settings Modal
const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: CaptureSettings;
  onSave: (settings: CaptureSettings) => void;
  darkMode: boolean;
}> = ({ isOpen, onClose, settings, onSave, darkMode }) => {
  const [localSettings, setLocalSettings] = useState<CaptureSettings>(settings);
  const [maxPagesInput, setMaxPagesInput] = useState<string>(settings.maxPages.toString());

  // Update local settings when prop changes
  useEffect(() => {
    setLocalSettings(settings);
    setMaxPagesInput(settings.maxPages.toString());
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleDeviceToggle = (device: string) => {
    const newDevices = localSettings.devices.includes(device)
      ? localSettings.devices.filter(d => d !== device)
      : [...localSettings.devices, device];
    setLocalSettings({ ...localSettings, devices: newDevices });
  };

  const handleMaxPagesChange = (value: string) => {
    // 数値のみ許可（マイナスなし）
    if (value === '' || /^\d+$/.test(value)) {
      const num = parseInt(value);
      // 300以下のみ許可
      if (value === '' || num <= 300) {
        setMaxPagesInput(value);
      }
    }
  };

  // エラーメッセージ
  const maxPagesError = maxPagesInput !== '' && (parseInt(maxPagesInput) < 1 || parseInt(maxPagesInput) > 300)
    ? '1〜300の数値を入力してください'
    : '';

  const handleSave = () => {
    // 保存前にバリデーション
    let validSettings = { ...localSettings };

    // maxPagesの範囲チェック（1-300）
    const maxPages = maxPagesInput === '' ? 1 : parseInt(maxPagesInput);
    if (maxPages < 1) {
      validSettings.maxPages = 1;
    } else if (maxPages > 300) {
      validSettings.maxPages = 300;
    } else {
      validSettings.maxPages = maxPages;
    }

    onSave(validSettings);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="glass-strong rounded-xl shadow-2xl max-w-md w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              詳細設定
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? 'text-gray-400 hover:bg-gray-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Device Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                デバイスタイプ
              </label>
              <div className="space-y-2">
                {[
                  { value: 'desktop', label: 'Desktop' },
                  { value: 'mobile', label: 'Mobile' },
                  { value: 'tablet', label: 'Tablet' }
                ].map((device) => (
                  <label
                    key={device.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                      localSettings.devices.includes(device.value)
                        ? 'border-blue-500 bg-blue-50/10'
                        : darkMode
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={localSettings.devices.includes(device.value)}
                      onChange={() => handleDeviceToggle(device.value)}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className={`ml-3 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                      {device.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Page Count Settings */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                ページ数設定
              </label>
              <div className="space-y-3">
                {/* All Pages Toggle */}
                <label
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    localSettings.allPages
                      ? 'border-blue-500 bg-blue-50/10'
                      : darkMode
                      ? 'border-gray-600 hover:border-gray-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={localSettings.allPages}
                    onChange={(e) => setLocalSettings({ ...localSettings, allPages: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className={`ml-3 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    全ページを取得
                  </span>
                </label>

                {/* Max Pages Input */}
                {!localSettings.allPages && (
                  <div>
                    <label className={`block text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      最大ページ数 (1-300)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1-300"
                      value={maxPagesInput}
                      onChange={(e) => handleMaxPagesChange(e.target.value)}
                      className={`w-full px-3 py-2 glass rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        maxPagesError
                          ? 'border-red-500'
                          : darkMode ? 'border-gray-600' : 'border-gray-300'
                      } ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}
                    />
                    {maxPagesError && (
                      <p className="text-xs text-red-500 mt-1">{maxPagesError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Exclude Popups */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                その他オプション
              </label>
              <label
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  localSettings.excludePopups
                    ? 'border-blue-500 bg-blue-50/10'
                    : darkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={localSettings.excludePopups}
                  onChange={(e) => setLocalSettings({ ...localSettings, excludePopups: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className={`ml-3 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  ポップアップを除外
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 p-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                darkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;