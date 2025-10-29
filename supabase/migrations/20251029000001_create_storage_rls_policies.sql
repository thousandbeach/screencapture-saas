-- ============================================================================
-- Storage RLS Policies for screenshots bucket
-- ============================================================================
-- This migration creates Row Level Security policies for the screenshots storage bucket.
-- Prerequisites: The "screenshots" bucket must exist (configured in supabase/config.toml)

-- 自分のファイルのみアップロード可能
CREATE POLICY "Users can upload own screenshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 自分のファイルのみ参照可能
CREATE POLICY "Users can view own screenshots"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 自分のファイルのみ削除可能
CREATE POLICY "Users can delete own screenshots"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );