import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Check, Activity, FileText, Clock, ExternalLink, Loader2, X,
    Database, Asterisk, Presentation, Maximize2, ChevronDown, ChevronUp,
    Download, Sliders, Filter, Layout, LayoutGrid, Menu, Brain
} from 'lucide-react';
import { fetchLogs, fetchArtifacts, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';

/* ─── Helpers: classify metadata fields ─── */
const REASONING_KEYS = new Set([
    'confidence', 'match_score', 'score', 'status', 'result',
    'reason', 'note', 'validation', 'match_result', 'flag',
    'accuracy', 'threshold', 'decision', 'outcome', 'verdict',
    'similarity', 'match_type', 'method', 'model', 'duration_ms'
]);

const SKIP_KEYS = new Set(['step_name']);

function isLargeData(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 2;
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length >= 4) return true;
        // Check if any nested value is itself a non-trivial object
        return keys.some(k => {
            const v = value[k];
            return (typeof v === 'object' && v !== null && Object.keys(v).length >= 2);
        });
    }
    if (typeof value === 'string') return value.length > 300;
    return false;
}

function classifyMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return { reasoning: {}, dataArtifacts: [] };

    const reasoning = {};
    const dataArtifacts = [];

    Object.entries(metadata).forEach(([key, value]) => {
        if (SKIP_KEYS.has(key)) return;

        if (isLargeData(value)) {
            // This is a data artifact - extracted data, validation details, etc.
            const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
            dataArtifacts.push({
                id: `meta-${key}-${Math.random().toString(36).slice(2, 8)}`,
                filename: `${label.charAt(0).toUpperCase() + label.slice(1)}`,
                file_type: 'json',
                content: value,
                _isMetaArtifact: true,
            });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Small object - flatten into reasoning
            Object.entries(value).forEach(([subKey, subVal]) => {
                const flatKey = `${key}.${subKey}`;
                if (typeof subVal !== 'object' || subVal === null) {
                    reasoning[flatKey] = subVal;
                }
            });
        } else {
            reasoning[key] = value;
        }
    });

    return { reasoning, dataArtifacts };
}

/* ─── CollapsibleReasoning ─── */
const CollapsibleReasoning = ({ reasoning }) => {
    const [isOpen, setIsOpen] = useState(false);
    const entries = Object.entries(reasoning || {});
    if (entries.length === 0) return null;

    const formatKey = (key) => {
        let display = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\./g, ' > ').trim();
        return display.charAt(0).toUpperCase() + display.slice(1);
    };

    const formatValue = (val) => {
        if (val === true) return 'Yes';
        if (val === false) return 'No';
        if (val === null || val === undefined) return '—';
        return String(val);
    };

    const getValueColor = (key, val) => {
        const s = String(val).toLowerCase();
        if (s === 'pass' || s === 'passed' || s === 'true' || s === 'yes' || s === 'success' || s === 'matched') return 'text-[#038408]';
        if (s === 'fail' || s === 'failed' || s === 'false' || s === 'no' || s === 'error' || s.includes('critical') || s.includes('mismatch')) return 'text-[#A40000]';
        if (key.includes('confidence') || key.includes('score') || key.includes('similarity') || key.includes('accuracy')) {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                if (num >= 0.9 || num >= 90) return 'text-[#038408]';
                if (num >= 0.7 || num >= 70) return 'text-[#ED6704]';
                return 'text-[#A40000]';
            }
        }
        return 'text-[#171717]';
    };

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] hover:text-[#666] transition-colors"
            >
                <Brain className="w-3 h-3" />
                {isOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                <span>Reasoning</span>
            </button>
            {isOpen && (
                <div className="mt-2 bg-[#fafafa] border border-[#f0f0f0] rounded-md p-3 space-y-1.5">
                    {entries.map(([key, val]) => (
                        <div key={key} className="flex items-baseline gap-2 text-[11px]">
                            <span className="text-[#9CA3AF] min-w-[100px] flex-shrink-0">{formatKey(key)}</span>
                            <span className={`font-medium ${getValueColor(key, val)}`}>
                                {formatValue(val)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── DatasetViewer ─── */
const DatasetViewer = ({ artifact, onClose }) => {
    const [viewMode, setViewMode] = useState('list');

    const parsedData = useMemo(() => {
        if (!artifact) return {};
        let raw = artifact.content || artifact.data;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return { raw_content: raw }; }
        }
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object' && raw !== null) return raw;
        return { value: String(raw) };
    }, [artifact]);

    const isTableData = Array.isArray(parsedData);

    const flatData = useMemo(() => {
        if (isTableData) return parsedData;
        const flat = {};
        const flatten = (obj, prefix = '') => {
            Object.entries(obj).forEach(([k, v]) => {
                const key = prefix ? `${prefix} > ${k}` : k;
                if (v === null || v === undefined) flat[key] = '';
                else if (Array.isArray(v)) flat[key] = v.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ');
                else if (typeof v === 'object') flatten(v, key);
                else flat[key] = v.toString();
            });
        };
        flatten(parsedData);
        return flat;
    }, [parsedData, isTableData]);

    const formatKey = (key) => {
        let display = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        return display.charAt(0).toUpperCase() + display.slice(1);
    };

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10 w-full">
                <div className="flex items-center gap-3">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                        <Menu className="w-4 h-4" />
                    </button>
                    <span className="text-[14px] font-normal text-[#171717]">
                        {artifact?.filename || 'Artifact Data'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400"><Maximize2 className="w-4 h-4" /></button>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
            </div>

            {/* Utility Bar */}
            <div className="flex flex-col w-full">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button className="p-2 border border-gray-300 rounded-[4px] hover:bg-gray-50 text-gray-600">
                            <Filter className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-gray-400">
                        <Download className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                        <Sliders className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                        <ExternalLink className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                        <div className="flex items-center border border-gray-200 rounded-[6px] p-0.5 bg-gray-50/50">
                            <button onClick={() => setViewMode('list')} title="List View"
                                className={`p-1 rounded-[4px] transition-all ${viewMode === 'list' ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Layout className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setViewMode('table')} title="Table View"
                                className={`p-1 rounded-[4px] transition-all ${viewMode === 'table' ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="h-px bg-gray-100 w-full"></div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                {viewMode === 'table' || isTableData ? (
                    <div className="w-full h-full overflow-auto">
                        <table className="min-w-full text-left border-collapse table-auto">
                            <thead className="bg-[#f9fafb] border-b border-gray-200 sticky top-0 z-20">
                                <tr>
                                    {(isTableData ? Object.keys(parsedData[0] || {}) : Object.keys(flatData)).map(header => (
                                        <th key={header} className="px-4 py-2 text-[11px] font-bold text-gray-900 border-r border-gray-100 min-w-[150px] bg-[#f9fafb]">
                                            <div className="flex items-center justify-between group cursor-pointer hover:text-black">
                                                <span>{formatKey(header)}</span>
                                                <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {isTableData ? parsedData.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} className="px-4 py-2 text-[11px] text-black border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                                {val?.toString() || '\u2014'}
                                            </td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        {Object.values(flatData).map((val, j) => (
                                            <td key={j} className="px-4 py-2 text-[11px] text-black border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                                {val || '\u2014'}
                                            </td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {Object.entries(flatData).map(([key, value], index) => (
                            <div key={key} className={`group px-8 py-3 border-b border-gray-100 hover:bg-[#f9fafb] transition-colors ${index === 0 ? 'mt-4' : ''}`}>
                                <div className="space-y-1.5 flex flex-col">
                                    <label className="block text-[11px] font-normal text-gray-400 transition-colors group-hover:text-gray-600">
                                        {formatKey(key)}
                                    </label>
                                    <div className="w-full max-w-[500px] px-3 py-1.5 bg-white border border-[#e5e7eb] rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] text-[#171717] font-normal min-h-[32px] flex items-center">
                                        {value || '\u2014'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── ProcessDetails ─── */
const ProcessDetails = () => {
    const { runId } = useParams();
    const [logs, setLogs] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [run, setRun] = useState(null);
    const [selectedArtifact, setSelectedArtifact] = useState(null);
    const [artifactWidth, setArtifactWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const logsEndRef = useRef(null);

    // Data loading + realtime subscriptions
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

    // Resize
    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e) => {
            const newWidth = window.innerWidth - e.clientX;
            setArtifactWidth(Math.max(400, Math.min(newWidth, window.innerWidth - 400)));
        };
        const handleMouseUp = () => setIsResizing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isResizing]);

    // Classify all log metadata into reasoning + data artifacts
    const logMetaClassified = useMemo(() => {
        const map = {};
        logs.forEach(log => {
            map[log.id] = classifyMetadata(log.metadata);
        });
        return map;
    }, [logs]);

    // Collect ALL data artifacts: from artifacts table + from metadata
    const allArtifacts = useMemo(() => {
        const combined = [...artifacts];
        Object.values(logMetaClassified).forEach(({ dataArtifacts }) => {
            dataArtifacts.forEach(da => {
                if (!combined.some(a => a.id === da.id)) combined.push(da);
            });
        });
        return combined;
    }, [artifacts, logMetaClassified]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getStepName = (log) => log.metadata?.step_name || `Step ${log.step_number}`;

    // FIX: Icon status based on position in timeline + run status
    const getIconStatus = (log, index) => {
        if (log.log_type === 'error') return 'error';
        if (log.log_type === 'complete') return 'complete';

        const isLast = index === logs.length - 1;

        if (!isLast) {
            // Not the last step — it finished, so it's done
            return 'complete';
        }

        // Last step — depends on run status
        if (!run) return 'in-progress';
        if (run.status === 'done') return 'complete';
        if (run.status === 'needs_attention' || run.status === 'needs_review') return 'error';
        return 'in-progress'; // ready, in_progress
    };

    const isViewableArtifact = (art) => {
        if (art.content) return true;
        if (art._isMetaArtifact) return true;
        if (art.file_type === 'application/json' || art.file_type === 'json') return true;
        return false;
    };

    const handleArtifactClick = (art) => {
        if (isViewableArtifact(art)) {
            setSelectedArtifact(art);
        } else if (art.url) {
            window.open(art.url, '_blank');
        }
    };

    const closeArtifactPanel = () => setSelectedArtifact(null);

    // Match DB artifacts to artifact-type logs
    const getDbArtifactsForLog = (log) => {
        if (log.log_type !== 'artifact') return [];
        return artifacts.filter(a =>
            log.message?.includes(a.filename) ||
            (log.metadata?.artifact_id && log.metadata.artifact_id === a.id)
        );
    };

    /* ─── JSX Return ─── */
    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Main content */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${selectedArtifact ? '' : 'mr-[400px]'}`}>
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-5 border-b border-[#f0f0f0] bg-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-[16px] font-semibold text-[#171717]">
                                Run: {runId?.slice(0, 8)}
                            </h2>
                            <p className="text-[12px] text-[#9CA3AF] mt-1">
                                {run && `${run.status} \u2022 Started ${formatDate(run.started_at)}`}
                            </p>
                        </div>
                        {run?.status && (
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                                run.status === 'done' ? 'bg-[#E6F3EA] text-[#038408]' :
                                run.status === 'in_progress' ? 'bg-[#DADAFF] text-[#0000A4]' :
                                run.status === 'needs_attention' || run.status === 'needs_review' ? 'bg-[#FFDADA] text-[#A40000]' :
                                'bg-[#f2f2f2] text-[#666]'
                            }`}>
                                {run.status.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-10 h-10 border border-[#f0f0f0] rounded-lg flex items-center justify-center mb-3">
                                <Activity className="w-5 h-5 text-[#9CA3AF]" />
                            </div>
                            <p className="text-sm text-[#666]">No activity logs yet</p>
                            <p className="text-xs text-[#9CA3AF] mt-1">Logs will appear here as the run progresses</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {logs.map((log, index) => {
                                const status = getIconStatus(log, index);
                                const isLastItem = index === logs.length - 1;
                                const classified = logMetaClassified[log.id] || { reasoning: {}, dataArtifacts: [] };
                                const dbArtifactsForLog = getDbArtifactsForLog(log);
                                const logDataArtifacts = classified.dataArtifacts;

                                return (
                                    <div key={log.id} className="flex gap-4 pb-6 relative">
                                        {/* Timeline track */}
                                        <div className="flex flex-col items-center w-[11px] flex-shrink-0 pt-[4px]">
                                            {/* Icon */}
                                            <div className={`w-[11px] h-[11px] rounded-[2px] border flex-shrink-0 ${
                                                status === 'complete'
                                                    ? 'bg-[#E6F3EA] border-[#66B280]'
                                                    : status === 'error'
                                                    ? 'bg-[#FFDADA] border-[#A40000]'
                                                    : 'bg-[#DADAFF] border-[#0000A4] animate-square-to-diamond'
                                            }`} />
                                            {/* Connector */}
                                            {!isLastItem && (
                                                <div className="w-[1px] bg-[#E5E7EB] flex-1 min-h-[20px] mt-1" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[13px] font-medium text-[#171717]">
                                                    {getStepName(log)}
                                                </span>
                                                <span className="text-[10px] text-[#9CA3AF]">
                                                    {formatTime(log.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-[#666] mt-0.5 leading-relaxed">
                                                {log.message}
                                            </p>

                                            {/* DB Artifact buttons */}
                                            {dbArtifactsForLog.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {dbArtifactsForLog.map(art => (
                                                        <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                            className="bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 flex items-center gap-1.5 transition-colors">
                                                            <FileText className="h-3.5 w-3.5 text-[#666]" strokeWidth={1.5} />
                                                            <span className="text-xs font-normal text-black">{art.filename}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Metadata data artifact buttons */}
                                            {logDataArtifacts.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {logDataArtifacts.map(da => (
                                                        <button key={da.id} onClick={() => setSelectedArtifact(da)}
                                                            className="bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 flex items-center gap-1.5 transition-colors">
                                                            <Database className="h-3.5 w-3.5 text-[#666]" strokeWidth={1.5} />
                                                            <span className="text-xs font-normal text-black">{da.filename}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reasoning collapsible */}
                                            <CollapsibleReasoning reasoning={classified.reasoning} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar: Key Details OR Artifact Viewer */}
            {selectedArtifact ? (
                <>
                    <div className="w-1 cursor-col-resize hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
                        onMouseDown={() => setIsResizing(true)} />
                    <div style={{ width: artifactWidth }} className="flex-shrink-0 border-l border-[#f0f0f0]">
                        <DatasetViewer artifact={selectedArtifact} onClose={closeArtifactPanel} />
                    </div>
                </>
            ) : (
                <div className="w-[400px] flex-shrink-0 border-l border-[#f0f0f0] bg-white overflow-y-auto custom-scrollbar">
                    <div className="px-5 pt-5 pb-3">
                        <h3 className="text-[13px] font-semibold text-[#171717] mb-1">Key Details</h3>
                    </div>

                    {/* Run Details */}
                    <div className="px-5 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Database className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider">Run Details</span>
                        </div>
                        <div className="space-y-2.5">
                            {[
                                ['Run ID', runId?.slice(0, 8)],
                                ['Status', run?.status?.replace(/_/g, ' ')],
                                ['Started', run?.started_at ? formatDate(run.started_at) + ' ' + formatTime(run.started_at) : '—'],
                                ['Completed', run?.completed_at ? formatDate(run.completed_at) + ' ' + formatTime(run.completed_at) : '—'],
                                ['Steps', logs.length.toString()],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center">
                                    <span className="text-[12px] text-gray-500 w-[120px] flex-shrink-0">{label}</span>
                                    <span className="text-[12px] text-gray-900 font-medium">{value || '\u2014'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mx-5 border-t border-[#f0f0f0]" />

                    {/* Artifacts — unified: DB + metadata-derived */}
                    <div className="px-5 pt-4 pb-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Presentation className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            <span className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider">Artifacts</span>
                        </div>
                        {allArtifacts.length === 0 ? (
                            <p className="text-[12px] text-[#9CA3AF]">No artifacts generated</p>
                        ) : (
                            <div className="space-y-1.5">
                                {allArtifacts.map(art => (
                                    <button key={art.id} onClick={() => handleArtifactClick(art)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f9fafb] transition-colors text-left group">
                                        {art._isMetaArtifact ? (
                                            <Database className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#666] flex-shrink-0" />
                                        ) : (
                                            <FileText className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#666] flex-shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-medium text-[#171717] truncate">
                                                {art.filename}
                                            </p>
                                            <p className="text-[10px] text-[#9CA3AF]">
                                                {art._isMetaArtifact ? 'Extracted from log metadata' : (art.file_type || 'file')}
                                            </p>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-[#d1d5db] group-hover:text-[#9CA3AF] ml-auto flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessDetails;
