/**
 * Backfill Script: Vector Embeddings for Existing Journal Entries
 * 
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts [userId]
 * 
 * Requirements & Compliance:
 * - Section 10: Never embeds entries with analysisOptOut == true.
 * - Idempotency: Hashes entry content using SHA-256; skips unchanged entries.
 * - Scope: Confined to user's isolated subcollection at /users/{uid}/entries/{entryId}.
 * - Zero Logging: Never logs entry text or raw embedding vectors to console.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  vector 
} from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { buildFirebaseConfig } from '../src/lib/firebaseConfig';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const firebaseConfig = buildFirebaseConfig(process.env);

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

async function generateEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.slice(0, 8000);
  const res = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: truncatedText,
    config: {
      outputDimensionality: 768,
    },
  });

  const values = (res as any).embedding?.values || res.embeddings?.[0]?.values;
  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error('Failed to obtain vector from Gemini embedding model.');
  }
  return values;
}

async function runBackfill(targetUserId?: string) {
  console.log('=====================================================');
  console.log('Starting Backfill for Semantic Search Vector Embeddings');
  console.log('Model: gemini-embedding-2-preview (768 dimensions)');
  console.log('=====================================================\n');

  if (!targetUserId) {
    console.log('No specific userId passed. Looking for active user sessions or pass: npx tsx scripts/backfill-embeddings.ts <userId>');
    console.log('Targeting default test user if needed, or exiting.');
    return;
  }

  console.log(`Processing subcollection /users/${targetUserId}/entries...`);

  // Read from /entries
  const entriesRef = collection(db, 'users', targetUserId, 'entries');
  const snap = await getDocs(entriesRef);

  let totalFound = snap.size;
  let newlyEmbedded = 0;
  let skippedUnchanged = 0;
  let skippedOptOut = 0;

  console.log(`Found ${totalFound} entries in /users/${targetUserId}/entries.`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const entryId = docSnap.id;

    // 1. Skip if user opted out of AI retrospective analysis (Section 10)
    if (data.analysisOptOut === true) {
      skippedOptOut++;
      // Ensure embedding is removed if present
      if (data.embedding) {
        await setDoc(doc(db, 'users', targetUserId, 'entries', entryId), {
          embedding: null,
          vectorField: null,
          contentHash: null,
        }, { merge: true });
      }
      continue;
    }

    // 2. Extract content
    let contentText = (data.title || '').trim();
    if (data.summary) contentText += '\n' + data.summary.trim();
    if (Array.isArray(data.messages)) {
      const userTexts = data.messages
        .filter((m: any) => m && m.role === 'user' && typeof m.content === 'string')
        .map((m: any) => m.content.trim())
        .filter(Boolean);
      if (userTexts.length > 0) contentText += '\n' + userTexts.join('\n');
    }

    if (!contentText.trim()) {
      continue;
    }

    // 3. Idempotent check
    const contentHash = computeContentHash(contentText);
    if (data.contentHash === contentHash && Array.isArray(data.embedding) && data.embedding.length === 768) {
      skippedUnchanged++;
      continue;
    }

    // 4. Generate embedding
    try {
      const embedding = await generateEmbedding(contentText);
      const updatePayload: any = {
        embedding,
        contentHash,
        embeddedAt: Date.now(),
      };
      try {
        updatePayload.vectorField = vector(embedding);
      } catch {}

      await setDoc(doc(db, 'users', targetUserId, 'entries', entryId), updatePayload, { merge: true });
      // Also update /interactions for mirror compatibility
      await setDoc(doc(db, 'users', targetUserId, 'interactions', entryId), updatePayload, { merge: true }).catch(() => {});

      newlyEmbedded++;
      process.stdout.write('.');
    } catch (err: any) {
      console.error(`\nFailed to embed entry ${entryId}:`, err?.message || err);
    }
  }

  console.log('\n\n--- Backfill Summary ---');
  console.log(`Total scanned:      ${totalFound}`);
  console.log(`Newly embedded:     ${newlyEmbedded}`);
  console.log(`Skipped unchanged:  ${skippedUnchanged}`);
  console.log(`Skipped opt-outs:   ${skippedOptOut}`);
  console.log('Backfill process complete.\n');
}

const targetUserId = process.argv[2];
runBackfill(targetUserId).catch((err) => {
  console.error('Fatal error during backfill:', err);
  process.exit(1);
});
