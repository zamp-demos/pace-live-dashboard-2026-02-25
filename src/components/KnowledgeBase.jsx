import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../services/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Zap, Link2, Clock, Plus, FileText, Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const KnowledgeBase = () => {
    const { currentProcess } = useOutletContext();
    const [markdown, setMarkdown] = useState('');
    const [kbMeta, setKbMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
        </div>
    );
};

export default KnowledgeBase;
