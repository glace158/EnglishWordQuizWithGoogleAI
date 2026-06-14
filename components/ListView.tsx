
import React, { useRef, useState } from 'react';

interface Props {
  wordData: any;
  onStartQuiz: (word: any) => void;
}

const ListView: React.FC<Props> = ({ wordData, onStartQuiz }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
        const krMeaning = p[1].replace(/[;/]/g, ',').trim();
        return { 
          id: `csv-${Date.now()}-${i}`, 
          en: p[0].trim(), 
          kr: krMeaning, 
          example: p[2]||'', 
          exampleKr: p[3]||'', 
          correctCount: 0, 
          incorrectCount: 0, 
          isMastered: false,
          interval: 0,
          easiness: 2.5,
          repetitions: 0,
          nextReview: Date.now()
        };
      }).filter(Boolean);
      wordData.setWords((prev: any) => [...prev, ...newWords]);
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (window.confirm('현재 단어장의 모든 단어를 삭제하시겠습니까?')) {
      wordData.setWords([]);
    }
  };

  const toggleMastery = (id: string) => {
    wordData.setWords((prev: any) => prev.map((w: any) => 
      w.id === id ? { ...w, isMastered: !w.isMastered } : w
    ));
  };

  const startRename = (book: any) => {
    setEditingId(book.id);
    setEditValue(book.name);
  };

  const finishRename = () => {
    if (editingId && editValue.trim()) {
      wordData.renameWordbook(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="bg-[#11141b] rounded-[2rem] shadow-2xl border border-slate-800/50 overflow-hidden">
      {/* Wordbook Tabs Selector */}
      <div className="bg-[#0e1117] border-b border-slate-800 px-6 pt-6 flex items-end gap-2 overflow-x-auto no-scrollbar">
        {wordData.wordbooks.map((book: any) => (
          <div 
            key={book.id} 
            className={`group relative flex items-center gap-2 px-6 py-4 rounded-t-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap border-x border-t border-transparent ${
              wordData.activeBookId === book.id 
                ? 'bg-[#161a24] text-indigo-400 border-slate-800 shadow-[0_-5px_15px_rgba(79,70,229,0.1)]' 
                : 'bg-transparent text-slate-600 hover:text-slate-400'
            }`}
            onClick={() => wordData.setActiveBookId(book.id)}
          >
            {editingId === book.id ? (
              <input 
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishRename}
                onKeyDown={(e) => e.key === 'Enter' && finishRename()}
                className="bg-transparent border-none outline-none text-indigo-400 w-24"
              />
            ) : (
              <span onDoubleClick={() => startRename(book)}>{book.name}</span>
            )}
            
            <span className="bg-slate-800/50 px-2 py-0.5 rounded-full text-[9px] text-slate-500 font-mono">
              {book.words.length}
            </span>

            {wordData.activeBookId === book.id && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); wordData.removeWordbook(book.id); }}
                  className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        
        <button 
          onClick={() => {
            const name = prompt('새 단어장 이름을 입력하세요:');
            if (name) wordData.addWordbook(name);
          }}
          className="px-5 py-4 text-slate-700 hover:text-indigo-400 transition-colors"
          title="Add New Wordbook"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
      </div>

      <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center bg-[#161a24]">
        <h2 className="text-2xl font-black text-slate-200 uppercase tracking-tighter">
          {wordData.wordbooks.find((b: any) => b.id === wordData.activeBookId)?.name}
        </h2>
        <div className="flex gap-3 flex-wrap justify-end">
          <button onClick={wordData.saveToSQL} className="px-5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-black rounded-xl border border-emerald-500/20 transition-all">SQL Save All</button>
          <button onClick={wordData.loadFromSQL} className="px-5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-black rounded-xl border border-emerald-500/20 transition-all">SQL Load All</button>
          <button onClick={wordData.handleLinkFile} className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-black rounded-xl border border-indigo-500/20 transition-all">파일 연결</button>
          <button onClick={wordData.exportToJSON} className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-black rounded-xl border border-indigo-500/20 transition-all">전체 백업</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition-all">IMPORT CSV</button>
          <button onClick={handleClearAll} className="px-5 py-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-black rounded-xl border border-rose-500/20 transition-all">CLEAR LIST</button>
          <input type="file" ref={fileInputRef} onChange={handleCSV} accept=".csv" className="hidden" />
        </div>
      </div>

      {/* Sync Credentials Bar */}
      <div className="bg-[#0e1117] p-4 border-b border-slate-800 flex flex-wrap gap-4 items-center">
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
        {wordData.words.length === 0 ? (
          <div className="p-20 text-center opacity-30 italic font-bold">
            이 단어장은 비어있습니다. CSV를 임포트하거나 퀴즈 모드에서 단어를 추가하세요.
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ListView;
