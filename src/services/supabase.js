import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Subscribe to realtime changes on a table with optional filter
export function subscribeToTable(table, filter, callback) {
    const channelName = `${table}-${filter || 'all'}-${Date.now()}`;
    const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: table,
            ...(filter ? { filter } : {})
        }, () => {
            callback();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// Fetch all organizations
export async function fetchOrgs() {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch processes for an org
export async function fetchProcesses(orgId) {
    const { data, error } = await supabase
        .from('processes')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch activity runs for a process
export async function fetchRuns(processId) {
    const { data, error } = await supabase
        .from('activity_runs')
        .select('*')
        .eq('process_id', processId)
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// Fetch activity logs for a run
// Actual columns: id, run_id, step_number, log_type, message, metadata, created_at
export async function fetchLogs(runId) {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('run_id', runId)
        .order('step_number', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch artifacts for a run
// Actual columns: id, run_id, filename, file_type, content, url, created_at
export async function fetchArtifacts(runId) {
    const { data, error } = await supabase
        .from('artifacts')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch knowledge base for a process
export async function fetchKnowledgeBase(processId) {
    const { data, error } = await supabase
        .from('processes')
        .select('knowledge_base')
        .eq('id', processId)
        .single();
    if (error) throw error;
    if (!data?.knowledge_base) return null;
    try {
        return typeof data.knowledge_base === 'string'
            ? JSON.parse(data.knowledge_base)
            : data.knowledge_base;
    } catch {
        return data.knowledge_base;
    }
}

// Fetch datasets for a process
export async function fetchDatasets(processId) {
    const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch rows for a dataset with pagination
export async function fetchDatasetRows(datasetId, { limit = 100, offset = 0, orderBy = 'created_at', ascending = false } = {}) {
    const { data, error, count } = await supabase
        .from('dataset_rows')
        .select('*, activity_runs!dataset_rows_run_id_fkey(name, status, created_at)', { count: 'exact' })
        .eq('dataset_id', datasetId)
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);
    if (error) throw error;
    return { rows: data || [], total: count || 0 };
}

// Export dataset rows as JSON (for client-side CSV generation)
export async function fetchAllDatasetRows(datasetId) {
    const { data, error } = await supabase
        .from('dataset_rows')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}
