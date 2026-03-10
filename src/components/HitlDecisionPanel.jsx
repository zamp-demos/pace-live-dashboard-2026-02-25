import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

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

    if (!run || run.status !== 'needs_attention') return null;

    const alreadyDecided = logs?.some(l => l.log_type === 'hitl_response');
    if (alreadyDecided || decided) return null;

    const submitDecision = async (decision) => {
        if (!name.trim()) {
            setShowNameError(true);
            return;
        }
        setShowNameError(false);
        setSubmitting(decision.id);

        const decLabel = `${decision.label} (${decision.desc})`;
        const message = `${decLabel} — approved by ${name.trim()}`;

        try {
            // 1. Log the HITL response (Phase 2 polls for this)
            await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'hitl_response',
                message: `Human decision: ${decision.id}`,
                metadata: {
                    step_name: 'Human Decision',
                    decision: decision.id,
                    decided_by: name.trim(),
                },
            });

            // 2. Log the human-readable decision as a visible activity entry
            await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'decision',
                message: message,
                metadata: {
                    step_name: 'Human Decision',
                    decision: decision.id,
                    decision_label: decLabel,
                    decided_by: name.trim(),
                },
            });

            // 3. Move run to running so Phase 2 can proceed
            await supabase
                .from('activity_runs')
                .update({
                    status: 'running',
                    current_status_text: `Applying decision: ${decLabel} (by ${name.trim()})`,
                })
                .eq('id', run.id);

            setDecided(true);
        } catch (e) {
            console.error('HITL submit failed:', e);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="mt-3">
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
