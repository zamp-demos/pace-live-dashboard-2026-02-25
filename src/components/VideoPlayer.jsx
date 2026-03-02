import React, { useState, useRef } from 'react';
import { X, Download, ExternalLink, Maximize2, Minimize2, Play } from 'lucide-react';

const VideoPlayer = ({ recording, onClose }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef(null);

    const videoUrl = recording?.s3_url;
    const title = recording?.metadata?.filename
        || (recording?.session_id ? `Recording ${recording.session_id.slice(0, 8)}` : 'Browser Recording');
    const subtitle = recording?.step_number != null
        ? `Step ${recording.step_number} \u2022 ${recording.status || 'available'}`
        : recording?.status || '';

    const handleDownload = () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = title.endsWith('.mp4') ? title : `${title}.mp4`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleOpenExternal = () => {
        if (videoUrl) window.open(videoUrl, '_blank');
    };

    const renderVideo = (className = '') => (
        <div className={`flex items-center justify-center bg-black ${className}`}>
            {!videoUrl || recording?.status === 'pending' ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Play className="w-12 h-12" />
                    <p className="text-sm">Recording pending — video will appear once processed</p>
                </div>
            ) : hasError ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <X className="w-12 h-12" />
                    <p className="text-sm">Unable to load video</p>
                    <button onClick={handleOpenExternal}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline">
                        Try opening directly
                    </button>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    autoPlay={false}
                    className="max-w-full max-h-full"
                    onError={() => setHasError(true)}
                >
                    Your browser does not support the video tag.
                </video>
            )}
        </div>
    );

    // Fullscreen modal
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 bg-black/70">
                    <div className="flex items-center gap-3">
                        <Play className="w-4 h-4 text-indigo-400" />
                        <div>
                            <h3 className="text-sm font-medium text-white truncate">{title}</h3>
                            {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {videoUrl && recording?.status !== 'pending' && (
                            <>
                                <button onClick={handleDownload}
                                    className="p-2 hover:bg-white/10 rounded-md transition-colors"
                                    title="Download">
                                    <Download className="w-4 h-4 text-gray-300" />
                                </button>
                                <button onClick={handleOpenExternal}
                                    className="p-2 hover:bg-white/10 rounded-md transition-colors"
                                    title="Open in new tab">
                                    <ExternalLink className="w-4 h-4 text-gray-300" />
                                </button>
                            </>
                        )}
                        <button onClick={() => setIsFullscreen(false)}
                            className="p-2 hover:bg-white/10 rounded-md transition-colors"
                            title="Exit fullscreen">
                            <Minimize2 className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>
                </div>
                {renderVideo('flex-1')}
            </div>
        );
    }

    // Inline panel
    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[13px] font-medium text-[#171717] truncate">{title}</h3>
                        {subtitle && <p className="text-[10px] text-[#9CA3AF]">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {videoUrl && recording?.status !== 'pending' && (
                        <>
                            <button onClick={handleDownload}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                                title="Download">
                                <Download className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            </button>
                            <button onClick={handleOpenExternal}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                                title="Open in new tab">
                                <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF]" />
                            </button>
                        </>
                    )}
                    <button onClick={() => setIsFullscreen(true)}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                        title="Fullscreen">
                        <Maximize2 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </button>
                    <button onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                        title="Close">
                        <X className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </button>
                </div>
            </div>

            {/* Video area */}
            {renderVideo('flex-1 rounded-b-none')}

            {/* Metadata footer */}
            {recording?.metadata && Object.keys(recording.metadata).length > 0 && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-[#f0f0f0] bg-[#fafafa]">
                    <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider mb-2">Recording Info</p>
                    <div className="space-y-1">
                        {recording.session_id && (
                            <div className="flex items-center">
                                <span className="text-[11px] text-gray-500 w-[90px]">Session</span>
                                <span className="text-[11px] text-gray-700 font-mono">{recording.session_id.slice(0, 16)}...</span>
                            </div>
                        )}
                        {recording.created_at && (
                            <div className="flex items-center">
                                <span className="text-[11px] text-gray-500 w-[90px]">Recorded</span>
                                <span className="text-[11px] text-gray-700">
                                    {new Date(recording.created_at).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
