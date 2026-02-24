
import React, { useState, useRef } from 'react';
import { ApiKey } from './types';

interface SettingsProps {
  keys: ApiKey[];
  onUpdateKeys: (keys: ApiKey[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ keys, onUpdateKeys }) => {
  const [newKey, setNewKey] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulk, setIsBulk] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'together'>('gemini');
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState(1500); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addKey = () => {
    if (!newKey.trim()) return;
    const keyObj: ApiKey = {
      id: Math.random().toString(36).substr(2, 9),
      key: newKey.trim(),
      provider,
      label: label.trim() || `${provider.toUpperCase()} Key ${keys.filter(k => k.provider === provider).length + 1}`,
      usageCount: 0,
      maxUsage: limit,
      resetDate: new Date().toISOString()
    };
    onUpdateKeys([...keys, keyObj]);
    setNewKey('');
    setLabel('');
  };

  const addBulkKeys = () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
    const newKeyObjs: ApiKey[] = lines.map((key, index) => ({
      id: Math.random().toString(36).substr(2, 9) + index,
      key,
      provider,
      label: `${provider.toUpperCase()} Bulk ${keys.filter(k => k.provider === provider).length + index + 1}`,
      usageCount: 0,
      maxUsage: limit,
      resetDate: new Date().toISOString()
    }));
    onUpdateKeys([...keys, ...newKeyObjs]);
    setBulkInput('');
    setIsBulk(false);
  };

  const removeKey = (id: string) => {
    onUpdateKeys(keys.filter(k => k.id !== id));
  };

  const exportVault = () => {
    const dataStr = JSON.stringify(keys, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studio_max_vault_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedKeys = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedKeys)) {
          onUpdateKeys(importedKeys);
          alert(`Imported ${importedKeys.length} keys.`);
        }
      } catch (err) {
        alert('Failed to parse the JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">API <span className="text-indigo-500">Vault</span></h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Guard the Free Tier: Monthly caps and multi-provider rotation.</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-[3rem] p-10 backdrop-blur-3xl shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex justify-between items-center ml-2">
              <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em]">Register Key</h3>
              <button 
                onClick={() => setIsBulk(!isBulk)} 
                className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-400 transition-colors"
              >
                {isBulk ? 'Single Add' : 'Bulk Add'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button onClick={() => setProvider('gemini')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${provider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Gemini</button>
                <button onClick={() => setProvider('together')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${provider === 'together' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Together</button>
              </div>
              
              {!isBulk ? (
                <>
                  <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none font-bold" />
                  <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="API Key" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-indigo-400 outline-none font-mono" />
                </>
              ) : (
                <textarea 
                  value={bulkInput} 
                  onChange={(e) => setBulkInput(e.target.value)} 
                  placeholder="Paste multiple keys (one per line or comma separated)" 
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-indigo-400 outline-none font-mono resize-none"
                />
              )}

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-2">Safety Usage Cap</label>
                <input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none font-bold" />
              </div>
              <button 
                onClick={isBulk ? addBulkKeys : addKey} 
                className="w-full py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                {isBulk ? 'Add Bulk to Vault' : 'Add to Vault'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] ml-2">Vault Status</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
              {keys.length === 0 ? <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem] opacity-20">Empty</div> : keys.map((k) => (
                <div key={k.id} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${k.usageCount >= k.maxUsage ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                      <div className="text-[11px] font-black text-slate-200">{k.label} ({k.provider})</div>
                    </div>
                    <button onClick={() => removeKey(k.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-500">×</button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                      <span className="text-slate-600">Monthly Usage</span>
                      <span className={k.usageCount >= k.maxUsage ? 'text-red-400' : 'text-indigo-400'}>{k.usageCount} / {k.maxUsage}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div className={`h-full ${k.usageCount >= k.maxUsage ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (k.usageCount / k.maxUsage) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/60 rounded-[3rem] p-10 backdrop-blur-3xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-black uppercase text-indigo-400">Database Portability</h3>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Treat your keys as a file-based database.</p>
        </div>
        <div className="flex gap-4">
          <input type="file" accept=".json" ref={fileInputRef} onChange={importVault} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase">Import JSON</button>
          <button onClick={exportVault} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase">Export JSON</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
