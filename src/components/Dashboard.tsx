'use client';

import { useState, useEffect } from 'react';
import {
  Clock, Download, Star, Globe, Play, RefreshCw, Plus,
  Settings, Search, Bell, Database, FileImage, TrendingUp,
  Loader2, AlertTriangle, Info, X, Camera, Menu,
  LayoutDashboard, History, Moon, Sun, LogOut
} from 'lucide-react';
import { useDarkMode } from '@/stores/useDarkMode';
import { useAuth } from '@/stores/useAuth';
import { supabase } from '@/lib/supabase';
import type {
  ActiveProjectDisplay,
  FavoriteSiteDisplay,
  HistoryItemDisplay,
  ActiveProject as DbActiveProject,
  FavoriteSite as DbFavoriteSite,
  CaptureHistory as DbCaptureHistory,
} from '@/lib/types';

// Type aliases for component use
type ActiveProject = ActiveProjectDisplay;
type FavoriteSite = FavoriteSiteDisplay;
type HistoryItem = HistoryItemDisplay;

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

// Main Dashboard Component
const Dashboard: React.FC = () => {
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [favorites, setFavorites] = useState<FavoriteSite[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [url, setUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
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

  const handleCapture = () => {
    if (!url) return;
    console.log('Capturing:', url);
    // Implementation here
  };

  const handleRecapture = (historyId: string) => {
    console.log('Recapturing:', historyId);
    // Implementation here
  };

  const handleFavoriteClick = (favoriteId: string) => {
    console.log('Running favorite:', favoriteId);
    // Implementation here
  };

  const handleDownload = (projectId: string) => {
    console.log('Downloading:', projectId);
    // Implementation here
  };

  // データ取得関数
  const fetchActiveProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('active_projects')
        .select(`
          *,
          history:capture_history!inner(base_url, page_count, metadata)
        `)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // DBデータをDisplay型に変換
      const projects: ActiveProject[] = (data || []).map((project: any) => ({
        id: project.id,
        url: project.history.base_url,
        pageCount: project.history.page_count,
        devices: project.history.metadata?.devices || ['desktop'],
        status: project.status,
        progress: project.progress,
        expiresAt: new Date(project.expires_at),
        downloadCount: project.download_count,
      }));

      setActiveProjects(projects);
    } catch (error) {
      console.error('Error fetching active projects:', error);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_sites')
        .select('*')
        .eq('user_id', user.id)
        .order('capture_count', { ascending: false });

      if (error) throw error;

      // DBデータをDisplay型に変換
      const favs: FavoriteSite[] = (data || []).map((fav: DbFavoriteSite) => ({
        id: fav.id,
        url: fav.url,
        title: fav.title || fav.url,
        captureCount: fav.capture_count,
        settings: fav.settings,
      }));

      setFavorites(favs);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('capture_history')
        .select('*')
        .eq('user_id', user.id)
        .order('captured_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // DBデータをDisplay型に変換
      const historyItems: HistoryItem[] = (data || []).map((item: DbCaptureHistory) => ({
        id: item.id,
        url: item.base_url,
        pageCount: item.page_count,
        capturedAt: new Date(item.captured_at),
      }));

      setHistory(historyItems);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // 初期データ取得
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchActiveProjects(),
        fetchFavorites(),
        fetchHistory(),
      ]);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Realtimeリスナー: active_projectsの変更を監視
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('active_projects_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE すべて監視
          schema: 'public',
          table: 'active_projects',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] active_projects change:', payload);

          // プロジェクトデータを再取得
          fetchActiveProjects();
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} darkMode={darkMode} />

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

                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
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
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={`flex-1 px-3 py-2 glass rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 ${
                    darkMode ? 'text-gray-100 border-gray-600' : 'text-gray-900 border-gray-300'
                  }`}
                />
                <button
                  onClick={handleCapture}
                  className="px-4 py-2 gradient-primary text-white rounded-lg hover:shadow-lg transition-all flex items-center"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  取得開始
                </button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button className={`px-3 py-2 rounded-lg transition-all flex items-center ${
                darkMode
                  ? 'bg-gray-700/70 text-gray-100 hover:bg-gray-600/70 border border-gray-600'
                  : 'bg-white/70 text-gray-900 hover:bg-white/90 border border-gray-300'
              }`}>
                <Settings className="h-4 w-4 mr-2" />
                詳細設定
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="今月の取得回数"
            value="127"
            icon={<TrendingUp />}
            color="blue"
            darkMode={darkMode}
          />
          <StatsCard
            title="総ページ数"
            value="5,234"
            icon={<FileImage />}
            color="green"
            darkMode={darkMode}
          />
          <StatsCard
            title="お気に入り"
            value="12"
            icon={<Star />}
            color="yellow"
            darkMode={darkMode}
          />
          <StatsCard
            title="ストレージ使用率"
            value="23%"
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
                  24時間限定
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
                <button className="text-sm text-blue-600 hover:text-blue-800">
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
              <button className={`w-full p-3 rounded-lg border-2 border-dashed transition-colors ${
                darkMode
                  ? 'border-gray-600 hover:border-blue-400 hover:bg-gray-800/50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Plus className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">お気に入りを追加</p>
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
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>過去のキャプチャ（永続保存）</p>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onRecapture={handleRecapture}
                  darkMode={darkMode}
                />
              ))}
              <button className={`w-full mt-4 p-2 text-sm text-blue-600 rounded transition-colors ${
                darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-blue-50'
              }`}>
                もっと見る
              </button>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <AlertBanner darkMode={darkMode} />
      </main>
      </div>
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
  darkMode: boolean;
}> = ({ project, onDownload, darkMode }) => {
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
      </div>
      <div className="flex items-center justify-between">
        {project.status === 'processing' ? (
          <div className={`flex items-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            <span>{Math.floor(project.progress * project.pageCount / 100)}/{project.pageCount} ページ完了</span>
          </div>
        ) : (
          <div className={`flex items-center text-xs ${isUrgent ? 'text-red-600' : isWarning ? 'text-orange-600' : darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isUrgent && <AlertTriangle className="h-3 w-3 mr-1" />}
            <Clock className="h-3 w-3 mr-1" />
            <span>残り {timeLeft}時間</span>
          </div>
        )}
        {project.status === 'completed' && (
          <button
            onClick={() => onDownload(project.id)}
            className="px-3 py-1 gradient-primary text-white text-xs rounded hover:shadow-lg transition-all flex items-center"
          >
            <Download className="h-3 w-3 mr-1" />
            ZIP
          </button>
        )}
      </div>
      <div className="mt-2 w-full glass rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            project.status === 'processing' ? 'gradient-animated' :
            isUrgent ? 'bg-gradient-to-r from-red-500 to-pink-500' :
            isWarning ? 'bg-gradient-to-r from-orange-400 to-yellow-500' :
            'bg-gradient-to-r from-green-400 to-emerald-500'
          }`}
          style={{ width: `${project.status === 'processing' ? project.progress : (timeLeft / 24) * 100}%` }}
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
      className={`w-full text-left p-3 rounded-lg glass transition-all group ${
        darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-200/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Globe className="h-4 w-4 text-blue-500 group-hover:text-blue-700" />
          <div>
            <p className={`font-medium text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{favorite.title}</p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{favorite.url}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs gradient-secondary text-white px-2 py-1 rounded">
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
  darkMode: boolean;
}> = ({ item, onRecapture, darkMode }) => {
  return (
    <div className={`group flex items-center justify-between p-2 rounded glass transition-all ${
      darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-200/40'
    }`}>
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

// Component: Sidebar
const Sidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}> = ({ isOpen, onClose, darkMode }) => {
  const menuItems = [
    { icon: <LayoutDashboard className="h-5 w-5" />, label: 'ダッシュボード', active: true },
    { icon: <Download className="h-5 w-5" />, label: 'ダウンロード可能', badge: '3' },
    { icon: <Star className="h-5 w-5" />, label: 'お気に入り', badge: '12' },
    { icon: <History className="h-5 w-5" />, label: '取得履歴' },
    { icon: <Database className="h-5 w-5" />, label: 'ストレージ' },
    { icon: <Settings className="h-5 w-5" />, label: '設定' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full glass-strong z-50 transition-transform duration-300 w-64 shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-white/20'}`}>
            <div className="flex items-center justify-between px-4 h-16">
              <div className="flex items-center space-x-2">
                <Camera className="h-6 w-6 text-blue-600" />
                <h2 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>ScreenCapture</h2>
              </div>
              <button
                onClick={onClose}
                className={darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      item.active
                        ? 'gradient-primary text-white shadow-lg'
                        : darkMode
                        ? 'text-gray-300 hover:bg-gray-700/50'
                        : 'text-gray-700 hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.active ? 'bg-white/30 text-white' : 'gradient-secondary text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  user@example.com
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>無料プラン</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
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
            スクリーンショットは24時間で自動削除されます。必要な画像は早めにダウンロードしてください。
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

export default Dashboard;