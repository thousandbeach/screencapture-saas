-- ScreenCapture SaaS - Initial Database Schema
-- Migration: 20251026000001
-- Description: Create initial tables for capture history, favorites, active projects, and health checks

-- ============================================================================
-- 取得履歴テーブル（永続保存）
-- ============================================================================
CREATE TABLE IF NOT EXISTS capture_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  base_url TEXT NOT NULL,
  page_count INTEGER DEFAULT 1,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 取得履歴のコメント
COMMENT ON TABLE capture_history IS '取得履歴テーブル（永続保存）。URLとメタデータのみ保存。';
COMMENT ON COLUMN capture_history.id IS 'プライマリキー';
COMMENT ON COLUMN capture_history.user_id IS 'ユーザーID（auth.users参照）';
COMMENT ON COLUMN capture_history.base_url IS '取得対象のベースURL';
COMMENT ON COLUMN capture_history.page_count IS '取得したページ数';
COMMENT ON COLUMN capture_history.captured_at IS 'スクリーンショット取得日時';
COMMENT ON COLUMN capture_history.metadata IS 'デバイス設定等のメタデータ（JSONB）';
COMMENT ON COLUMN capture_history.created_at IS 'レコード作成日時';

-- ============================================================================
-- お気に入りサイトテーブル（永続保存）
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorite_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  last_captured TIMESTAMP WITH TIME ZONE,
  capture_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- お気に入りサイトのコメント
COMMENT ON TABLE favorite_sites IS 'お気に入りサイトテーブル（永続保存）。ワンクリック再実行用。';
COMMENT ON COLUMN favorite_sites.id IS 'プライマリキー';
COMMENT ON COLUMN favorite_sites.user_id IS 'ユーザーID（auth.users参照）';
COMMENT ON COLUMN favorite_sites.url IS 'お気に入りサイトのURL';
COMMENT ON COLUMN favorite_sites.title IS 'サイトタイトル';
COMMENT ON COLUMN favorite_sites.last_captured IS '最終取得日時';
COMMENT ON COLUMN favorite_sites.capture_count IS '取得回数';
COMMENT ON COLUMN favorite_sites.settings IS 'デフォルト設定（JSONB）';
COMMENT ON COLUMN favorite_sites.created_at IS 'レコード作成日時';
COMMENT ON COLUMN favorite_sites.updated_at IS 'レコード更新日時';

-- ============================================================================
-- アクティブプロジェクトテーブル（24時間で削除）
-- ============================================================================
CREATE TABLE IF NOT EXISTS active_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES capture_history(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  storage_path TEXT NOT NULL,
  download_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- アクティブプロジェクトのコメント
COMMENT ON TABLE active_projects IS 'アクティブプロジェクトテーブル（24時間で自動削除）。ダウンロード可能期間を管理。';
COMMENT ON COLUMN active_projects.id IS 'プライマリキー';
COMMENT ON COLUMN active_projects.history_id IS '取得履歴ID（capture_history参照）';
COMMENT ON COLUMN active_projects.user_id IS 'ユーザーID（auth.users参照）';
COMMENT ON COLUMN active_projects.expires_at IS '有効期限（24時間後）';
COMMENT ON COLUMN active_projects.storage_path IS 'Storageパス（{user_id}/{project_id}）';
COMMENT ON COLUMN active_projects.download_count IS 'ダウンロード回数';
COMMENT ON COLUMN active_projects.status IS 'ステータス（processing/completed/error）';
COMMENT ON COLUMN active_projects.progress IS '進捗率（0-100）';
COMMENT ON COLUMN active_projects.error_message IS 'エラーメッセージ（エラー時のみ）';
COMMENT ON COLUMN active_projects.created_at IS 'レコード作成日時';
COMMENT ON COLUMN active_projects.updated_at IS 'レコード更新日時';

-- ============================================================================
-- ヘルスチェックテーブル（Supabase自動起動用）
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_checks (
  id SERIAL PRIMARY KEY,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

-- ヘルスチェックのコメント
COMMENT ON TABLE health_checks IS 'ヘルスチェックテーブル。Supabase Free Planの自動スリープ防止用。';
COMMENT ON COLUMN health_checks.id IS 'プライマリキー（連番）';
COMMENT ON COLUMN health_checks.checked_at IS 'チェック実行日時';
COMMENT ON COLUMN health_checks.status IS 'ステータス';

-- ============================================================================
-- インデックス作成（パフォーマンス最適化）
-- ============================================================================

-- capture_history インデックス
CREATE INDEX IF NOT EXISTS idx_capture_history_user_id
  ON capture_history(user_id);

CREATE INDEX IF NOT EXISTS idx_capture_history_captured_at
  ON capture_history(captured_at DESC);

-- favorite_sites インデックス
CREATE INDEX IF NOT EXISTS idx_favorite_sites_user_id
  ON favorite_sites(user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_sites_url
  ON favorite_sites(url);

-- active_projects インデックス
CREATE INDEX IF NOT EXISTS idx_active_projects_user_id
  ON active_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_active_projects_expires_at
  ON active_projects(expires_at);

CREATE INDEX IF NOT EXISTS idx_active_projects_status
  ON active_projects(status);

-- ============================================================================
-- 自動更新トリガー（updated_at）
-- ============================================================================

-- updated_at自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- favorite_sites用トリガー
CREATE TRIGGER update_favorite_sites_updated_at
  BEFORE UPDATE ON favorite_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- active_projects用トリガー
CREATE TRIGGER update_active_projects_updated_at
  BEFORE UPDATE ON active_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();