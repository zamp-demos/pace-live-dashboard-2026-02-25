import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

// Helper to subscribe to table changes
export function subscribeToTable(table, filter, callback) {
  const channel = supabase
    .channel(`realtime-${table}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// Fetch helpers
export async function fetchOrgs() {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchProcesses(orgId) {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchRuns(processId) {
  const { data, error } = await supabase
    .from('activity_runs')
    .select('*')
    .eq('process_id', processId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchLogs(runId) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('run_id', runId)
    .order('step_number', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchArtifacts(runId) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchKnowledgeBase(processId) {
  const { data, error } = await supabase
    .from('processes')
    .select('knowledge_base')
    .eq('id', processId)
    .single();
  if (error) throw error;
  return data?.knowledge_base || '';
}
