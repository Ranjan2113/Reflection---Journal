import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Trash2, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  MessageSquare, 
  Calendar, 
  FileText, 
  PlusCircle, 
  Tag, 
  Download,
  ShieldAlert
} from 'lucide-react';
import { JournalEntry, ReflectionMode } from '../types';

interface HistoryViewProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onNewEntry: () => void;
  onSeedAnniversary?: () => Promise<void> | void;
  onNavigateToSemanticSearch?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  entries,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
  onSeedAnniversary,
  onNavigateToSemanticSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesMode = selectedMode === 'all' || entry.mode === selectedMode;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesMode;

    const matchesTitle = entry.title.toLowerCase().includes(query);
    const matchesSummary = (entry.summary || '').toLowerCase().includes(query);
    const matchesTags = (entry.tags || []).some((t) => t.toLowerCase().includes(query));
    const matchesMessages = entry.messages.some((m) =>
      m.content.toLowerCase().includes(query)
    );

    return matchesMode && (matchesTitle || matchesSummary || matchesTags || matchesMessages);
  });

  const handleDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this reflection? This cannot be undone.')) {
      try {
        setDeletingId(entryId);
        await onDeleteEntry(entryId);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getModeBadge = (mode: ReflectionMode) => {
    switch (mode) {
      case 'brainstorm':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3ECE2] text-[#8C6239] border border-[#D8CCBE]">Brainstorming</span>;
      case 'action':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAEFF5] text-[#2C4C6E] border border-[#D0DCE8]">Action Steps</span>;
      case 'summary':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4EFF6] text-[#633A6E] border border-[#E2D5E6]">Synthesis</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EBF3ED] text-[#2F5E3D] border border-[#D2E4D6]">Deep Reflection</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#2D2926]">
            Past Reflections &amp; <span className="italic font-serif text-[#A67C52]">Dialogues</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#6E675F] mt-1">
            Private, user-isolated journal archive in Firestore ({entries.length} total entries)
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {onSeedAnniversary && (
            <button
              id="btn-seed-anniversary-history"
              onClick={onSeedAnniversary}
              className="px-4 py-2.5 rounded-xl bg-[#F3ECE2] hover:bg-[#EAE0D3] text-[#8C6239] border border-[#D8CCBE] text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
              title="Creates a test journal entry dated 1 year ago to immediately trigger the Anniversary Echo banner"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
              <span>Test 1-Year Echo</span>
            </button>
          )}

          {onNavigateToSemanticSearch && (
            <button
              id="btn-open-semantic-search-history"
              onClick={onNavigateToSemanticSearch}
              className="px-4 py-2.5 rounded-xl bg-[#2D2926] hover:bg-[#1C1A18] text-[#FBF8F3] text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer border border-[#2D2926]"
              title="Semantic search over your personal reflection history"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C5A880]" />
              <span>Felt Like This?</span>
            </button>
          )}

          <button
            id="btn-new-entry-history"
            onClick={onNewEntry}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-[#F3ECE2] hover:bg-[#E8DFD3] text-[#8C6239] text-xs font-semibold flex items-center gap-2 border border-[#D8CCBE] shadow-2xs transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 text-[#A67C52]" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E0D8] shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#A8A095]" />
          <input
            id="input-search-reflections"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries, keywords, takeaways, or tags..."
            className="w-full pl-10 pr-4 py-2 text-sm text-[#2D2926] placeholder-[#A8A095] bg-[#FBF8F3] border border-[#E5E0D8] rounded-xl outline-none focus:bg-white focus:border-[#A67C52] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-xs text-[#6E675F] hover:text-[#2D2926] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setSelectedMode('all')}
            className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              selectedMode === 'all'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            All ({entries.length})
          </button>
          <button
            onClick={() => setSelectedMode('reflection')}
            className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              selectedMode === 'reflection'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            Reflections
          </button>
          <button
            onClick={() => setSelectedMode('brainstorm')}
            className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              selectedMode === 'brainstorm'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            Brainstorms
          </button>
          <button
            onClick={() => setSelectedMode('action')}
            className={`px-3.5 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              selectedMode === 'action'
                ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                : 'bg-[#F3ECE2] text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]'
            }`}
          >
            Action Steps
          </button>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-[#D8CCBE] space-y-3">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-[#F3ECE2] border border-[#E5E0D8] flex items-center justify-center text-[#8C6239]">
            <Clock className="h-6 w-6 text-[#A67C52]" />
          </div>
          <h2 className="font-editorial-serif text-xl font-bold text-[#2D2926]">
            {searchQuery ? 'No matching reflections found' : 'No reflections yet'}
          </h2>
          <p className="text-xs sm:text-sm text-[#6E675F] max-w-sm mx-auto">
            {searchQuery
              ? 'Try changing your search term or mode filter.'
              : 'Begin your first conversational journaling session with Gemini.'}
          </p>
          {!searchQuery && (
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={onNewEntry}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2D2926] text-[#FBF8F3] text-xs font-semibold hover:bg-[#1C1A18] cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5 text-[#C5A880]" />
                <span>Create First Entry</span>
              </button>
              {onSeedAnniversary && (
                <button
                  id="btn-seed-anniversary-empty-state"
                  onClick={onSeedAnniversary}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F3ECE2] text-[#8C6239] border border-[#D8CCBE] text-xs font-semibold hover:bg-[#EAE0D3] cursor-pointer"
                  title="Seed an entry from 1 year ago to immediately test Anniversary Echo"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
                  <span>Seed 1-Year-Ago Test Entry</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelectEntry(entry)}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E5E0D8] hover:border-[#A67C52] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group space-y-4"
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getModeBadge(entry.mode)}
                    {entry.analysisOptOut && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#633A6E] bg-[#F4EFF6] border border-[#E2D5E6] px-2 py-0.5 rounded-md" title="Excluded from AI retrospective analysis">
                        <ShieldAlert className="h-2.5 w-2.5 text-[#633A6E]" />
                        <span>Private</span>
                      </span>
                    )}
                    <span className="text-[11px] text-[#6E675F] flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#A8A095]" />
                      {new Date(entry.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, entry.id)}
                    disabled={deletingId === entry.id}
                    className="p-1.5 text-[#8C847B] hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h2 className="font-editorial-serif text-lg sm:text-xl font-bold text-[#2D2926] group-hover:text-[#8C6239] transition-colors line-clamp-1">
                  {entry.title || 'Untitled Reflection'}
                </h2>

                {/* Summary or Last Message snippet */}
                <p className="text-xs sm:text-sm text-[#6E675F] line-clamp-2 leading-relaxed">
                  {entry.summary
                    ? entry.summary
                    : entry.messages.length > 0
                    ? entry.messages[entry.messages.length - 1].content.replace(/[#*`_]/g, '')
                    : 'Empty reflection draft.'}
                </p>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-[#E5E0D8] flex items-center justify-between text-xs text-[#6E675F]">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-[#A8A095]" />
                    <span>{entry.messages.length}</span>
                  </span>
                  {(entry.tags || []).slice(0, 2).map((t) => (
                    <span key={t} className="text-[10px] text-[#2D2926] bg-[#F3ECE2] border border-[#E5E0D8] px-2 py-0.5 rounded-md">
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[#8C6239] font-semibold group-hover:translate-x-1 transition-transform text-xs">
                  <span>Open</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
};
