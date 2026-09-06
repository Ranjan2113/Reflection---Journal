import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Search, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  PlusCircle, 
  HelpCircle,
  CheckCircle2,
  Tag,
  BookOpen,
  X
} from 'lucide-react';
import { JournalEntry, SemanticSearchResult } from '../types';
import { performSemanticSearch, runBackfillEmbeddings, seedSemanticSearchSampleEntries } from '../lib/db';

interface SemanticSearchViewProps {
  userId: string;
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

const SUGGESTED_QUERIES = [
  'Feeling like an imposter despite working hard',
  'Restless creative block and blank page frustration',
  'Quiet breakthrough after wanting to give up',
  'Overwhelmed by deadlines and competing demands',
  'Calm morning presence and renewed gratitude',
];

export const SemanticSearchView: React.FC<SemanticSearchViewProps> = ({
  userId,
  entries,
  onSelectEntry,
  onNewEntry,
}) => {
  const [queryText, setQueryText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[] | null>(null);
  const [coldStartNotice, setColdStartNotice] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  // Count embedded entries that have not opted out of retrospective AI (Section 10)
  const eligibleEmbeddedCount = useMemo(() => {
    return entries.filter(
      (e) => !e.analysisOptOut && Array.isArray(e.embedding) && e.embedding.length === 768
    ).length;
  }, [entries]);

  const unEmbeddedCount = useMemo(() => {
    return entries.filter(
      (e) => !e.analysisOptOut && (!e.embedding || e.embedding.length !== 768)
    ).length;
  }, [entries]);

  // Execute Semantic Search
  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : queryText).trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setColdStartNotice(null);
    setLastSearchedQuery(query);

    try {
      const response = await performSemanticSearch(userId, query, entries);

      if (response.coldStart) {
        setColdStartNotice(
          response.message || 
          `Semantic search improves as you write more reflections. You currently have ${response.count} reflection(s) with embeddings; 5 or more are needed for nuanced pattern matching.`
        );
        setSearchResults([]);
      } else {
        setSearchResults(response.results);
      }
    } catch (err: any) {
      console.error('Semantic search failed:', err);
      setSearchError(err?.message || 'Failed to complete semantic search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Run backfill to compute embeddings for existing entries
  const handleBackfill = async () => {
    setIsBackfilling(true);
    setSearchError(null);
    try {
      await runBackfillEmbeddings(userId, entries);
    } catch (err: any) {
      console.error('Backfill error:', err);
      setSearchError('Failed to complete backfill: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsBackfilling(false);
    }
  };

  // Seed sample reflections to immediately overcome cold start for testing
  const handleSeedSamples = async () => {
    setIsSeeding(true);
    setSearchError(null);
    try {
      await seedSemanticSearchSampleEntries(userId);
      setColdStartNotice(null);
    } catch (err: any) {
      console.error('Seeding error:', err);
      setSearchError('Failed to seed sample reflections: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSelectResult = (resultId: string) => {
    const matchedEntry = entries.find((e) => e.id === resultId);
    if (matchedEntry) {
      onSelectEntry(matchedEntry);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8C6239]">
          <Sparkles className="h-4 w-4" />
          <span>Semantic Memory Search</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2926] tracking-tight">
              When have I felt like this before?
            </h1>
            <p className="text-sm text-[#6E675F] mt-1 max-w-2xl leading-relaxed">
              Search your personal reflection archive by emotion, nuance, or circumstance. 
              Gemini matches the underlying feeling, not just literal keywords.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span 
              id="badge-embedded-count"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                eligibleEmbeddedCount >= 5 
                  ? 'bg-[#EBF3ED] text-[#2F5E3D] border-[#D2E4D6]' 
                  : 'bg-[#FDF4E7] text-[#97601B] border-[#F2D7B3]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{eligibleEmbeddedCount} indexed {eligibleEmbeddedCount === 1 ? 'entry' : 'entries'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Un-embedded entries warning / Backfill banner */}
      {unEmbeddedCount > 0 && (
        <div className="p-4 rounded-xl bg-[#F4EFE6] border border-[#E5DACD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <RefreshCw className={`h-4 w-4 text-[#8C6239] mt-0.5 ${isBackfilling ? 'animate-spin' : ''}`} />
            <div className="text-xs text-[#524B44]">
              <span className="font-semibold text-[#2D2926]">
                {unEmbeddedCount} past {unEmbeddedCount === 1 ? 'reflection requires' : 'reflections require'} indexing.
              </span>{' '}
              Run backfill to generate embeddings and include them in semantic search.
            </div>
          </div>
          <button
            id="btn-run-backfill"
            onClick={handleBackfill}
            disabled={isBackfilling}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#FBF8F3] bg-[#2D2926] hover:bg-[#433E39] disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isBackfilling ? (
              <>
                <div className="h-3 w-3 border-2 border-[#FBF8F3] border-t-transparent rounded-full animate-spin" />
                <span>Indexing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-[#C5A880]" />
                <span>Index Past Entries</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Bar Form */}
      <form onSubmit={(e) => handleSearch(e)} className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8C6239]">
            <Search className="h-5 w-5" />
          </div>
          
          <input
            id="input-semantic-search"
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Describe a feeling or situation (e.g. 'Feeling overwhelmed by new responsibilities but eager to prove myself')..."
            className="w-full pl-12 pr-28 py-3.5 sm:py-4 rounded-2xl bg-white border border-[#E5E0D8] text-[#2D2926] placeholder-[#9E978E] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#8C6239]/20 focus:border-[#8C6239] shadow-xs transition-all"
          />

          <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="p-1.5 text-[#9E978E] hover:text-[#2D2926] rounded-lg transition-colors cursor-pointer"
                title="Clear query"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              id="btn-semantic-search-submit"
              type="submit"
              disabled={isSearching || !queryText.trim()}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#FBF8F3] bg-[#2D2926] hover:bg-[#433E39] disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSearching ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-[#FBF8F3] border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-[#C5A880]" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggested Query Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] text-[#8C857B] font-medium mr-1">Inspirations:</span>
          {SUGGESTED_QUERIES.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQueryText(suggestion);
                handleSearch(undefined, suggestion);
              }}
              className="text-[11px] text-[#6E675F] hover:text-[#2D2926] bg-[#F3ECE2]/80 hover:bg-[#F3ECE2] border border-[#E5E0D8] px-2.5 py-1 rounded-full transition-colors cursor-pointer truncate max-w-[280px]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {/* Error Banner */}
      {searchError && (
        <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F6D0D0] text-[#8A2626] text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Cold-Start Notice (Section 10 & Requirements) */}
      {coldStartNotice && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-[#FFFDF9] border border-[#EADBCC] shadow-xs space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-[#FDF4E7] text-[#8C6239] flex items-center justify-center shrink-0 mt-0.5 border border-[#F2D7B3]">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#2D2926]">
                Cold-Start State: More Reflections Needed
              </h3>
              <p className="text-xs sm:text-sm text-[#6E675F] leading-relaxed">
                {coldStartNotice}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#F0E6D9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-[11px] text-[#8C857B]">
              Need to test immediately? Seed 5 diverse reflections with vector embeddings.
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-seed-sample-entries"
                onClick={handleSeedSamples}
                disabled={isSeeding}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#8C6239] bg-[#F3ECE2] hover:bg-[#E8DFD3] border border-[#D8CCBE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSeeding ? (
                  <>
                    <div className="h-3 w-3 border-2 border-[#8C6239] border-t-transparent rounded-full animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    <span>Seed 5 Sample Reflections</span>
                  </>
                )}
              </button>

              <button
                id="btn-write-entry-coldstart"
                onClick={onNewEntry}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#FBF8F3] bg-[#2D2926] hover:bg-[#433E39] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="h-3 w-3 text-[#C5A880]" />
                <span>Write Entry</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search Results List */}
      {searchResults !== null && !coldStartNotice && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#8C857B] px-1">
            <span>
              Top {searchResults.length} most similar past {searchResults.length === 1 ? 'reflection' : 'reflections'} for &ldquo;
              <span className="text-[#2D2926] font-medium">{lastSearchedQuery}</span>&rdquo;
            </span>
            <span className="font-mono text-[11px]">Ranked by Vector Cosine Similarity</span>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[#E5E0D8] bg-white/50 space-y-3">
              <Clock className="h-8 w-8 mx-auto text-[#A8A196]" />
              <h3 className="text-sm font-serif font-bold text-[#2D2926]">No similar reflections found</h3>
              <p className="text-xs text-[#6E675F] max-w-md mx-auto">
                Try phrasing the emotion or situation differently, or write a new reflection detailing this experience.
              </p>
              <button
                onClick={onNewEntry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8C6239] bg-[#F3ECE2] hover:bg-[#E8DFD3] transition-colors cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Write about this today</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {searchResults.map((result, index) => {
                  const dateFormatted = new Date(result.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  const percentage = Math.round(result.similarity * 100);

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectResult(result.id)}
                      className="group p-5 rounded-2xl bg-white border border-[#E5E0D8] hover:border-[#C5A880] shadow-xs hover:shadow-sm transition-all cursor-pointer space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-[#8C857B]">
                          <span className="font-medium text-[#6E675F]">{dateFormatted}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-[#A8A196]">Rank #{index + 1}</span>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span 
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              percentage >= 80 
                                ? 'bg-[#EBF3ED] text-[#2F5E3D] border-[#D2E4D6]' 
                                : percentage >= 65 
                                ? 'bg-[#F3ECE2] text-[#8C6239] border-[#D8CCBE]' 
                                : 'bg-[#F5F4F0] text-[#6E675F] border-[#E5E0D8]'
                            }`}
                          >
                            {percentage}% Similarity
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-serif font-bold text-[#2D2926] group-hover:text-[#8C6239] transition-colors">
                        {result.title}
                      </h3>

                      {/* Plain text snippet, client-side truncated per Section 10 */}
                      <p className="text-xs sm:text-sm text-[#524B44] leading-relaxed line-clamp-2">
                        {result.snippet}
                      </p>

                      <div className="pt-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {result.tags && result.tags.map((tag) => (
                            <span 
                              key={tag} 
                              className="inline-flex items-center gap-0.5 text-[10px] text-[#8C857B] bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#EFECE6]"
                            >
                              <Tag className="h-2.5 w-2.5 text-[#B8B1A7]" />
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>

                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8C6239] group-hover:translate-x-0.5 transition-transform">
                          <span>Open Reflection</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
