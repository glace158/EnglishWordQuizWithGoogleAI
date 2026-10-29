/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrainingStats } from '../types';

interface StatsCardsProps {
  stats: TrainingStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="visual-stats-panel">
      {/* Words Total Card */}
      <div 
        className="bg-[#111320]/60 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md shadow-black/20"
        id="stat-words-total"
      >
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-500">
          WORDS TOTAL
        </span>
        <span className="text-3xl md:text-4xl font-extrabold text-zinc-100 mt-2 font-mono">
          {stats.wordsTotal}
        </span>
      </div>

      {/* Mastered Card */}
      <div 
        className="bg-[#111320]/60 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md shadow-black/20"
        id="stat-mastered"
      >
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-500">
          MASTERED
        </span>
        <span className="text-3xl md:text-4xl font-extrabold text-green-400 mt-2 font-mono">
          {stats.mastered}
        </span>
      </div>

      {/* Learning Card */}
      <div 
        className="bg-[#111320]/60 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md shadow-black/20"
        id="stat-learning"
      >
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-500">
          LEARNING
        </span>
        <span className="text-3xl md:text-4xl font-extrabold text-[#A855F7] mt-2 font-mono">
          {stats.learning}
        </span>
      </div>

      {/* Avg Accuracy Card */}
      <div 
        className="bg-[#111320]/60 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md shadow-black/20"
        id="stat-avg-accuracy"
      >
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-500">
          AVG ACCURACY
        </span>
        <span className="text-3xl md:text-4xl font-extrabold text-[#3B82F6] mt-2 font-mono">
          {stats.avgAccuracy}%
        </span>
      </div>
    </div>
  );
}
