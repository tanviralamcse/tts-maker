
import React, { useState, useEffect, useRef } from 'react';
import { FeatureId, ApiKey } from './types';
import VoiceStudio from './VoiceStudio';
import MotionLab from './MotionLab';
import Settings from './Settings';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureId>('motion-lab');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    const saved = localStorage.getItem('studio_max_keys');
    if (!saved) return [];
    
    const parsed: ApiKey[] = JSON.parse(saved);
    const now = new Date();
    return parsed.map(k => {
      const resetDate = new Date(k.resetDate);
      if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
        return { ...k, usageCount: 0, resetDate: now.toISOString() };
      }
      return k;
    });
  });

  // Using Refs for indices ensures that multiple calls in a tight loop 
  // always get the NEXT key without waiting for a React re-render.
  const geminiIndexRef = useRef(0);
  const togetherIndexRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('studio_max_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const updateKeys = (newKeys: ApiKey[]) => {
    setApiKeys(newKeys);
  };

  /**
   * Rotates through available keys for the requested provider.
   * Increments usage counts and ensures round-robin selection.
   */
  const getRotatedKey = (provider: 'gemini' | 'together'): string => {
    const providerKeys = apiKeys.filter(k => k.provider === provider && k.usageCount < k.maxUsage);
    
    if (providerKeys.length === 0) {
      console.warn(`No active ${provider} keys found in Vault. Using environment default.`);
      return process.env.API_KEY || '';
    }

    // Determine current index and increment ref
    const ref = provider === 'gemini' ? geminiIndexRef : togetherIndexRef;
    const currentIndex = ref.current % providerKeys.length;
    const selectedKey = providerKeys[currentIndex];
    
    // Advance the ref for the NEXT call
    ref.current++;

    // Update usage count in state (asynchronous, but ref handles the rotation logic)
    setApiKeys(prev => prev.map(k => 
      k.id === selectedKey.id ? { ...k, usageCount: k.usageCount + 1 } : k
    ));

    console.debug(`[Vault] Rotating to ${provider} key: ${selectedKey.label}`);
    return selectedKey.key;
  };

  const navItems = [
    { id: 'motion-lab', label: 'Motion Lab', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ), status: 'MULTI' },
    { id: 'voice-studio', label: 'Voice Studio', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )},
    { id: 'settings', label: 'Vault', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    )},
  ];

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-200">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="font-black text-white tracking-tighter text-xl italic">STUDIO MAX</span>
        </div>

        <nav className="flex-grow p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveFeature(item.id as FeatureId)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                activeFeature === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="text-sm font-black uppercase tracking-tight">{item.label}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800/50">
           <div className="flex items-center gap-3 px-2 py-1">
             <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400">MTD</div>
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-200 truncate uppercase tracking-tighter">Vault Guard</span>
               <span className="text-[9px] font-bold text-indigo-500 truncate uppercase tracking-widest">
                 {apiKeys.filter(k => k.usageCount < k.maxUsage).length} Keys Ready
               </span>
             </div>
           </div>
        </div>
      </aside>

      <main className="flex-grow overflow-y-auto p-12 bg-slate-950 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          {activeFeature === 'motion-lab' && <MotionLab getApiKey={getRotatedKey} />}
          {activeFeature === 'voice-studio' && <VoiceStudio getApiKey={() => getRotatedKey('gemini')} />}
          {activeFeature === 'settings' && <Settings keys={apiKeys} onUpdateKeys={updateKeys} />}
        </div>
      </main>
    </div>
  );
};

export default App;
