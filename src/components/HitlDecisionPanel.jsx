import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

/* ── Process-specific HITL decision configs ── */
const PROCESS_DECISIONS = {
    /* Dispute Resolution — Uber Eats */
    'd629444d-b53f-4779-9884-65e3169cf30a': [
        { id: 'approve_reverse', label: 'Approve — Reverse Adjustment', desc: 'Merchant wins, refund returned', style: 'primary' },
        { id: 'override_uphold', label: 'Override — Uphold Adjustment', desc: 'Customer keeps refund', style: 'secondary' },
        { id: 'escalate_tier2', label: 'Escalate to Tier 2', desc: 'Send to senior analyst', style: 'warning' },
        { id: 'more_investigation', label: 'Request More Investigation', desc: 'Need additional data', style: 'ghost' },
    ],
    /* TMS Ops — Uber Freight (default/legacy) */
    '65dbe6b4-122f-458c-b7ff-6f99c951c109': [
        { id: 'approve_workload', label: 'Use Workload', desc: 'Alcohol Cans', style: 'primary' },
        { id: 'approve_bluejay', label: 'Use BlueJay', desc: 'Group', style: 'primary' },
        { id: 'correct', label: 'Correct value', desc: 'Enter commodity', style: 'secondary' },
        { id: 'reject', label: 'Reject load', desc: 'Escalate', style: 'warning' },
    ],
};

/* Fallback for any process not in the map */
const DEFAULT_DECISIONS = [
    { id: 'approve', label: 'Approve', desc: 'Accept recommendation', style: 'primary' },
    { id: 'reject', label: 'Reject', desc: 'Reject recommendation', style: 'secondary' },
    { id: 'escalate', label: 'Escalate', desc: 'Send for review', style: 'warning' },
];

/* ── Button style map ── */
const BUTTON_STYLES = {
    primary: {
        base: 'bg-[#171717] text-white hover:bg-[#333]',
        active: 'bg-gray-400 text-white cursor-wait',
    },
    secondary: {
        base: 'bg-white text-[#171717] border border-[#D1D5DB] hover:bg-[#F3F4F6]',
        active: 'bg-gray-200 text-gray-500 cursor-wait',
    },
    warning: {
        base: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] hover:bg-[#FDE68A]',
        active: 'bg-yellow-200 text-yellow-700 cursor-wait',
    },
    ghost: {
        base: 'bg-transparent text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#374151]',
        active: 'bg-gray-100 text-gray-400 cursor-wait',
    },
};

export default function HitlDecisionPanel({ run, logs }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);
    const [name, setName] = useState('');
    const [showNameError, setShowNameError] = useState(false);
    const [error, setError] = useState(null);

    if (!run || run.status !== 'needs_attention') return null;

    const alreadyDecided = logs?.some(l =>
        l.log_type === 'system' && l.metadata?.hitl_decision === true
    );
    if (alreadyDecided || decided) return null;

    /* Resolve decisions for this process */
    const decisions = PROCESS_DECISIONS[run.process_id] || DEFAULT_DECISIONS;

    const submitDecision = async (decision) => {
        if (!name.trim()) {
            setShowNameError(true);
            return;
        }
        setShowNameError(false);
        setError(null);
        setSubmitting(decision.id);

        const decLabel = `${decision.label} (${decision.desc})`;

        try {
            /* 1. System log with hitl_decision marker (agent polls for this) */
            const { error: e1 } = await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: (logs?.length || 0) + 1,
                log_type: 'system',
                message: `Human decision: ${decision.id}`,
                metadata: {
                    step_name: 'Human Decision',
                    hitl_decision: true,
                    decision: decision.id,
                    decision_label: decLabel,
                    decided_by: name.trim(),
                },
            });
            if (e1) throw new Error(`system log insert: ${e1.message}`);

            /* 2. Visible decision log for timeline */
            const { error: e2 } = await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: (logs?.length || 0) + 2,
                log_type: 'decision',
                message: `${decLabel} — approved by ${name.trim()}`,
                metadata: {
                    step_name: 'Human Decision',
                    decision: decision.id,
                    decision_label: decLabel,
                    decided_by: name.trim(),
                    reasoning_steps: [
                        `Reviewer ${name.trim()} selected: ${decision.label}`,
                        `Action: ${decision.desc}`,
                    ],
                },
            });
            if (e2) throw new Error(`decision log insert: ${e2.message}`);

            /* 3. Move run back to in_progress */
            const { error: e3 } = await supabase
                .from('activity_runs')
                .update({
                    status: 'in_progress',
                    current_status_text: `Decision: ${decLabel} (by ${name.trim()})`,
                })
                .eq('id', run.id);
            if (e3) throw new Error(`run update: ${e3.message}`);

            setDecided(true);
        } catch (e) {
            console.error('HITL submit failed:', e);
            setError(e.message || 'Submit failed');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
            <div className="text-[11px] font-semibold text-[#A40000] uppercase tracking-wide mb-2">
                Action Required — Human Review
            </div>
            {error && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                    Error: {error}
                </div>
            )}
            <div className="flex items-center gap-2 mb-3">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setShowNameError(false); }}
                    placeholder="Your name"
                    className={`px-2.5 py-1.5 text-[12px] rounded-lg border bg-white outline-none transition-colors w-44 ${
                        showNameError ? 'border-red-400 placeholder-red-300' : 'border-[#E5E7EB] focus:border-[#171717]'
                    }`}
                />
                {showNameError && (
                    <span className="text-[11px] text-red-500">Enter your name</span>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {decisions.map(d => {
                    const style = BUTTON_STYLES[d.style] || BUTTON_STYLES.primary;
                    const isActive = submitting === d.id;
                    const isDisabled = !!submitting && !isActive;
                    return (
                        <button
                            key={d.id}
                            disabled={!!submitting}
                            onClick={() => submitDecision(d)}
                            title={d.desc}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
                                ${isActive ? style.active : style.base}
                                ${isDisabled ? 'opacity-40' : ''}
                            `}
                        >
                            {isActive ? 'Submitting...' : d.label}
                        </button>
                    );
                })}
            </div>
            <div className="mt-1.5 text-[10px] text-[#9CA3AF]">
                {decisions.map(d => d.desc).join(' · ')}
            </div>
        </div>
    );
}
