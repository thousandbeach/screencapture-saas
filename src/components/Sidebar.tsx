'use client';

import { useRouter } from 'next/navigation';
import {
  Download, Star, LayoutDashboard, History, Database, Settings, X, Camera
} from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface SidebarProps {
  isOpen: boolean;
  onCloseAction: () => void;
  darkMode: boolean;
  activeProjectsCount?: number;
  favoritesCount?: number;
  user: User | null;
  activePage?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseAction,
  darkMode,
  activeProjectsCount = 0,
  favoritesCount = 0,
  user,
  activePage = 'dashboard'
}) => {
  const router = useRouter();

  const menuItems = [
    { icon: <LayoutDashboard className="h-5 w-5" />, label: 'ダッシュボード', active: activePage === 'dashboard', path: '/' },
    { icon: <Download className="h-5 w-5" />, label: 'ダウンロード可能', badge: activeProjectsCount > 0 ? activeProjectsCount.toString() : undefined },
    { icon: <Star className="h-5 w-5" />, label: 'お気に入り', badge: favoritesCount > 0 ? favoritesCount.toString() : undefined },
    { icon: <History className="h-5 w-5" />, label: '取得履歴' },
    { icon: <Database className="h-5 w-5" />, label: 'ストレージ' },
    { icon: <Settings className="h-5 w-5" />, label: '設定', active: activePage === 'settings', path: '/settings' },
  ];

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.path) {
      router.push(item.path);
      // モバイルでのみサイドバーを閉じる
      if (window.innerWidth < 1024) {
        onCloseAction();
      }
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onCloseAction}
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
                onClick={onCloseAction}
                className={`lg:hidden ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
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
                    onClick={() => handleMenuClick(item)}
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
          {user && (
            <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    {user.email || 'user@example.com'}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>無料プラン</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};