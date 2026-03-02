import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
    Database, Download, Search, ChevronDown, ChevronUp,
    Table2, BarChart3, FileSpreadsheet, ArrowUpDown, ExternalLink,
    Layers, Hash, Type, Calendar, ToggleLeft, Braces
} from 'lucide-react';
import { fetchDatasets, fetchDatasetRows, fetchAllDatasetRows, subscribeToTable } from '../services/supabase';

/* ─── Type icon helper ─── */
const typeIcons = {
    string: <Type className="w-3 h-3" />,
    number: <Hash className="w-3 h-3" />,
    boolean: <ToggleLeft className="w-3 h-3" />,
    date: <Calendar className="w-3 h-3" />,
    json: <Braces className="w-3 h-3" />,
};

/* ─── CSV export helper ─── */
function exportToCSV(fields, rows, datasetName) {
    const headers = ['run_id', 'created_at', ...fields.map(f => f.name)];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
        const d = row.data || {};
        const vals = [
            row.run_id || '',
            row.created_at || '',
            ...fields.map(f => {
                const v = d[f.name];
                if (v === null || v === undefined) return '';
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"` : s;
            })
        ];
        csvRows.push(vals.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(/\s+/g, '_').toLowerCase()}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ─── Format cell value ─── */
function formatCell(value, type) {
    if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
    if (type === 'json' || typeof value === 'object') {
        return <span className="font-mono text-[10px] text-gray-500">{JSON.stringify(value).slice(0, 80)}</span>;
    }
    if (type === 'number') return <span className="font-mono">{value}</span>;
    if (type === 'boolean') return value ? '✓' : '✗';
    if (type === 'date') {
        try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
    }
    const s = String(value);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
}

/* ─── Main Component ─── */
export default function DataExplorer() {
    const { currentProcess } = useOutletContext();
    const navigate = useNavigate();

    const [datasets, setDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState(null);
    const [rows, setRows] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);
    const pageSize = 50;

    // Load datasets when process changes
    useEffect(() => {
        if (!currentProcess) return;
        setLoading(true);
        const load = async () => {
            try {
                const ds = await fetchDatasets(currentProcess.id);
                setDatasets(ds);
                if (ds.length > 0 && !selectedDataset) setSelectedDataset(ds[0]);
                else if (ds.length === 0) setSelectedDataset(null);
            } catch (err) { console.error('Error loading datasets:', err); }
            setLoading(false);
        };
        load();
        const unsub = subscribeToTable('datasets', `process_id=eq.${currentProcess.id}`, () => load());
        return () => unsub();
    }, [currentProcess?.id]);

    // Load rows when dataset or page changes
    useEffect(() => {
        if (!selectedDataset) { setRows([]); setTotalRows(0); return; }
        setRowsLoading(true);
        const load = async () => {
            try {
                const { rows: r, total } = await fetchDatasetRows(selectedDataset.id, {
                    limit: pageSize, offset: page * pageSize
                });
                setRows(r);
                setTotalRows(total);
            } catch (err) { console.error('Error loading rows:', err); }
            setRowsLoading(false);
        };
        load();
        const unsub = subscribeToTable('dataset_rows', `dataset_id=eq.${selectedDataset.id}`, () => load());
        return () => unsub();
    }, [selectedDataset?.id, page]);

    const fields = useMemo(() => {
        if (!selectedDataset?.schema?.fields) return [];
        return selectedDataset.schema.fields;
    }, [selectedDataset]);

    // Client-side search + sort
    const filteredRows = useMemo(() => {
        let result = [...rows];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(row => {
                const d = row.data || {};
                return Object.values(d).some(v =>
                    v !== null && String(v).toLowerCase().includes(term)
                );
            });
        }
        if (sortField) {
            result.sort((a, b) => {
                const va = a.data?.[sortField] ?? '';
                const vb = b.data?.[sortField] ?? '';
                const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
                return sortAsc ? cmp : -cmp;
            });
        }
        return result;
    }, [rows, searchTerm, sortField, sortAsc]);

    const handleSort = (fieldName) => {
        if (sortField === fieldName) setSortAsc(!sortAsc);
        else { setSortField(fieldName); setSortAsc(true); }
    };

    const handleExport = async () => {
        if (!selectedDataset) return;
        try {
            const allRows = await fetchAllDatasetRows(selectedDataset.id);
            exportToCSV(fields, allRows, selectedDataset.name);
        } catch (err) { console.error('Export error:', err); }
    };

    const totalPages = Math.ceil(totalRows / pageSize);

    if (!currentProcess) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <p>Select a process to view datasets</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <div className="animate-pulse flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span className="text-sm">Loading datasets...</span>
                </div>
            </div>
        );
    }

    if (datasets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <Database className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No datasets defined</p>
                <p className="text-xs text-gray-400 max-w-xs text-center">
                    Datasets are created automatically during process setup.
                    They define the standard data schema for every run.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900">Datasets</h2>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {selectedDataset && (
                        <>
                            <span className="text-[10px] text-gray-400">
                                {totalRows} {totalRows === 1 ? 'row' : 'rows'}
                            </span>
                            <button onClick={handleExport}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors">
                                <Download className="w-3 h-3" />
                                Export CSV
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Dataset selector tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto">
                {datasets.map(ds => (
                    <button key={ds.id} onClick={() => { setSelectedDataset(ds); setPage(0); setSearchTerm(''); setSortField(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${
                            selectedDataset?.id === ds.id
                                ? 'bg-gray-900 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}>
                        <Layers className="w-3 h-3" />
                        {ds.name}
                    </button>
                ))}
            </div>

            {selectedDataset && (
                <>
                    {/* Dataset info + search */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                        <p className="text-[11px] text-gray-400 max-w-md truncate">
                            {selectedDataset.description}
                        </p>
                        <div className="relative">
                            <Search className="w-3 h-3 text-gray-300 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                                type="text" value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search rows..."
                                className="pl-7 pr-2 py-1 text-[11px] border border-gray-200 rounded-md w-48 focus:outline-none focus:border-gray-400"
                            />
                        </div>
                    </div>

                    {/* Schema bar */}
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50/50 border-b border-gray-100 overflow-x-auto">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold whitespace-nowrap">Schema</span>
                        {fields.map(f => (
                            <span key={f.name} className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                                {typeIcons[f.type] || <Type className="w-3 h-3" />}
                                <span className={f.required ? 'font-semibold' : ''}>{f.name}</span>
                                <span className="text-gray-300">({f.type})</span>
                            </span>
                        ))}
                    </div>

                    {/* Data table */}
                    <div className="flex-1 overflow-auto">
                        {rowsLoading ? (
                            <div className="flex items-center justify-center py-12 text-gray-400">
                                <div className="animate-pulse text-sm">Loading rows...</div>
                            </div>
                        ) : filteredRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                <Table2 className="w-6 h-6 text-gray-300" />
                                <p className="text-xs">
                                    {searchTerm ? 'No rows match your search' : 'No data rows yet'}
                                </p>
                            </div>
                        ) : (
                            <table className="min-w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10">
                                    <tr className="border-b border-gray-100">
                                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">
                                            Run
                                        </th>
                                        {fields.map(f => (
                                            <th key={f.name}
                                                onClick={() => handleSort(f.name)}
                                                className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                                                <span className="flex items-center gap-1">
                                                    {f.name}
                                                    {sortField === f.name ? (
                                                        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    ) : (
                                                        <ArrowUpDown className="w-2.5 h-2.5 text-gray-300" />
                                                    )}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">
                                            Date
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, i) => (
                                        <tr key={row.id}
                                            className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                            <td className="px-3 py-2">
                                                {row.run_id ? (
                                                    <button
                                                        onClick={() => navigate(`/done/process/${row.run_id}`)}
                                                        className="text-[10px] font-mono text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-0.5">
                                                        {row.run_id.slice(0, 8)}
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                )}
                                            </td>
                                            {fields.map(f => (
                                                <td key={f.name} className="px-3 py-2 text-[11px] text-gray-700 max-w-[200px] truncate">
                                                    {formatCell(row.data?.[f.name], f.type)}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap">
                                                {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                            <span className="text-[10px] text-gray-400">
                                Page {page + 1} of {totalPages} ({totalRows} total)
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                                    className="px-2 py-1 text-[10px] rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
                                    Prev
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                    className="px-2 py-1 text-[10px] rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
