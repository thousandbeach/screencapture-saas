// ScreenCapture SaaS - TypeScript Type Definitions
// データベーススキーマに対応する型定義

// ============================================================================
// Database Tables
// ============================================================================

/**
 * 取得履歴テーブル（永続保存）
 */
export interface CaptureHistory {
  id: string;
  user_id: string;
  base_url: string;
  page_count: number;
  captured_at: string;
  metadata: CaptureMetadata;
  created_at: string;
}

/**
 * お気に入りサイトテーブル（永続保存）
 */
export interface FavoriteSite {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  last_captured: string | null;
  capture_count: number;
  settings: CaptureSettings;
  created_at: string;
  updated_at: string;
}

/**
 * アクティブプロジェクトテーブル（最大48時間で削除）
 */
export interface ActiveProject {
  id: string;
  history_id: string;
  user_id: string;
  expires_at: string;
  storage_path: string;
  download_count: number;
  status: ProjectStatus;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ヘルスチェックテーブル
 */
export interface HealthCheck {
  id: number;
  checked_at: string;
  status: string;
}

// ============================================================================
// Enums & Constants
// ============================================================================

/**
 * プロジェクトステータス
 */
export type ProjectStatus = 'processing' | 'completed' | 'error';

/**
 * デバイスタイプ
 */
export type DeviceType = 'desktop' | 'tablet' | 'mobile';

/**
 * デバイスビューポート設定
 */
export const DEVICE_VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 480, height: 800 },
} as const;

// ============================================================================
// JSONB Types
// ============================================================================

/**
 * キャプチャメタデータ（capture_history.metadata）
 */
export interface CaptureMetadata {
  devices?: DeviceType[];
  max_pages?: number;
  all_pages?: boolean;
  exclude_popups?: boolean;
  wait_time?: number;
  custom_settings?: Record<string, unknown>;
}

/**
 * キャプチャ設定（favorite_sites.settings）
 */
export interface CaptureSettings {
  all_pages?: boolean;
  devices?: DeviceType[];
  exclude_popups?: boolean;
  max_pages?: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * キャプチャリクエスト
 */
export interface CaptureRequest {
  url: string;
  options: {
    devices: DeviceType[];
    max_pages: number;
    all_pages: boolean;
    exclude_popups: boolean;
  };
}

/**
 * キャプチャレスポンス
 */
export interface CaptureResponse {
  project_id: string;
  history_id: string;
  expires_at: string;
  status: ProjectStatus;
}

/**
 * プロジェクト詳細（JOINしたデータ）
 */
export interface ProjectDetail extends ActiveProject {
  history: CaptureHistory;
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * Dashboard用のアクティブプロジェクト表示型
 */
export interface ActiveProjectDisplay {
  id: string;
  url: string;
  pageCount: number;
  devices: DeviceType[];
  status: ProjectStatus;
  progress: number;
  expiresAt: Date;
  downloadCount: number;
}

/**
 * Dashboard用のお気に入りサイト表示型
 */
export interface FavoriteSiteDisplay {
  id: string;
  url: string;
  title: string;
  captureCount: number;
  settings?: CaptureSettings;
}

/**
 * Dashboard用の履歴表示型
 */
export interface HistoryItemDisplay {
  id: string;
  url: string;
  pageCount: number;
  capturedAt: Date;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Supabase INSERT用の型（自動生成フィールドを除外）
 */
export type InsertCaptureHistory = Omit<
  CaptureHistory,
  'id' | 'captured_at' | 'created_at'
>;

export type InsertFavoriteSite = Omit<
  FavoriteSite,
  'id' | 'created_at' | 'updated_at'
>;

export type InsertActiveProject = Omit<
  ActiveProject,
  'id' | 'created_at' | 'updated_at'
>;

/**
 * Supabase UPDATE用の型（部分更新可能）
 */
export type UpdateFavoriteSite = Partial<
  Omit<FavoriteSite, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;

export type UpdateActiveProject = Partial<
  Omit<ActiveProject, 'id' | 'user_id' | 'history_id' | 'created_at' | 'updated_at'>
>;