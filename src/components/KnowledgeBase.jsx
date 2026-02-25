import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, FileText, ChevronRight, Search } from 'lucide-react';
import { fetchKnowledgeBase, subscribeToTable } from '../services/supabase';

const KnowledgeBase = () => {
    const { currentProcess } = useOutletContext();
    const [kb, setKb] = useState(null);
    const [expandedSection, setExpandedSection] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!currentProcess) return;

        const loadKB = async () => {
            try {
                const data = await fetchKnowledgeBase(currentProcess.id);
                setKb(data);
            } catch (err) { console.error(err); }
        };
        loadKB();

        const unsub = subscribeToTable('processes', `id=eq.${currentProcess.id}`, () => loadKB());
        return unsub;
    }, [currentProcess]);

    if (!currentProcess) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <BookOpen className="w-8 h-8 text-[#cacaca] mb-3" />
                <div className="text-[14px] font-[500] text-[#171717] mb-1">No process selected</div>
                <div className="text-[13px] text-[#7d7d7d]">Select a process from the sidebar</div>
            </div>
        );
    }

    if (!kb) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <BookOpen className="w-8 h-8 text-[#cacaca] mb-3" />
                <div className="text-[14px] font-[500] text-[#171717] mb-1">No knowledge base yet</div>
                <div className="text-[13px] text-[#7d7d7d] max-w-[300px]">
                    Pace will build the knowledge base for this process as it learns.
                </div>
            </div>
        );
    }

    // KB is stored as JSON — either an object with sections or an array of entries
    const sections = Array.isArray(kb) ? kb : (kb.sections || [kb]);

    const filteredSections = searchQuery
        ? sections.filter(s => {
            const title = (s.title || s.name || '').toLowerCase();
            const content = (s.content || s.description || JSON.stringify(s)).toLowerCase();
            return title.includes(searchQuery.toLowerCase()) || content.includes(searchQuery.toLowerCase());
        })
        : sections;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-[16px] font-[600] text-[#171717] mb-1">Knowledge Base</h2>
                    <p className="text-[13px] text-[#8f8f8f]">Process-specific rules, decisions, and learnings captured by Pace.</p>
                </div>

                {/* Search */}
                {sections.length > 3 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#f9f9f9] rounded-lg border border-[#f0f0f0] mb-4">
                        <Search className="w-3.5 h-3.5 text-[#cacaca]" />
                        <input
                            type="text"
                            placeholder="Search knowledge base..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-[13px] text-[#383838] placeholder-[#cacaca] outline-none w-full"
                        />
                    </div>
                )}

                {/* Sections */}
                <div className="space-y-2">
                    {filteredSections.map((section, idx) => {
                        const title = section.title || section.name || `Section ${idx + 1}`;
                        const content = section.content || section.description || (typeof section === 'string' ? section : JSON.stringify(section, null, 2));
                        const isExpanded = expandedSection === idx;

                        return (
                            <div key={idx} className="border border-[#f0f0f0] rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setExpandedSection(isExpanded ? null : idx)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fbfbfb] transition-colors text-left"
                                >
                                    <ChevronRight className={`w-3.5 h-3.5 text-[#cacaca] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <FileText className="w-4 h-4 text-[#8f8f8f]" />
                                    <span className="text-[13px] font-[500] text-[#171717]">{title}</span>
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-4 pl-11">
                                        <div className="text-[13px] text-[#555] leading-relaxed whitespace-pre-wrap">
                                            {content}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {filteredSections.length === 0 && searchQuery && (
                    <div className="text-center py-8">
                        <div className="text-[13px] text-[#8f8f8f]">No matching entries</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBase;
