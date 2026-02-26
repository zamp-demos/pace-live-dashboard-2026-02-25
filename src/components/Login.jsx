import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (email.trim()) {
            sessionStorage.setItem('userEmail', email.trim());
            sessionStorage.setItem('userName', email.split('@')[0]);
        }
        navigate('/done/processes');
    };

    const gridLines = useMemo(() => {
        const lines = [];
        for (let i = 0; i < 8; i++) {
            lines.push(
                <div
                    key={`h-${i}`}
                    className="absolute h-[1px] bg-gradient-to-r from-transparent via-[#e5e5e5] to-transparent animate-grid-line-h"
                    style={{
                        top: `${10 + i * 12}%`,
                        left: '-100%',
                        right: '-100%',
                        animationDelay: `${i * 2}s`,
                        opacity: 0.4,
                    }}
                />
            );
        }
        for (let i = 0; i < 10; i++) {
            lines.push(
                <div
                    key={`v-${i}`}
                    className="absolute w-[1px] bg-gradient-to-b from-transparent via-[#e5e5e5] to-transparent animate-grid-line-v"
                    style={{
                        left: `${5 + i * 10}%`,
                        top: '-100%',
                        bottom: '-100%',
                        animationDelay: `${i * 1.5}s`,
                        opacity: 0.3,
                    }}
                />
            );
        }
        return lines;
    }, []);

    const hashedBlocks = useMemo(() => {
        const blocks = [];
        const positions = [
            { top: '15%', left: '8%' }, { top: '25%', left: '78%' },
            { top: '60%', left: '15%' }, { top: '70%', left: '85%' },
            { top: '40%', left: '92%' }, { top: '80%', left: '5%' },
        ];
        positions.forEach((pos, i) => {
            blocks.push(
                <div
                    key={`hash-${i}`}
                    className="absolute opacity-[0.03]"
                    style={{ ...pos, fontSize: '48px', fontFamily: 'monospace', color: '#171717' }}
                >
                    {'///'}
                </div>
            );
        });
        return blocks;
    }, []);

    return (
        <div className="min-h-screen bg-[#fdfdfb] flex items-center justify-center relative overflow-hidden">
            {/* Animated grid background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {gridLines}
                {hashedBlocks}
            </div>

            {/* Login card */}
            <div className="relative z-10 bg-white rounded-[24px] border border-[#f0f0f0] shadow-sm w-full max-w-[640px] p-[80px]">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-10">
                    <img src="/home-pace.svg" alt="Pace" className="w-7 h-7" />
                    <span style={{ fontSize: '26px', fontWeight: 750, letterSpacing: '-0.04em', color: '#171717' }}>
                        Pace Live
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full px-4 py-3 text-[15px] border border-[#f2f2f2] rounded-md hover:border-[#ebebeb] focus:border-[#e0e0e0] focus:outline-none transition-colors bg-white placeholder-[#b0b0b0]"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full px-4 py-3 text-[15px] border border-[#f2f2f2] rounded-md hover:border-[#ebebeb] focus:border-[#e0e0e0] focus:outline-none transition-colors bg-white placeholder-[#b0b0b0]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#171717] text-white text-[15px] font-medium rounded-md hover:bg-[#333] transition-colors"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                <p className="text-center text-[12px] text-[#cacaca] mt-8">
                    Real-time audit dashboard for Pace workflows
                </p>
            </div>
        </div>
    );
};

export default Login;
