export type ReflectionMode = 'reflection' | 'brainstorm' | 'action' | 'summary';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  mode?: ReflectionMode;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  isPinned?: boolean;
  analysisOptOut?: boolean; // Section 10: true if user opts out of retrospective AI analysis
  contentHash?: string; // SHA-256 of entry content for idempotent embedding
  embedding?: number[]; // 768-dimensional float vector
  embeddedAt?: number;
}

export interface SemanticSearchResult {
  id: string;
  title: string;
  createdAt: number;
  snippet: string;
  similarity: number;
  tags?: string[];
}

export interface AnniversaryEcho {
  id: string; // Document ID: YYYY-MM-DD
  date: string; // YYYY-MM-DD
  pastEntryId: string;
  pastEntryDate: number;
  pastEntryTitle: string;
  pastEntryExcerpt: string;
  reflection: string; // Plain-text 2-sentence reflection from Gemini
  createdAt: number;
}

export interface DailyQuestionPrompt {
  id: string; // Document ID: YYYY-MM-DD
  date: string; // YYYY-MM-DD
  question: string;
  regenCount: number; // 0 on initial open, incremented on "give me another" (max 3)
  isStaticFallback?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export interface PromptPreset {
  id: string;
  title: string;
  prompt: string;
  mode: ReflectionMode;
  category: string;
}

export type AccountDeletionStage =
  | 'idle'
  | 'entries'
  | 'interactions'
  | 'prompts'
  | 'echoes'
  | 'userDoc'
  | 'auth'
  | 'completed'
  | 'error';

export interface AccountDeletionProgress {
  stage: AccountDeletionStage;
  deletedEntries: number;
  deletedInteractions: number;
  deletedPrompts: number;
  deletedEchoes: number;
  error?: string;
  requiresReauth?: boolean;
  timestamp?: number;
}

export interface UserDataStats {
  entriesCount: number;
  embeddedCount: number;
  promptsCount: number;
  echoesCount: number;
}
