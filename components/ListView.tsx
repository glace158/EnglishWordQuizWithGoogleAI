
import React, { useRef } from 'react';

interface Props {
  wordData: any;
  onStartQuiz: (word: any) => void;
}

const ListView: React.FC<Props> = ({ wordData, onStartQuiz }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCSV = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/).slice(1);
      const newWords = lines.map((l, i) => {
        const p = l.split(',');
        if (p.length < 2) return null;
        // 단어 뜻 내의 ; 이나 / 를 , 로 치환
        const krMeaning = p[1].replace(/[;/]/g, ',').trim();
        return { 
          id: `csv-${Date.now()}-${i}`, 
          en: p[0].trim(), 
          kr: krMeaning, 
          example: p[2]||'', 
          exampleKr: p[3]||'', 
          correctCount: 0, 
          incorrectCount: 0, 
          isMastered: false 
        };
      }).filter(Boolean);
      wordData.setWords((prev: any) => [...prev, ...newWords]);
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (window.confirm('정말로 모든 단어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      wordData.setWords([]);
    }
  };

  const toggleMastery = (id: string) => {
    wordData.setWords((prev: any) => prev.map((w: any) => 
      w.id === id ? { ...w, isMastered: !w.isMastered } : w
    ));
  };

  return (
    <div className="bg-[#11141b] rounded-[2rem] shadow-2xl border border-slate-800/50 overflow-hidden">
      <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center bg-[#161a24]">
        <h2 className="text-2xl font-black text-slate-200 uppercase tracking-tighter">Word Studio</h2>
        <div className="flex gap-3 flex-wrap justify-end">
          <button onClick={wordData.saveToSQL} className="px-5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-black rounded-xl border border-emerald-500/20 transition-all">SQL Save</button>
          <button onClick={wordData.loadFromSQL} className="px-5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-black rounded-xl border border-emerald-500/20 transition-all">SQL Load</button>
          <button onClick={wordData.handleLinkFile} className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-black rounded-xl border border-indigo-500/20 transition-all">JSON 연결</button>
          <button onClick={wordData.exportToJSON} className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-black rounded-xl border border-indigo-500/20 transition-all">JSON 저장</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition-all">IMPORT CSV</button>
          <button onClick={handleClearAll} className="px-5 py-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-black rounded-xl border border-rose-500/20 transition-all">CLEAR ALL</button>
          <input type="file" ref={fileInputRef} onChange={handleCSV} accept=".csv" className="hidden" />
        </div>
      </div>

      {/* Sync Credentials Bar - Separated Fields */}
      <div className="bg-[#0e1117] p-4 rounded-b-2xl border-t border-slate-800 flex flex-wrap gap-4 items-center">
        <div className="flex-1 flex gap-3 min-w-[280px]">
          <input 
            type="text" 
            value={wordData.syncId} 
            onChange={(e) => wordData.setSyncId(e.target.value)} 
            placeholder="Sync ID" 
            className="flex-1 bg-[#05070a] border border-slate-800 text-[10px] font-mono text-indigo-400 p-2.5 rounded-xl outline-none focus:border-indigo-500/30 transition-colors" 
          />
          <input 
            type="password" 
            value={wordData.syncPassword} 
            onChange={(e) => wordData.setSyncPassword(e.target.value)} 
            placeholder="Sync Password" 
            className="flex-1 bg-[#05070a] border border-slate-800 text-[10px] font-mono text-indigo-400 p-2.5 rounded-xl outline-none focus:border-indigo-500/30 transition-colors" 
          />
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        <div className="hidden md:grid grid-cols-[80px_1fr_1.5fr_100px_120px] bg-[#0e1117] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800 items-center sticky top-0 z-10 py-5 px-8">
          <div>State</div><div>Term</div><div>Interpretation</div><div className="text-center">Accuracy</div><div className="text-center">Actions</div>
        </div>
        <div className="divide-y divide-slate-800/50">
          {wordData.words.map((w: any) => (
            <div key={w.id} className="flex flex-col md:grid md:grid-cols-[80px_1fr_1.5fr_100px_120px] items-center hover:bg-slate-800/20 transition-colors p-6 md:p-0">
              <div className="hidden md:flex justify-center py-5">
                <button 
                  onClick={() => toggleMastery(w.id)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${w.isMastered ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-900 border border-slate-800 hover:border-slate-600'}`}
                  title={w.isMastered ? "Unmark Mastered" : "Mark Mastered"}
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                </button>
              </div>
              <div className="px-8 py-2 md:py-5 font-black text-xl md:text-lg text-slate-100">{w.en}</div>
              <div className="px-8 py-2 md:py-5 text-slate-400">{w.kr}</div>
              <div className="px-8 py-2 md:py-5 text-center text-indigo-400 font-bold">{Math.round((w.correctCount / (w.correctCount + w.incorrectCount || 1)) * 100)}%</div>
              <div className="px-8 py-2 md:py-5 flex justify-center gap-3">
                <button onClick={() => onStartQuiz(w)} className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <button onClick={() => wordData.setWords((prev:any)=>prev.filter((x:any)=>x.id!==w.id))} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"></path></svg></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListView;
