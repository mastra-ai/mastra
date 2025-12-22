import { GitBranch } from 'lucide-react';

export interface BranchBannerProps {
  sourceThreadId: string;
  sourceThreadTitle?: string;
  onNavigateBack: () => void;
}

export const BranchBanner = ({ sourceThreadId, sourceThreadTitle, onNavigateBack }: BranchBannerProps) => {
  const displayTitle = sourceThreadTitle || `Thread ${sourceThreadId.slice(-5)}`;

  return (
    <div className="flex items-center gap-3 py-4 mb-4">
      <div className="flex-1 border-t border-border1" />
      <span className="text-ui-xs text-icon3 flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" />
        Branched from{' '}
        <button onClick={onNavigateBack} className="text-accent1 hover:underline">
          {displayTitle}
        </button>
      </span>
      <div className="flex-1 border-t border-border1" />
    </div>
  );
};
