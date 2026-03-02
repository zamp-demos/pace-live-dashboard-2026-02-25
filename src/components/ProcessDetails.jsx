import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Check, Activity, FileText, Clock, ExternalLink, Loader2, X,
    Database, Asterisk, Presentation, Maximize2, ChevronDown, ChevronUp,
    Download, Sliders, Filter, Layout, LayoutGrid, Menu, Brain, Briefcase,
    Eye, Paperclip, Image, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
    Play
} from 'lucide-react';
import { fetchLogs, fetchArtifacts, fetchBrowserRecordings, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';
import VideoPlayer from './VideoPlayer';

/* ─── Helpers: classify metadata fields ─── */
const REASONING_KEYS = new Set([
    'confidence', 'match_score', 'score', 'status', 'result',
    'reason', 'note', 'validation', 'match_result', 'flag',
    'accuracy', 'threshold', 'decision', 'outcome', 'verdict',
    'similarity', 'match_type', 'method', 'model', 'duration_ms',
    'document_type', 'action', 'completeness', 'quality_score',
    'match_found', 'search_method', 'recommendation', 'action_id',
    'decision_by', 'final_status', 'match_verdict', 'line_items_total'
]);

const SKIP_KEYS = new Set(['step_name', 'reasoning_steps']);

/* Fields we want to surface in Case Details sidebar */
const CASE_DETAIL_KEYS = new Set([
    'vendor', 'vendor_name', 'invoice_number', 'invoice_no',
    'po_number', 'invoice_amount', 'total', 'currency',
    'match_verdict', 'quality_score', 'final_status',
    'document_type', 'invoice_date', 'po_date', 'department',
    'linkages', 'decision_by', 'recommendation'
]);

function isLargeData(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 2;
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length >= 4) return true;
        return keys.some(k => {
            const v = value[k];
            return (typeof v === 'object' && v !== null && Object.keys(v).length >= 2);
        });
    }
    if (typeof value === 'string') return value.length > 300;
    return false;
}


/* --- Split long log messages into summary + detail --- */
function splitLogMessage(message) {
    if (!message || typeof message !== 'string') return { summary: message || '', detail: '' };
    // If short enough, no split needed
    if (message.length <= 140) return { summary: message, detail: '' };
    // Try to split at first sentence boundary (period followed by space + capital letter)
    const sentenceMatch = message.match(/^([^.]+\.\s?)(.+)/s);
    if (sentenceMatch && sentenceMatch[1].length >= 20 && sentenceMatch[1].length <= 200) {
        return { summary: sentenceMatch[1].trim(), detail: sentenceMatch[2].trim() };
    }
    // Fallback: truncate at ~120 chars on word boundary
    const truncAt = message.lastIndexOf(' ', 120);
    if (truncAt > 40) {
        return { summary: message.slice(0, truncAt) + '...', detail: message };
    }
    return { summary: message.slice(0, 120) + '...', detail: message };
}

function classifyMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return { reasoning: {}, dataArtifacts: [] };

    const reasoning = {};
    const dataArtifacts = [];

    Object.entries(metadata).forEach(([key, value]) => {
        if (SKIP_KEYS.has(key)) return;

        if (isLargeData(value)) {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
            dataArtifacts.push({
                id: `meta-${key}-${Math.random().toString(36).slice(2, 8)}`,
                filename: `${label.charAt(0).toUpperCase() + label.slice(1)}`,
                file_type: 'json',
                content: value,
                _isMetaArtifact: true,
            });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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

/* Extract case details from all logs */
function extractCaseDetails(logs) {
    const details = {};
    // Process logs in order so later steps overwrite earlier ones (more complete data)
    logs.forEach(log => {
        if (!log.metadata) return;
        Object.entries(log.metadata).forEach(([key, value]) => {
            if (CASE_DETAIL_KEYS.has(key) && value !== null && value !== undefined) {
                // Only take simple displayable values
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    details[key] = value;
                } else if (typeof value === 'object' && !Array.isArray(value)) {
                    // For small objects like linkages, flatten to a readable string
                    const parts = Object.entries(value)
                        .filter(([, v]) => v !== null)
                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
                    if (parts.length > 0 && parts.length <= 3) {
                        details[key] = parts.join(', ');
                    }
                }
            }
        });
    });
    return details;
}

/* Format field key for display */
const formatFieldKey = (key) => {
    const display = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\./g, ' > ')
        .trim();
    return display.charAt(0).toUpperCase() + display.slice(1);
};

/* ─── CollapsibleReasoning ─── */
const CollapsibleReasoning = ({ reasoning, messageDetail, reasoningSteps, summaryText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const entries = Object.entries(reasoning || {});
    const hasSteps = Array.isArray(reasoningSteps) && reasoningSteps.length > 0;
    if (entries.length === 0 && !messageDetail && !hasSteps) return null;

    const formatValue = (val) => {
        if (val === true) return 'Yes';
        if (val === false) return 'No';
        if (val === null || val === undefined) return '\u2014';
        return String(val);
    };

    /* Collect all displayable lines into a flat array for the tree connector */
    const lines = [];
    if (summaryText) {
        lines.push({ type: 'narrative', text: summaryText.replace(/^[•·\-*]\s*/, '') });
    }
    if (messageDetail) {
        lines.push({ type: 'narrative', text: messageDetail });
    }
    entries.forEach(([key, val]) => {
        lines.push({ type: 'kv', label: formatFieldKey(key), value: formatValue(val) });
    });
    if (hasSteps) {
        reasoningSteps.forEach((step) => {
            lines.push({ type: 'step', text: step });
        });
    }

    return (
        <div className="mt-2.5">
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden" style={{ width: "min(50vw, 480px)" }}>
                {/* Toggle row — compact width, grey */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                >
                    <span className="font-medium">{isOpen ? 'Hide reasoning' : 'See reasoning'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Expanded content with tree-branch connectors */}
                {isOpen && (
                    <div className="px-3 pb-3 pt-0.5">
                        <div className="space-y-0">
                            {lines.map((line, idx) => {
                                const isLast = idx === lines.length - 1;
                                return (
                                    <div key={idx} className="flex items-start gap-2 min-h-[24px]">
                                        {/* Tree connector — curved elbow for last, tee for others */}
                                        <div className="flex flex-col items-center w-4 flex-shrink-0">
                                            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="flex-shrink-0">
                                                {/* vertical line above */}
                                                <line x1="4" y1="0" x2="4" y2="12" stroke="#D1D5DB" strokeWidth="1.5" />
                                                {/* horizontal line to right */}
                                                <line x1="4" y1="12" x2="16" y2="12" stroke="#D1D5DB" strokeWidth="1.5" />
                                                {/* vertical line below (not on last item) */}
                                                {!isLast && <line x1="4" y1="12" x2="4" y2="24" stroke="#D1D5DB" strokeWidth="1.5" />}
                                            </svg>
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 py-0.5">
                                            {line.type === 'narrative' && (
                                                <p className="text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap">{line.text}</p>
                                            )}
                                            {line.type === 'kv' && (
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[12px] text-[#6B7280] flex-shrink-0">{line.label}:</span>
                                                    <span className="text-[12px] text-[#171717] font-medium break-all">{line.value}</span>
                                                </div>
                                            )}
                                            {line.type === 'step' && (
                                                <span className="text-[12px] text-[#555]">{line.text}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Document type detection ─── */
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'gif', 'bmp', 'webp', 'svg']);
const DOCUMENT_MIMETYPES = new Set([
    'application/pdf', 'image/png', 'image/jpeg', 'image/tiff',
    'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
]);

function isDocumentFile(artifact) {
    if (!artifact) return false;
    // Check file extension
    const ext = (artifact.file_type || artifact.filename || '').split('.').pop().toLowerCase();
    if (DOCUMENT_EXTENSIONS.has(ext)) return true;
    // Check metadata file_type (MIME)
    const mime = artifact.metadata?.file_type || '';
    if (DOCUMENT_MIMETYPES.has(mime)) return true;
    // Check if artifact has a URL and extension in filename
    if (artifact.url && artifact.filename) {
        const fnExt = artifact.filename.split('.').pop().toLowerCase();
        if (DOCUMENT_EXTENSIONS.has(fnExt)) return true;
    }
    return false;
}

function getDocumentType(artifact) {
    const fname = artifact?.filename || '';
    const ext = fname.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(ext)) return 'image';
    return 'unknown';
}

/* ─── DocumentPreview ─── */
const DocumentPreview = ({ artifact, onClose }) => {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);
    const docType = getDocumentType(artifact);
    const fileUrl = artifact?.url || artifact?.file_url || '';
    const fileName = artifact?.filename || 'Document';
    const fileSize = artifact?.metadata?.file_size_bytes || artifact?.file_size_bytes;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const handleDownload = () => {
        if (fileUrl) {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10 w-full">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-red-50 rounded">
                        {docType === 'pdf'
                            ? <FileText className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                            : <Image className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                        }
                    </div>
                    <div className="min-w-0">
                        <span className="text-[14px] font-medium text-[#171717] truncate block">{fileName}</span>
                        {fileSize && (
                            <span className="text-[11px] text-[#9CA3AF]">{formatSize(fileSize)}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleDownload} title="Download"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileUrl && window.open(fileUrl, '_blank')} title="Open in new tab"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} title="Close"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Toolbar for zoom/rotate (images) */}
            {docType === 'image' && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-gray-100 bg-[#fafafa]">
                    <button onClick={() => setZoom(z => Math.max(25, z - 25))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-[11px] text-gray-500 w-12 text-center">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(300, z + 25))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><ZoomIn className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><RotateCw className="w-4 h-4" /></button>
                    <button onClick={() => setZoom(100)}
                        className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200 rounded">Reset</button>
                </div>
            )}

            {/* Document content */}
            <div className="flex-1 overflow-auto bg-[#f5f5f5]">
                {docType === 'pdf' && fileUrl ? (
                    <iframe
                        src={`${fileUrl}#toolbar=1&navpanes=0`}
                        className="w-full h-full border-0"
                        title={fileName}
                        style={{ minHeight: '100%' }}
                    />
                ) : docType === 'image' && fileUrl ? (
                    <div className="flex items-center justify-center p-4 min-h-full">
                        <img
                            src={fileUrl}
                            alt={fileName}
                            style={{
                                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease',
                                maxWidth: zoom <= 100 ? '100%' : 'none',
                            }}
                            className="shadow-lg rounded"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <FileText className="w-12 h-12" strokeWidth={1} />
                        <p className="text-sm">Preview not available</p>
                        <button onClick={handleDownload}
                            className="px-3 py-1.5 bg-black text-white text-xs rounded-md hover:bg-gray-800 transition-colors">
                            Download File
                        </button>
                    </div>
                )}
            </div>
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
                                                <span>{formatFieldKey(header)}</span>
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
                                        {formatFieldKey(key)}
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
    const [recordings, setRecordings] = useState([]);
    const [selectedArtifact, setSelectedArtifact] = useState(null);
    const [artifactWidth, setArtifactWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
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
        const loadRecordings = async () => {
            try { setRecordings(await fetchBrowserRecordings(runId)); } catch (err) { console.error(err); }
        };
        loadRecordings();
        const unsubLogs = subscribeToTable('activity_logs', `run_id=eq.${runId}`, () => loadLogs());
        const unsubArtifacts = subscribeToTable('artifacts', `run_id=eq.${runId}`, () => loadArtifacts());
        const unsubRun = subscribeToTable('activity_runs', `id=eq.${runId}`, () => loadRun());
        const unsubRecordings = subscribeToTable('browser_recordings', `run_id=eq.${runId}`, () => loadRecordings());
        return () => { unsubLogs(); unsubArtifacts(); unsubRun(); unsubRecordings(); };
    }, [runId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

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

    const logMetaClassified = useMemo(() => {
        const map = {};
        logs.forEach(log => { map[log.id] = classifyMetadata(log.metadata); });
        return map;
    }, [logs]);

    const allArtifacts = useMemo(() => {
        const combined = [...artifacts];
        Object.values(logMetaClassified).forEach(({ dataArtifacts }) => {
            dataArtifacts.forEach(da => {
                if (!combined.some(a => a.id === da.id)) combined.push(da);
            });
        });
        return combined;
    }, [artifacts, logMetaClassified]);

    // Extract case details from log metadata
    const caseDetails = useMemo(() => extractCaseDetails(logs), [logs]);

    /* ─── Group logs by step_name so sub-steps render as one entry ─── */
    const groupedLogs = useMemo(() => {
        const groups = [];
        const stepMap = new Map(); // step_name -> group index

        logs.forEach((log) => {
            const stepName = log.metadata?.step_name;
            if (stepName && stepMap.has(stepName)) {
                // Add to existing group
                groups[stepMap.get(stepName)].logs.push(log);
            } else {
                // New group
                const idx = groups.length;
                if (stepName) stepMap.set(stepName, idx);
                groups.push({ stepName: stepName || null, logs: [log] });
            }
        });

        // Enrich each group with combined artifacts, reasoning, recordings
        return groups.map((group) => {
            const firstLog = group.logs[0];
            const lastLog = group.logs[group.logs.length - 1];
            const stepNumbers = new Set(group.logs.map(l => l.step_number));

            // Collect all DB artifacts whose step_number matches any log in group
            const dbArts = artifacts.filter(a =>
                stepNumbers.has(a.step_number) ||
                group.logs.some(l =>
                    l.log_type === 'artifact' && (
                        l.message?.includes(a.filename) ||
                        (l.metadata?.artifact_id && l.metadata.artifact_id === a.id)
                    )
                )
            );

            // Collect all meta artifacts from classified metadata
            const metaArts = [];
            group.logs.forEach(l => {
                const classified = logMetaClassified[l.id];
                if (classified?.dataArtifacts) metaArts.push(...classified.dataArtifacts);
            });

            // Collect recordings for any step_number in the group
            const recs = recordings.filter(r => stepNumbers.has(r.step_number));

            // Merge reasoning from all logs
            const mergedReasoning = {};
            const allReasoningSteps = [];
            group.logs.forEach(l => {
                const classified = logMetaClassified[l.id];
                if (classified?.reasoning) Object.assign(mergedReasoning, classified.reasoning);
                const rs = l.metadata?.reasoning_steps;
                if (Array.isArray(rs)) allReasoningSteps.push(...rs);
            });

            // Collect non-artifact messages
            const messages = group.logs
                .filter(l => l.log_type !== 'artifact' && l.message)
                .map(l => l.message);

            // Combined message detail
            const combinedMessage = messages.join(' ');
            const msgSplit = splitLogMessage(combinedMessage);

            return {
                ...group,
                firstLog,
                lastLog,
                stepNumbers,
                dbArtifacts: dbArts,
                metaArtifacts: metaArts,
                recordings: recs,
                mergedReasoning,
                allReasoningSteps,
                messages,
                msgSplit,
            };
        });
    }, [logs, artifacts, recordings, logMetaClassified]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };
    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const getStepName = (log) => log.metadata?.step_name || `Step ${log.step_number}`;

    const getIconStatus = (log, index) => {
        if (log.log_type === 'error') return 'error';
        if (log.log_type === 'complete') return 'complete';
        const isLast = index === logs.length - 1;
        if (!isLast) return 'complete';
        if (!run) return 'in-progress';
        if (run.status === 'done') return 'complete';
        if (run.status === 'needs_attention' || run.status === 'needs_review') return 'error';
        return 'in-progress';
    };

    const isViewableArtifact = (art) => {
        if (art.content) return true;
        if (art._isMetaArtifact) return true;
        if (art.file_type === 'application/json' || art.file_type === 'json') return true;
        return false;
    };

    const getRecordingForLog = (log) => {
        return recordings.find(r => r.step_number === log.step_number) || null;
    };

    const handleArtifactClick = (art) => {
        if (art._isVideo) {
            setSelectedArtifact(art);
        } else if (isDocumentFile(art)) {
            setSelectedArtifact({ ...art, _isDocument: true });
        } else if (isViewableArtifact(art)) {
            setSelectedArtifact(art);
        } else if (art.url) {
            window.open(art.url, '_blank');
        }
    };

    const getDbArtifactsForLog = (log) => {
        if (log.log_type !== 'artifact') return [];
        return artifacts.filter(a =>
            log.message?.includes(a.filename) ||
            (log.metadata?.artifact_id && log.metadata.artifact_id === a.id)
        );
    };

    const formatCaseValue = (key, val) => {
        if (typeof val === 'number') {
            if (key.includes('amount') || key.includes('total')) {
                return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            if (key.includes('score')) return val.toFixed(2);
            return String(val);
        }
        return String(val);
    };

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Main content - NO margin-right, flex handles it */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-5 border-b border-[#f0f0f0] bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-[16px] font-semibold text-[#171717]">
                                {run?.document_name || run?.name || `Run ${runId?.slice(0, 8)}`}
                            </h2>
                            {run?.status && (
                                <span className={`flex items-center gap-1 text-[12px] font-medium ${
                                    run.status === 'done' ? 'text-[#038408]' :
                                    run.status === 'in_progress' ? 'text-[#0000A4]' :
                                    (run.status === 'needs_attention' || run.status === 'needs_review') ? 'text-[#A40000]' :
                                    'text-[#666]'
                                }`}>
                                    {run.status === 'done' && (
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3a1 1 0 010 1.4l-6 6a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4L6.5 9.6l5.3-5.3a1 1 0 011.4 0z" fill="currentColor"/></svg>
                                    )}
                                    {run.status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                                </span>
                            )}
                        </div>
                        <p className="text-[12px] text-[#9CA3AF]">
                            {run?.started_at && `Started ${formatDate(run.started_at)}`}
                        </p>
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
                            {groupedLogs.map((group, groupIndex) => {
                                const { firstLog, lastLog, mergedReasoning, allReasoningSteps, msgSplit, dbArtifacts, metaArtifacts, recordings: groupRecordings } = group;
                                const isLastGroup = groupIndex === groupedLogs.length - 1;
                                const status = getIconStatus(lastLog, isLastGroup ? logs.length - 1 : logs.indexOf(lastLog));
                                const stepLabel = group.stepName || getStepName(firstLog);
                                const hasReasoning = (
                                    Object.keys(mergedReasoning || {}).length > 0 ||
                                    !!msgSplit.detail ||
                                    allReasoningSteps.length > 0
                                );
                                // Deduplicate DB artifacts by id
                                const seenArtIds = new Set();
                                const uniqueDbArts = dbArtifacts.filter(a => {
                                    if (seenArtIds.has(a.id)) return false;
                                    seenArtIds.add(a.id);
                                    return true;
                                });
                                // All attachments: DB artifacts + meta artifacts + recordings
                                const hasAttachments = uniqueDbArts.length > 0 || metaArtifacts.length > 0 || groupRecordings.length > 0;

                                return (
                                    <div key={firstLog.id} className="flex gap-4 pb-6 relative">
                                        <div className="flex flex-col items-center w-[11px] flex-shrink-0 pt-[4px]">
                                            <div className={`w-[11px] h-[11px] rounded-[2px] border flex-shrink-0 ${
                                                status === 'complete'
                                                    ? 'bg-[#E6F3EA] border-[#66B280]'
                                                    : status === 'error'
                                                    ? 'bg-[#FFDADA] border-[#A40000]'
                                                    : 'bg-[#DADAFF] border-[#0000A4] animate-square-to-diamond'
                                            }`} />
                                            {!isLastGroup && (
                                                <div className="w-[1px] bg-[#E5E7EB] flex-1 min-h-[20px] mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pb-2">
                                            {/* Step name + timestamp */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[13px] font-medium text-[#171717]">
                                                    {stepLabel}
                                                </span>
                                                <span className="text-[10px] text-[#9CA3AF]">
                                                    {formatTime(firstLog.created_at)}
                                                </span>
                                                {group.logs.length > 1 && (
                                                    <span className="text-[10px] text-[#D1D5DB]">
                                                        ({group.logs.length} sub-steps)
                                                    </span>
                                                )}
                                            </div>
                                            {/* Summary text — hidden when reasoning box shows it */}
                                            {!hasReasoning && msgSplit.summary && (
                                                <p className="text-[12px] text-[#666] mt-0.5 leading-relaxed">
                                                    {msgSplit.summary.replace(/^[\u2022\u00b7\-*]\s*/, '')}
                                                </p>
                                            )}
                                            {/* Reasoning box with merged data */}
                                            <CollapsibleReasoning
                                                reasoning={mergedReasoning}
                                                messageDetail={msgSplit.detail}
                                                reasoningSteps={allReasoningSteps}
                                                summaryText={msgSplit.summary}
                                            />
                                            {/* All attachments: DB artifacts + data artifacts + recordings */}
                                            {hasAttachments && (
                                                <div className="flex flex-wrap gap-2 mt-2.5">
                                                    {uniqueDbArts.map(art => {
                                                        const isPdf = art.filename?.toLowerCase().endsWith('.pdf');
                                                        const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(art.filename || '');
                                                        return (
                                                            <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                                className={`${isPdf ? 'bg-red-50 hover:bg-red-100 border border-red-100' : isImg ? 'bg-blue-50 hover:bg-blue-100 border border-blue-100' : 'bg-[#f2f2f2] hover:bg-gray-200 border border-gray-200'} rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors group/chip`}>
                                                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                                                    isPdf ? 'bg-red-100' : isImg ? 'bg-blue-100' : 'bg-gray-200'
                                                                }`}>
                                                                    {isPdf ? (
                                                                        <FileText className="h-3 w-3 text-red-500" strokeWidth={2} />
                                                                    ) : isImg ? (
                                                                        <Image className="h-3 w-3 text-blue-500" strokeWidth={2} />
                                                                    ) : (
                                                                        <FileText className="h-3 w-3 text-[#666]" strokeWidth={2} />
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-medium text-[#374151]">{art.filename}</span>
                                                                <Eye className="h-3 w-3 text-[#D1D5DB] group-hover/chip:text-[#9CA3AF] flex-shrink-0 ml-0.5" strokeWidth={1.5} />
                                                            </button>
                                                        );
                                                    })}
                                                    {metaArtifacts.map(da => (
                                                        <button key={da.id} onClick={() => setSelectedArtifact(da)}
                                                            className="bg-[#f2f2f2] hover:bg-gray-200 rounded-[6px] px-2 py-1 flex items-center gap-1.5 transition-colors">
                                                            <Database className="h-3.5 w-3.5 text-[#666]" strokeWidth={1.5} />
                                                            <span className="text-xs font-normal text-black">{da.filename}</span>
                                                        </button>
                                                    ))}
                                                    {groupRecordings.map(rec => (
                                                        <button key={rec.id}
                                                            onClick={() => handleArtifactClick({ ...rec, _isVideo: true })}
                                                            className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-[6px] px-2.5 py-1.5 flex items-center gap-2 transition-colors">
                                                            <Play className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" strokeWidth={1.5} />
                                                            <span className="text-xs font-normal text-black">Browser Recording</span>
                                                            {rec.status === 'pending' && (
                                                                <span className="text-[9px] text-indigo-400">(processing)</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right panel: Artifact viewer OR Key Details sidebar */}
            {selectedArtifact ? (
                <>
                    <div className="w-1 cursor-col-resize hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
                        onMouseDown={() => setIsResizing(true)} />
                    <div style={{ width: artifactWidth }} className="flex-shrink-0 border-l border-[#f0f0f0]">
                        {selectedArtifact._isVideo ? (
                            <VideoPlayer recording={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
                        ) : selectedArtifact._isDocument ? (
                            <DocumentPreview artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
                        ) : (
                            <DatasetViewer artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
                        )}
                    </div>
                </>
            ) : (
                <div className="w-[400px] flex-shrink-0 border-l border-[#f0f0f0] bg-white overflow-y-auto custom-scrollbar">
                    <div className="px-5 pt-5 pb-4">
                        <h3 className="text-[14px] font-semibold text-[#171717]">Key Details</h3>
                    </div>

                    {/* Case Details - extracted from log metadata */}
                    {Object.keys(caseDetails).length > 0 && (
                        <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                                <Briefcase className="w-3.5 h-3.5 text-[#6B7280]" />
                                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Case Details</span>
                            </div>
                            <div className="px-4 pb-3.5 space-y-3">
                                {Object.entries(caseDetails).map(([key, value]) => (
                                    <div key={key}>
                                        <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-0.5">{formatFieldKey(key)}</p>
                                        <p className="text-[13px] text-[#171717] font-medium break-words leading-snug">
                                            {formatCaseValue(key, value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Run Details */}
                    <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                            <Database className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Run Details</span>
                        </div>
                        <div className="px-4 pb-3.5 space-y-3">
                            {[
                                ['Run ID', runId?.slice(0, 8)],
                                ['Status', run?.status?.replace(/_/g, ' ')],
                                ['Started', run?.started_at ? formatDate(run.started_at) + ' ' + formatTime(run.started_at) : '\u2014'],
                                ['Completed', run?.completed_at ? formatDate(run.completed_at) + ' ' + formatTime(run.completed_at) : '\u2014'],
                                ['Steps', logs.length.toString()],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-0.5">{label}</p>
                                    <p className="text-[13px] text-[#171717] font-medium">{value || '\u2014'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Artifacts */}
                    <div className="mx-4 mb-4 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                            <Presentation className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Artifacts</span>
                        </div>
                        <div className="px-4 pb-3.5">
                            {allArtifacts.length === 0 ? (
                                <p className="text-[12px] text-[#9CA3AF]">No artifacts generated</p>
                            ) : (
                                <div className="space-y-1">
                                    {allArtifacts.map(art => {
                                        const isPdf = art.filename?.toLowerCase().endsWith('.pdf');
                                        const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(art.filename || '');
                                        return (
                                            <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f5f5f5] transition-colors text-left group">
                                                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                                    isPdf ? 'bg-red-50' : isImg ? 'bg-blue-50' : art._isMetaArtifact ? 'bg-purple-50' : 'bg-gray-100'
                                                }`}>
                                                    {art._isMetaArtifact ? (
                                                        <Database className="w-3.5 h-3.5 text-purple-500" />
                                                    ) : isPdf ? (
                                                        <FileText className="w-3.5 h-3.5 text-red-500" />
                                                    ) : isImg ? (
                                                        <Image className="w-3.5 h-3.5 text-blue-500" />
                                                    ) : (
                                                        <FileText className="w-3.5 h-3.5 text-[#666]" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12px] font-medium text-[#171717] truncate">{art.filename}</p>
                                                    <p className="text-[10px] text-[#9CA3AF]">
                                                        {art._isMetaArtifact ? 'Extracted data' : (art.file_type || 'file')}
                                                    </p>
                                                </div>
                                                <Eye className="w-3.5 h-3.5 text-[#d1d5db] group-hover:text-[#9CA3AF] flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessDetails;
