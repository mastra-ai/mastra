import { Dialog, DialogContent, DialogHeader, DialogTitle, Kbd, Txt } from '@mastra/playground-ui';

interface ShortcutsOverlayProps {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open the command palette' },
  { keys: ['?'], description: 'Show this shortcuts help' },
  { keys: ['Enter'], description: 'Send the message' },
  { keys: ['Shift', 'Enter'], description: 'Insert a newline' },
  { keys: ['/'], description: 'Start a slash command' },
  { keys: ['Esc'], description: 'Close a dialog, or stop a running turn' },
];

/** A help overlay listing the keyboard shortcuts, triggered by '?'. */
export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-md" aria-label="Keyboard shortcuts">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1 px-5 pb-5">
          {SHORTCUTS.map(s => (
            <li key={s.description} className="flex items-center justify-between gap-4 py-1.5">
              <Txt as="span" variant="ui-sm" className="text-icon5">
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
      </DialogContent>
    </Dialog>
  );
}
