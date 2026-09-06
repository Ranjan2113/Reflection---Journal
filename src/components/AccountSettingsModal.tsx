import React, { useState, useEffect } from 'react';
import { 
  User, 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Calendar, 
  X, 
  Loader2, 
  CheckCircle2, 
  RefreshCw,
  Lock
} from 'lucide-react';
import { FirebaseUser } from '../lib/firebase';
import { 
  UserDataStats, 
  AccountDeletionProgress, 
  AccountDeletionStage 
} from '../types';
import { 
  getUserDataStats, 
  getPendingAccountDeletion, 
  deleteUserAccountAndData, 
  reauthenticateAndResumeAccountDeletion,
  clearPendingAccountDeletion 
} from '../lib/db';

interface AccountSettingsModalProps {
  user: FirebaseUser;
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  user,
  isOpen,
  onClose,
  onAccountDeleted,
}) => {
  const [stats, setStats] = useState<UserDataStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  
  // Deletion UI states
  const [confirmText, setConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletionProgress, setDeletionProgress] = useState<AccountDeletionProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for pending/interrupted deletion on mount
  useEffect(() => {
    if (!isOpen || !user) return;

    setIsLoadingStats(true);
    getUserDataStats(user.uid)
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        console.error('Failed to load user data stats:', err);
      })
      .finally(() => {
        setIsLoadingStats(false);
      });

    // Check if an interrupted deletion checkpoint exists
    const pending = getPendingAccountDeletion(user.uid);
    if (pending && pending.stage !== 'completed') {
      setDeletionProgress(pending);
      if (pending.stage === 'error') {
        setErrorMessage(pending.error || 'A previous deletion attempt was interrupted.');
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleStartDeletion = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await deleteUserAccountAndData(user.uid, (progress) => {
        setDeletionProgress(progress);
      });

      // Complete
      setIsDeleting(false);
      onAccountDeleted();
    } catch (err: any) {
      console.error('Account deletion error:', err);
      setIsDeleting(false);
      if (err?.code === 'auth/requires-recent-login') {
        setErrorMessage(
          'Google requires fresh authentication to revoke your account credentials. Please click Re-authenticate below to finish.'
        );
      } else {
        setErrorMessage(
          err?.message || 'Failed to complete deletion. You can safely resume from this point.'
        );
      }
    }
  };

  const handleResumeDeletion = async () => {
    setErrorMessage(null);
    setIsDeleting(true);

    try {
      if (deletionProgress?.requiresReauth) {
        await reauthenticateAndResumeAccountDeletion(user.uid, (progress) => {
          setDeletionProgress(progress);
        });
      } else {
        await deleteUserAccountAndData(user.uid, (progress) => {
          setDeletionProgress(progress);
        });
      }

      setIsDeleting(false);
      onAccountDeleted();
    } catch (err: any) {
      console.error('Resume deletion error:', err);
      setIsDeleting(false);
      if (err?.code === 'auth/requires-recent-login') {
        setErrorMessage(
          'Google requires fresh authentication to revoke your account credentials. Please click Re-authenticate below to finish.'
        );
      } else {
        setErrorMessage(
          err?.message || 'Failed to resume deletion. You can try again.'
        );
      }
    }
  };

  const handleCancelPending = () => {
    clearPendingAccountDeletion(user.uid);
    setDeletionProgress(null);
    setErrorMessage(null);
    setConfirmText('');
  };

  const stageOrder: { stage: AccountDeletionStage; label: string }[] = [
    { stage: 'entries', label: 'Purging reflections & 768-dim embeddings (/entries)' },
    { stage: 'interactions', label: 'Purging legacy reflection mirrors (/interactions)' },
    { stage: 'prompts', label: 'Purging derived daily inquiry prompts (/prompts)' },
    { stage: 'echoes', label: 'Purging derived anniversary echoes (/echoes)' },
    { stage: 'userDoc', label: 'Removing root user document (/users/{uid})' },
    { stage: 'auth', label: 'Revoking Firebase Authentication credentials' },
  ];

  const currentStageIndex = deletionProgress
    ? stageOrder.findIndex((s) => s.stage === deletionProgress.stage)
    : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B18]/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="account-settings-modal"
        className="w-full max-w-xl bg-[#FBF8F3] border border-[#D8CCBE] rounded-2xl shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD3] bg-[#F5EFE6]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E8DFD3] text-[#8C6239]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#2D2926]">Account & Privacy</h2>
              <p className="text-xs text-[#6E675F]">Identity, data footprint, and account deletion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-[#8A8178] hover:text-[#2D2926] hover:bg-[#E8DFD3] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* User Profile Overview */}
          <div className="p-4 rounded-xl bg-white border border-[#E8DFD3] flex items-center gap-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="h-12 w-12 rounded-full border border-[#D8CCBE] object-cover ring-2 ring-[#F3ECE2]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-[#E8DFD3] text-[#2D2926] flex items-center justify-center font-medium text-base">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#2D2926] truncate">
                  {user.displayName || 'Journaler'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3ECE2] text-[#8C6239] border border-[#D8CCBE]">
                  <ShieldCheck className="h-3 w-3" />
                  Google Verified
                </span>
              </div>
              <p className="text-xs text-[#6E675F] truncate">{user.email}</p>
              <p className="text-[10px] text-[#A2998F] font-mono mt-0.5 truncate">
                UID: {user.uid}
              </p>
            </div>
          </div>

          {/* Data Footprint & Privacy Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6E675F] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Data Storage Footprint
              </h3>
              <span className="text-[11px] text-[#8C6239] font-medium">Path: /users/{user.uid}/*</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-white border border-[#E8DFD3] text-center">
                <span className="text-[10px] font-medium text-[#6E675F] block mb-1">Reflections</span>
                <span className="text-lg font-bold text-[#2D2926]">
                  {isLoadingStats ? '...' : stats?.entriesCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8DFD3] text-center">
                <span className="text-[10px] font-medium text-[#6E675F] block mb-1">Vectors (768d)</span>
                <span className="text-lg font-bold text-[#2D2926]">
                  {isLoadingStats ? '...' : stats?.embeddedCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8DFD3] text-center">
                <span className="text-[10px] font-medium text-[#6E675F] block mb-1">Daily Inquiries</span>
                <span className="text-lg font-bold text-[#2D2926]">
                  {isLoadingStats ? '...' : stats?.promptsCount ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E8DFD3] text-center">
                <span className="text-[10px] font-medium text-[#6E675F] block mb-1">Echo Summaries</span>
                <span className="text-lg font-bold text-[#2D2926]">
                  {isLoadingStats ? '...' : stats?.echoesCount ?? 0}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF5EE] border border-[#E8DFD3] text-xs text-[#6E675F] leading-relaxed flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-[#8C6239] shrink-0 mt-0.5" />
              <span>
                All entries, vector embeddings, and inquiry prompts are stored exclusively under your private user document in Firestore. Data is strictly isolated by security rules.
              </span>
            </div>
          </div>

          {/* Interrupted / Pending Deletion Alert */}
          {deletionProgress && deletionProgress.stage !== 'completed' && (
            <div className="p-4 rounded-xl bg-[#FDF4F4] border border-[#F3C4C4] space-y-3">
              <div className="flex items-start gap-2.5 text-[#B91C1C]">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Account Deletion In Progress / Paused</h4>
                  <p className="text-xs text-[#7F1D1D] mt-0.5">
                    {errorMessage ||
                      `Deletion paused at stage: ${deletionProgress.stage}. You can resume to finish wiping your data.`}
                  </p>
                </div>
              </div>

              {/* Progress Counters */}
              <div className="text-xs text-[#7F1D1D] grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-lg border border-[#F3C4C4]/60">
                <div>Purged reflections: <strong>{deletionProgress.deletedEntries}</strong></div>
                <div>Purged prompts: <strong>{deletionProgress.deletedPrompts}</strong></div>
                <div>Purged echoes: <strong>{deletionProgress.deletedEchoes}</strong></div>
                <div>Purged mirrors: <strong>{deletionProgress.deletedInteractions}</strong></div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  id="btn-resume-account-deletion"
                  onClick={handleResumeDeletion}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {deletionProgress.requiresReauth
                    ? 'Re-authenticate with Google & Complete'
                    : 'Resume Account Deletion'}
                </button>
                <button
                  onClick={handleCancelPending}
                  disabled={isDeleting}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[#6E675F] hover:text-[#2D2926] hover:bg-[#E8DFD3]/60 transition-colors cursor-pointer"
                >
                  Reset Status
                </button>
              </div>
            </div>
          )}

          {/* Active Deletion Stepper */}
          {isDeleting && (
            <div className="p-4 rounded-xl bg-white border border-[#E8DFD3] space-y-3">
              <h4 className="text-xs font-semibold text-[#2D2926] uppercase tracking-wider flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B91C1C]" />
                Purging Account Data & Revoking Credentials
              </h4>
              <div className="space-y-2 text-xs">
                {stageOrder.map((step, idx) => {
                  const isCurrent = deletionProgress?.stage === step.stage;
                  const isPassed = currentStageIndex > idx;
                  return (
                    <div
                      key={step.stage}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-[#FDF4F4] text-[#B91C1C] font-medium'
                          : isPassed
                          ? 'text-[#2D7A4D] font-normal'
                          : 'text-[#8A8178]'
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2D7A4D]" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#B91C1C]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[#D8CCBE] ml-1 mr-0.5" />
                      )}
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Danger Zone: Permanent Account Deletion */}
          {!isDeleting && (!deletionProgress || deletionProgress.stage === 'idle') && (
            <div className="p-4 rounded-xl bg-[#FDF4F4]/70 border border-[#F3C4C4] space-y-4">
              <div className="flex items-start gap-2.5 text-[#B91C1C]">
                <Trash2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Danger Zone: Permanent Account Deletion</h4>
                  <p className="text-xs text-[#6E675F] mt-1 leading-relaxed">
                    Deleting your account permanently wipes your entire user document (<code className="text-[#8C6239]">/users/{user.uid}</code>) and all subcollections (<code className="text-[#8C6239]">entries</code>, <code className="text-[#8C6239]">prompts</code>, <code className="text-[#8C6239]">echoes</code>), including all 768-dimensional vector embeddings and tags. It revokes your Google credentials via Firebase Auth.
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-[#F3C4C4]/60 text-xs text-[#7F1D1D] space-y-1">
                <div className="font-semibold">This action cannot be undone:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-[#6E675F]">
                  <li>All past reflections and chat history will be unrecoverable.</li>
                  <li>All generated vector embeddings will be permanently erased.</li>
                  <li>Daily inquiries and anniversary echoes will be purged.</li>
                  <li>Your Firebase Auth user will be revoked immediately.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label 
                  htmlFor="input-confirm-delete"
                  className="block text-xs font-medium text-[#2D2926]"
                >
                  Type <span className="font-mono font-bold text-[#B91C1C]">DELETE</span> to confirm:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="input-confirm-delete"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-white border border-[#D8CCBE] focus:outline-hidden focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] font-mono"
                  />
                  <button
                    id="btn-confirm-delete-account"
                    onClick={handleStartDeletion}
                    disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E8DFD3] bg-[#F5EFE6] flex items-center justify-between text-xs text-[#6E675F]">
          <span>Privacy-first & Resumable per Section 10</span>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-1.5 rounded-xl font-medium text-[#2D2926] bg-[#E8DFD3] hover:bg-[#D8CCBE] transition-colors cursor-pointer disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
