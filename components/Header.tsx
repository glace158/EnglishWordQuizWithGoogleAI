
import React from 'react';

interface Props {
  activeTab: 'quiz' | 'list';
  setActiveTab: (tab: 'quiz' | 'list') => void;
}

const Header: React.FC<Props> = ({ activeTab, setActiveTab }) => (
  <header className="mb-12 text-center">
    <h1 className="text-5xl font-extrabold mb-3 tracking-tight">
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">VocaMaster AI</span>
    </h1>
    <p className="text-slate-500 font-medium italic">High-Fidelity Learning Interface</p>
    <div className="mt-10 flex justify-center p-1 bg-[#11141b] rounded-full w-fit mx-auto shadow-2xl border border-slate-800">
      <button onClick={() => setActiveTab('quiz')} className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>Trivia Showdown</button>
      <button onClick={() => setActiveTab('list')} className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>Word Studio</button>
    </div>
  </header>
);

export default Header;
