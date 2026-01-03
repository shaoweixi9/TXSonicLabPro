
import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  PlayIcon, 
  TrashIcon, 
  ArrowDownTrayIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon, 
  SpeakerWaveIcon, 
  UserIcon, 
  InformationCircleIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  CpuChipIcon,
  SparklesIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { AudioFile, EmotionStatus } from './types';
import { fileToBase64, formatFileSize } from './utils/audioUtils';
import { analyzeAudioEmotion } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [showTip, setShowTip] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkKeyStatus = async () => {
    try {
      const status = await window.aistudio?.hasSelectedApiKey();
      if (status) setHasKey(true);
    } catch (e) {
      setHasKey(true);
    }
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleSwitchKey = async () => {
    await window.aistudio?.openSelectKey();
    setHasKey(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AudioFile[] = Array.from(e.target.files).map((f: File) => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        name: f.name,
        size: formatFileSize(f.size),
        status: EmotionStatus.IDLE
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("确定要清空所有记录吗？")) {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 辅助函数：等待一段时间
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const processBatch = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const pendingFiles = files.filter(f => f.status === EmotionStatus.IDLE || f.status === EmotionStatus.FAILED);
    
    for (let i = 0; i < pendingFiles.length; i++) {
      const audioFile = pendingFiles[i];
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: EmotionStatus.PROCESSING, error: undefined } : f));
      
      let retryCount = 0;
      const maxRetries = 2;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        try {
          const base64 = await fileToBase64(audioFile.file);
          const result = await analyzeAudioEmotion(base64, audioFile.file.type);
          
          setFiles(prev => prev.map(f => f.id === audioFile.id ? { 
            ...f, 
            status: EmotionStatus.COMPLETED,
            emotionType: result.emotionType,
            emotionLevel: result.emotionLevel,
            voiceIdentity: result.voiceIdentity,
            reasoning: result.reasoning
          } : f));
          success = true;
        } catch (error: any) {
          console.error(`Analysis Error (File: ${audioFile.name}):`, error);
          
          // 如果是频率限制 (429) 错误，尝试等待更久
          if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
            retryCount++;
            if (retryCount <= maxRetries) {
              const waitTime = retryCount * 5000; // 阶梯式等待：5秒, 10秒
              console.log(`命中频率限制，正在进行第 ${retryCount} 次重试，等待 ${waitTime/1000}s...`);
              await sleep(waitTime);
              continue;
            }
          }

          setFiles(prev => prev.map(f => f.id === audioFile.id ? { 
            ...f, 
            status: EmotionStatus.FAILED,
            error: error.message?.includes("429") ? "频率超限" : "分析失败"
          } : f));
          break; // 停止当前文件的重试
        }
      }

      // 请求之间的固定间隔，避免被识别为攻击
      if (i < pendingFiles.length - 1) {
        await sleep(1500); 
      }
    }
    setIsProcessing(false);
  };

  const exportResults = () => {
    const header = "文件名,情绪,强度(1-10),角色标签,AI洞察\n";
    const rows = files.map(f => 
      `"${f.name}","${f.emotionType || ''}","${f.emotionLevel || ''}","${f.voiceIdentity || ''}","${f.reasoning?.replace(/"/g, '""') || ''}"`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `分析结果_${new Date().getTime()}.csv`;
    link.click();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelColor = (level: number) => {
    const colors = [
      'bg-emerald-400', 'bg-emerald-500', 'bg-green-500', 'bg-lime-500', 'bg-yellow-400',
      'bg-amber-500', 'bg-orange-500', 'bg-orange-600', 'bg-red-500', 'bg-rose-600'
    ];
    return colors[Math.max(0, Math.min(level - 1, 9))];
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col min-h-screen antialiased bg-slate-50/50">
      {/* 顶部标题栏 */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <SpeakerWaveIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 
              className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase"
              style={{ WebkitTextStroke: '0.8px currentColor' }}
            >
              SONIC LAB <span className="text-blue-600" style={{ WebkitTextStroke: '0.8px #2563eb' }}>PRO</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold mt-1.5 tracking-widest uppercase">High-Fidelity Audio Perception</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSwitchKey}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all border border-slate-200"
          >
            <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
            切换 Key
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-white text-emerald-600 border border-emerald-100 shadow-sm">
            <ShieldCheckIcon className="w-4 h-4" />
            API 已链接
          </div>
          <button onClick={() => setShowTip(!showTip)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-white rounded-full transition-colors">
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 介绍卡片 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8 shadow-sm relative overflow-hidden group">
        <div className="absolute -top-12 -right-12 p-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
          <CpuChipIcon className="w-64 h-64 text-blue-600" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black mb-3 uppercase tracking-[0.2em]">
              <SparklesIcon className="w-4 h-4" />
              Next-Gen Audio Intelligence
            </div>
            <p className="text-slate-600 text-base leading-relaxed font-medium">
              基于 <span className="text-blue-600 font-bold">Gemini 原生多模态 Flash 引擎</span>，Sonic Lab 绕过传统的语音转文字流程，直接通过声学物理特征深度解析音频背后的真实情绪底色。
            </p>
          </div>
          <div className="flex gap-8 border-l border-slate-100 pl-8 h-full items-center shrink-0">
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900">{files.length}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">任务队列</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600">{files.filter(f => f.status === EmotionStatus.COMPLETED).length}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">已解析</div>
            </div>
          </div>
        </div>
      </div>

      {showTip && (
        <div className="bg-white border-l-4 border-blue-500 p-4 rounded-xl mb-8 text-sm text-slate-600 flex gap-4 animate-in slide-in-from-top-4 duration-300 shadow-sm">
          <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="mb-1"><b className="text-slate-900">频率限制说明：</b></p>
            <p className="text-xs">
              为了保证解析稳定性，我们采用了 <b>Flash 高性能模型</b>。如遇“频率超限”，系统会自动重试并增加延迟。建议批量任务保持在 15 个以内以获得最佳体验。
            </p>
          </div>
        </div>
      )}

      {/* 核心操作区 */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input type="file" multiple accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border border-slate-200/60"
          >
            <PlusIcon className="w-4 h-4" />
            添加音频
          </button>
          <button 
            onClick={processBatch}
            disabled={isProcessing || files.length === 0}
            className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-extrabold shadow-lg ${
              isProcessing || files.length === 0 
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
            }`}
          >
            {isProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4 fill-current" />}
            {isProcessing ? '智能解析中...' : '开始AI批量解析'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={exportResults}
            disabled={files.length === 0}
            className="px-4 py-2 text-slate-600 hover:text-blue-600 disabled:opacity-30 text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            导出结果
          </button>
          <div className="w-px h-6 bg-slate-100"></div>
          <button 
            onClick={clearAll}
            disabled={files.length === 0 || isProcessing}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-0"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 表格数据 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden min-h-[500px]">
        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-40">
            <div className="p-6 bg-slate-50 rounded-full mb-6">
              <SpeakerWaveIcon className="w-12 h-12 opacity-20" />
            </div>
            <p className="text-sm font-bold tracking-widest uppercase">请导入音频文件开始解析任务</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left table-fixed border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[20%]">文件名</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[100px] text-center">状态</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[120px] text-center">情绪标签</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[110px] text-center">强度</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[160px] text-center">音色/角色</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">AI 深度洞察</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {files.map((file, index) => {
                  const showAbove = index > 0 && index >= files.length - 2;
                  
                  return (
                    <tr key={file.id} className="hover:bg-slate-50/50 transition-colors group relative hover:z-30">
                      <td className="px-6 py-5 align-middle">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 truncate mb-1" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{file.size}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <div className="flex justify-center">
                          <StatusChip status={file.status} error={file.error} />
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <div className="flex justify-center">
                          {file.emotionType ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-black rounded-lg border border-blue-100/50">
                              {file.emotionType}
                            </span>
                          ) : <span className="text-slate-200">--</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        {file.emotionLevel ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-[11px] font-black leading-none ${file.emotionLevel >= 8 ? 'text-rose-600' : file.emotionLevel >= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {file.emotionLevel}
                            </span>
                            <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40 relative">
                              <div 
                                className={`absolute top-0 left-0 h-full ${getLevelColor(file.emotionLevel)} transition-all duration-700`}
                                style={{ width: `${file.emotionLevel * 10}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : <div className="text-center text-slate-200">--</div>}
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex justify-center">
                          {file.voiceIdentity ? (
                            <div className="inline-flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-sm">
                              <UserIcon className="w-3.5 h-3.5 opacity-40 shrink-0" />
                              <span className="font-bold truncate" title={file.voiceIdentity}>{file.voiceIdentity}</span>
                            </div>
                          ) : <span className="text-slate-200">--</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        {file.reasoning ? (
                          <div className="relative group/popover flex items-center gap-2 cursor-default">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400 shrink-0" />
                            <p className="text-[11px] text-slate-400 line-clamp-2 italic leading-relaxed">
                              {file.reasoning}
                            </p>
                            <div className={`invisible group-hover/popover:visible opacity-0 group-hover/popover:opacity-100 absolute ${showAbove ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-80 p-5 bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] transition-all duration-200 pointer-events-auto text-left`}>
                              <div className="text-[10px] font-black text-blue-600 uppercase mb-3 border-b border-blue-50 pb-2 flex justify-between items-center tracking-widest">
                                <span>AI 听感分析报告</span>
                                <SparklesIcon className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-[12px] text-slate-600 leading-relaxed font-semibold mb-5">
                                {file.reasoning}
                              </p>
                              <button 
                                onClick={() => copyToClipboard(file.reasoning!, file.id)}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-100 rounded-xl text-[11px] font-black transition-all"
                              >
                                {copiedId === file.id ? (
                                  <><CheckIcon className="w-4 h-4 text-emerald-500" /> 已存入剪贴板</>
                                ) : (
                                  <><ClipboardDocumentIcon className="w-4 h-4" /> 复制分析全文</>
                                )}
                              </button>
                              <div className={`absolute left-4 w-3 h-3 bg-white border-slate-200 transform rotate-45 ${showAbove ? '-bottom-1.5 border-r border-b' : '-top-1.5 border-l border-t'}`}></div>
                            </div>
                          </div>
                        ) : <span className="text-[11px] text-slate-200 font-medium">就绪，等待智能解析</span>}
                      </td>
                      <td className="px-6 py-5 text-right align-middle">
                        <button 
                          onClick={() => removeFile(file.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="mt-auto py-12 flex flex-col items-center gap-2 border-t border-slate-100">
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest text-center">
          © 2026 Sonic Lab Pro | Powered by Gemini 3 Flash
        </p>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] opacity-60">
          Experimental Audio Perception Environment
        </p>
      </footer>
    </div>
  );
};

const StatusChip: React.FC<{ status: EmotionStatus, error?: string }> = ({ status, error }) => {
  const base = "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase border whitespace-nowrap h-[24px]";
  switch (status) {
    case EmotionStatus.IDLE:
      return <span className={`${base} bg-slate-50 text-slate-400 border-slate-100`}>等待中</span>;
    case EmotionStatus.PROCESSING:
      return <span className={`${base} bg-blue-50 text-blue-600 border-blue-100 shadow-sm shadow-blue-50/50`}><ArrowPathIcon className="w-3 h-3 animate-spin" />解析中</span>;
    case EmotionStatus.COMPLETED:
      return <span className={`${base} bg-emerald-50 text-emerald-600 border-emerald-100`}><CheckCircleIcon className="w-3 h-3" />已完成</span>;
    case EmotionStatus.FAILED:
      return <span className={`${base} bg-rose-50 text-rose-600 border-rose-100`} title={error}><XCircleIcon className="w-3 h-3" />{error || "失败"}</span>;
    default:
      return null;
  }
};

export default App;
