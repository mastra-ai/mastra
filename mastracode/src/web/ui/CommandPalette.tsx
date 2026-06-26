import { useEffect, useMemo, useRef, useState } from 'react';

import { SLASH_COMMANDS } from './commands';
import type { SlashCommand } from './commands';

interface CommandPaletteProps {
  /** Run a command. Commands with args pre-fill the composer; no-arg commands execute. */
  onRun: (command: SlashCommand) => void;
  onClose: () => void;
}

/**
 * A Cmd/Ctrl+K command palette over the slash-command registry. Filters as you
 * type, navigates with arrows, runs on Enter, and dismisses on Escape (handled
 * by the global key handler in App).
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

  // Focus the input on open; keep the active index in range as matches change.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
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
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Filter commands"
        />
        <ul className="palette-list" role="listbox" aria-label="Commands">
          {matches.length === 0 && <li className="palette-empty">No matching commands</li>}
          {matches.map((c, i) => (
            <li key={c.name}>
              <button
                type="button"
                className={`palette-item ${i === active ? 'active' : ''}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(c)}
              >
                <span className="palette-name">
                  /{c.name}
                  {c.args && <span className="palette-args"> {c.args}</span>}
                </span>
                <span className="palette-desc">{c.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="palette-hint">
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate · <kbd>↵</kbd> run · <kbd>esc</kbd> close
        </div>
      </div>
    </div>
  );
}
