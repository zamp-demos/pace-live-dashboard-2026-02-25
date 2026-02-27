import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../services/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Zap, Link2, Clock, Plus, FileText, Loader2, Download, Image, Table, File, Eye } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/* ── File type helpers ── */
const getFileIcon = (fileType) => {
    if (!fileType) return File;
    if (fileType.startsWith('image/')) return Image;
    if (fileType === 'application/pdf') return FileText;
    if (fileType.includes('spreadsheet') || fileType.includes('csv') || fileType.includes('excel')) return Table;
    if (fileType.includes('markdown') || fileType.includes('text')) return FileText;
    return File;
};

const getFileTypeLabel = (fileType, docType) => {
    if (docType && docType !== 'unknown') {
        return docType.toUpperCase();
    }
    if (!fileType) return 'FILE';
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.startsWith('image/')) return fileType.split('/')[1]?.toUpperCase() || 'IMAGE';
    if (fileType.includes('csv')) return 'CSV';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'XLSX';
    if (fileType.includes('markdown')) return 'MD';
    if (fileType.includes('text')) return 'TXT';
    return 'FILE';
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
        return new Date(isoStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } catch { return ''; }
};

const isPreviewable = (fileType) => {
    if (!fileType) return false;
    return fileType.startsWith('image/') || fileType === 'application/pdf';
};

const KnowledgeBase = () => {
    const { currentProcess } = useOutletContext();
    const [markdown, setMarkdown] = useState('');
    const [kbMeta, setKbMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [previewDoc, setPreviewDoc] = useState(null);

    useEffect(() => {
        if (!currentProcess) return;
        setLoading(true);
        setError(null);

        const loadKB = async () => {
            try {
                let meta = null;
                try {
                    meta = typeof currentProcess.knowledge_base === 'string'
                        ? JSON.parse(currentProcess.knowledge_base)
                        : currentProcess.knowledge_base;
                } catch (e) {
                    meta = null;
                }

                if (meta && meta.storage_path) {
                    setKbMeta(meta);
                    const url = `${SUPABASE_URL}/storage/v1/object/public/${meta.storage_path}`;
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const text = await resp.text();
                        setMarkdown(text);
                    } else {
                        setError('Knowledge base file not found in storage.');
                    }
                } else if (Array.isArray(meta)) {
                    const md = meta.map(item =>
                        `## ${item.title}\n\n${item.content}`
                    ).join('\n\n---\n\n');
                    setMarkdown(md);
                    setKbMeta({ version: 0, triggers: [], integrations: [] });
                } else {
                    setMarkdown('');
                    setKbMeta({ version: 0, triggers: [], integrations: [] });
                }
            } catch (err) {
                setError('Failed to load knowledge base.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadKB();
    }, [currentProcess]);

    if (!currentProcess) {
        return (
            <div className="flex items-center justify-center h-64 text-[#8f8f8f]">
                Select a process to view its knowledge base.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-[#8f8f8f]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading knowledge base...
            </div>
        );
    }

    const triggers = kbMeta?.triggers || [];
    const integrations = kbMeta?.integrations || [];
    const sourceDocuments = kbMeta?.source_documents || [];

    return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            {/* Header */}
            <h1 className="text-[36px] font-bold text-[#171717] mb-8">Knowledge Base</h1>

            {/* Metadata rows */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28 text-[#666666] text-[14px]">
                        <Zap className="w-4 h-4" />
                        <span>Trigger</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {triggers.length > 0 ? (
                            triggers.map((t, i) => (
                                <span key={i} className="px-3 py-1.5 rounded border border-[#ebebeb] text-[13px] font-medium text-[#171717]">{t}</span>
                            ))
                        ) : (
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#ebebeb] text-[13px] font-medium text-[#171717] hover:bg-[#fbfbfb] transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28 text-[#666666] text-[14px]">
                        <Link2 className="w-4 h-4" />
                        <span>Integration</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {integrations.length > 0 ? (
                            integrations.map((t, i) => (
                                <span key={i} className="px-3 py-1.5 rounded border border-[#ebebeb] text-[13px] font-medium text-[#171717]">{t}</span>
                            ))
                        ) : (
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#ebebeb] text-[13px] font-medium text-[#171717] hover:bg-[#fbfbfb] transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28 text-[#666666] text-[14px]">
                        <Clock className="w-4 h-4" />
                        <span>History</span>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#ebebeb] text-[13px] font-medium text-[#171717] hover:bg-[#fbfbfb] transition-colors">
                        View versions
                    </button>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#ebebeb] mb-8"></div>

            {/* Source Documents Section */}
            {sourceDocuments.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-[18px] font-semibold text-[#171717] mb-4 flex items-center gap-2">
                        <File className="w-5 h-5 text-[#666]" />
                        Source Documents
                        <span className="text-[12px] font-normal text-[#8f8f8f] ml-1">
                            ({sourceDocuments.length})
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sourceDocuments.map((doc, i) => {
                            const IconComponent = getFileIcon(doc.file_type);
                            const typeLabel = getFileTypeLabel(doc.file_type, doc.doc_type);
                            const canPreview = isPreviewable(doc.file_type);

                            return (
                                <div
                                    key={doc.filename + i}
                                    className="group flex items-start gap-3 p-4 rounded-lg border border-[#ebebeb] hover:border-[#d0d0d0] hover:bg-[#fafafa] transition-all cursor-default"
                                >
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center">
                                        <IconComponent className="w-5 h-5 text-[#666]" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-[#171717] truncate" title={doc.filename}>
                                            {doc.filename}
                                        </p>
                                        <p className="text-[11px] text-[#8f8f8f] mt-0.5 line-clamp-2" title={doc.description}>
                                            {doc.description || doc.filename}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#b0b0b0]">
                                            <span className="px-1.5 py-0.5 rounded bg-[#f0f0f0] text-[#666] font-medium">
                                                {typeLabel}
                                            </span>
                                            {doc.size_bytes && (
                                                <span>{formatBytes(doc.size_bytes)}</span>
                                            )}
                                            {doc.uploaded_at && (
                                                <span>{formatDate(doc.uploaded_at)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canPreview && (
                                            <button
                                                onClick={() => setPreviewDoc(doc)}
                                                className="p-1.5 rounded hover:bg-[#ebebeb] text-[#8f8f8f] hover:text-[#333] transition-colors"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <a
                                            href={doc.public_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded hover:bg-[#ebebeb] text-[#8f8f8f] hover:text-[#333] transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Divider after source docs */}
                    <div className="border-t border-[#ebebeb] mt-8 mb-8"></div>
                </div>
            )}

            {/* KB Content */}
            {error ? (
                <div className="text-red-500 text-center py-12">{error}</div>
            ) : !markdown ? (
                <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-[#cacaca] mx-auto mb-4" />
                    <p className="text-[#666666] text-lg mb-2">No knowledge base yet</p>
                    <p className="text-[#8f8f8f] text-sm">
                        Start a conversation with Pace to build the knowledge base for this process.
                    </p>
                </div>
            ) : (
                <div className="kb-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdown}
                    </ReactMarkdown>
                </div>
            )}

            {/* Preview Modal */}
            {previewDoc && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8"
                    onClick={() => setPreviewDoc(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[85vh] w-full flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebebeb]">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-[#666]" />
                                <span className="text-[14px] font-medium text-[#171717]">
                                    {previewDoc.filename}
                                </span>
                                <span className="text-[11px] text-[#8f8f8f]">
                                    {previewDoc.description}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.public_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded hover:bg-[#f5f5f5] text-[#666] hover:text-[#333] transition-colors"
                                    title="Open in new tab"
                                >
                                    <Download className="w-4 h-4" />
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-2 rounded hover:bg-[#f5f5f5] text-[#666] hover:text-[#333] transition-colors text-lg font-light"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        {/* Modal body */}
                        <div className="flex-1 overflow-auto bg-[#f9f9f9]">
                            {previewDoc.file_type?.startsWith('image/') ? (
                                <div className="flex items-center justify-center p-8">
                                    <img
                                        src={previewDoc.public_url}
                                        alt={previewDoc.filename}
                                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                                    />
                                </div>
                            ) : previewDoc.file_type === 'application/pdf' ? (
                                <iframe
                                    src={previewDoc.public_url}
                                    className="w-full h-[75vh]"
                                    title={previewDoc.filename}
                                />
                            ) : (
                                <div className="p-8 text-center text-[#8f8f8f]">
                                    Preview not available for this file type.
                                    <a href={previewDoc.public_url} target="_blank" rel="noopener noreferrer"
                                       className="text-blue-600 underline ml-1">Download instead</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
