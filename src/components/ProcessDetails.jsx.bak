import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Activity, FileText, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { fetchLogs, fetchArtifacts, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';

const ProcessDetails = () => {
    const { runId } = useParams();
    const [logs, setLogs] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [run, setRun] = useState(null);
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!runId) return;

        const loadRun = async () => {
            const { data } = await supabase.from('activity_runs').select('*').eq('id', runId).single();
            if (data) setRun(data);
        };
        loadRun();

        const loadLogs = async () => {
            try { setLogs(await fetchLogs(runId)); } catch (err) { console.error(err); }
        };
        loadLogs();

        const loadArtifacts = async () => {
            try { setArtifacts(await fetchArtifacts(runId)); } catch (err) { console.error(err); }
        };
        loadArtifacts();

        const unsubLogs = subscribeToTable('activity_logs', `run_id=eq.${runId}`, () => loadLogs());
        const unsubArtifacts = subscribeToTable('artifacts', `run_id=eq.${runId}`, () => loadArtifacts());
        const unsubRun = subscribeToTable('activity_runs', `id=eq.${runId}`, () => loadRun());

        return () => { unsubLogs(); unsubArtifacts(); unsubRun(); };
    }, [runId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    // Map log_type to visual style
    const typeColor = (logType) => {
        switch (logType) {
            case 'complete': return 'text-[#0da425]';
            case 'error': return 'text-[#ff1515]';
            case 'decision': return 'text-[#2546F5]';
            case 'artifact': return 'text-[#ED6704]';
            case 'system': default: return 'text-[#8f8f8f]';
        }
    };

    const typeIcon = (logType) => {
        switch (logType) {
            case 'complete': return <Check className="w-3.5 h-3.5 text-[#0da425]" />;
            case 'error': return <Activity className="w-3.5 h-3.5 text-[#ff1515]" />;
            case 'decision': return <Loader2 className="w-3.5 h-3.5 text-[#2546F5]" />;
            case 'artifact': return <FileText className="w-3.5 h-3.5 text-[#ED6704]" />;
            case 'system': default: return <Clock className="w-3.5 h-3.5 text-[#8f8f8f]" />;
        }
    };

    // Extract step_name from metadata if present
    const getStepName = (log) => {
        if (log.metadata?.step_name) return log.metadata.step_name;
        return `Step ${log.step_number}`;
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Run Header */}
            {run && (
                <div className="flex items-center gap-4 px-6 py-3 border-b border-[#f0f0f0]">
                    <div className="flex-1">
                        <div className="text-[14px] font-[550] text-[#171717]">{run.document_name || run.name}</div>
                        <div className="text-[12px] text-[#8f8f8f] mt-0.5">{run.current_status_text}</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-md text-[11px] font-[500] ${
                        run.status === 'done' ? 'bg-[#E2F1EB] text-[#038408]' :
                        run.status === 'in_progress' || run.status === 'ready' ? 'bg-[#EAF3FF] text-[#2546F5]' :
                        run.status === 'needs_attention' ? 'bg-[#FFDADA] text-[#A40000]' :
                        run.status === 'needs_review' ? 'bg-[#FCEDB9] text-[#ED6704]' :
                        'bg-[#EBEBEB] text-[#8F8F8F]'
                    }`}>
                        {run.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Activity Log */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="text-[12px] font-[550] text-[#171717] uppercase tracking-wider mb-4">Activity Log</div>
                    
                    {logs.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-[13px] text-[#8f8f8f]">Waiting for activity...</div>
                            <div className="text-[12px] text-[#cacaca] mt-1">Logs will stream here in real-time</div>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {logs.map((log, idx) => (
                                <div key={log.id} className="flex gap-3 group">
                                    {/* Timeline */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-7 h-7 rounded-full bg-[#f7f7f7] border border-[#ebebeb] flex items-center justify-center flex-shrink-0">
                                            {typeIcon(log.log_type)}
                                        </div>
                                        {idx < logs.length - 1 && (
                                            <div className="w-[1px] h-full min-h-[20px] bg-[#ebebeb] my-1" />
                                        )}
                                    </div>
                                    {/* Content */}
                                    <div className="pb-4 flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-[13px] font-[500] ${typeColor(log.log_type)}`}>
                                                {getStepName(log)}
                                            </span>
                                            <span className="text-[10px] text-[#cacaca] bg-[#f9f9f9] px-1.5 py-0.5 rounded">
                                                {log.log_type}
                                            </span>
                                            <span className="text-[11px] text-[#cacaca]">{formatTime(log.created_at)}</span>
                                        </div>
                                        <div className="text-[13px] text-[#555] mt-0.5 leading-relaxed">
                                            {log.message}
                                        </div>
                                        {log.metadata && Object.keys(log.metadata).filter(k => k !== 'step_name').length > 0 && (
                                            <pre className="mt-2 text-[11px] text-[#8f8f8f] bg-[#fafafa] border border-[#f0f0f0] rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(
                                                    Object.fromEntries(Object.entries(log.metadata).filter(([k]) => k !== 'step_name')),
                                                    null, 2
                                                )}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>

                {/* Artifacts Sidebar */}
                {artifacts.length > 0 && (
                    <div className="w-[280px] border-l border-[#f0f0f0] overflow-y-auto px-4 py-4 bg-[#FAFAFA]">
                        <div className="text-[12px] font-[550] text-[#171717] uppercase tracking-wider mb-3">Artifacts</div>
                        <div className="space-y-2">
                            {artifacts.map(art => (
                                <div key={art.id} className="bg-white border border-[#f0f0f0] rounded-lg p-3 hover:shadow-sm transition-shadow">
                                    <div className="flex items-start gap-2">
                                        <FileText className="w-4 h-4 text-[#8f8f8f] mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-[500] text-[#171717] truncate">{art.filename}</div>
                                            <div className="text-[11px] text-[#8f8f8f] mt-0.5">{art.file_type}</div>
                                        </div>
                                    </div>
                                    {art.url && (
                                        <a href={art.url} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1 mt-2 text-[11px] text-[#2546F5] hover:underline">
                                            <ExternalLink className="w-3 h-3" /> Open
                                        </a>
                                    )}
                                    {art.content && (
                                        <pre className="mt-2 text-[10px] text-[#8f8f8f] bg-[#f9f9f9] rounded p-1.5 overflow-x-auto max-h-[100px] whitespace-pre-wrap">
                                            {typeof art.content === 'string' ? art.content : JSON.stringify(art.content, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcessDetails;
