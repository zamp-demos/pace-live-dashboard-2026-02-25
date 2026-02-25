import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Check, Activity, FileText, Clock, ExternalLink, Loader2, X,
    Database, Asterisk, Presentation, Maximize2, ChevronDown, ChevronUp,
    Download, Sliders, Filter, Layout, LayoutGrid, Menu
} from 'lucide-react';
import { fetchLogs, fetchArtifacts, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';

/* ─── DatasetViewer ─── */
const DatasetViewer = ({ artifact, onClose }) => {
    const [viewMode, setViewMode] = useState('list');

    // Parse artifact data - could be JSON string, object, or array
    const parsedData = React.useMemo(() => {
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

    // For object data, flatten nested values to strings
    const flatData = React.useMemo(() => {
        if (isTableData) return parsedData;
        const flat = {};
        Object.entries(parsedData).forEach(([k, v]) => {
            if (v === null || v === undefined) flat[k] = '';
            else if (Array.isArray(v)) flat[k] = v.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ');
            else if (typeof v === 'object') flat[k] = JSON.stringify(v);
            else flat[k] = v.toString();
        });
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
                            <button
                                onClick={() => setViewMode('list')}
                                title="List View"
                                className={`p-1 rounded-[4px] transition-all ${viewMode === 'list' ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Layout className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                title="Table View"
                                className={`p-1 rounded-[4px] transition-all ${viewMode === 'table' ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
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
                                {isTableData ? (
                                    parsedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            {Object.values(row).map((val, j) => (
                                                <td key={j} className="px-4 py-2 text-[11px] text-black border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {val?.toString() || '\u2014'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
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

/* ─── CollapsibleMetadata ─── */
const CollapsibleMetadata = ({ metadata }) => {
    const [isOpen, setIsOpen] = useState(false);
    const filtered = Object.fromEntries(
        Object.entries(metadata || {}).filter(([k]) => k !== 'step_name')
    );
    if (Object.keys(filtered).length === 0) return null;

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-[10px] text-[#9CA3AF] hover:text-[#666] transition-colors"
            >
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{isOpen ? 'Hide' : 'Show'} details</span>
            </button>
            {isOpen && (
                <pre className="mt-1.5 text-[11px] text-[#8f8f8f] bg-[#fafafa] border border-[#f0f0f0] rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(filtered, null, 2)}
                </pre>
            )}
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

    // Data loading
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

    // Auto-scroll to latest log
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Resize handling
    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e) => {
            const newWidth = window.innerWidth - e.clientX;
            setArtifactWidth(Math.max(400, Math.min(newWidth, window.innerWidth - 400)));
        };
        const handleMouseUp = () => setIsResizing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getStepName = (log) => log.metadata?.step_name || `Step ${log.step_number}`;

    const getLogStatus = (logType) => {
        switch (logType) {
            case 'complete': return 'complete';
            case 'error': return 'error';
            default: return 'in-progress';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'done': return { bg: 'bg-[#E2F1EB]', text: 'text-[#038408]' };
            case 'in_progress': case 'ready': return { bg: 'bg-[#EAF3FF]', text: 'text-[#2546F5]' };
            case 'needs_attention': return { bg: 'bg-[#FFDADA]', text: 'text-[#A40000]' };
            case 'needs_review': return { bg: 'bg-[#FCEDB9]', text: 'text-[#ED6704]' };
            default: return { bg: 'bg-[#EBEBEB]', text: 'text-[#8F8F8F]' };
        }
    };

    // Check if an artifact has viewable JSON data
    const isViewableArtifact = (art) => {
        if (art.content) return true;
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

    // Map artifact log entries to their artifacts
    const getArtifactsForLog = (log) => {
        if (log.log_type !== 'artifact') return [];
        // Match by step_number or by artifact filename mentioned in log message
        return artifacts.filter(a =>
            log.message?.includes(a.filename) ||
            (log.metadata?.artifact_id && log.metadata.artifact_id === a.id)
        );
    };

    const statusBadge = run ? getStatusBadge(run.status) : {};

    return (
        <div className="flex h-full bg-white">
            {/* Left Pane */}
            <div
                className="flex flex-col overflow-hidden border-r border-[#f0f0f0]"
                style={{ width: selectedArtifact ? `calc(100% - ${artifactWidth}px)` : '100%' }}
            >
                {/* Run Header */}
                {run && (
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[#f0f0f0]">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Run #</span>
                                <span className="font-semibold text-xs">{run.name || runId?.slice(0, 8)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-[#f0f0f0] bg-white">
                                {run.status === 'done' ? (
                                    <Check className="h-3 w-3 text-[#0b821a]" strokeWidth={2.5} />
                                ) : run.status === 'needs_attention' || run.status === 'needs_review' ? (
                                    <Activity className="h-3 w-3 text-[#ff1515]" strokeWidth={2} />
                                ) : (
                                    <Loader2 className="h-3 w-3 text-[#2445ff] animate-spin" />
                                )}
                                <span className="font-medium text-black">
                                    {run.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                            </div>
                        </div>
                        {run.document_name && (
                            <span className="text-[12px] text-[#8f8f8f]">{run.document_name}</span>
                        )}
                    </div>
                )}

                {/* Activity Timeline */}
                <div className="flex-1 overflow-y-auto">
                    {/* Today Divider */}
                    <div className="flex items-center py-6 px-8">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink mx-4 text-xs text-gray-500 font-medium">
                            {run ? formatDate(run.created_at) : 'Today'}
                        </span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    {logs.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-[13px] text-[#8f8f8f]">Waiting for activity...</div>
                            <div className="text-[12px] text-[#cacaca] mt-1">Logs will stream here in real-time</div>
                        </div>
                    ) : (
                        <div className="px-8 pb-8">
                            <div className="max-w-3xl">
                                {logs.map((log, index) => {
                                    const isLastItem = index === logs.length - 1;
                                    const status = getLogStatus(log.log_type);
                                    const logArtifacts = getArtifactsForLog(log);

                                    return (
                                        <div key={log.id} className="relative flex gap-4">
                                            {/* Time */}
                                            <div className="w-20 flex-shrink-0 text-right pt-[8.5px]">
                                                <span className="text-[11px] text-[#9CA3AF] font-medium tabular-nums leading-[13px] block">
                                                    {formatTime(log.created_at)}
                                                </span>
                                            </div>

                                            {/* Timeline Icon */}
                                            <div className="relative flex flex-col items-center w-5 self-stretch">
                                                {(!isLastItem || index > 0) && (
                                                    <div
                                                        className={`absolute w-[1px] bg-[#E5E7EB] left-1/2 -translate-x-1/2 
                                                            ${index === 0 ? 'top-[15px]' : 'top-0'} 
                                                            ${isLastItem ? 'h-[15px]' : 'bottom-0'}`}
                                                    ></div>
                                                )}
                                                <div className="relative z-10 bg-white py-[9.5px]">
                                                    <div
                                                        className={`w-[11px] h-[11px] border transition-all duration-300 ${
                                                            status === 'error' ? 'bg-[#FFDADA] border-[#A40000] rounded-[2px]' :
                                                            status === 'complete' ? 'bg-[#E6F3EA] border-[#66B280] rounded-[2px]' :
                                                            'bg-[#DADAFF] border-[#0000A4] animate-square-to-diamond'
                                                        }`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pt-[8.5px] pb-10">
                                                <h3 className="text-[13px] font-medium text-gray-900 mb-1 leading-[13px]">
                                                    {getStepName(log)}
                                                </h3>
                                                <p className="text-[12px] text-[#666] leading-relaxed mb-2">
                                                    {log.message}
                                                </p>

                                                {/* Collapsible metadata */}
                                                <CollapsibleMetadata metadata={log.metadata} />

                                                {/* Inline artifact buttons for artifact-type logs */}
                                                {logArtifacts.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {logArtifacts.map((art) => (
                                                            <button
                                                                key={art.id}
                                                                onClick={() => handleArtifactClick(art)}
                                                                className="inline-flex items-center gap-2 bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 transition-all text-left border-none"
                                                            >
                                                                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-black" strokeWidth={1.5} />
                                                                <span className="text-xs font-normal text-black">{art.filename}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* For artifact logs with no matched artifact, show a generic link */}
                                                {log.log_type === 'artifact' && logArtifacts.length === 0 && artifacts.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {artifacts.map((art) => (
                                                            <button
                                                                key={art.id}
                                                                onClick={() => handleArtifactClick(art)}
                                                                className="inline-flex items-center gap-2 bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 transition-all text-left border-none"
                                                            >
                                                                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-black" strokeWidth={1.5} />
                                                                <span className="text-xs font-normal text-black">{art.filename}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane - Artifact Viewer (when selected) */}
            {selectedArtifact && (
                <div className="flex flex-1 h-full overflow-hidden relative">
                    {/* Resize Handle */}
                    <div
                        className="absolute left-0 top-0 w-1 h-full cursor-col-resize z-50 group hover:bg-black/5 transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[4px] h-12 bg-gray-200 rounded-full group-hover:bg-gray-400 group-active:bg-gray-600 transition-colors border border-white shadow-sm"></div>
                    </div>

                    <div
                        className="h-full border-l border-[#f0f0f0] bg-white flex flex-1 overflow-hidden"
                        style={{ width: `${artifactWidth}px` }}
                    >
                        <DatasetViewer artifact={selectedArtifact} onClose={closeArtifactPanel} />
                    </div>
                </div>
            )}

            {/* Right Sidebar - Key Details (hidden when artifact selected) */}
            {!selectedArtifact && (
                <aside className="w-[400px] border-l border-[#f0f0f0] bg-white overflow-y-auto flex flex-col">
                    <div className="p-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[13px] font-[550] text-[#171717] flex items-center gap-2">
                                <Asterisk className="h-4 w-4 text-[#171717]" />
                                Key Details
                            </h2>
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <Maximize2 className="h-3.5 w-3.5 text-[#8f8f8f]" />
                            </button>
                        </div>

                        {/* Case Details Section */}
                        {run && (
                            <div className="mb-5">
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Database className="h-3 w-3 text-[#171717]" />
                                    <h3 className="text-[13px] font-[550] text-[#171717]">Run Details</h3>
                                </div>
                                <div className="space-y-2.5 text-xs text-center">
                                    <div className="flex justify-center">
                                        <span className="text-gray-500 w-[120px] text-left pr-4">Run #</span>
                                        <span className="text-gray-900 font-medium w-[120px] text-left truncate">
                                            {runId?.slice(0, 8)}
                                        </span>
                                    </div>
                                    {run.name && (
                                        <div className="flex justify-center">
                                            <span className="text-gray-500 w-[120px] text-left pr-4">Name</span>
                                            <span className="text-gray-900 font-medium w-[120px] text-left truncate">{run.name}</span>
                                        </div>
                                    )}
                                    {run.document_name && (
                                        <div className="flex justify-center">
                                            <span className="text-gray-500 w-[120px] text-left pr-4">Document</span>
                                            <span className="text-gray-900 font-medium w-[120px] text-left truncate">{run.document_name}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-center">
                                        <span className="text-gray-500 w-[120px] text-left pr-4">Status</span>
                                        <span className="text-gray-900 font-medium w-[120px] text-left">
                                            {run.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </span>
                                    </div>
                                    <div className="flex justify-center">
                                        <span className="text-gray-500 w-[120px] text-left pr-4">Started</span>
                                        <span className="text-gray-900 font-medium w-[120px] text-left">{formatDate(run.created_at)}</span>
                                    </div>
                                    {run.current_status_text && (
                                        <div className="flex justify-center">
                                            <span className="text-gray-500 w-[120px] text-left pr-4">Status Text</span>
                                            <span className="text-gray-900 font-medium w-[120px] text-left truncate">{run.current_status_text}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-center">
                                        <span className="text-gray-500 w-[120px] text-left pr-4">Steps</span>
                                        <span className="text-gray-900 font-medium w-[120px] text-left">{logs.length}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-[#f0f0f0] -mx-5 my-5"></div>

                        {/* Artifacts Section */}
                        <div>
                            <h3 className="text-[13px] font-[550] text-[#171717] mb-3 flex items-center gap-2">
                                <Presentation className="h-4 w-4 text-[#171717]" />
                                Artifacts
                            </h3>
                            <div className="flex flex-col gap-2 items-start">
                                {artifacts.length === 0 && (
                                    <span className="text-xs text-gray-400 italic">No artifacts generated yet.</span>
                                )}
                                {artifacts.map((art) => (
                                    <button
                                        key={art.id}
                                        onClick={() => handleArtifactClick(art)}
                                        className="inline-flex items-center gap-2 bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 transition-all text-left border-none"
                                    >
                                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-black" strokeWidth={1.5} />
                                        <span className="text-xs font-normal text-black">{art.filename}</span>
                                        {art.url && <ExternalLink className="h-2.5 w-2.5 text-[#8f8f8f]" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>
            )}
        </div>
    );
};

export default ProcessDetails;
