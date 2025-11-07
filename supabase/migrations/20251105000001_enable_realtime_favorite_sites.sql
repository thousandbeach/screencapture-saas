-- Enable Realtime for favorite_sites table
-- Migration: 20251105000001
-- Description: Enable Supabase Realtime for favorite_sites table to support real-time updates

-- Set replica identity to FULL to enable tracking all column changes
ALTER TABLE favorite_sites REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE favorite_sites;