import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Filter, Check, Activity, SlidersHorizontal } from 'lucide-react';
import { fetchRuns, subscribeToTable } from '../services/supabase';

const ProcessList = () => {
    const navigate = useNavigate();
    const { currentProcess } = useOutletContext();
    const [activeTab, setActiveTab] = useState('done');
    const [runs, setRuns] = useState([]);

    useEffect(() => {
        if (!currentProcess) return;

        const loadRuns = async () => {
            try {
                const data = await fetchRuns(currentProcess.id);
                setRuns(data);
            } catch (err) {
                console.error('Error fetching runs:', err);
            }
        };
        loadRuns();

        const unsub = subscribeToTable('activity_runs', `process_id=eq.${currentProcess.id}`, () => loadRuns());
        return unsub;
    }, [currentProcess]);

    const statusMap = {
        'needs_attention': 'Needs Attention',
        'needs_review': 'Needs Review',
        'void': 'Void',
        'in_progress': 'In Progress',
        'ready': 'In Progress',
        'done': 'Done',
    };

    const getRunsByTab = (tab) => {
        if (tab === 'in_progress') return runs.filter(r => r.status === 'in_progress' || r.status === 'ready');
        return runs.filter(r => r.status === tab);
    };

    const tabs = [
        { key: 'needs_attention', name: 'Needs attention', squareBg: 'bg-[#FFDADA]', squareBorder: 'border-[#A40000]' },
        { key: 'needs_review', name: 'Needs review', squareBg: 'bg-[#FCEDB9]', squareBorder: 'border-[#ED6704]' },
        { key: 'void', name: 'Void', squareBg: 'bg-[#EBEBEB]', squareBorder: 'border-[#8F8F8F]' },
        { key: 'in_progress', name: 'In progress', squareBg: 'bg-[#EAF3FF]', squareBorder: 'border-[#2546F5]' },
        { key: 'done', name: 'Done', squareBg: 'bg-[#E2F1EB]', squareBorder: 'border-[#038408]' },
    ].map(tab => ({ ...tab, count: getRunsByTab(tab.key).length }));

    const currentRuns = getRunsByTab(activeTab);

    if (!currentProcess) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-[14px] font-[500] text-[#171717] mb-1">No process selected</div>
                <div className="text-[13px] font-[400] text-[#7d7d7d] max-w-[300px]">
                    Pace will create processes here when you start a new workflow from chat.
                </div>
            </div>
        );
    }

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] bg-white text-center mt-[-50px]">
            <div className="relative flex h-[150px] w-[190px] items-center justify-center mb-4">
                <img src="/file3.svg" className="h-full w-full object-contain" />
            </div>
            <div className="text-[14px] font-[500] text-[#171717] mb-1">All clear for now</div>
            <div className="text-[13px] font-[400] text-[#7d7d7d] max-w-[260px]">
                Activity runs will appear here in real-time as Pace works on tasks.
            </div>
        </div>
    );

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <div className="bg-white flex flex-col h-full overflow-hidden">
            {/* Status Tabs */}
            <div className="px-6 pt-2 pb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-2 py-0.5 text-[11px] rounded-[6px] transition-colors ${activeTab === tab.key
                                ? "bg-[#00000005] border border-[#ebebeb] font-[500] text-[#171717]"
                                : 'text-[#666666] hover:text-[#171717] hover:bg-[#00000005] font-[500]'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-[1.5px] border ${tab.squareBg} ${tab.squareBorder}`} />
                            <span>{tab.name}</span>
                            <span className={activeTab === tab.key ? "text-[#171717]" : "text-[#cacaca]"}>{tab.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
                <button className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-[500] text-[#171717] hover:bg-[#fbfbfb] rounded-[4px] border border-[#ebebeb] shadow-sm">
                    <Filter className="w-3 h-3" />
                    Filter
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {currentRuns.length > 0 ? (
                    <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 bg-white z-10 border-t border-b border-[#ebebeb]">
                            <tr className="f-12-450 text-[#8f8f8f]">
                                <th className="w-12 px-6 py-2"></th>
                                <th className="px-4 py-2 text-left font-normal whitespace-nowrap">Document</th>
                                <th className="px-4 py-2 text-left font-normal whitespace-nowrap">Current Status</th>
                                <th className="px-4 py-2 text-left font-normal whitespace-nowrap">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRuns.map(run => (
                                <tr
                                    key={run.id}
                                    className="hover:bg-[#f9f9f9] cursor-pointer transition-colors border-b border-[#f2f2f2] last:border-0"
                                    onClick={() => navigate(`/done/process/${run.id}`)}
                                >
                                    <td className="px-6 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {run.status === 'needs_attention' ? (
                                                <Activity className="w-2.5 h-2.5 text-[#ff1515]" />
                                            ) : run.status === 'done' ? (
                                                <Check className="w-2.5 h-2.5 text-[#0da425]" />
                                            ) : run.status === 'in_progress' || run.status === 'ready' ? (
                                                <Activity className="w-2.5 h-2.5 text-[#2445ff]" />
                                            ) : (
                                                <div className="w-2.5 h-2.5" />
                                            )}
                                            <div className={`w-2 h-2 rounded-[1.5px] border ${
                                                run.status === 'needs_attention' ? "bg-[#FFDADA] border-[#A40000]" :
                                                run.status === 'needs_review' ? "bg-[#FCEDB9] border-[#ED6704]" :
                                                run.status === 'void' ? "bg-[#EBEBEB] border-[#8F8F8F]" :
                                                run.status === 'in_progress' || run.status === 'ready' ? "bg-[#EAF3FF] border-[#2546F5]" :
                                                "bg-[#E2F1EB] border-[#038408]"
                                            }`} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-[13px] font-[450] text-[#171717] max-w-[250px] truncate">
                                        {run.document_name || run.name}
                                    </td>
                                    <td className="px-4 py-2.5 text-[13px] font-[450] text-[#171717] max-w-[350px] truncate">
                                        {run.current_status_text}
                                    </td>
                                    <td className="px-4 py-2.5 text-[12px] text-[#8f8f8f] whitespace-nowrap">
                                        {formatTime(run.updated_at || run.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    renderEmptyState()
                )}
            </div>
        </div>
    );
};

export default ProcessList;
