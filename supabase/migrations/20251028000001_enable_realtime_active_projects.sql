-- Enable Realtime for active_projects table
-- This allows the frontend to receive real-time updates when projects are created or updated

alter publication supabase_realtime add table active_projects;