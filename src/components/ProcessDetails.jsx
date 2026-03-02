import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Check, Activity, FileText, Clock, ExternalLink, Loader2, X,
    ChevronDown, ChevronUp, ArrowLeft, Shield, AlertTriangle,
    CheckCircle, Info, Brain, Search, UserCheck, Scale, FileSearch,
    Gavel, BookOpen, Play
} from 'lucide-react';
import { fetchLogs, fetchArtifacts, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';

/* ─── Step icon mapping ─── */
const STEP_ICONS = {
    'Data Ingestion & Normalisation': FileText,
    'Sanctions List Matching': Search,
    'Adverse Media Screening': FileSearch,
    'Alert Prioritisation': AlertTriangle,
    'Alert Generation & Prioritisation': AlertTriangle,
    'L1 Triage — Automated Analysis': UserCheck,
    'L2 Enhanced Investigation': Brain,
    'Disposition & Human Review': Scale,
    'True Match Actions & MLRO Referral': Shield,
    'Audit Trail & Governance': BookOpen,
};

const STEP_COLORS = {
    'system': { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', dot: 'bg-blue-500' },
    'decision': { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', dot: 'bg-purple-500' },
    'error': { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', dot: 'bg-red-500' },
    'complete': { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
    'artifact': { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', dot: 'bg-amber-500' },
};

/* ─── Status badge ─── */
const StatusBadge = ({ status }) => {
    const config = {
        done: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
        needs_review: { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        needs_attention: { label: 'Needs Attention', cls: 'bg-red-50 text-red-700 border-red-200' },
    };
    const c = config[status] || config.in_progress;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${c.cls}`}>
            {status === 'done' && <CheckCircle className="w-3 h-3 mr-1" />}
            {status === 'needs_review' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {c.label}
        </span>
    );
};

/* ─── Format metadata value for display ─── */
const formatValue = (val) => {
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    if (val === null || val === undefined) return '—';
    if (Array.isArray(val)) return val.join(' · ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const formatKey = (key) => {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\./g, ' › ')
        .trim()
        .replace(/^./, c => c.toUpperCase());
};

/* ─── Collapsible details panel for a log entry ─── */
const LogDetails = ({ metadata }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!metadata || typeof metadata !== 'object') return null;
    
    const entries = Object.entries(metadata).filter(([key]) => key !== 'step_name');
    if (entries.length === 0) return null;

    return (
        <div className="mt-2.5">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
                <Brain className="w-3.5 h-3.5" />
                <span>{isOpen ? 'Hide' : 'View'} Details</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {isOpen && (
                <div className="mt-2 bg-gray-50/80 border border-gray-100 rounded-lg p-4 space-y-2">
                    {entries.map(([key, val]) => {
                        const isArray = Array.isArray(val);
                        const isHighlight = key.includes('confidence') || key.includes('verdict') || 
                                          key.includes('severity') || key.includes('urgency') ||
                                          key.includes('priority') || key.includes('disposition');
                        return (
                            <div key={key} className="flex items-start gap-3 text-[12px]">
                                <span className="text-gray-400 min-w-[140px] flex-shrink-0 pt-0.5">
                                    {formatKey(key)}
                                </span>
                                <span className={`${isHighlight ? 'font-semibold text-gray-900' : 'text-gray-700'} leading-relaxed`}>
                                    {isArray ? (
                                        <ul className="list-none space-y-1">
                                            {val.map((item, i) => (
                                                <li key={i} className="flex items-start gap-1.5">
                                                    <span className="text-gray-300 mt-1">·</span>
                                                    <span>{String(item)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : formatValue(val)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ─── Step Group: groups logs under a step name header ─── */
const StepGroup = ({ stepName, stepNumber, logs, isLast }) => {
    const IconComponent = STEP_ICONS[stepName] || Activity;
    const isComplete = logs.some(l => l.log_type === 'complete');
    const hasDecision = logs.some(l => l.log_type === 'decision');
    const hasError = logs.some(l => l.log_type === 'error');

    const stepStatus = hasError ? 'error' : isComplete ? 'complete' : hasDecision ? 'decision' : 'system';
    const colors = STEP_COLORS[stepStatus];

    return (
        <div className="relative">
            {/* Step header */}
            <div className={`flex items-center gap-3 px-5 py-3 ${colors.bg} border-b ${colors.border}`}>
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${colors.bg} border ${colors.border}`}>
                    <IconComponent className={`w-4 h-4 ${colors.icon}`} />
                </div>
                <div className="flex-1">
                    <h3 className="text-[13px] font-semibold text-gray-900">{stepName || `Step ${stepNumber}`}</h3>
                </div>
                {isComplete && (
                    <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-[11px] font-medium">Done</span>
                    </div>
                )}
            </div>

            {/* Log entries within this step */}
            <div className="relative pl-8 pr-5 py-2">
                {/* Timeline line */}
                {!isLast && <div className="absolute left-[2.15rem] top-0 bottom-0 w-px bg-gray-200" />}
                
                {logs.map((log, idx) => {
                    const logColors = STEP_COLORS[log.log_type] || STEP_COLORS.system;
                    return (
                        <div key={log.id} className="relative py-3 pl-6">
                            {/* Timeline dot */}
                            <div className={`absolute left-0 top-[1.1rem] w-2 h-2 rounded-full ${logColors.dot} ring-2 ring-white`} />
                            
                            {/* Log content */}
                            <div>
                                <p className="text-[13px] text-gray-800 leading-relaxed">
                                    {log.message}
                                </p>
                                <LogDetails metadata={log.metadata} />
                                
                                {/* Timestamp */}
                                <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                        {new Date(log.created_at).toLocaleTimeString('en-GB', { 
                                            hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ─── Main Component ─── */
const ProcessDetails = () => {
    const { runId } = useParams();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [run, setRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!runId) return;
        const loadRun = async () => {
            const { data } = await supabase.from('activity_runs').select('*').eq('id', runId).single();
            if (data) setRun(data);
        };
        const loadLogs = async () => {
            try {
                const data = await fetchLogs(runId);
                setLogs(data);
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        const loadArtifacts = async () => {
            try { setArtifacts(await fetchArtifacts(runId)); } catch (err) { console.error(err); }
        };
        loadRun();
        loadLogs();
        loadArtifacts();

        const subLogs = subscribeToTable('activity_logs', `run_id=eq.${runId}`, () => {
            fetchLogs(runId).then(setLogs).catch(console.error);
        });
        const subRun = subscribeToTable('activity_runs', `id=eq.${runId}`, () => {
            supabase.from('activity_runs').select('*').eq('id', runId).single().then(({ data }) => {
                if (data) setRun(data);
            });
        });
        const subArtifacts = subscribeToTable('artifacts', `run_id=eq.${runId}`, () => {
            fetchArtifacts(runId).then(setArtifacts).catch(console.error);
        });

        return () => {
            subLogs?.unsubscribe?.();
            subRun?.unsubscribe?.();
            subArtifacts?.unsubscribe?.();
        };
    }, [runId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    /* Group logs by step_name (from metadata) */
    const stepGroups = useMemo(() => {
        const groups = [];
        let currentGroup = null;

        logs.forEach(log => {
            const stepName = log.metadata?.step_name || `Step ${log.step_number}`;
            if (!currentGroup || currentGroup.stepName !== stepName) {
                currentGroup = { stepName, stepNumber: log.step_number, logs: [log] };
                groups.push(currentGroup);
            } else {
                currentGroup.logs.push(log);
            }
        });

        return groups;
    }, [logs]);

    /* Extract summary stats */
    const summaryStats = useMemo(() => {
        const stats = { alerts: 0, trueMatches: 0, falsePositives: 0, mlroReferrals: 0 };
        logs.forEach(log => {
            const m = log.metadata || {};
            if (m.alerts_generated) stats.alerts = Math.max(stats.alerts, m.alerts_generated);
            if (m.total_alerts) stats.alerts = Math.max(stats.alerts, m.total_alerts);
            if (m.true_matches !== undefined) stats.trueMatches = Math.max(stats.trueMatches, m.true_matches);
            if (m.false_positives !== undefined) stats.falsePositives = Math.max(stats.falsePositives, m.false_positives);
            if (m.escalate_to_mlro) stats.mlroReferrals = Math.max(stats.mlroReferrals, m.escalate_to_mlro);
            if (m.referrals_created) stats.mlroReferrals = Math.max(stats.mlroReferrals, m.referrals_created);
        });
        return stats;
    }, [logs]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            onClick={() => navigate('/done/processes')}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-gray-500" />
                        </button>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-[16px] font-semibold text-gray-900">
                                    {run?.name || 'Loading...'}
                                </h1>
                                {run && <StatusBadge status={run.status} />}
                            </div>
                            <p className="text-[12px] text-gray-500 mt-0.5">
                                {run?.document_name} · {run ? new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                        </div>
                    </div>
                    
                    {/* Status text */}
                    {run?.current_status_text && (
                        <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-[12px] text-gray-600">{run.current_status_text}</p>
                        </div>
                    )}

                    {/* Summary stats bar */}
                    {summaryStats.alerts > 0 && (
                        <div className="mt-3 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-[11px] text-gray-500">Alerts: <span className="font-semibold text-gray-900">{summaryStats.alerts}</span></span>
                            </div>
                            {summaryStats.trueMatches > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-[11px] text-gray-500">True Matches: <span className="font-semibold text-red-700">{summaryStats.trueMatches}</span></span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-[11px] text-gray-500">False Positives: <span className="font-semibold text-gray-900">{summaryStats.falsePositives}</span></span>
                            </div>
                            {summaryStats.mlroReferrals > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-600" />
                                    <span className="text-[11px] text-gray-500">MLRO Referrals: <span className="font-semibold text-red-700">{summaryStats.mlroReferrals}</span></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline content */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto py-4">
                    {stepGroups.map((group, idx) => (
                        <StepGroup
                            key={`${group.stepName}-${idx}`}
                            stepName={group.stepName}
                            stepNumber={group.stepNumber}
                            logs={group.logs}
                            isLast={idx === stepGroups.length - 1}
                        />
                    ))}
                    
                    {logs.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Activity className="w-8 h-8 mb-3" />
                            <p className="text-[13px]">No activity yet</p>
                        </div>
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* Artifacts bar */}
            {artifacts.length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-gray-500">Artifacts:</span>
                        {artifacts.map(a => (
                            <a
                                key={a.id}
                                href={a.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <FileText className="w-3 h-3" />
                                {a.filename}
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessDetails;
