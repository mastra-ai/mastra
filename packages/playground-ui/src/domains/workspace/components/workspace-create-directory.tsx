import { useQueryClient } from '@tanstack/react-query';
import { FolderPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { parentOf, ROOT_PATH } from '../path';
import { useWorkspaceContext } from './use-workspace-context';
import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Input } from '@/ds/components/Input';

/** "New folder" icon button; renders nothing unless `onCreateDirectory` is provided. */
export function WorkspaceCreateDirectory({ labeled = false }: { labeled?: boolean } = {}) {
  const { workspaceId, onCreateDirectory, isReadOnly } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const [pending, setPending] = useState(false);

  if (!onCreateDirectory || isReadOnly(ROOT_PATH)) return null;

  const trimmed = path.trim().replace(/^\.?\/+|\/+$/g, '');

  const submit = async () => {
    if (!trimmed) return;
    setPending(true);
    try {
      await onCreateDirectory(trimmed);
      await queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'fs', 'list', parentOf(trimmed)] });
      setOpen(false);
      setPath('');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {labeled ? (
        <Button variant="ghost" icon={<FolderPlusIcon />} onClick={() => setOpen(true)}>
          New folder
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" tooltip="New folder" onClick={() => setOpen(true)}>
          <FolderPlusIcon />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen} pending={pending}>
        <DialogContent size="sm">
          <form
            onSubmit={event => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Input
                autoFocus
                aria-label="Folder path"
                placeholder="docs/guides"
                value={path}
                onChange={event => setPath(event.target.value)}
              />
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <Button type="submit" variant="primary" disabled={!trimmed || pending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
