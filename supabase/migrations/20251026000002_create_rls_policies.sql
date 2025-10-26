-- ScreenCapture SaaS - Row Level Security (RLS) Policies
-- Migration: 20251026000002
-- Description: Enable RLS and create security policies for all tables

-- ============================================================================
-- RLS有効化
-- ============================================================================

ALTER TABLE capture_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_projects ENABLE ROW LEVEL SECURITY;

-- health_checksはRLS不要（内部システム用）

-- ============================================================================
-- capture_history ポリシー
-- ============================================================================

-- SELECT: ユーザーは自分の履歴のみ閲覧可能
CREATE POLICY "Users can view own capture history"
  ON capture_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: ユーザーは自分の履歴のみ作成可能
CREATE POLICY "Users can create own capture history"
  ON capture_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 履歴は更新不可（読み取り専用）
-- DELETE: 履歴は削除不可（永続保存）

-- ============================================================================
-- favorite_sites ポリシー
-- ============================================================================

-- SELECT: ユーザーは自分のお気に入りのみ閲覧可能
CREATE POLICY "Users can view own favorites"
  ON favorite_sites
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: ユーザーは自分のお気に入りのみ作成可能
CREATE POLICY "Users can create own favorites"
  ON favorite_sites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: ユーザーは自分のお気に入りのみ更新可能
CREATE POLICY "Users can update own favorites"
  ON favorite_sites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: ユーザーは自分のお気に入りのみ削除可能
CREATE POLICY "Users can delete own favorites"
  ON favorite_sites
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- active_projects ポリシー
-- ============================================================================

-- SELECT: ユーザーは自分のプロジェクトのみ閲覧可能
CREATE POLICY "Users can view own active projects"
  ON active_projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: ユーザーは自分のプロジェクトのみ作成可能
CREATE POLICY "Users can create own active projects"
  ON active_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: ユーザーは自分のプロジェクトのみ更新可能（進捗更新用）
CREATE POLICY "Users can update own active projects"
  ON active_projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: サーバーサイド（Cron Job）のみ削除可能
-- 通常ユーザーからの削除は不可

-- ============================================================================
-- Storage Policies (screenshots bucket)
-- ============================================================================
-- Note: Storage policiesはSupabase Studioから設定するか、
-- 別途storage.objectsテーブルに対してポリシーを作成する必要があります。
-- 以下は参考用のSQLです。

-- 自分のファイルのみアップロード可能
-- CREATE POLICY "Users can upload own screenshots"
--   ON storage.objects
--   FOR INSERT
--   WITH CHECK (
--     bucket_id = 'screenshots' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- 自分のファイルのみ参照可能
-- CREATE POLICY "Users can view own screenshots"
--   ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'screenshots' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- 自分のファイルのみ削除可能
-- CREATE POLICY "Users can delete own screenshots"
--   ON storage.objects
--   FOR DELETE
--   USING (
--     bucket_id = 'screenshots' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );