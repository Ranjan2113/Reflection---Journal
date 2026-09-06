import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Lock, 
  Database, 
  Cpu, 
  ArrowRight, 
  MessageSquare, 
  Lightbulb, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignInClick = async () => {
    try {
      setSigningIn(true);
      await onSignIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FBF8F3] via-[#F3ECE2]/30 to-[#FBF8F3]">
      <div className="max-w-3xl w-full text-center space-y-8">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F3ECE2] border border-[#E5E0D8] text-xs font-medium text-[#2D2926]"
        >
          <ShieldCheck className="h-4 w-4 text-[#A67C52]" />
          <span>Private &bull; Isolated Firestore Subcollections &bull; Gemini 3.6 Flash</span>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <h1 className="font-editorial-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#2D2926] leading-tight">
            Conversational Journaling &amp; <span className="italic font-serif text-[#A67C52]">AI Reflection</span>
          </h1>
          <p className="text-base sm:text-lg text-[#6E675F] max-w-2xl mx-auto font-normal leading-relaxed">
            A quiet, personal sanctuary to unpack your thoughts, explore ideas from new angles, and distill clarity with Gemini. Every reflection is strictly isolated to your authenticated account.
          </p>
        </motion.div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50/90 border border-red-200 text-sm text-red-800 text-left max-w-md mx-auto">
            <span className="font-semibold">Sign-in Notice:</span> {errorMessage}
          </div>
        )}

        {/* Action / Google Sign In */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            id="btn-google-sign-in"
            onClick={handleSignInClick}
            disabled={isLoading || signingIn}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#2D2926] hover:bg-[#1C1A18] text-[#FBF8F3] font-medium text-sm sm:text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer border border-[#2D2926]"
          >
            {/* Google Vector Icon */}
            <svg className="h-5 w-5 fill-current text-white" viewBox="0 0 24 24">
              <path d="M12.24 10.285V13.8h6.887C18.2 16.15 15.65 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.47 0 2.815.535 3.86 1.415l2.67-2.67C17.135 3.255 14.83 2.4 12.24 2.4 6.97 2.4 2.7 6.67 2.7 11.94s4.27 9.54 9.54 9.54c5.505 0 9.15-3.87 9.15-9.315 0-.63-.06-1.245-.18-1.885H12.24z" />
            </svg>
            <span>
              {isLoading || signingIn ? 'Connecting to Firebase...' : 'Continue with Google'}
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Architecture & Capabilities Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-8 text-left"
        >
          <div className="p-6 rounded-2xl bg-white/90 border border-[#E5E0D8] shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#F3ECE2] text-[#8C6239] flex items-center justify-center border border-[#E5E0D8]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="font-editorial-serif font-bold text-[#2D2926] text-lg">
              Multi-Turn Dialogue
            </h2>
            <p className="text-xs sm:text-sm text-[#6E675F] leading-relaxed">
              Engage in rich conversations with Gemini 3.6 Flash. Unpack complex feelings, explore creative angles, and formulate concrete steps.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/90 border border-[#E5E0D8] shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#F3ECE2] text-[#8C6239] flex items-center justify-center border border-[#E5E0D8]">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="font-editorial-serif font-bold text-[#2D2926] text-lg">
              User-Isolated Vault
            </h2>
            <p className="text-xs sm:text-sm text-[#6E675F] leading-relaxed">
              Enforced by strict Firestore security rules. Your journal entries are isolated strictly to your UID subcollection.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/90 border border-[#E5E0D8] shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#F3ECE2] text-[#8C6239] flex items-center justify-center border border-[#E5E0D8]">
              <Database className="h-5 w-5" />
            </div>
            <h2 className="font-editorial-serif font-bold text-[#2D2926] text-lg">
              Continuous Firestore Sync
            </h2>
            <p className="text-xs sm:text-sm text-[#6E675F] leading-relaxed">
              Automatic persistence records your thoughts and AI takeaways with zero data loss, offline resilience, and live updates.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
