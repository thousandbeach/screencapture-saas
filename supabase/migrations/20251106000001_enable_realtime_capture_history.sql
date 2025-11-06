-- Enable Realtime for capture_history table
-- Migration: 20251106000001
-- Description: Enable Supabase Realtime for capture_history table to support real-time updates

-- Set replica identity to FULL to enable tracking all column changes
ALTER TABLE capture_history REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE capture_history;
