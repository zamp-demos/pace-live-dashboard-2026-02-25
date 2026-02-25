import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        // Accept any credentials
        navigate('/done/processes');
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
            <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-sm p-8 w-full max-w-[380px]">
                <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center gap-2.5">
                        <img src="/adam-icon.svg" alt="Pace" className="w-7 h-7" />
                        <span className="text-[18px] font-[600] text-[#171717]">Pace Live</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[12px] font-[500] text-[#383838] mb-1.5">Email</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter any email"
                            className="w-full px-3 py-2 text-[13px] border border-[#ebebeb] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#171717] focus:border-[#171717] bg-[#FAFAFA]"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-[500] text-[#383838] mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter any password"
                            className="w-full px-3 py-2 text-[13px] border border-[#ebebeb] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#171717] focus:border-[#171717] bg-[#FAFAFA]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2.5 bg-[#171717] text-white text-[13px] font-[500] rounded-lg hover:bg-[#333] transition-colors"
                    >
                        Sign In
                    </button>
                </form>

                <p className="text-center text-[11px] text-[#cacaca] mt-6">
                    Real-time audit dashboard for Pace workflows
                </p>
            </div>
        </div>
    );
};

export default Login;
