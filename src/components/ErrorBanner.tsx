import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-900 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
        <span className="font-medium text-xs sm:text-sm">{message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-800 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1 rounded-md text-red-600 hover:bg-red-100"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
