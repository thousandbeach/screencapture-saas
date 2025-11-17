import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const projectId = 'dfa3372e-51a2-4ff2-b9ec-1958c185cc99';

const { data, error } = await supabase
  .from('active_projects')
  .select('*')
  .eq('id', projectId)
  .single();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
