
import React from 'react';

interface Props {
  auth: any;
}

const AuthView: React.FC<Props> = ({ auth }) => {
  const { loginId, setLoginId, password, setPassword, isLoading, statusMessage, showError, handleLoginAction } = auth;

  return (
    <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#11141b] border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">
            VocaMaster Login
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
            Authorized Database Access Only
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <input 
              type="text" 
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Login ID"
              disabled={isLoading}
              className="w-full bg-[#080a0f] border-2 border-slate-800 py-4 px-6 rounded-2xl text-center text-lg font-bold text-slate-100 outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700 disabled:opacity-50"
              autoFocus
            />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoginAction()}
              placeholder="Password"
              disabled={isLoading}
              className={`w-full bg-[#080a0f] border-2 py-4 px-6 rounded-2xl text-center text-lg font-bold outline-none transition-all ${showError ? 'border-rose-500 animate-[shake_0.4s]' : 'border-slate-800 focus:border-indigo-500/50 text-indigo-400'} placeholder:text-slate-700 disabled:opacity-50`}
            />
          </div>

          {statusMessage && (
            <div className={`text-[11px] font-bold uppercase tracking-wider animate-in fade-in duration-300 ${showError || statusMessage.includes('실패') || statusMessage.includes('오류') || statusMessage.includes('않습니다') || statusMessage.includes('확인') ? 'text-rose-400' : 'text-indigo-400/80'}`}>
              {statusMessage}
            </div>
          )}

          <button 
            onClick={handleLoginAction}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:bg-slate-800 flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              'AUTHENTICATE'
            )}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800/50">
          <p className="text-slate-600 text-[9px] uppercase tracking-tighter leading-relaxed">
            PostgreSQL Cloud Service (Supabase) Active.<br/>
            Login: voca_user_registered | Data: word_data
          </p>
        </div>
      </div>
      <style>{`@keyframes shake {0%,100%{transform:translateX(0);}20%,60%{transform:translateX(-5px);}40%,80%{transform:translateX(5px);}}`}</style>
    </div>
  );
};

export default AuthView;
