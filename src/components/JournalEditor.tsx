import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  Lightbulb, 
  Compass, 
  Target, 
  FileText,
  Tag,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { JournalEntry, ChatMessage, ReflectionMode, SaveState, PromptPreset } from '../types';
import { AnniversaryEchoCard } from './AnniversaryEcho';
import { DailyQuestionCard } from './DailyQuestionCard';

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
  saveState: SaveState;
  onRetrySave: () => void;
  onNewEntry: () => void;
  onSelectEntry?: (entry: JournalEntry) => void;
}

const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'deep-clarity',
    title: 'Unpack a Decision',
    prompt: 'I am trying to decide between multiple paths and feel stuck. Here is what I am weighing:',
    mode: 'reflection',
    category: 'Clarity'
  },
  {
    id: 'brainstorm-ideas',
    title: 'Creative Brainstorming',
    prompt: 'I have a nascent idea or challenge that I want to explore from lateral angles:',
    mode: 'brainstorm',
    category: 'Innovation'
  },
  {
    id: 'action-steps',
    title: 'Breakdown to Action',
    prompt: 'I have an ambitious goal, but need to break it down into realistic, low-friction micro-actions:',
    mode: 'action',
    category: 'Execution'
  },
  {
    id: 'weekly-synthesis',
    title: 'Retrospective & Energy',
    prompt: 'Looking back at recent challenges and wins, here is what gave me energy and drained me:',
    mode: 'summary',
    category: 'Wellbeing'
  }
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdateEntry,
  saveState,
  onRetrySave,
  onNewEntry,
  onSelectEntry,
}) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [isDailyQuestionDismissed, setIsDailyQuestionDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleUseDailyQuestion = (question: string) => {
    setInputText(question + ' ');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.messages, isGenerating]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const handleTitleChange = (newTitle: string) => {
    onUpdateEntry({
      ...entry,
      title: newTitle,
      updatedAt: Date.now(),
    });
  };

  const handleModeChange = (mode: ReflectionMode) => {
    onUpdateEntry({
      ...entry,
      mode,
      updatedAt: Date.now(),
    });
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const currentTags = entry.tags || [];
    if (!currentTags.includes(newTagInput.trim())) {
      onUpdateEntry({
        ...entry,
        tags: [...currentTags, newTagInput.trim()],
        updatedAt: Date.now(),
      });
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = entry.tags || [];
    onUpdateEntry({
      ...entry,
      tags: currentTags.filter((t) => t !== tagToRemove),
      updatedAt: Date.now(),
    });
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportMarkdown = () => {
    const content = `# ${entry.title || 'Journal Reflection'}\n` +
      `*Mode: ${entry.mode} | Date: ${new Date(entry.createdAt).toLocaleString()}*\n\n` +
      (entry.summary ? `> **Summary**: ${entry.summary}\n\n` : '') +
      entry.messages
        .map((m) => `### ${m.role === 'user' ? 'Me' : 'Gemini'}\n${m.content}\n`)
        .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'reflection'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAutoSummarize = async () => {
    if (entry.messages.length === 0 || isSummarizing) return;
    try {
      setIsSummarizing(true);
      const conversationText = entry.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: conversationText }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') || !res.ok) {
        throw new Error('Summarization service unavailable.');
      }
      const data = await res.json();

      onUpdateEntry({
        ...entry,
        title: data.title || entry.title,
        summary: data.summary || entry.summary,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Auto-summarize error:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend !== undefined ? promptToSend : inputText;
    if (!text.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      role: 'user',
      content: text.trim(),
      createdAt: Date.now(),
      mode: entry.mode,
    };

    const updatedMessages = [...entry.messages, userMessage];
    
    // Optimistically update entry state & persist to Firestore
    const updatedEntry: JournalEntry = {
      ...entry,
      title: entry.title === 'Untitled Reflection' && text.length > 0 
        ? (text.slice(0, 35) + (text.length > 35 ? '...' : '')) 
        : entry.title,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    setInputText('');
    await onUpdateEntry(updatedEntry);

    // Call server Gemini API proxy
    try {
      setIsGenerating(true);
      const payloadMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          mode: entry.mode,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textResp = await res.text().catch(() => '');
        throw new Error(
          `Server returned unexpected response (${res.status}). ${textResp.startsWith('<!') ? 'Dev server restarting or proxying, please retry in a moment.' : textResp.slice(0, 100)}`
        );
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `AI request failed with status ${res.status}`);
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        role: 'assistant',
        content: data.reply || '',
        createdAt: Date.now(),
        mode: entry.mode,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      await onUpdateEntry({
        ...updatedEntry,
        messages: finalMessages,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error('Error generating AI response:', err);
      // Add error message in thread so user can see and retry
      const assistantErrMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `*Error connecting to Gemini:* ${err.message || 'Unable to generate response. Please check your API key and connection.'}`,
        createdAt: Date.now(),
        mode: entry.mode,
      };
      await onUpdateEntry({
        ...updatedEntry,
        messages: [...updatedMessages, assistantErrMsg],
        updatedAt: Date.now(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white/95 rounded-2xl border border-[#E5E0D8] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Title input */}
          <div className="flex-1">
            <input
              id="input-entry-title"
              type="text"
              value={entry.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Title your reflection..."
              className="w-full font-editorial-serif text-2xl sm:text-3xl font-bold text-[#2D2926] border-none outline-none bg-transparent placeholder-[#B8B0A5] focus:ring-0 px-0"
            />
            <div className="text-xs text-[#6E675F] flex items-center gap-2 mt-1">
              <span>Created {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>&bull;</span>
              <span>{entry.messages.length} interaction{entry.messages.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Save Status & Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Save Status Badge */}
            {saveState === 'saved' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#2D2926] bg-[#F3ECE2] border border-[#D8CCBE]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#A67C52]" />
                <span className="hidden sm:inline">Saved to Firestore</span>
              </span>
            )}
            {saveState === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#8C6239] bg-[#F3ECE2] border border-[#D8CCBE]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#A67C52]" />
                <span className="hidden sm:inline">Syncing...</span>
              </span>
            )}
            {saveState === 'error' && (
              <button
                onClick={onRetrySave}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Save Error (Retry)</span>
              </button>
            )}

            {/* AI Auto Title & Summary button */}
            <button
              id="btn-auto-summarize"
              onClick={handleAutoSummarize}
              disabled={isSummarizing || entry.messages.length === 0}
              className="p-2 rounded-xl text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2] transition-colors disabled:opacity-40 border border-[#E5E0D8] cursor-pointer"
              title="Generate AI Summary & Title"
            >
              <Sparkles className={`h-4 w-4 text-[#A67C52] ${isSummarizing ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Markdown */}
            <button
              id="btn-export-markdown"
              onClick={handleExportMarkdown}
              className="p-2 rounded-xl text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2] transition-colors border border-[#E5E0D8] cursor-pointer"
              title="Export as Markdown"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Reflection Mode Tabs */}
        <div className="pt-3 border-t border-[#E5E0D8] flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#6E675F] mr-1">AI Mode:</span>
          
          <button
            onClick={() => handleModeChange('reflection')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              entry.mode === 'reflection'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-[#C5A880]" />
            <span>Deep Reflection</span>
          </button>

          <button
            onClick={() => handleModeChange('brainstorm')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              entry.mode === 'brainstorm'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5 text-[#C5A880]" />
            <span>Brainstorming</span>
          </button>

          <button
            onClick={() => handleModeChange('action')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              entry.mode === 'action'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            <Target className="h-3.5 w-3.5 text-[#C5A880]" />
            <span>Action Steps</span>
          </button>

          <button
            onClick={() => handleModeChange('summary')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              entry.mode === 'summary'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-[#C5A880]" />
            <span>Synthesis</span>
          </button>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {(entry.tags || []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-[#F3ECE2] text-[#2D2926] border border-[#D8CCBE]"
            >
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-700 text-[#6E675F] ml-0.5 cursor-pointer"
              >
                &times;
              </button>
            </span>
          ))}

          {showTagInput ? (
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="tag name..."
                autoFocus
                className="text-xs px-2.5 py-1 rounded-lg border border-[#D8CCBE] bg-white outline-none w-28 focus:border-[#A67C52]"
              />
              <button
                onClick={handleAddTag}
                className="text-xs text-[#2D2926] hover:text-[#A67C52] font-semibold cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={() => setShowTagInput(false)}
                className="text-xs text-[#6E675F] hover:text-[#2D2926] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="inline-flex items-center gap-1 text-xs text-[#6E675F] hover:text-[#2D2926] px-2.5 py-1 rounded-lg hover:bg-[#F3ECE2] transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Tag</span>
            </button>
          )}

          {/* Section 10: Retrospective AI Privacy Toggle */}
          <button
            id="btn-toggle-ai-opt-out"
            type="button"
            onClick={() => {
              onUpdateEntry({
                ...entry,
                analysisOptOut: !entry.analysisOptOut,
                updatedAt: Date.now(),
              });
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ml-auto ${
              entry.analysisOptOut
                ? 'bg-[#F4EFF6] text-[#633A6E] border-[#E2D5E6]'
                : 'bg-white text-[#6E675F] border-[#E5E0D8] hover:text-[#2D2926]'
            }`}
            title="When active, this entry is strictly excluded from retrospective AI prompts (e.g., Anniversary Echoes)."
          >
            {entry.analysisOptOut ? (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-[#633A6E]" />
                <span>Private (AI Opted-Out)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-[#A8A095]" />
                <span>Retrospective AI Allowed</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Banner if generated */}
      {entry.summary && (
        <div className="p-5 rounded-2xl bg-[#F3ECE2]/90 border border-[#D8CCBE] text-sm text-[#2D2926] space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#8C6239] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
            <span>AI Executive Takeaway</span>
          </div>
          <p className="text-[#2D2926] leading-relaxed font-normal font-editorial-serif text-base sm:text-lg">{entry.summary}</p>
        </div>
      )}

      {/* Conversation / Reflections Thread */}
      <div className="space-y-4 min-h-[250px]">
        {entry.messages.length === 0 ? (
          <div>
            {/* Section 10: Daily Question Prompt Card */}
            <DailyQuestionCard
              userId={entry.userId}
              onUseQuestion={handleUseDailyQuestion}
              onDismiss={() => setIsDailyQuestionDismissed(true)}
              isDismissed={isDailyQuestionDismissed}
            />

            {isDailyQuestionDismissed && (
              <div className="mb-4 flex justify-end">
                <button
                  id="btn-restore-daily-question"
                  type="button"
                  onClick={() => setIsDailyQuestionDismissed(false)}
                  className="text-xs text-[#8C6239] hover:text-[#2D2926] inline-flex items-center gap-1.5 cursor-pointer font-medium bg-[#F3ECE2] hover:bg-[#EAE0D3] px-3 py-1.5 rounded-lg border border-[#E5DDD0] transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
                  <span>Restore today&apos;s daily question</span>
                </button>
              </div>
            )}

            {/* Empty State & Prompt Presets */}
            <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-[#D8CCBE] bg-white/60 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-2">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F3ECE2] border border-[#E5E0D8] flex items-center justify-center text-[#8C6239]">
                <Compass className="h-6 w-6 text-[#A67C52]" />
              </div>
              <h2 className="font-editorial-serif text-xl sm:text-2xl font-bold text-[#2D2926]">
                Begin Your Reflection
              </h2>
              <p className="text-xs sm:text-sm text-[#6E675F] leading-relaxed">
                Write freely about what is on your mind, or select a thoughtfully composed prompt below to initiate dialogue.
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mx-auto text-left">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    handleModeChange(preset.mode);
                    setInputText(preset.prompt + ' ');
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="p-4 rounded-2xl bg-white border border-[#E5E0D8] hover:border-[#A67C52] hover:shadow-xs transition-all text-left space-y-1.5 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-[#2D2926] group-hover:text-[#8C6239] transition-colors font-editorial-serif">
                      {preset.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3ECE2] text-[#8C6239] font-medium border border-[#E5E0D8]">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E675F] line-clamp-2 leading-relaxed">
                    {preset.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
        ) : (
          /* Messages List */
          <div className="space-y-4">
            {entry.messages.map((message, idx) => (
              <motion.div
                key={message.id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-[#2D2926] text-[#FBF8F3] ml-6 sm:ml-12 shadow-xs border border-[#2D2926]'
                    : 'bg-white border border-[#E5E0D8] text-[#2D2926] mr-6 sm:mr-12 shadow-xs'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    message.role === 'user'
                      ? 'bg-[#3D3834] text-[#C5A880]'
                      : 'bg-[#F3ECE2] text-[#8C6239] border border-[#E5E0D8]'
                  }`}
                >
                  {message.role === 'user' ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-[#A67C52]" />
                  )}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        message.role === 'user' ? 'text-[#C5A880]' : 'text-[#8C6239]'
                      }`}
                    >
                      {message.role === 'user' ? 'Your Reflection' : 'Gemini 3.6 Flash'}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] ${
                          message.role === 'user' ? 'text-[#A8A095]' : 'text-[#8C847B]'
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => handleCopyMessage(message.content, idx)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          message.role === 'user'
                            ? 'text-[#A8A095] hover:text-[#FBF8F3] hover:bg-[#3D3834]'
                            : 'text-[#8C847B] hover:text-[#2D2926] hover:bg-[#F3ECE2]'
                        }`}
                        title="Copy text"
                      >
                        {copiedIndex === idx ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Render Message Text with Markdown */}
                  <div className={`prose prose-sm max-w-none break-words leading-relaxed ${
                    message.role === 'user' ? 'prose-invert text-[#FBF8F3]' : 'text-[#2D2926]'
                  }`}>
                    <Markdown>{message.content}</Markdown>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Generating Skeleton indicator */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 p-5 sm:p-6 rounded-2xl bg-white border border-[#E5E0D8] mr-12 shadow-xs"
              >
                <div className="h-8 w-8 rounded-xl bg-[#F3ECE2] text-[#8C6239] border border-[#E5E0D8] flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 animate-spin text-[#A67C52]" />
                </div>
                <div className="space-y-2 flex-1 pt-1">
                  <div className="text-xs font-semibold text-[#8C6239]">Gemini is reflecting...</div>
                  <div className="h-3 bg-[#F3ECE2] rounded-full w-4/5 animate-pulse" />
                  <div className="h-3 bg-[#F3ECE2] rounded-full w-2/3 animate-pulse" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Section 10: Anniversary Echo banner (renders only if an anniversary entry exists in a previous year) */}
      <AnniversaryEchoCard userId={entry.userId} onOpenPastEntry={onSelectEntry} />

      {/* Input Control Box */}
      <div className="bg-white rounded-2xl border border-[#D8CCBE] shadow-md p-3.5 focus-within:border-[#A67C52] transition-all sticky bottom-4">
        <textarea
          id="input-reflection-box"
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !isDailyQuestionDismissed && entry.messages.length === 0
              ? `Respond to today's question, or write freely (Mode: ${entry.mode})...`
              : `Write your thoughts or ask for guidance (Mode: ${entry.mode})...`
          }
          rows={2}
          className="w-full resize-none border-none outline-none text-sm text-[#2D2926] placeholder-[#A8A095] bg-transparent px-2 py-1 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D8] px-1">
          <div className="text-[11px] text-[#6E675F] hidden sm:block">
            <span>Press <kbd className="font-mono bg-[#F3ECE2] px-1 py-0.5 rounded border border-[#D8CCBE] text-[#2D2926]">Enter</kbd> to reflect &bull; <kbd className="font-mono bg-[#F3ECE2] px-1 py-0.5 rounded border border-[#D8CCBE] text-[#2D2926]">Shift+Enter</kbd> for new line</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-[#6E675F] font-mono">
              {inputText.length} chars
            </span>
            <button
              id="btn-send-reflection"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isGenerating}
              className="px-5 py-2 rounded-xl bg-[#2D2926] hover:bg-[#1C1A18] text-[#FBF8F3] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Reflect</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
