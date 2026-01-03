
import React from 'react';
import { Word } from '../types';

interface Props {
  words: Word[];
}

const StatsSection: React.FC<Props> = ({ words }) => {
  const mastered = words.filter(w => w.isMastered).length;
  const learning = words.length - mastered;
  const avgAccuracy = words.length === 0 ? 0 : Math.round(words.reduce((acc, w) => {
    const total = w.correctCount + w.incorrectCount;
    return acc + (total === 0 ? 0 : (w.correctCount / total) * 100);
  }, 0) / words.length);

  return (
    <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
      {[
        { label: 'Words Total', val: words.length, color: 'text-slate-100' },
        { label: 'Mastered', val: mastered, color: 'text-emerald-400' },
        { label: 'Learning', val: learning, color: 'text-purple-400' },
        { label: 'Avg Accuracy', val: `${avgAccuracy}%`, color: 'text-indigo-400' }
      ].map((stat, i) => (
        <div key={i} className="bg-[#11141b] p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center shadow-lg group hover:border-slate-700 transition-all">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{stat.label}</div>
          <div className={`text-3xl font-black ${stat.color} group-hover:scale-110 transition-transform`}>{stat.val}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsSection;
