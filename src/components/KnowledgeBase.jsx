import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../services/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Zap, Link2, Clock, Plus, ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react';

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
                // Parse knowledge_base metadata from process
                let meta = null;
                try {
                    meta = typeof currentProcess.knowledge_base === 'string'
                        ? JSON.parse(currentProcess.knowledge_base)
                        : currentProcess.knowledge_base;
                } catch (e) {
                    meta = null;
                }

                // If it has a storage_path, fetch from Storage bucket
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
                }
                // Legacy: if it's an array of {title, content}, convert to markdown
                else if (Array.isArray(meta)) {
                    const md = meta.map(item =>
                        `## ${item.title}\n\n${item.content}`
                    ).join('\n\n---\n\n');
                    setMarkdown(md);
                    setKbMeta({ version: 0, triggers: [], integrations: [] });
                }
                else {
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
            <div className="flex items-center justify-center h-64 text-gray-500">
                Select a process to view its knowledge base.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading knowledge base...
            </div>
        );
    }

    const triggers = kbMeta?.triggers || [];
    const integrations = kbMeta?.integrations || [];
    const version = kbMeta?.version || 0;

    return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            {/* Header */}
            <h1 className="text-3xl font-bold text-gray-100 mb-8">Knowledge Base</h1>

            {/* Metadata rows */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-40 text-gray-400">
                        <Zap className="w-4 h-4" />
                        <span className="text-sm">Trigger</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {triggers.length > 0 ? (
                            triggers.map((t, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md text-sm">{t}</span>
                            ))
                        ) : (
                            <button className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-md text-sm transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-40 text-gray-400">
                        <Link2 className="w-4 h-4" />
                        <span className="text-sm">Integration</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {integrations.length > 0 ? (
                            integrations.map((t, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md text-sm">{t}</span>
                            ))
                        ) : (
                            <button className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-md text-sm transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-40 text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">History</span>
                    </div>
                    <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md text-sm transition-colors">
                        View versions
                    </button>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 mb-8"></div>

            {/* KB Content */}
            {error ? (
                <div className="text-red-400 text-center py-12">{error}</div>
            ) : !markdown ? (
                <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg mb-2">No knowledge base yet</p>
                    <p className="text-gray-500 text-sm">
                        Start a conversation with Pace to build the knowledge base for this process.
                    </p>
                </div>
            ) : (
                <article className="kb-content prose prose-invert prose-gray max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => (
                                <h1 className="text-2xl font-bold text-gray-100 mt-8 mb-4">{children}</h1>
                            ),
                            h2: ({ children }) => (
                                <>
                                    <h2 className="text-xl font-semibold text-gray-100 mt-10 mb-3">{children}</h2>
                                    <div className="border-t border-gray-700 mb-4"></div>
                                </>
                            ),
                            h3: ({ children }) => (
                                <h3 className="text-lg font-semibold text-gray-200 mt-6 mb-2">{children}</h3>
                            ),
                            p: ({ children }) => (
                                <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
                            ),
                            ul: ({ children }) => (
                                <ul className="list-disc list-outside ml-5 space-y-1.5 mb-4 text-gray-300">{children}</ul>
                            ),
                            ol: ({ children }) => (
                                <ol className="list-decimal list-outside ml-5 space-y-1.5 mb-4 text-gray-300">{children}</ol>
                            ),
                            li: ({ children }) => (
                                <li className="text-gray-300 leading-relaxed">{children}</li>
                            ),
                            strong: ({ children }) => (
                                <strong className="text-gray-100 font-semibold">{children}</strong>
                            ),
                            table: ({ children }) => (
                                <div className="overflow-x-auto mb-6 rounded-lg border border-gray-700">
                                    <table className="min-w-full divide-y divide-gray-700">{children}</table>
                                </div>
                            ),
                            thead: ({ children }) => (
                                <thead className="bg-gray-800">{children}</thead>
                            ),
                            th: ({ children }) => (
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{children}</th>
                            ),
                            td: ({ children }) => (
                                <td className="px-4 py-3 text-sm text-gray-300 border-t border-gray-700">{children}</td>
                            ),
                            hr: () => (
                                <hr className="border-gray-700 my-8" />
                            ),
                            code: ({ inline, children }) => (
                                inline
                                    ? <code className="bg-gray-800 text-amber-300 px-1.5 py-0.5 rounded text-sm">{children}</code>
                                    : <code className="block bg-gray-800 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto mb-4">{children}</code>
                            ),
                        }}
                    />
                </article>
            )}
        </div>
    );
};

export default KnowledgeBase;
