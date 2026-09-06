import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  BookOpen, 
  Sparkles, 
  PlusCircle, 
  Clock, 
  LogOut, 
  ShieldCheck,
  Search,
  Settings
} from 'lucide-react';

interface NavbarProps {
  user: FirebaseUser | null;
  currentView: 'editor' | 'history' | 'search';
  onViewChange: (view: 'editor' | 'history' | 'search') => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  onOpenAccountSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  onViewChange,
  onNewEntry,
  onSignOut,
  onOpenAccountSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E0D8] bg-[#FBF8F3]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#2D2926] text-[#FBF8F3] flex items-center justify-center shadow-xs">
            <Sparkles className="h-5 w-5 text-[#C5A880]" />
          </div>
          <div>
            <span className="font-editorial-serif font-bold text-[#2D2926] tracking-tight text-lg sm:text-xl">
              Reflect &amp; Journal AI
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-mono text-[#6E675F] bg-[#F3ECE2] border border-[#E5E0D8] px-2 py-0.5 rounded-full">
              Gemini 3.6 + Firestore
            </span>
          </div>
        </div>

        {/* Center Actions (when logged in) */}
        {user && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              id="nav-tab-editor"
              onClick={() => onViewChange('editor')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                currentView === 'editor'
                  ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                  : 'text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2]/80'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Studio</span>
            </button>

            <button
              id="nav-tab-history"
              onClick={() => onViewChange('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                currentView === 'history'
                  ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                  : 'text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2]/80'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Past Entries</span>
            </button>

            <button
              id="nav-tab-semantic-search"
              onClick={() => onViewChange('search')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                currentView === 'search'
                  ? 'bg-[#2D2926] text-[#FBF8F3] shadow-xs'
                  : 'text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2]/80'
              }`}
              title="Search past reflections by feeling or situation"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Felt Like This?</span>
              <span className="sm:hidden">Search</span>
            </button>

            <button
              id="btn-new-entry-nav"
              onClick={onNewEntry}
              className="ml-1 sm:ml-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-[#8C6239] bg-[#F3ECE2] hover:bg-[#E8DFD3] transition-colors border border-[#D8CCBE] cursor-pointer"
              title="Start a new reflection"
            >
              <PlusCircle className="h-4 w-4 text-[#A67C52]" />
              <span className="hidden sm:inline">New Entry</span>
            </button>
          </nav>
        )}

        {/* User Status / Auth Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#2D2926] leading-tight">
                  {user.displayName || 'Journaler'}
                </span>
                <span className="text-[11px] text-[#6E675F] truncate max-w-[160px]">
                  {user.email}
                </span>
              </div>
              
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-8 w-8 rounded-full border border-[#D8CCBE] ring-2 ring-[#F3ECE2] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#E8DFD3] text-[#2D2926] flex items-center justify-center font-medium text-xs">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <button
                id="btn-account-settings"
                onClick={onOpenAccountSettings}
                className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2] transition-colors cursor-pointer"
                title="Account & Privacy Settings"
                aria-label="Account & Privacy Settings"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                id="btn-sign-out"
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#2D2926] hover:bg-[#F3ECE2] transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#6E675F] bg-[#F3ECE2]/80 border border-[#E5E0D8] px-2.5 py-1 rounded-full">
              <ShieldCheck className="h-4 w-4 text-[#A67C52]" />
              <span className="font-medium">Isolated User Storage</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
