import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';

import { useOverlays } from '../../../lib/overlays';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], description: 'Show this shortcuts help' },
  { keys: ['Enter'], description: 'Send the message' },
  { keys: ['Shift', 'Enter'], description: 'Insert a newline' },
  { keys: ['/'], description: 'Start a slash command' },
  { keys: ['Esc'], description: 'Close a dialog, or stop a running turn' },
];

/** A help overlay listing the keyboard shortcuts, triggered by '?'. */
export function ShortcutsOverlay() {
  const { close } = useOverlays();
  const searchShortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Dialog open onOpenChange={open => !open && close('shortcuts')}>
      <DialogContent aria-label="Keyboard shortcuts">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ul className="flex flex-col gap-1">
            <li className="flex items-center justify-between gap-4 py-1.5">
              <Txt as="span" variant="caption" className="text-foreground">
                Search and navigate
              </Txt>
              <Kbd>{searchShortcutLabel}</Kbd>
            </li>
            {SHORTCUTS.map(s => (
              <li key={s.description} className="flex items-center justify-between gap-4 py-1.5">
                <Txt as="span" variant="caption" className="text-foreground">
                  {s.description}
                </Txt>
                <span className="flex shrink-0 items-center gap-1">
                  {s.keys.map(k => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
