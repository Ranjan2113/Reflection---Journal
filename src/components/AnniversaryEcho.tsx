import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnniversaryEcho, JournalEntry } from '../types';
import { Sparkles, Calendar, BookOpen, X } from 'lucide-react';

interface AnniversaryEchoProps {
  userId: string;
  onOpenPastEntry?: (entry: JournalEntry) => void;
}

export const AnniversaryEchoCard: React.FC<AnniversaryEchoProps> = ({
  userId,
  onOpenPastEntry,
}) => {
  const [echo, setEcho] = useState<AnniversaryEcho | null>(null);
  const [matchedPastEntry, setMatchedPastEntry] = useState<JournalEntry | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    async function loadAnniversaryEcho() {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        // Format today's date key for daily caching: YYYY-MM-DD
        const monthPad = String(currentMonth + 1).padStart(2, '0');
        const dayPad = String(currentDay).padStart(2, '0');
        const todayDateKey = `${currentYear}-${monthPad}-${dayPad}`;

        // 1. Check client/server cache at /users/{uid}/echoes/{YYYY-MM-DD}
        const cacheRef = doc(db, 'users', userId, 'echoes', todayDateKey);
        const cachedSnap = await getDoc(cacheRef).catch(() => null);

        if (cachedSnap && cachedSnap.exists()) {
          const data = cachedSnap.data() as AnniversaryEcho;
          if (data && data.reflection && isMounted) {
            setEcho(data);
            return;
          }
        }

        // 2. Look for entry closest to this calendar date in previous years (most recent year first)
        // Window: [targetDate - 3 days, targetDate + 3 days], preferring exact date
        let foundEntry: JournalEntry | null = null;
        let foundTargetDate: Date | null = null;

        for (let year = currentYear - 1; year >= currentYear - 10; year--) {
          const targetDate = new Date(year, currentMonth, currentDay, 12, 0, 0, 0);
          const targetTimestamp = targetDate.getTime();

          // 3-day window calculation
          const windowStart = new Date(year, currentMonth, currentDay - 3, 0, 0, 0, 0).getTime();
          const windowEnd = new Date(year, currentMonth, currentDay + 3, 23, 59, 59, 999).getTime();

          // UID-scoped range query on entry's createdAt
          const entriesCol = collection(db, 'users', userId, 'interactions');
          const rangeQuery = query(
            entriesCol,
            where('createdAt', '>=', windowStart),
            where('createdAt', '<=', windowEnd)
          );

          const querySnap = await getDocs(rangeQuery).catch((err) => {
            console.error('Anniversary range query error:', err);
            return null;
          });

          if (!querySnap || querySnap.empty) continue;

          const candidateEntries: JournalEntry[] = [];
          querySnap.forEach((docSnap) => {
            const data = docSnap.data() as JournalEntry;
            // Skip any entry with analysisOptOut == true (Section 10 private boundary)
            if (data && data.analysisOptOut !== true) {
              candidateEntries.push({
                ...data,
                id: docSnap.id,
              });
            }
          });

          if (candidateEntries.length > 0) {
            // Pick the entry closest to the exact calendar date (minimum distance in ms)
            candidateEntries.sort((a, b) => {
              const distA = Math.abs(a.createdAt - targetTimestamp);
              const distB = Math.abs(b.createdAt - targetTimestamp);
              return distA - distB;
            });

            foundEntry = candidateEntries[0];
            foundTargetDate = targetDate;
            break; // Stop at the most recent year that has a matching entry
          }
        }

        // If none exists, render nothing — no empty state, no placeholder
        if (!foundEntry || !isMounted) {
          return;
        }

        setMatchedPastEntry(foundEntry);

        // 3. Prepare entry content (cap characters per Section 10 rules)
        const pastEntryDateFormatted = new Date(foundEntry.createdAt).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        const todayDateFormatted = now.toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // Combine summary and message text, capped to 1500 chars (Section 10)
        let pastText = foundEntry.summary || '';
        if (foundEntry.messages && foundEntry.messages.length > 0) {
          const userMsgs = foundEntry.messages
            .filter((m) => m.role === 'user')
            .map((m) => m.content)
            .join(' ');
          if (userMsgs) {
            pastText = pastText ? `${pastText}\n${userMsgs}` : userMsgs;
          }
        }
        if (!pastText && foundEntry.title) {
          pastText = foundEntry.title;
        }

        const cappedText = pastText.slice(0, 1500);

        // 4. Request server-side reflection from /api/echo
        const res = await fetch('/api/echo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pastEntryText: cappedText,
            todayDate: todayDateFormatted,
            pastEntryDate: pastEntryDateFormatted,
            pastEntryTitle: foundEntry.title,
            analysisOptOut: false,
          }),
        });

        if (!res.ok) {
          throw new Error(`Echo generation failed with status ${res.status}`);
        }

        const result = await res.json();
        const reflectionText = typeof result.reflection === 'string' ? result.reflection.trim() : '';

        if (!reflectionText) return;

        const echoData: AnniversaryEcho = {
          id: todayDateKey,
          date: todayDateKey,
          pastEntryId: foundEntry.id,
          pastEntryDate: foundEntry.createdAt,
          pastEntryTitle: foundEntry.title || 'Untitled Reflection',
          pastEntryExcerpt: cappedText.slice(0, 200),
          reflection: reflectionText,
          createdAt: Date.now(),
        };

        // 5. Cache at /users/{uid}/echoes/{YYYY-MM-DD} so repeat opens don't re-bill
        await setDoc(cacheRef, echoData).catch((err) => {
          console.warn('Could not cache anniversary echo:', err);
        });

        if (isMounted) {
          setEcho(echoData);
        }
      } catch (err) {
        console.error('Error in Anniversary Echo evaluation:', err);
      }
    }

    loadAnniversaryEcho();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // If no echo or user dismissed it for the session, render nothing (no empty state, no placeholder)
  if (!echo || dismissed) {
    return null;
  }

  const pastDateObj = new Date(echo.pastEntryDate);
  const yearsAgo = new Date().getFullYear() - pastDateObj.getFullYear();
  const yearLabel = yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`;

  return (
    <div
      id="anniversary-echo-banner"
      className="mb-6 rounded-2xl bg-[#F6F1EA] border border-[#E5DDD0] p-5 shadow-xs transition-all relative overflow-hidden group"
    >
      {/* Decorative Warm Accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#A67C52]" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#EFE6DC] border border-[#D8CCBE] flex items-center justify-center text-[#8C6239]">
            <Sparkles className="h-3.5 w-3.5 text-[#A67C52]" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#8C6239]">
              Anniversary Echo
            </span>
            <span className="mx-1.5 text-[#A8A095]">•</span>
            <span className="text-xs font-medium text-[#6E675F] inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 inline text-[#A8A095]" />
              {pastDateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              ({yearLabel})
            </span>
          </div>
        </div>

        <button
          id="btn-dismiss-echo"
          onClick={() => setDismissed(true)}
          title="Dismiss for today"
          className="text-[#A8A095] hover:text-[#2D2926] p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Past Entry Reference */}
      <div className="mt-3.5 pl-9">
        <div className="text-xs font-semibold text-[#2D2926] mb-1">
          From your past reflection: <span className="italic font-editorial-serif text-sm text-[#8C6239]">&ldquo;{echo.pastEntryTitle}&rdquo;</span>
        </div>

        {echo.pastEntryExcerpt && (
          <p className="text-xs text-[#6E675F] line-clamp-2 italic border-l-2 border-[#D8CCBE] pl-2.5 my-2">
            &ldquo;{echo.pastEntryExcerpt}...&rdquo;
          </p>
        )}

        {/* Gemini 2-Sentence Reflection (Rendered Strictly as Plain Text) */}
        <div className="mt-3 p-3.5 rounded-xl bg-white border border-[#E5DDD0] shadow-2xs">
          <div className="text-[11px] font-semibold text-[#8C6239] mb-1 flex items-center gap-1.5">
            <span>Observational Reflection</span>
          </div>
          {/* Plain text rendering ONLY per Section 10: never dangerouslySetInnerHTML, never markdown */}
          <p className="font-editorial-serif text-[14px] text-[#2D2926] leading-relaxed select-text">
            {echo.reflection}
          </p>
        </div>

        {/* Action to open past entry if callback provided */}
        {matchedPastEntry && onOpenPastEntry && (
          <div className="mt-3 flex items-center justify-end">
            <button
              id="btn-view-past-echo-entry"
              onClick={() => onOpenPastEntry(matchedPastEntry)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6239] hover:text-[#2D2926] transition-colors cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Read original entry</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
