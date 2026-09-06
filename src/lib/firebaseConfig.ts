/**
 * Firebase client configuration, sourced from environment variables.
 *
 * These values ship inside the browser bundle by design — Firebase web config
 * is public and is not a credential. Access is enforced by firestore.rules and
 * by API key restrictions in the Google Cloud console, not by hiding this file.
 * They live in .env so the repo is not pinned to one Firebase project.
 */

export interface FirebaseAppletConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

type EnvSource = Record<string, string | undefined>;

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export function buildFirebaseConfig(env: EnvSource): FirebaseAppletConfig {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your Firebase project values.'
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY!,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    appId: env.VITE_FIREBASE_APP_ID!,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || undefined,
  };
}
