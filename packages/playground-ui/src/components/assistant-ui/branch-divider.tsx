import { GitBranch } from 'lucide-react';

export const BranchDivider = () => {
  return (
    <div className="flex items-center gap-3 py-4 px-2">
      <div className="flex-1 border-t border-border1" />
      <span className="text-ui-xs text-icon3 flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" />
        Branched from original
      </span>
      <div className="flex-1 border-t border-border1" />
    </div>
  );
};
