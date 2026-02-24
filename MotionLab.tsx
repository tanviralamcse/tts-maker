
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from '@google/genai';
import { LANGUAGES, VOICES, PRODUCTION_LANG_CODES } from './constants';
import { Scene, VideoProject, TTSEngine, ImageEngine, VoiceName, Language, Character } from './types';
import { decodeBase64, pcmToWavBlob } from './utils/audioUtils';

declare var puter: any;

interface MotionLabProps {
  getApiKey: (provider: 'gemini' | 'together') => string;
}

const MotionLab: React.FC<MotionLabProps> = ({ getApiKey }) => {
  const [project, setProject] = useState<VideoProject>({
    story: `Casting bible input:
- The Father: A thin middle-aged South Asian man in his 40s, worn-out traditional kurta and pants, tired but kind eyes, short dark hair with some grey, gentle caring expression, slightly hunched from hardship.
- The Daughter: A small girl around 7-8 years old, big innocent brown eyes, messy dark hair in a simple braid, wearing a faded floral dress, barefoot, thin but cheerful face, holding her father's hand.

Scenes:
===============================================
SCENE 1
===============================================

IMAGE: A thin middle-aged father in worn-out kurta walking on a dusty village road holding hands with his small 7-year-old daughter in faded floral dress, vertical 9:16 Pixar style

BANGLA: এক দুর্ভিক্ষের সময়। একজন বাবা তার ছোট মেয়েকে নিয়ে পথে হাঁটছেন। পকেটে শেষ কয়েকটা টাকা।

HINDI: अकाल का समय था। एक पिता अपनी छोटी बेटी के साथ रास्ते पर चल रहे थे। जेब में आखिरी कुछ रुपये।

ENGLISH: It was a time of famine. A father was walking on the road with his little daughter. In his pocket, the last few coins.`,
    scenes: [],
    characters: [],
    language: LANGUAGES[0],
    targetLanguages: PRODUCTION_LANG_CODES,
    ttsEngine: TTSEngine.PUTER,
    imageEngine: ImageEngine.GEMINI,
    selectedVoice: VoiceName.KORE,
    isProcessing: false,
    step: 'idle'
  });
  
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrls, setExportUrls] = useState<Record<string, string>>({});
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateProject = (updates: Partial<VideoProject>) => {
    setProject(prev => ({ ...prev, ...updates }));
  };

  const toggleLanguage = (code: string) => {
    const current = project.targetLanguages;
    if (current.includes(code)) {
      if (current.length > 1) {
        updateProject({ targetLanguages: current.filter(c => c !== code) });
      }
    } else {
      updateProject({ targetLanguages: [...current, code] });
    }
  };

  const retry = async <T extends unknown>(fn: () => Promise<T>, retries = 5, initialDelay = 2000, context = "Operation"): Promise<T> => {
    try {
      return await fn();
    } catch (err: any) {
      const isQuotaError = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota');
      
      if (retries > 0 && isQuotaError) {
        let waitTime = initialDelay;
        try {
          const errorBody = JSON.parse(err.message.substring(err.message.indexOf('{')));
          const retryDelayStr = errorBody?.details?.[0]?.retryDelay;
          if (retryDelayStr) {
            waitTime = parseInt(retryDelayStr.replace('s', '')) * 1000 + 1000;
          }
        } catch (e) {
          waitTime = initialDelay * (6 - retries);
        }

        setRetryInfo(`Rate limited ${context}. Waiting ${Math.round(waitTime/1000)}s...`);
        await new Promise(r => setTimeout(r, waitTime));
        return retry(fn, retries - 1, initialDelay, context);
      }
      throw err;
    }
  };

  const parseStructuredStory = (rawText: string): { scenes: Scene[], characters: Character[] } => {
    const characters: Character[] = [];
    const scenes: Scene[] = [];
    
    const castingMatch = rawText.match(/Casting bible input:([\s\S]*?)Scenes:/i);
    if (castingMatch) {
      const charLines = castingMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
      charLines.forEach(line => {
        const parts = line.replace(/^-/, '').split(':');
        if (parts.length >= 2) {
          characters.push({
            name: parts[0].trim(),
            description: parts.slice(1).join(':').trim()
          });
        }
      });
    }

    const sceneSplitRegex = /={10,}\s*SCENE \d+\s*={10,}/gi;
    const sceneBlocks = rawText.split(sceneSplitRegex).slice(1);

    const langKeyMap: Record<string, string> = {
      'BANGLA:': 'bn-BD', 'HINDI:': 'hi-IN', 'ENGLISH:': 'en-US'
    };

    sceneBlocks.forEach((block, i) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const scene: Scene = { id: `scene-${i}`, imagePrompt: '', narratorText: '', voiceEmotion: "cinematic", translations: {}, audios: {} };
      
      lines.forEach(line => {
        if (line.toUpperCase().startsWith('IMAGE:')) {
          scene.imagePrompt = line.substring(6).trim();
        } else {
          for (const [prefix, code] of Object.entries(langKeyMap)) {
            if (line.toUpperCase().startsWith(prefix)) {
              scene.translations[code] = line.substring(prefix.length).trim();
              if (code === 'en-US') scene.narratorText = scene.translations[code];
              break;
            }
          }
        }
      });
      
      if (!scene.narratorText) {
        const firstTrans = Object.values(scene.translations)[0];
        scene.narratorText = firstTrans || "Scene Script";
      }
      if (scene.imagePrompt || Object.keys(scene.translations).length > 0) {
        scenes.push(scene);
      }
    });

    return { scenes, characters };
  };

  const getTogetherImage = async (prompt: string): Promise<string> => {
    const apiKey = getApiKey('together');
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell', prompt, width: 1024, height: 1024, steps: 4 })
    });
    const data = await response.json();
    return data.data[0].url || data.data[0].b64_json;
  };

  const getReplicateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspectRatio })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Replicate generation failed");
    }
    const data = await response.json();
    return data.url;
  };

  const processProduction = async () => {
    if (!project.story.trim()) return;
    setError(null);
    setRetryInfo(null);
    updateProject({ isProcessing: true, step: 'storyboarding' });

    try {
      const { scenes: parsedScenes, characters: parsedCharacters } = parseStructuredStory(project.story);
      if (parsedScenes.length === 0) throw new Error("Could not find any scenes. Ensure SCENE 1 headers are present.");
      
      updateProject({ scenes: parsedScenes, characters: parsedCharacters });

      // Step 1: Generate Images
      for (let i = 0; i < parsedScenes.length; i++) {
        const scene = parsedScenes[i];
        let cinematicPrompt = `Pixar style. `;
        if (parsedCharacters.length > 0) {
          cinematicPrompt += "Character Bible:\n";
          parsedCharacters.forEach(char => {
            cinematicPrompt += `- ${char.name}: ${char.description}\n`;
          });
          cinematicPrompt += "\nScene Description: ";
        }
        cinematicPrompt += scene.imagePrompt;

        const isVertical = cinematicPrompt.toLowerCase().includes('9:16') || cinematicPrompt.toLowerCase().includes('vertical');
        const aspectRatio = isVertical ? "9:16" : "16:9";

        if (project.imageEngine === ImageEngine.TOGETHER) {
          parsedScenes[i].imageUrl = await getTogetherImage(cinematicPrompt);
        } else if (project.imageEngine === ImageEngine.REPLICATE) {
          parsedScenes[i].imageUrl = await getReplicateImage(cinematicPrompt, aspectRatio);
        } else {
          const ai = new GoogleGenAI({ apiKey: getApiKey('gemini') });
          const imgRes = await retry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ parts: [{ text: cinematicPrompt }] }],
            config: { imageConfig: { aspectRatio } }
          }), 3, 3000, `Image Generation ${i+1}`) as GenerateContentResponse;
          const part = imgRes.candidates?.[0]?.content?.parts.find(p => p.inlineData);
          if (part?.inlineData) parsedScenes[i].imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
        updateProject({ scenes: [...parsedScenes], step: 'synthesizing' });
      }

      // Step 2: Multi-Language TTS Synthesis
      for (let i = 0; i < parsedScenes.length; i++) {
        const scene = parsedScenes[i];
        
        for (const langCode of project.targetLanguages) {
          const transText = scene.translations[langCode];
          if (!transText) continue;

          if (project.ttsEngine === TTSEngine.GEMINI) {
            setRetryInfo(`Throttling Gemini TTS. Processing ${langCode}...`);
            const aiTTS = new GoogleGenAI({ apiKey: getApiKey('gemini') });
            try {
              const ttsRes = await retry(() => aiTTS.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: transText }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: project.selectedVoice } } },
                },
              }), 5, 5000, `TTS Synthesis (${langCode})`) as GenerateContentResponse;

              const base64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (base64) {
                const bytes = decodeBase64(base64);
                const blob = await pcmToWavBlob(bytes, 24000);
                parsedScenes[i].audios[langCode] = { blob, url: URL.createObjectURL(blob) };
              }
              await new Promise(r => setTimeout(r, 6500)); 
            } catch (e: any) { console.error(`Failed TTS for ${langCode}:`, e); }
          } else if (project.ttsEngine === TTSEngine.PUTER) {
            setRetryInfo(`Puter Synthesis: Processing ${langCode}...`);
            try {
              const audioObj = await puter.ai.txt2speech(transText, langCode);
              const response = await fetch(audioObj.src);
              const blob = await response.blob();
              parsedScenes[i].audios[langCode] = { blob, url: URL.createObjectURL(blob) };
              await new Promise(r => setTimeout(r, 500));
            } catch (e) { console.error(`Puter TTS failed for ${langCode}:`, e); }
          }
        }
        updateProject({ scenes: [...parsedScenes] });
        setRetryInfo(null);
      }
      updateProject({ step: 'ready', isProcessing: false });
    } catch (err: any) {
      setError(err.message);
      updateProject({ isProcessing: false, step: 'idle' });
    }
  };

  const exportAllVideos = async () => {
    if (!canvasRef.current || project.scenes.length === 0) return;
    updateProject({ step: 'exporting' });
    const urls: Record<string, string> = {};
    
    const isVertical = project.scenes[0].imagePrompt.toLowerCase().includes('9:16') || project.scenes[0].imagePrompt.toLowerCase().includes('vertical');
    const canvas = canvasRef.current;
    canvas.width = isVertical ? 720 : 1280;
    canvas.height = isVertical ? 1280 : 720;

    for (const langCode of project.targetLanguages) {
      const hasAudio = project.scenes.some(s => s.audios[langCode]);
      if (!hasAudio) continue;

      setExportProgress(0);
      const ctx = canvas.getContext('2d', { alpha: false })!;
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const canvasStream = (canvas as any).captureStream(30);
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const recordPromise = new Promise<string>((resolve) => { recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))); });
      recorder.start();

      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        if (!scene.imageUrl) continue;
        setExportProgress(Math.round(((i + 1) / project.scenes.length) * 100));
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = scene.imageUrl;
        await new Promise(r => img.onload = r);

        let duration = 4000;
        const audioData = scene.audios[langCode];
        if (audioData?.blob) {
          const arrayBuf = await audioData.blob.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(dest); source.connect(audioCtx.destination);
          duration = audioBuffer.duration * 1000 + 500;
          source.start();
        }

        const start = Date.now();
        const translatedText = scene.translations[langCode] || "";
        
        await new Promise<void>((resolve) => {
          const frame = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(1, elapsed / duration);
            const scale = 1.0 + progress * 0.12;
            
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(scale, scale); ctx.translate(-canvas.width/2, -canvas.height/2);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            
            if (translatedText) {
              const overlayH = isVertical ? 350 : 200;
              ctx.fillStyle = 'rgba(0,0,0,0.8)';
              ctx.fillRect(0, canvas.height - overlayH, canvas.width, overlayH);
              
              ctx.fillStyle = 'white';
              ctx.font = isVertical ? '800 42px Inter' : '800 36px Inter';
              ctx.textAlign = 'center';
              
              const words = translatedText.split(' ');
              let line = ''; const lines = [];
              const maxW = canvas.width * 0.9;
              for(let n = 0; n < words.length; n++) {
                if (ctx.measureText(line + words[n]).width > maxW) { lines.push(line); line = ''; }
                line += words[n] + ' ';
              }
              lines.push(line);
              
              const startY = canvas.height - (overlayH / 2) - (lines.length * 20);
              lines.forEach((l, idx) => ctx.fillText(l.trim(), canvas.width/2, startY + (idx * (isVertical ? 60 : 50))));
            }
            
            if (progress < 1) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
      }
      recorder.stop();
      urls[langCode] = await recordPromise;
      audioCtx.close();
      setExportUrls({ ...urls });
    }
    updateProject({ step: 'ready' });
  };

  return (
    <div className="flex flex-col gap-8 pb-20 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-6xl font-black text-white tracking-tighter italic">GLOBAL <span className="text-indigo-500">MAX</span></h1>
          <p className="text-slate-500 font-bold text-[10px] mt-2 uppercase tracking-widest">{project.targetLanguages.length}-Language Studio ({project.targetLanguages.map(c => c.split('-')[0].toUpperCase()).join(', ')})</p>
        </div>
        <div className="flex gap-4">
           {project.step === 'ready' && <button onClick={exportAllVideos} className="bg-white text-black px-10 py-5 rounded-full font-black shadow-2xl flex items-center gap-3 transition-all active:scale-95"><div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>RENDER {project.targetLanguages.length} REELS</button>}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-[480px] space-y-6 shrink-0">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
             <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-6 tracking-[0.2em]">Engine Config</h3>
             <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => updateProject({ ttsEngine: TTSEngine.GEMINI })} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${project.ttsEngine === TTSEngine.GEMINI ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>GEMINI TTS</button>
                <button onClick={() => updateProject({ ttsEngine: TTSEngine.PUTER })} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${project.ttsEngine === TTSEngine.PUTER ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>PUTER FREE</button>
             </div>
             <div className="grid grid-cols-3 gap-2 mb-6">
                <button onClick={() => updateProject({ imageEngine: ImageEngine.GEMINI })} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${project.imageEngine === ImageEngine.GEMINI ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>GEMINI IMG</button>
                <button onClick={() => updateProject({ imageEngine: ImageEngine.TOGETHER })} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${project.imageEngine === ImageEngine.TOGETHER ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>TOGETHER</button>
                <button onClick={() => updateProject({ imageEngine: ImageEngine.REPLICATE })} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${project.imageEngine === ImageEngine.REPLICATE ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>FLUX REPLICATE</button>
             </div>

              <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-4 tracking-[0.2em]">Target Voices (Languages)</h3>
             <div className="grid grid-cols-3 gap-2 mb-6">
                {LANGUAGES.map(lang => (
                  <button 
                     key={lang.code}
                     onClick={() => toggleLanguage(lang.code)}
                     className={`py-3 rounded-xl text-[9px] font-black border transition-all flex flex-col items-center gap-1 ${project.targetLanguages.includes(lang.code) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    {lang.name.toUpperCase()}
                  </button>
                ))}
             </div>

             <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-4 tracking-[0.2em]">Script & Bible Editor</h3>
             <textarea 
                value={project.story} 
                onChange={(e) => updateProject({ story: e.target.value })} 
                className="w-full h-[500px] bg-slate-950 border border-slate-800 rounded-2xl p-6 text-xs text-slate-300 outline-none mb-6 font-mono leading-relaxed" 
                placeholder="Casting bible input:..." 
             />
             <button onClick={processProduction} disabled={project.isProcessing} className="w-full py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[2rem] font-black uppercase text-sm shadow-xl shadow-indigo-900/40 transition-all hover:scale-[1.02] active:scale-95">
               {project.isProcessing ? `WORKING: ${project.step.toUpperCase()}` : `Process All Scenes x ${project.targetLanguages.length} Voices`}
             </button>
          </div>
          
          {Object.keys(exportUrls).length > 0 && (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-[2rem] p-8 shadow-2xl space-y-4">
               <h3 className="text-[10px] font-black uppercase text-emerald-400">Download Produced Reels</h3>
               <div className="grid grid-cols-2 gap-2">
                 {LANGUAGES.filter(l => exportUrls[l.code]).map(l => (
                   <a key={l.code} href={exportUrls[l.code]} download={`story_${l.name}.webm`} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black text-white hover:bg-emerald-600 transition-all text-center flex items-center justify-center gap-2">
                     <span className="text-base">{l.flag}</span> {l.name.toUpperCase()}
                   </a>
                 ))}
               </div>
            </div>
          )}
        </div>

        <div className="flex-grow bg-slate-900/40 border border-slate-800/40 rounded-[3.5rem] p-10 backdrop-blur-3xl shadow-2xl min-h-[800px]">
           <div className="flex justify-between items-center mb-12">
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Visual Storyboard</h2>
           </div>
           
           {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-6 rounded-3xl text-xs font-bold mb-8">{error}</div>}
           {retryInfo && (
             <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center gap-4 animate-pulse">
               <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{retryInfo}</span>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[1100px] scrollbar-hide pb-20">
             {project.scenes.length === 0 ? (
               <div className="col-span-full py-40 text-center border-2 border-dashed border-slate-800 rounded-[3rem] opacity-30">
                 <p className="text-[10px] font-black uppercase tracking-[0.5em]">Awaiting Input Structure</p>
               </div>
             ) : project.scenes.map((scene) => (
               <div key={scene.id} className="bg-slate-950/80 border border-slate-800/60 rounded-[2.5rem] p-6 flex flex-col group transition-all hover:border-indigo-500/30">
                 <div className={`aspect-video bg-slate-900 rounded-[1.8rem] mb-6 overflow-hidden relative border border-slate-800 shadow-xl ${scene.imagePrompt.toLowerCase().includes('9:16') ? 'aspect-[9/16] max-h-[500px]' : ''}`}>
                   {scene.imageUrl ? (
                     <img src={scene.imageUrl} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full animate-pulse flex flex-col items-center justify-center gap-4">
                       <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin"></div>
                       <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Rendering Frame</span>
                     </div>
                   )}
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed line-clamp-2">"{scene.narratorText}"</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.keys(scene.audios).map(lang => (
                          <div key={lang} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <span className="text-[8px] text-indigo-400 font-black">{lang.split('-')[0].toUpperCase()}</span>
                          </div>
                        ))}
                    </div>
                 </div>
               </div>
             ))}
           </div>
           <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
};

export default MotionLab;
