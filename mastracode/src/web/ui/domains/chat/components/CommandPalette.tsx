import { Dialog, DialogContent } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SLASH_COMMANDS } from '../index';
import type { SlashCommand } from '../index';

interface CommandPaletteProps {
  /** Run a command. Commands with args pre-fill the composer; no-arg commands execute. */
  onRun: (command: SlashCommand) => void;
  onClose: () => void;
}

/**
 * A Cmd/Ctrl+K command palette over the slash-command registry. Filters as you
 * type, navigates with arrows, runs on Enter, and dismisses on Escape (handled
 * by the DS Dialog and the global key handler in App).
 */
export function CommandPalette({ onRun, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<SlashCommand[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [query]);

  // Keep the active index in range as the match list shrinks/grows.
  useEffect(() => {
    setActive(a => Math.min(a, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  const run = (command: SlashCommand | undefined) => {
    if (!command) return;
    onRun(command);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % Math.max(1, matches.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i - 1 + matches.length) % Math.max(1, matches.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(matches[active]);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="top-1/4 w-full max-w-xl translate-y-0 gap-0 p-0"
        aria-label="Command palette"
        initialFocus={inputRef}
      >
        <Input
          ref={inputRef}
          variant="unstyled"
          className="h-form-default border-b border-border1 bg-transparent px-3.5 text-ui-md"
          placeholder="Type a command…"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Filter commands"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label="Commands">
          {matches.length === 0 && (
            <li>
              <Txt as="div" variant="ui-sm" className="px-2 py-3 text-center text-icon3">
                No matching commands
              </Txt>
            </li>
          )}
          {matches.map((c, i) => (
            <li key={c.name}>
              <button
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-hidden ${
                  i === active ? 'bg-surface4' : 'hover:bg-surface4'
                }`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(c)}
              >
                <Txt as="span" variant="ui-md" font="mono" className="text-icon6">
                  /{c.name}
                  {c.args && <span className="text-icon3"> {c.args}</span>}
                </Txt>
                <Txt as="span" variant="ui-xs" className="text-icon3">
                  {c.description}
                </Txt>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5 border-t border-border1 px-3 py-2 text-icon3">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            navigate
          </Txt>
          <Kbd>↵</Kbd>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            run
          </Txt>
          <Kbd>esc</Kbd>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            close
          </Txt>
        </div>
      </DialogContent>
    </Dialog>
  );
}
