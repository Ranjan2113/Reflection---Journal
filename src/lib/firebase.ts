import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { buildFirebaseConfig } from './firebaseConfig';

const firebaseConfig = buildFirebaseConfig(import.meta.env as Record<string, string | undefined>);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with explicit database ID if specified
export const db: Firestore = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Firebase Sign-Out Error:', error);
    throw error;
  }
}

export { onAuthStateChanged, deleteUser, reauthenticateWithPopup };
export type { FirebaseUser };
