import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { joinPath } from '../path';
import { useWorkspaceContext } from './use-workspace-context';
import { TreeIcon } from '@/ds/components/Tree/tree-icon';
import { FolderIcon } from '@/ds/icons/FolderIcon';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';

export function WorkspaceNewFolderInput({ parent, onDone }: { parent: string; onDone: () => void }) {
  const { workspaceId, onCreateDirectory } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const submitted = useRef(false);

  const submit = async (value: string) => {
    const name = value.trim().replace(/^\/+|\/+$/g, '');
    if (submitted.current) return;
    if (!name) return onDone();
    submitted.current = true;
    try {
      await onCreateDirectory?.(joinPath(parent, name));
    } catch {
      // The caller reports the failure; keep the input open so the user can retry or cancel.
      submitted.current = false;
      return;
    }
    onDone();
    await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'fs', 'list', parent] });
  };

  return (
    <>
      <TreeIcon>
        <FolderIcon className="text-muted-foreground" />
      </TreeIcon>
      <input
        type="text"
        aria-label="Folder name"
        placeholder="Folder name"
        autoFocus
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit(event.currentTarget.value);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onDone();
          }
        }}
        onBlur={event => void submit(event.currentTarget.value)}
        {...passwordManagerOptOutProps}
        className="min-w-0 flex-1 border-none bg-transparent text-caption zoom-safe-text text-foreground outline-hidden placeholder:text-muted-foreground"
      />
    </>
  );
}
