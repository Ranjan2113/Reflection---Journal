import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DailyQuestionPrompt, JournalEntry } from '../types';
import { Sparkles, RefreshCw, X, MessageSquareQuote, Check } from 'lucide-react';

const CLIENT_STATIC_QUESTIONS = [
  "What is one small detail from today that made you pause or brought a moment of quiet focus?",
  "Looking back at the past few days, what is a theme or feeling that keeps resurfacing?",
  "What is an assumption you held recently that turned out differently than you expected?",
  "If you could step away from your obligations for one hour today, what would you give your attention to?",
  "What conversation or interaction lingered in your thoughts the most this week?",
  "What is a decision you made lately that required more patience than usual?",
];

interface DailyQuestionCardProps {
  userId: string;
  onUseQuestion: (question: string) => void;
  onDismiss: () => void;
  isDismissed: boolean;
}

export const DailyQuestionCard: React.FC<DailyQuestionCardProps> = ({
  userId,
  onUseQuestion,
  onDismiss,
  isDismissed,
}) => {
  const [dailyPrompt, setDailyPrompt] = useState<DailyQuestionPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const isFetchingRef = useRef(false);

  const getTodayDateKey = () => {
    const now = new Date();
    const monthPad = String(now.getMonth() + 1).padStart(2, '0');
    const dayPad = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${monthPad}-${dayPad}`;
  };

  // 1. Lazy evaluation on first open of the day
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function loadDailyQuestion() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        setLoading(true);
        setErrorNotice(null);
        const todayDateKey = getTodayDateKey();

        // Check local cache at /users/{uid}/prompts/{YYYY-MM-DD}
        const promptDocRef = doc(db, 'users', userId, 'prompts', todayDateKey);
        const promptSnap = await getDoc(promptDocRef).catch(() => null);

        if (promptSnap && promptSnap.exists()) {
          const data = promptSnap.data() as DailyQuestionPrompt;
          if (data && data.question && isMounted) {
            setDailyPrompt(data);
            setLoading(false);
            isFetchingRef.current = false;
            return;
          }
        }

        // Retrieve user entries from the last 7 days (uid-scoped)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const entriesCol = collection(db, 'users', userId, 'interactions');
        const q = query(entriesCol, where('createdAt', '>=', sevenDaysAgo));
        const entriesSnap = await getDocs(q).catch((err) => {
          console.error('Error fetching recent 7-day entries:', err);
          return null;
        });

        const eligibleEntries: Array<{
          id: string;
          createdAt: number;
          text: string;
          analysisOptOut: boolean;
        }> = [];

        if (entriesSnap && !entriesSnap.empty) {
          entriesSnap.forEach((docSnap) => {
            const data = docSnap.data() as JournalEntry;
            // Skip analysisOptOut per Section 10
            if (data && data.analysisOptOut !== true) {
              let text = data.summary || '';
              if (data.messages && data.messages.length > 0) {
                const userMsgs = data.messages
                  .filter((m) => m.role === 'user')
                  .map((m) => m.content)
                  .join(' ');
                if (userMsgs) {
                  text = text ? `${text}\n${userMsgs}` : userMsgs;
                }
              }
              if (!text && data.title) {
                text = data.title;
              }

              eligibleEntries.push({
                id: docSnap.id,
                createdAt: data.createdAt || Date.now(),
                text,
                analysisOptOut: false,
              });
            }
          });
        }

        // Request initial daily question from server
        let resData: any = null;
        try {
          const res = await fetch('/api/daily-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              todayDate: todayDateKey,
              isRegen: false,
              currentRegenCount: 0,
              entries: eligibleEntries,
            }),
          });

          if (res.ok) {
            resData = await res.json();
          }
        } catch {
          // Network or server issue; fall back to static question
        }

        const questionText = (resData && typeof resData.question === 'string')
          ? resData.question.trim()
          : CLIENT_STATIC_QUESTIONS[0];

        const newPrompt: DailyQuestionPrompt = {
          id: todayDateKey,
          date: todayDateKey,
          question: questionText,
          regenCount: (resData && typeof resData.regenCount === 'number') ? resData.regenCount : 0,
          isStaticFallback: resData ? Boolean(resData.isStaticFallback) : true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Cache document at /users/{uid}/prompts/{YYYY-MM-DD}
        await setDoc(promptDocRef, newPrompt).catch((err) => {
          console.warn('Could not cache daily question:', err);
        });

        if (isMounted) {
          setDailyPrompt(newPrompt);
        }
      } catch (err: any) {
        console.warn('Recovered daily question with static fallback:', err?.message || err);
      } finally {
        isFetchingRef.current = false;
        if (isMounted) setLoading(false);
      }
    }

    loadDailyQuestion();

    return () => {
      isMounted = false;
      isFetchingRef.current = false;
    };
  }, [userId]);

  // Handle "Give me another" regeneration control (max 3 per day enforced server-side)
  const handleRegenerate = async () => {
    if (!userId || !dailyPrompt || regenerating) return;
    if (dailyPrompt.regenCount >= 3) {
      setErrorNotice('Daily regeneration limit reached (max 3 per day).');
      return;
    }

    try {
      setRegenerating(true);
      setErrorNotice(null);
      const todayDateKey = getTodayDateKey();

      // Retrieve recent entries again
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const entriesCol = collection(db, 'users', userId, 'interactions');
      const q = query(entriesCol, where('createdAt', '>=', sevenDaysAgo));
      const entriesSnap = await getDocs(q).catch(() => null);

      const eligibleEntries: Array<{
        id: string;
        createdAt: number;
        text: string;
        analysisOptOut: boolean;
      }> = [];

      if (entriesSnap && !entriesSnap.empty) {
        entriesSnap.forEach((docSnap) => {
          const data = docSnap.data() as JournalEntry;
          if (data && data.analysisOptOut !== true) {
            let text = data.summary || '';
            if (data.messages && data.messages.length > 0) {
              const userMsgs = data.messages
                .filter((m) => m.role === 'user')
                .map((m) => m.content)
                .join(' ');
              if (userMsgs) {
                text = text ? `${text}\n${userMsgs}` : userMsgs;
              }
            }
            eligibleEntries.push({
              id: docSnap.id,
              createdAt: data.createdAt || Date.now(),
              text: text || data.title || '',
              analysisOptOut: false,
            });
          }
        });
      }

      const res = await fetch('/api/daily-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          todayDate: todayDateKey,
          isRegen: true,
          currentRegenCount: dailyPrompt.regenCount,
          entries: eligibleEntries,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to regenerate question.');
      }

      const updatedPrompt: DailyQuestionPrompt = {
        ...dailyPrompt,
        question: resData.question,
        regenCount: typeof resData.regenCount === 'number' ? resData.regenCount : dailyPrompt.regenCount + 1,
        isStaticFallback: Boolean(resData.isStaticFallback),
        updatedAt: Date.now(),
      };

      const promptDocRef = doc(db, 'users', userId, 'prompts', todayDateKey);
      await setDoc(promptDocRef, updatedPrompt).catch((err) => {
        console.warn('Could not update daily prompt cache:', err);
      });

      setDailyPrompt(updatedPrompt);
      setApplied(false);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Unable to regenerate question.');
    } finally {
      setRegenerating(false);
    }
  };

  if (isDismissed || !dailyPrompt) {
    return null;
  }

  const remainingRegens = Math.max(0, 3 - dailyPrompt.regenCount);

  return (
    <div
      id="daily-question-card"
      className="mb-5 rounded-2xl bg-white border border-[#D8CCBE] p-5 shadow-xs transition-all relative overflow-hidden group"
    >
      {/* Decorative top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A67C52] via-[#C5A880] to-[#E5DDD0]" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#F3ECE2] border border-[#E5DDD0] flex items-center justify-center text-[#8C6239]">
            <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#8C6239]">
              Today&apos;s Daily Question
            </span>
            <span className="mx-1.5 text-[#D8CCBE]">&bull;</span>
            <span className="text-xs text-[#6E675F]">
              {dailyPrompt.isStaticFallback ? 'Foundational Inquiry' : 'From your past 7 days'}
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          id="btn-dismiss-daily-question"
          onClick={onDismiss}
          title="Dismiss question to write freely"
          className="text-[#A8A095] hover:text-[#2D2926] p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* The Question Text (Strict Plain-Text Rendering per Section 10) */}
      <div className="mt-3.5 pl-9">
        <p
          id="daily-question-text"
          className="font-editorial-serif text-[17px] sm:text-[19px] text-[#2D2926] leading-snug font-medium select-text"
        >
          {dailyPrompt.question}
        </p>

        {errorNotice && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 inline-block">
            {errorNotice}
          </p>
        )}

        {/* Controls: Use Question / Give Me Another */}
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-[#F0EAE1]">
          <div className="flex items-center gap-2">
            <button
              id="btn-use-daily-question"
              type="button"
              onClick={() => {
                onUseQuestion(dailyPrompt.question);
                setApplied(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2D2926] hover:bg-[#1C1A18] text-[#FBF8F3] text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              {applied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Prompt Injected</span>
                </>
              ) : (
                <>
                  <MessageSquareQuote className="h-3.5 w-3.5 text-[#C5A880]" />
                  <span>Reflect on this question</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[#6E675F] hover:text-[#2D2926] px-2 py-1 transition-colors cursor-pointer"
            >
              Write freely instead
            </button>
          </div>

          {/* "Give me another" regeneration control */}
          <button
            id="btn-regenerate-daily-question"
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating || dailyPrompt.regenCount >= 3}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
              dailyPrompt.regenCount >= 3
                ? 'opacity-50 cursor-not-allowed bg-transparent border-transparent text-[#A8A095]'
                : 'text-[#8C6239] hover:text-[#2D2926] bg-[#FBF8F3] hover:bg-[#F3ECE2] border-[#E5DDD0]'
            }`}
            title={
              dailyPrompt.regenCount >= 3
                ? 'Daily limit reached (max 3 regenerations per day)'
                : 'Regenerate question (max 3 per day)'
            }
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin text-[#A67C52]' : ''}`} />
            <span>
              {regenerating
                ? 'Regenerating...'
                : dailyPrompt.regenCount >= 3
                ? 'Max regenerations reached (3/3)'
                : `Give me another (${remainingRegens} left)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
