'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Camera, Bell, Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { useDarkMode } from '@/stores/useDarkMode';
import { useActiveProjects } from '@/stores/useActiveProjects';
import { useFavorites } from '@/stores/useFavorites';
import { SettingsContent } from '@/components/SettingsContent';
import { Sidebar } from '@/components/Sidebar';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { darkMode, toggleDarkMode} = useDarkMode();
  // Zustand stores - セレクタ関数を使用して各プロパティを個別に監視
  const activeProjects = useActiveProjects(state => state.projects);
  const initializeProjects = useActiveProjects(state => state.initialize);
  const favorites = useFavorites(state => state.favorites);
  const initializeFavorites = useFavorites(state => state.initialize);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

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

    console.log('[Settings] Initializing Zustand stores for user:', user.id);

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
      console.log('[Settings] Cleaning up Zustand stores');
      if (cleanupProjects) cleanupProjects();
      if (cleanupFavorites) cleanupFavorites();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // user.id のみに依存（initializeProjects/Favoritesは安定している）

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!user) {
    return null;
  }

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
        activePage="settings"
      />

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}
      >
        {/* Header */}
        <header className="glass-strong sticky top-0 z-20 shadow-lg">
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

        {/* Settings Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <SettingsContent user={user} />
        </main>
      </div>
    </div>
  );
}