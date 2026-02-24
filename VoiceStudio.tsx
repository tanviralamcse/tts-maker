
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { LANGUAGES, VOICES, DEFAULT_TEXT } from './constants';
import { VoiceName, Language, AudioState, TTSEngine } from './types';
import { decodeBase64, pcmToWavBlob } from './utils/audioUtils';

declare var puter: any;

interface VoiceStudioProps {
  getApiKey: () => string;
}

const VoiceStudio: React.FC<VoiceStudioProps> = ({ getApiKey }) => {
  const [engine, setEngine] = useState<TTSEngine>(TTSEngine.GEMINI);
  const [text, setText] = useState<string>(DEFAULT_TEXT['bn-BD']);
  const [selectedLang, setSelectedLang] = useState<Language>(LANGUAGES[0]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.KORE);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedSystemVoice, setSelectedSystemVoice] = useState<string>('');
  
  const [audioState, setAudioState] = useState<AudioState>({
    blob: null,
    url: null,
    isLoading: false,
    error: null,
    isSystemPlaying: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSystemVoices(voices);
      const langVoices = voices.filter(v => v.lang.startsWith(selectedLang.code.split('-')[0]));
      if (langVoices.length > 0) setSelectedSystemVoice(langVoices[0].voiceURI);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedLang]);

  const generateSpeech = async () => {
    if (!text.trim()) return;
    setAudioState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      if (engine === TTSEngine.GEMINI) {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const prompt = `Say accurately in ${selectedLang.name}: ${text}`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("Voice synthesis failed.");

        const pcmBytes = decodeBase64(base64Audio);
        const wavBlob = await pcmToWavBlob(pcmBytes, 24000);
        const url = URL.createObjectURL(wavBlob);
        setAudioState({ blob: wavBlob, url, isLoading: false, error: null, isSystemPlaying: false });
      } 
      else if (engine === TTSEngine.PUTER) {
        // Puter.js TTS (Edge TTS based)
        const audioObj = await puter.ai.txt2speech(text, selectedLang.code);
        const response = await fetch(audioObj.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioState({ blob, url, isLoading: false, error: null, isSystemPlaying: false });
      }
      else if (engine === TTSEngine.SYSTEM) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = selectedLang.code;
        const voice = systemVoices.find(v => v.voiceURI === selectedSystemVoice);
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
        setAudioState({ blob: null, url: null, isLoading: false, error: null, isSystemPlaying: true });
      }
    } catch (err: any) {
      setAudioState((prev) => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800/50 backdrop-blur-xl">
        <div className="flex p-1 w-full md:w-auto gap-1">
          <button 
            onClick={() => setEngine(TTSEngine.GEMINI)} 
            className={`flex-1 md:flex-none px-6 py-3 rounded-[1.2rem] text-[10px] font-black transition-all ${engine === TTSEngine.GEMINI ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            GEMINI CLOUD
          </button>
          <button 
            onClick={() => setEngine(TTSEngine.PUTER)} 
            className={`flex-1 md:flex-none px-6 py-3 rounded-[1.2rem] text-[10px] font-black transition-all ${engine === TTSEngine.PUTER ? 'bg-cyan-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            PUTER FREE (EDGE)
          </button>
          <button 
            onClick={() => setEngine(TTSEngine.SYSTEM)} 
            className={`flex-1 md:flex-none px-6 py-3 rounded-[1.2rem] text-[10px] font-black transition-all ${engine === TTSEngine.SYSTEM ? 'bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
          >
            SYSTEM OS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-6">Language Library</h3>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {LANGUAGES.map((lang) => (
                <button key={lang.code} onClick={() => { setSelectedLang(lang); setText(DEFAULT_TEXT[lang.code as keyof typeof DEFAULT_TEXT] || ''); }} className={`flex flex-col p-4 rounded-2xl border transition-all ${selectedLang.code === lang.code ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="text-2xl mb-2">{lang.flag}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {engine === TTSEngine.GEMINI && (
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-6">Gemini Tone</h3>
              <div className="space-y-3">
                {VOICES.map((v) => (
                  <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`w-full flex justify-between items-center p-4 rounded-2xl border transition-all ${selectedVoice === v.name ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                    <div className="text-left"><div className="text-xs font-black">{v.name}</div></div>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">{v.gender}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {engine === TTSEngine.SYSTEM && (
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-6">System Voices</h3>
              <select 
                value={selectedSystemVoice} 
                onChange={(e) => setSelectedSystemVoice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] font-bold text-slate-300 outline-none"
              >
                {systemVoices.filter(v => v.lang.startsWith(selectedLang.code.split('-')[0])).map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[3.5rem] p-10 shadow-2xl flex flex-col min-h-[600px] backdrop-blur-3xl">
            <h2 className="text-4xl font-black text-white italic tracking-tighter mb-10 uppercase">
              {engine === TTSEngine.PUTER ? <span className="text-cyan-400">Puter</span> : engine === TTSEngine.GEMINI ? <span className="text-indigo-500">Gemini</span> : <span className="text-slate-400">System</span>} Speech
            </h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-grow bg-transparent border-none text-slate-100 focus:outline-none resize-none font-bold text-3xl md:text-5xl leading-[1.3] mb-10 scrollbar-hide"
              placeholder="Start typing your script here..."
            />
            <button
              onClick={generateSpeech}
              disabled={audioState.isLoading || !text.trim()}
              className={`w-full py-8 rounded-[2.5rem] font-black text-xl transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center justify-center ${
                engine === TTSEngine.PUTER ? 'bg-cyan-500 text-white' : engine === TTSEngine.GEMINI ? 'bg-white text-black' : 'bg-slate-700 text-white'
              }`}
            >
              {audioState.isLoading ? 'SYNTHESIZING...' : 'GENERATE MASTER AUDIO'}
            </button>
            {audioState.url && (
              <div className="bg-slate-950/80 rounded-[2.5rem] p-8 border border-slate-800/60 shadow-inner mt-8">
                <audio ref={audioRef} src={audioState.url} controls className="w-full h-12" />
              </div>
            )}
            {audioState.error && <p className="text-red-500 text-xs mt-4 font-bold uppercase tracking-widest">{audioState.error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;
