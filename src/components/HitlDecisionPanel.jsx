import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

const DECISIONS = [
    { id: 'approve_workload', label: 'Use Workload', desc: 'Alcohol Cans' },
    { id: 'approve_bluejay', label: 'Use BlueJay', desc: 'Group' },
    { id: 'correct', label: 'Correct value', desc: 'Enter commodity' },
    { id: 'reject', label: 'Reject load', desc: 'Escalate' },
];

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
            // 1. Write system log with hitl_decision marker (Phase 2 polls for this)
            const { error: e1 } = await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'system',
                message: `Human decision: ${decision.id}`,
                metadata: {
                    step_name: 'Human Decision',
                    hitl_decision: true,
                    decision: decision.id,
                    decided_by: name.trim(),
                },
            });
            if (e1) throw new Error(`system log insert: ${e1.message}`);

            // 2. Write visible decision log for timeline
            const { error: e2 } = await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'decision',
                message: `${decLabel} — approved by ${name.trim()}`,
                metadata: {
                    step_name: 'Human Decision',
                    decision: decision.id,
                    decision_label: decLabel,
                    decided_by: name.trim(),
                },
            });
            if (e2) throw new Error(`decision log insert: ${e2.message}`);

            // 3. Move run to running
            const { error: e3 } = await supabase
                .from('activity_runs')
                .update({
                    status: 'in_progress',
                    current_status_text: `Applying decision: ${decLabel} (by ${name.trim()})`,
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
        <div className="mt-3">
            {error && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                    Error: {error}
                </div>
            )}
            <div className="flex items-center gap-2 mb-2">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setShowNameError(false); }}
                    placeholder="Your name"
                    className={`px-2.5 py-1.5 text-[12px] rounded-lg border bg-white outline-none transition-colors w-40 ${
                        showNameError ? 'border-red-400 placeholder-red-300' : 'border-[#E5E7EB] focus:border-[#171717]'
                    }`}
                />
                {showNameError && (
                    <span className="text-[11px] text-red-500">Enter your name</span>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {DECISIONS.map(d => (
                    <button
                        key={d.id}
                        disabled={!!submitting}
                        onClick={() => submitDecision(d)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors
                            ${submitting === d.id
                                ? 'bg-gray-400 text-white cursor-wait'
                                : 'bg-[#171717] text-white hover:bg-[#333] cursor-pointer'
                            }
                            ${submitting && submitting !== d.id ? 'opacity-40' : ''}
                        `}
                    >
                        {submitting === d.id ? 'Submitting...' : d.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
