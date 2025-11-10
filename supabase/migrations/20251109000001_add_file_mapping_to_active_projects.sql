-- active_projectsテーブルにfile_mappingカラムを追加
-- ファイルとURL、デバイスのマッピング情報を保存

ALTER TABLE active_projects
ADD COLUMN file_mapping JSONB DEFAULT '[]'::jsonb;

-- コメント追加
COMMENT ON COLUMN active_projects.file_mapping IS 'ファイルマッピング情報（JSON配列: [{filename, url, device, pageIndex}]）';