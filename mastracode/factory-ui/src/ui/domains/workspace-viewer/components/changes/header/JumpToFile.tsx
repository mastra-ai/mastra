import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { ListTree } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceChangesScope } from '../../../../../../api/types';
import { useWorkspacePatches } from '../../../../../../hooks/use-fs';
import { pluralize } from '../pluralize';
import type { RepositoryProviders } from '../tree/change-tree';
import { ChangeTree } from '../tree/ChangeTree';

interface JumpToFileProps {
  workspacePath: string;
  scope: WorkspaceChangesScope;
  visible: boolean;
  repositoryProviders?: RepositoryProviders;
  onJump: (path: string) => void;
}

export function JumpToFile({ workspacePath, scope, visible, repositoryProviders, onJump }: JumpToFileProps) {
  const patches = useWorkspacePatches(workspacePath, scope, { enabled: visible });
  const [open, setOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [selectedPath, setSelectedPath] = useState<string>();

  if (patches.error || !patches.data?.changes.length) return null;

  const fileCount = patches.data.changes.length;
  const jump = (path: string) => {
    setSelectedPath(path);
    setOpen(false);
    onJump(path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        size="sm"
        variant="ghost"
        tooltip="Jump to file"
        aria-label={`Jump to file, ${pluralize(fileCount, 'file')}`}
      >
        <ListTree />
        <span className="tabular-nums">{fileCount}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <ScrollArea maxHeight="min(28rem,60vh)">
          <ChangeTree
            changes={patches.data}
            repositoryProviders={repositoryProviders}
            openFolders={openFolders}
            onFolderOpenChange={(path, folderOpen) => setOpenFolders(previous => ({ ...previous, [path]: folderOpen }))}
            selectedPath={selectedPath}
            onSelect={jump}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
