import { Play, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { VersionActionsProps } from '../types';

export function VersionActions({
  version,
  index,
  isUpdating,
  onSetActive,
  onDelete,
}: Omit<VersionActionsProps, 'onCopy' | 'copiedVersions'>) {
  return (
    <div className="flex items-center space-x-1">
      {version.status !== 'active' && version.status !== 'draft' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 hover:bg-mastra-bg-3 relative group"
          onClick={e => {
            e.stopPropagation();
            onSetActive(version, index);
          }}
          disabled={isUpdating}
        >
          <Play className="h-3 w-3" />
        </Button>
      )}
      {index !== 0 && version.status !== 'active' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 hover:bg-mastra-bg-3 relative group"
          onClick={e => {
            e.stopPropagation();
            onDelete(index);
          }}
        >
          <Trash2 className="h-3 w-3 text-red-400 hover:text-red-500" />
        </Button>
      )}
    </div>
  );
}
