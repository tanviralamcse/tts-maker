
export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export enum TTSEngine {
  GEMINI = 'GEMINI',
  PUTER = 'PUTER',
  SYSTEM = 'SYSTEM'
}

export enum ImageEngine {
  GEMINI = 'GEMINI',
  PUTER = 'PUTER',
  TOGETHER = 'TOGETHER',
  REPLICATE = 'REPLICATE'
}

export type FeatureId = 'voice-studio' | 'motion-lab' | 'settings';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface AudioState {
  blob: Blob | null;
  url: string | null;
  isLoading: boolean;
  error: string | null;
  isSystemPlaying: boolean;
}

export interface Character {
  name: string;
  description: string;
}

export interface Scene {
  id: string;
  narratorText: string; // Original text
  imagePrompt: string;
  voiceEmotion: string;
  imageUrl?: string;
  translations: Record<string, string>; // languageCode -> translatedText
  audios: Record<string, { blob?: Blob, url?: string }>; // languageCode -> audioData
}

export interface ApiKey {
  id: string;
  key: string;
  provider: 'gemini' | 'together';
  label: string;
  usageCount: number;
  maxUsage: number; // For free tier protection
  resetDate: string; // ISO string for tracking month
}

export interface VideoProject {
  story: string;
  scenes: Scene[];
  characters: Character[];
  language: Language; // Primary language
  targetLanguages: string[]; // List of language codes for multi-export
  ttsEngine: TTSEngine;
  imageEngine: ImageEngine;
  selectedVoice: VoiceName;
  selectedSystemVoice?: string;
  isProcessing: boolean;
  step: 'idle' | 'scripting' | 'storyboarding' | 'synthesizing' | 'ready' | 'exporting';
}
