
import { Language, VoiceName } from './types';

export const LANGUAGES: Language[] = [
  { code: 'bn-BD', name: 'Bangla', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en-US', name: 'English', nativeName: 'English', flag: '🇺🇸' },
];

export const PRODUCTION_LANG_CODES = [
  'bn-BD', 'hi-IN', 'en-US'
];

export const VOICES = [
  { name: VoiceName.KORE, description: 'Bright, professional, and clear', gender: 'Female' },
  { name: VoiceName.ZEPHYR, description: 'Soft, cinematic, and breathy', gender: 'Female' },
  { name: VoiceName.PUCK, description: 'Youthful, friendly, and energetic', gender: 'Male' },
  { name: VoiceName.CHARON, description: 'Deep, authoritative, and steady', gender: 'Male' },
  { name: VoiceName.FENRIR, description: 'Mellow, calm, and soothing', gender: 'Male' },
];

export const DEFAULT_TEXT = {
  'en-US': 'Hello! Welcome to Studio Max. I can speak English clearly and naturally.',
  'bn-BD': 'হ্যালো! স্টুডিও ম্যাক্স-এ স্বাগতম। আমি আপনার জন্য চমৎকার বাংলায় কথা বলতে পারি।',
  'hi-IN': 'नमस्ते! स्टूडियो मैक्स में आपका स्वागत है। मैं आपके लिए बहुत अच्छी हिंदी बोल सकता हूँ।',
};
