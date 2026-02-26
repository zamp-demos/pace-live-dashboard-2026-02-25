import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowUp, Trash2, Mic, Paperclip, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatMessage = ({ msg }) => {
    const isUser = msg.role === 'user';
    const userName = sessionStorage.getItem('userName') || sessionStorage.getItem('userEmail')?.split('@')[0] || 'You';
    const userInitial = userName.charAt(0).toUpperCase();

    return (
        <div className="flex w-full mb-8 justify-start">
            <div className="flex gap-4 w-full">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isUser ? 'bg-[#FFE2D1]' : 'bg-[#2445ff]'
                }`}>
                    {isUser ? (
                        <span className="text-[#AF521F] text-xs font-bold">{userInitial}</span>
                    ) : (
                        <img src="/home-pace.svg" alt="Pace" className="w-5 h-5 brightness-0 invert" />
                    )}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-[#171717]">
                        {isUser ? userName : 'Pace'}
                    </span>
                    <div className="text-[13px] text-[#171717] leading-relaxed break-words">
                        {isUser ? (
                            <span>{msg.content}</span>
                        ) : msg.isError ? (
                            <span className="text-red-600">{msg.content}</span>
                        ) : (
                            <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-[#171717] prose-strong:text-[#171717] prose-code:text-xs prose-code:bg-[#f5f5f5] prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatPanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const processName = sessionStorage.getItem('currentProcessName') || 'Chat';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMsg = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const orgId = sessionStorage.getItem('currentOrgId') || '';
            const orgName = sessionStorage.getItem('currentOrgName') || '';
            const processId = sessionStorage.getItem('currentProcessId') || '';

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history: messages.slice(-20),
                    orgId,
                    orgName,
                    processId,
                    processName,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to get response');
            }

            const data = await response.json();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response,
                timestamp: new Date().toISOString(),
            }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Something went wrong: ${error.message}`,
                timestamp: new Date().toISOString(),
                isError: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    // FAB button when closed
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-white border border-[#ebebeb]"
                title="Chat with Pace"
            >
                <img src="/home-pace.svg" alt="Pace" className="w-7 h-7" />
            </button>
        );
    }

    // Full chat panel
    return (
        <div
            className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white border border-[#ebebeb]"
            style={{ width: '420px', height: '620px', maxHeight: 'calc(100vh - 48px)' }}
        >
            {/* Header */}
            <div className="h-12 border-b border-[#ebebeb] flex items-center justify-between px-4 shrink-0 bg-white">
                <h2 className="text-[13px] font-bold text-[#171717] truncate pr-4">
                    {processName}
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearChat}
                        className="p-1.5 hover:bg-[#f5f5f5] rounded-md text-[#8f8f8f] hover:text-[#171717] transition-all"
                        title="Clear chat"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-[#f5f5f5] rounded-md text-[#8f8f8f] hover:text-[#171717] transition-all"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <img src="/home-pace.svg" alt="Pace" className="w-10 h-10 mb-4 opacity-20" />
                        <p className="text-[13px] font-medium text-[#171717] mb-1">Chat with Pace</p>
                        <p className="text-[12px] text-[#8f8f8f] leading-relaxed">
                            Ask about processes, runs, or anything on the dashboard.
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <ChatMessage key={idx} msg={msg} />
                ))}

                {isLoading && (
                    <div className="flex gap-4 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-[#2445ff] flex items-center justify-center flex-shrink-0">
                            <img src="/home-pace.svg" alt="Pace" className="w-5 h-5 brightness-0 invert" />
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-[13px] font-bold text-[#171717]">Pace</span>
                            <div className="flex gap-1.5 items-center">
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#ebebeb] bg-white">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything or give feedback..."
                        className="w-full bg-[#fbfbfb] border border-[#ebebeb] rounded-xl pl-4 pr-10 py-3 text-[15px] placeholder-[#8f8f8f] focus:outline-none focus:border-[#c9c9c9] transition-all"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                            input.trim() ? 'bg-black text-white' : 'bg-transparent text-[#cacaca]'
                        }`}
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-3 mt-2 px-1">
                    <button className="text-[#cacaca] hover:text-[#8f8f8f] transition-colors">
                        <Mic className="w-4 h-4" />
                    </button>
                    <button className="text-[#cacaca] hover:text-[#8f8f8f] transition-colors">
                        <Paperclip className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
