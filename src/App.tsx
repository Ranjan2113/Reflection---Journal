import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  auth, 
  signInWithGoogle, 
  logoutUser, 
  onAuthStateChanged, 
  FirebaseUser 
} from './lib/firebase';
import { 
  saveJournalEntry, 
  subscribeToUserEntries, 
  deleteJournalEntry,
  seedAnniversaryTestEntry,
  getPendingAccountDeletion
} from './lib/db';
import { JournalEntry, SaveState, ReflectionMode } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { HistoryView } from './components/HistoryView';
import { SemanticSearchView } from './components/SemanticSearchView';
import { ErrorBanner } from './components/ErrorBanner';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

function createNewEntryTemplate(userId: string): JournalEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: 'Untitled Reflection',
    summary: '',
    mode: 'reflection',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    isPinned: false,
  };
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'editor' | 'history' | 'search'>('editor');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [interruptedDeletionNotice, setInterruptedDeletionNotice] = useState(false);
  const [deletedAccountBanner, setDeletedAccountBanner] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Firebase Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        // Initialize an active entry draft if none exists
        setActiveEntry(createNewEntryTemplate(currentUser.uid));

        // Check if an interrupted account deletion is pending
        const pending = getPendingAccountDeletion(currentUser.uid);
        if (pending && pending.stage !== 'completed') {
          setInterruptedDeletionNotice(true);
        } else {
          setInterruptedDeletionNotice(false);
        }
      } else {
        setActiveEntry(null);
        setEntries([]);
        setInterruptedDeletionNotice(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-Time Firestore User Subcollection Listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (updatedEntries) => {
        setEntries(updatedEntries);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setErrorMessage('Failed to load past entries from Firestore.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 3. User Sign In with Google
  const handleSignIn = async () => {
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Failed to authenticate with Google.');
      }
    }
  };

  // 4. User Sign Out
  const handleSignOut = async () => {
    try {
      await logoutUser();
      setCurrentView('editor');
    } catch (err: any) {
      console.error('Logout error:', err);
      setErrorMessage('Failed to sign out. Please try again.');
    }
  };

  // 5. Update and Save Active Journal Entry
  const handleUpdateEntry = useCallback(
    async (updated: JournalEntry) => {
      if (!user) return;
      setActiveEntry(updated);
      setSaveState('saving');

      try {
        await saveJournalEntry(user.uid, updated);
        setSaveState('saved');
      } catch (err: any) {
        console.error('Save to Firestore error:', err);
        setSaveState('error');
        setErrorMessage('Failed to persist reflection to Firestore.');
      }
    },
    [user]
  );

  // 6. Start a New Blank Entry
  const handleNewEntry = () => {
    if (!user) return;
    const fresh = createNewEntryTemplate(user.uid);
    setActiveEntry(fresh);
    setCurrentView('editor');
    setSaveState('saved');
  };

  // 7. Select Entry from History to View/Continue
  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setCurrentView('editor');
    setSaveState('saved');
  };

  // 8. Delete Entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntry?.id === entryId) {
        handleNewEntry();
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setErrorMessage('Failed to delete reflection from Firestore.');
    }
  };

  // 9. Retry Save
  const handleRetrySave = () => {
    if (activeEntry && user) {
      handleUpdateEntry(activeEntry);
    }
  };

  // 10. Seed 1-Year-Ago Entry to test Anniversary Echo
  const handleSeedAnniversaryEntry = async () => {
    if (!user) return;
    try {
      setErrorMessage(null);
      await seedAnniversaryTestEntry(user.uid);
      // Open editor fresh so AnniversaryEchoCard immediately evaluates and displays the echo
      handleNewEntry();
    } catch (err: any) {
      console.error('Seed anniversary error:', err);
      setErrorMessage('Failed to seed anniversary entry: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleAccountDeleted = () => {
    setUser(null);
    setEntries([]);
    setActiveEntry(null);
    setIsAccountSettingsOpen(false);
    setInterruptedDeletionNotice(false);
    setDeletedAccountBanner(
      'Your account, reflections, 768-dimensional vector embeddings, and all derived inquiries have been permanently wiped from Google Cloud Firestore, and your Firebase credentials have been revoked.'
    );
    setCurrentView('editor');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF8F3] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-[#E5E0D8] border-t-[#2D2926] rounded-full animate-spin" />
          <span className="text-xs font-medium text-[#6E675F]">
            Initializing secure session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#2D2926] flex flex-col font-sans antialiased selection:bg-[#F3ECE2] selection:text-[#8C6239]">
      
      {/* Global Navigation */}
      <Navbar
        user={user}
        currentView={currentView}
        onViewChange={setCurrentView}
        onNewEntry={handleNewEntry}
        onSignOut={handleSignOut}
        onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
      />

      {/* Interrupted Account Deletion Warning Banner */}
      {interruptedDeletionNotice && user && (
        <div className="bg-[#FDF4F4] border-b border-[#F3C4C4] px-4 py-2.5 text-xs text-[#B91C1C]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>An incomplete account deletion was detected for your profile. Data wiping can be resumed immediately.</span>
            </div>
            <button
              id="btn-banner-resume-deletion"
              onClick={() => setIsAccountSettingsOpen(true)}
              className="px-3 py-1 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              Resume Account Deletion
            </button>
          </div>
        </div>
      )}

      {/* Post-Deletion Confirmation Banner */}
      {deletedAccountBanner && (
        <div className="bg-[#F2F8F4] border-b border-[#CBE4D3] px-4 py-3 text-xs text-[#235C3A]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2D7A4D]" />
              <span>{deletedAccountBanner}</span>
            </div>
            <button
              onClick={() => setDeletedAccountBanner(null)}
              className="text-[#2D7A4D] hover:underline cursor-pointer font-medium ml-3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onRetry={saveState === 'error' ? handleRetrySave : undefined}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1">
        {!user ? (
          <LandingPage
            onSignIn={handleSignIn}
            isLoading={authLoading}
            errorMessage={errorMessage}
          />
        ) : currentView === 'search' ? (
          <SemanticSearchView
            userId={user.uid}
            entries={entries}
            onSelectEntry={handleSelectEntry}
            onNewEntry={handleNewEntry}
          />
        ) : currentView === 'editor' && activeEntry ? (
          <JournalEditor
            entry={activeEntry}
            onUpdateEntry={handleUpdateEntry}
            saveState={saveState}
            onRetrySave={handleRetrySave}
            onNewEntry={handleNewEntry}
            onSelectEntry={handleSelectEntry}
          />
        ) : (
          <HistoryView
            entries={entries}
            onSelectEntry={handleSelectEntry}
            onDeleteEntry={handleDeleteEntry}
            onNewEntry={handleNewEntry}
            onSeedAnniversary={handleSeedAnniversaryEntry}
            onNavigateToSemanticSearch={() => setCurrentView('search')}
          />
        )}
      </main>

      {/* Account & Privacy Settings Modal */}
      {user && (
        <AccountSettingsModal
          user={user}
          isOpen={isAccountSettingsOpen}
          onClose={() => setIsAccountSettingsOpen(false)}
          onAccountDeleted={handleAccountDeleted}
        />
      )}

    </div>
  );
}
