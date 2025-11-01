'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Camera, Bell, Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { useDarkMode } from '@/stores/useDarkMode';
import { SettingsContent } from '@/components/SettingsContent';
import { Sidebar } from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

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

  // アクティブプロジェクト数を取得
  useEffect(() => {
    if (!user) return;

    const fetchActiveProjects = async () => {
      const now = new Date().toISOString();
      const { count, error } = await supabase
        .from('active_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gt('expires_at', now);

      if (!error) {
        setActiveProjectsCount(count || 0);
      }
    };

    fetchActiveProjects();

    // Realtime購読でリアルタイム更新
    const channel = supabase
      .channel('settings_active_projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchActiveProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // お気に入り数を取得
  useEffect(() => {
    if (!user) return;

    const fetchFavorites = async () => {
      const { count } = await supabase
        .from('favorite_sites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setFavoritesCount(count || 0);
    };

    fetchFavorites();

    // Realtime購読でリアルタイム更新
    const channel = supabase
      .channel('settings_favorites')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorite_sites',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
        activeProjectsCount={activeProjectsCount}
        favoritesCount={favoritesCount}
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