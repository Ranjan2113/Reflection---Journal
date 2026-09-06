import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  writeBatch,
  limit,
  onSnapshot, 
  query, 
  orderBy, 
  vector,
} from 'firebase/firestore';
import { db, auth, deleteUser, reauthenticateWithPopup, googleProvider } from './firebase';
import { 
  JournalEntry, 
  SemanticSearchResult,
  AccountDeletionProgress,
  AccountDeletionStage,
  UserDataStats,
} from '../types';

/**
 * Strict Undefined-Stripping Utility
 * Prevents Firestore runtime errors caused by undefined properties in objects/arrays
 */
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => (value === undefined ? null : value))
  );
}

/**
 * Save or update a journal interaction for an authenticated user.
 * Paths strictly isolated: /users/{userId}/entries/{entryId} (and mirrored to /interactions for legacy compatibility)
 * Automatically triggers server-side idempotent vector embedding generation per Section 10.
 */
export async function saveJournalEntry(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to persist interaction.');
  }
  if (!entry.id) {
    throw new Error('Entry ID is required.');
  }

  const cleanEntry = sanitizePayload({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });

  // Save document to /entries and mirror to /interactions
  const entriesRef = doc(db, 'users', userId, 'entries', entry.id);
  const interactionsRef = doc(db, 'users', userId, 'interactions', entry.id);

  await Promise.all([
    setDoc(entriesRef, cleanEntry, { merge: true }),
    setDoc(interactionsRef, cleanEntry, { merge: true }),
  ]);

  // Section 10: Trigger server-side embedding generation
  // If analysisOptOut == true, embedding is neither generated nor stored.
  if (entry.analysisOptOut !== true) {
    // Asynchronously call embed endpoint so UI save is instant and non-blocking
    triggerEmbeddingGeneration(userId, entry).catch((err) => {
      console.warn('Asynchronous entry embedding deferred or failed:', err?.message || err);
    });
  } else {
    // Clear any existing embedding if user has opted out
    const optOutUpdate = {
      embedding: null,
      vectorField: null,
      contentHash: null,
      embeddedAt: null,
      analysisOptOut: true,
    };
    await Promise.all([
      setDoc(entriesRef, optOutUpdate, { merge: true }).catch(() => {}),
      setDoc(interactionsRef, optOutUpdate, { merge: true }).catch(() => {}),
    ]);
  }
}

/**
 * Trigger server-side idempotent embedding generation
 */
export async function triggerEmbeddingGeneration(
  userId: string,
  entry: JournalEntry,
  force = false
): Promise<{ skipped: boolean; embedding?: number[]; contentHash?: string } | null> {
  try {
    const res = await fetch('/api/entries/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        entryId: entry.id,
        title: entry.title,
        summary: entry.summary,
        messages: entry.messages,
        analysisOptOut: entry.analysisOptOut,
        existingHash: entry.contentHash,
        force,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (!data.skipped && Array.isArray(data.embedding)) {
      const updateData: any = {
        embedding: data.embedding,
        contentHash: data.contentHash,
        embeddedAt: data.embeddedAt || Date.now(),
      };

      try {
        // Attach native Firestore vector type if supported by SDK
        updateData.vectorField = vector(data.embedding);
      } catch {
        // fallback to standard numeric array
      }

      // Persist embedding back to the entry documents
      const entriesRef = doc(db, 'users', userId, 'entries', entry.id);
      const interactionsRef = doc(db, 'users', userId, 'interactions', entry.id);
      await Promise.all([
        setDoc(entriesRef, updateData, { merge: true }),
        setDoc(interactionsRef, updateData, { merge: true }),
      ]);
    }

    return data;
  } catch (err: any) {
    console.error('Failed to trigger server-side embedding:', err?.message || err);
    return null;
  }
}

/**
 * Real-time listener for user's isolated journal entries
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // Listen to the entries subcollection
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const entries: JournalEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          entries.push(mapDocToJournalEntry(docSnap.id, userId, data));
        });
        onUpdate(entries);
      } else {
        // Fallback check on legacy /interactions subcollection if /entries is empty
        const legacyRef = collection(db, 'users', userId, 'interactions');
        const legacyQ = query(legacyRef, orderBy('updatedAt', 'desc'));
        const legacyUnsub = onSnapshot(legacyQ, (legacySnap) => {
          const legacyEntries: JournalEntry[] = [];
          legacySnap.forEach((docSnap) => {
            const data = docSnap.data();
            legacyEntries.push(mapDocToJournalEntry(docSnap.id, userId, data));
          });
          onUpdate(legacyEntries);
        }, onError);
        return () => legacyUnsub();
      }
    },
    (err) => {
      console.error('Error listening to user journal entries:', err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

function mapDocToJournalEntry(id: string, userId: string, data: any): JournalEntry {
  return {
    id,
    userId: data.userId || userId,
    title: data.title || 'Untitled Reflection',
    summary: data.summary || '',
    mode: data.mode || 'reflection',
    messages: Array.isArray(data.messages) ? data.messages : [],
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    isPinned: Boolean(data.isPinned),
    analysisOptOut: Boolean(data.analysisOptOut),
    contentHash: data.contentHash || undefined,
    embedding: Array.isArray(data.embedding) ? data.embedding : undefined,
    embeddedAt: data.embeddedAt || undefined,
  };
}

/**
 * Delete a specific journal entry for the authenticated user
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entriesRef = doc(db, 'users', userId, 'entries', entryId);
  const interactionsRef = doc(db, 'users', userId, 'interactions', entryId);
  await Promise.all([
    deleteDoc(entriesRef).catch(() => {}),
    deleteDoc(interactionsRef).catch(() => {}),
  ]);
}

/**
 * Perform semantic search over past reflections ("When have I felt like this before?")
 */
export async function performSemanticSearch(
  userId: string,
  queryText: string,
  entries: JournalEntry[]
): Promise<{
  coldStart: boolean;
  count: number;
  minRequired: number;
  message?: string;
  results: SemanticSearchResult[];
}> {
  const res = await fetch('/api/entries/semantic-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      queryText,
      entries,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Semantic search failed.');
  }

  return await res.json();
}

/**
 * Run backfill for existing entries that are missing embeddings
 */
export async function runBackfillEmbeddings(
  userId: string,
  entries: JournalEntry[]
): Promise<{
  totalProcessed: number;
  newlyEmbedded: number;
  skippedUnchanged: number;
  skippedOptOut: number;
}> {
  const res = await fetch('/api/entries/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      entries,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Backfill failed.');
  }

  const result = await res.json();

  // Persist returned updates to Firestore
  if (Array.isArray(result.updates) && result.updates.length > 0) {
    await Promise.all(
      result.updates.map((u: any) => {
        const updateDocPayload: any = {
          embedding: u.embedding,
          contentHash: u.contentHash,
          embeddedAt: u.embeddedAt,
        };
        try {
          updateDocPayload.vectorField = vector(u.embedding);
        } catch {}

        return Promise.all([
          setDoc(doc(db, 'users', userId, 'entries', u.id), updateDocPayload, { merge: true }),
          setDoc(doc(db, 'users', userId, 'interactions', u.id), updateDocPayload, { merge: true }),
        ]);
      })
    );
  }

  return result;
}

/**
 * Seed 5 diverse past reflections with varying emotions/situations to immediately
 * demonstrate and test the Semantic Search engine without cold-start blocking.
 */
export async function seedSemanticSearchSampleEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) throw new Error('User ID is required.');

  const sampleEntries: Array<Omit<JournalEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = [
    {
      title: 'Navigating Imposter Syndrome in Leadership',
      mode: 'reflection',
      messages: [
        {
          id: `seed-msg-1`,
          role: 'user',
          content: 'I felt like an imposter stepping into the leadership meeting today. Everyone seemed so confident with their numbers and strategy, while I was second-guessing my recommendations. I had to take deep breaths to remind myself that my perspective was earned through hands-on work.',
          createdAt: Date.now() - 86400000 * 45,
        },
      ],
      summary: 'Grappling with self-doubt during high-stakes leadership discussions and grounding through self-compassion and breathing.',
      tags: ['imposter-syndrome', 'leadership', 'vulnerability'],
      analysisOptOut: false,
    },
    {
      title: 'Creative Block & Frustration with the Blank Page',
      mode: 'brainstorm',
      messages: [
        {
          id: `seed-msg-2`,
          role: 'user',
          content: 'Completely stuck on the design architecture. Stared at an empty document for two hours feeling restless, agitated, and drained. Walking outside in the rain helped clear the mental fog. Realized I was trying to solve step ten before finishing step one.',
          createdAt: Date.now() - 86400000 * 30,
        },
      ],
      summary: 'Overcoming creative paralysis and restlessness by stepping away, resetting with a walk, and breaking down complexity.',
      tags: ['creative-block', 'burnout', 'clarity'],
      analysisOptOut: false,
    },
    {
      title: 'The Breakthrough After Months of Grit',
      mode: 'action',
      messages: [
        {
          id: `seed-msg-3`,
          role: 'user',
          content: 'Finally cracked the persistence synchronization challenge after weeks of trial and error! There is such a quiet joy in seeing pieces fall into place after wanting to give up so many times. Grateful for sticking through the hardest phase.',
          createdAt: Date.now() - 86400000 * 20,
        },
      ],
      summary: 'Quiet celebration and satisfaction after enduring technical setbacks and finding a breakthrough solution.',
      tags: ['breakthrough', 'persistence', 'celebration'],
      analysisOptOut: false,
    },
    {
      title: 'Feeling Overwhelmed by Competing Demands',
      mode: 'reflection',
      messages: [
        {
          id: `seed-msg-4`,
          role: 'user',
          content: 'Inbox overflowing, three project deadlines colliding, and feeling pulled in every direction. When everything is urgent, nothing feels clear. Decided to shut off notifications for the afternoon and focus purely on the single most important task.',
          createdAt: Date.now() - 86400000 * 12,
        },
      ],
      summary: 'Managing cognitive overload and sensory exhaustion by establishing strict digital boundaries and single-tasking.',
      tags: ['overwhelmed', 'focus', 'boundaries'],
      analysisOptOut: false,
    },
    {
      title: 'Peaceful Morning and Rekindled Motivation',
      mode: 'summary',
      messages: [
        {
          id: `seed-msg-5`,
          role: 'user',
          content: 'Woke up before the alarm feeling genuinely refreshed and optimistic. Sitting with hot coffee, journal open, feeling aligned with where I am headed. The uncertainty from last month has softened into calm acceptance.',
          createdAt: Date.now() - 86400000 * 4,
        },
      ],
      summary: 'Cultivating presence, gratitude, and renewed energy during an unhurried morning routine.',
      tags: ['peace', 'gratitude', 'momentum'],
      analysisOptOut: false,
    },
  ];

  const createdEntries: JournalEntry[] = [];

  for (let i = 0; i < sampleEntries.length; i++) {
    const s = sampleEntries[i];
    const entryId = `entry-seed-${Date.now()}-${i}`;
    const timestamp = Date.now() - 86400000 * (45 - i * 9);

    const fullEntry: JournalEntry = {
      ...s,
      id: entryId,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await saveJournalEntry(userId, fullEntry);
    createdEntries.push(fullEntry);
  }

  // Trigger backfill to guarantee all 5 have embeddings immediately
  await runBackfillEmbeddings(userId, createdEntries).catch(() => {});

  return createdEntries;
}

/**
 * Seed an entry exactly 1 year ago to easily test and verify the Anniversary Echo feature
 */
export async function seedAnniversaryTestEntry(userId: string): Promise<JournalEntry> {
  if (!userId) throw new Error('User ID is required.');
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 14, 30, 0, 0);
  const entryId = `entry-anniversary-${oneYearAgo.getTime()}`;

  const testEntry: JournalEntry = {
    id: entryId,
    userId,
    title: 'Navigating Change & Milestones',
    mode: 'reflection',
    messages: [
      {
        id: `msg-${oneYearAgo.getTime()}-1`,
        role: 'user',
        content: 'I am standing at a crossroads with a major transition. It feels uncertain, but I am learning how to trust my patience and focus on small daily habits rather than the overwhelming whole.',
        createdAt: oneYearAgo.getTime(),
      },
      {
        id: `msg-${oneYearAgo.getTime()}-2`,
        role: 'assistant',
        content: 'Patience in the face of ambiguity is often the quiet foundation of meaningful progress. What single milestone today feels most grounding?',
        createdAt: oneYearAgo.getTime() + 60000,
      },
    ],
    summary: 'Reflecting on project uncertainties, learning to pace efforts, and finding quiet confidence through daily habits.',
    createdAt: oneYearAgo.getTime(),
    updatedAt: oneYearAgo.getTime(),
    tags: ['growth', 'patience', 'milestones'],
    analysisOptOut: false,
  };

  await saveJournalEntry(userId, testEntry);

  // Invalidate today's cached echo so the AnniversaryEchoCard re-evaluates fresh
  const monthPad = String(now.getMonth() + 1).padStart(2, '0');
  const dayPad = String(now.getDate()).padStart(2, '0');
  const todayKey = `${now.getFullYear()}-${monthPad}-${dayPad}`;
  await deleteDoc(doc(db, 'users', userId, 'echoes', todayKey)).catch(() => {});

  return testEntry;
}

/**
 * Fetch a single entry by ID
 */
export async function getSingleEntry(
  userId: string,
  entryId: string
): Promise<JournalEntry | null> {
  if (!userId || !entryId) return null;
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  let snap = await getDoc(entryRef);
  if (!snap.exists()) {
    // Fallback to legacy interactions
    snap = await getDoc(doc(db, 'users', userId, 'interactions', entryId));
    if (!snap.exists()) return null;
  }
  
  return mapDocToJournalEntry(snap.id, userId, snap.data());
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT DELETION & DATA PURGING ENGINE (Section 10 & Privacy Mandates)
// ─────────────────────────────────────────────────────────────────────────────

const DELETION_STORAGE_PREFIX = 'reflect_journal_account_deletion_';

/**
 * Fetch current user data counts to display transparently before deletion
 */
export async function getUserDataStats(userId: string): Promise<UserDataStats> {
  if (!userId) {
    return { entriesCount: 0, embeddedCount: 0, promptsCount: 0, echoesCount: 0 };
  }

  try {
    const entriesSnap = await getDocs(collection(db, 'users', userId, 'entries'));
    let embeddedCount = 0;
    entriesSnap.forEach((d) => {
      const data = d.data();
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        embeddedCount++;
      }
    });

    const promptsSnap = await getDocs(collection(db, 'users', userId, 'prompts')).catch(() => ({ size: 0 }));
    const echoesSnap = await getDocs(collection(db, 'users', userId, 'echoes')).catch(() => ({ size: 0 }));

    return {
      entriesCount: entriesSnap.size,
      embeddedCount,
      promptsCount: promptsSnap.size || 0,
      echoesCount: echoesSnap.size || 0,
    };
  } catch (err) {
    console.error('Failed to load user data stats:', err);
    return { entriesCount: 0, embeddedCount: 0, promptsCount: 0, echoesCount: 0 };
  }
}

/**
 * Check if an interrupted account deletion is pending for the user
 */
export function getPendingAccountDeletion(userId: string): AccountDeletionProgress | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${DELETION_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist checkpoint state in localStorage so deletion can resume if interrupted
 */
export function savePendingAccountDeletion(userId: string, progress: AccountDeletionProgress): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${DELETION_STORAGE_PREFIX}${userId}`,
      JSON.stringify({ ...progress, timestamp: Date.now() })
    );
  } catch (err) {
    console.error('Failed to persist account deletion checkpoint:', err);
  }
}

/**
 * Clear deletion checkpoint once completely finished
 */
export function clearPendingAccountDeletion(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${DELETION_STORAGE_PREFIX}${userId}`);
  } catch (err) {
    console.error('Failed to clear deletion checkpoint:', err);
  }
}

/**
 * Idempotently and repeatedly delete all documents in a subcollection in batches of 100
 */
async function deleteSubcollectionInBatches(
  userId: string,
  subcollectionName: string,
  onBatchDeleted?: (deletedBatchCount: number) => void
): Promise<number> {
  let totalDeleted = 0;
  const colRef = collection(db, 'users', userId, subcollectionName);

  while (true) {
    const q = query(colRef, limit(100));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.docs.length;
    onBatchDeleted?.(totalDeleted);
  }

  return totalDeleted;
}

/**
 * Complete and Resumable User Account Deletion:
 * 1. Purges all journal entries and 768-dimensional vector embeddings (/users/{uid}/entries)
 * 2. Purges legacy mirrored entries (/users/{uid}/interactions)
 * 3. Purges derived daily reflective inquiry questions (/users/{uid}/prompts)
 * 4. Purges derived anniversary echoes (/users/{uid}/echoes)
 * 5. Removes the parent user document (/users/{uid})
 * 6. Revokes the Firebase Auth user account (deleteUser)
 *
 * Designed to be fully idempotent and resumable if interrupted midway (network dropped, session expired, etc.).
 */
export async function deleteUserAccountAndData(
  userId: string,
  onProgress?: (progress: AccountDeletionProgress) => void
): Promise<void> {
  if (!userId) throw new Error('User ID is required for account deletion.');

  const checkpoint = getPendingAccountDeletion(userId);
  const progress: AccountDeletionProgress = checkpoint
    ? {
        stage: checkpoint.stage,
        deletedEntries: checkpoint.deletedEntries || 0,
        deletedInteractions: checkpoint.deletedInteractions || 0,
        deletedPrompts: checkpoint.deletedPrompts || 0,
        deletedEchoes: checkpoint.deletedEchoes || 0,
        timestamp: Date.now(),
      }
    : {
        stage: 'idle',
        deletedEntries: 0,
        deletedInteractions: 0,
        deletedPrompts: 0,
        deletedEchoes: 0,
        timestamp: Date.now(),
      };

  const updateProgress = (stage: AccountDeletionStage, partial?: Partial<AccountDeletionProgress>) => {
    progress.stage = stage;
    if (partial) {
      Object.assign(progress, partial);
    }
    progress.timestamp = Date.now();
    savePendingAccountDeletion(userId, progress);
    onProgress?.({ ...progress });
  };

  try {
    // ── STAGE 1: Delete /users/{uid}/entries (including all vector embeddings)
    updateProgress('entries');
    const entriesDeleted = await deleteSubcollectionInBatches(userId, 'entries', (count) => {
      updateProgress('entries', { deletedEntries: progress.deletedEntries + count });
    });
    progress.deletedEntries += entriesDeleted;
    savePendingAccountDeletion(userId, progress);

    // ── STAGE 2: Delete /users/{uid}/interactions (legacy mirrored entries)
    updateProgress('interactions');
    const interactionsDeleted = await deleteSubcollectionInBatches(userId, 'interactions', (count) => {
      updateProgress('interactions', { deletedInteractions: progress.deletedInteractions + count });
    });
    progress.deletedInteractions += interactionsDeleted;
    savePendingAccountDeletion(userId, progress);

    // ── STAGE 3: Delete /users/{uid}/prompts (derived daily questions)
    updateProgress('prompts');
    const promptsDeleted = await deleteSubcollectionInBatches(userId, 'prompts', (count) => {
      updateProgress('prompts', { deletedPrompts: progress.deletedPrompts + count });
    });
    progress.deletedPrompts += promptsDeleted;
    savePendingAccountDeletion(userId, progress);

    // ── STAGE 4: Delete /users/{uid}/echoes (derived anniversary echoes)
    updateProgress('echoes');
    const echoesDeleted = await deleteSubcollectionInBatches(userId, 'echoes', (count) => {
      updateProgress('echoes', { deletedEchoes: progress.deletedEchoes + count });
    });
    progress.deletedEchoes += echoesDeleted;
    savePendingAccountDeletion(userId, progress);

    // ── STAGE 5: Delete parent /users/{uid} document
    updateProgress('userDoc');
    await deleteDoc(doc(db, 'users', userId)).catch((err) => {
      // Document might not exist if user only had subcollections, which is fine
      console.warn('Parent user document deletion note:', err?.message || err);
    });

    // ── STAGE 6: Revoke Firebase Auth user
    updateProgress('auth');
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      try {
        await deleteUser(currentUser);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/requires-recent-login') {
          const reauthProgress: AccountDeletionProgress = {
            ...progress,
            stage: 'error',
            error: 'Google Authentication requires recent sign-in before revoking this account.',
            requiresReauth: true,
            timestamp: Date.now(),
          };
          savePendingAccountDeletion(userId, reauthProgress);
          onProgress?.(reauthProgress);
          throw authErr;
        }
        throw authErr;
      }
    }

    // ── STAGE 7: Completed successfully
    clearPendingAccountDeletion(userId);
    updateProgress('completed');
  } catch (err: any) {
    console.error('Account deletion encountered an error:', err);
    const isReauth = err?.code === 'auth/requires-recent-login';
    const errorProgress: AccountDeletionProgress = {
      ...progress,
      stage: 'error',
      error: isReauth
        ? 'Google Authentication requires recent sign-in before revoking this account.'
        : err?.message || 'Deletion failed due to network or permission error.',
      requiresReauth: isReauth,
      timestamp: Date.now(),
    };
    savePendingAccountDeletion(userId, errorProgress);
    onProgress?.(errorProgress);
    throw err;
  }
}

/**
 * Re-authenticate with Google and immediately resume the account deletion flow
 */
export async function reauthenticateAndResumeAccountDeletion(
  userId: string,
  onProgress?: (progress: AccountDeletionProgress) => void
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No user is currently active to re-authenticate.');
  }

  // Pop up Google re-authentication
  await reauthenticateWithPopup(currentUser, googleProvider);

  // Resume deletion from current checkpoint
  await deleteUserAccountAndData(userId, onProgress);
}
