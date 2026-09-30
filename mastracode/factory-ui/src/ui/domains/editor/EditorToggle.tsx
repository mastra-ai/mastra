import { Button } from '@mastra/playground-ui/components/Button';
import { Code2Icon } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useWorkspacePanel } from '../workspace-viewer/context/useWorkspacePanel';

/**
 * Header action that flips the session view between chat and the code editor.
 * The state lives in `?view=editor` so editor visits are linkable and survive
 * refreshes; leaving the editor also drops the file/lines permalink params.
 */
export function EditorToggle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspacePath } = useWorkspacePanel();
  const open = searchParams.get('view') === 'editor';

  if (!workspacePath) return null;

  const toggle = () => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (open) {
        next.delete('view');
        next.delete('file');
        next.delete('lines');
      } else {
        next.set('view', 'editor');
      }
      return next;
    });
  };

  return (
    <Button
      size="icon-sm"
      variant={open ? 'default' : 'ghost'}
      tooltip={open ? 'Back to chat' : 'Open editor'}
      aria-label="Code editor"
      aria-pressed={open}
      onClick={toggle}
    >
      <Code2Icon />
    </Button>
  );
}
