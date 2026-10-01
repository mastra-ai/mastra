import { cn } from '@mastra/playground-ui/utils/cn';
import Fuse from 'fuse.js';
import { ChevronRight, FileText, Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface QuickOpenCommand {
  id: string;
  label: string;
  hint?: string;
  run(): void;
}

interface QuickOpenDialogProps {
  open: boolean;
  /** `'files'` (Cmd+P) or `'commands'` (Cmd+Shift+P) — sets the initial query prefix. */
  mode: 'files' | 'commands';
  files: string[];
  commands: QuickOpenCommand[];
  onOpenFile(path: string): void;
  onClose(): void;
}

interface ResultItem {
  id: string;
  label: string;
  hint?: string;
  kind: 'file' | 'command';
  select(): void;
}

const MAX_RESULTS = 50;

function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

/**
 * VS Code-style quick open: type to fuzzy-match workspace files, or prefix
 * with `>` to search the command list instead. Rendered as a top-centered
 * overlay; fully keyboard driven (arrows + Enter + Escape).
 */
export function QuickOpenDialog({ open, mode, files, commands, onOpenFile, onClose }: QuickOpenDialogProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(mode === 'commands' ? '>' : '');
      setSelected(0);
    }
  }, [open, mode]);

  const fileFuse = useMemo(
    () =>
      new Fuse(
        files.map(path => ({ path, name: basename(path) })),
        {
          keys: [
            { name: 'name', weight: 0.7 },
            { name: 'path', weight: 0.3 },
          ],
          threshold: 0.4,
          ignoreLocation: true,
        },
      ),
    [files],
  );
  const commandFuse = useMemo(() => new Fuse(commands, { keys: ['label'], threshold: 0.4, ignoreLocation: true }), [
    commands,
  ]);

  const commandMode = query.startsWith('>');
  const needle = (commandMode ? query.slice(1) : query).trim();

  const results = useMemo<ResultItem[]>(() => {
    if (commandMode) {
      const matched = needle ? commandFuse.search(needle).map(result => result.item) : commands;
      return matched.slice(0, MAX_RESULTS).map(command => ({
        id: command.id,
        label: command.label,
        hint: command.hint,
        kind: 'command' as const,
        select: () => {
          onClose();
          command.run();
        },
      }));
    }
    const matched = needle ? fileFuse.search(needle).map(result => result.item.path) : files.slice(0, MAX_RESULTS);
    return matched.slice(0, MAX_RESULTS).map(path => ({
      id: path,
      label: basename(path),
      hint: path,
      kind: 'file' as const,
      select: () => {
        onClose();
        onOpenFile(path);
      },
    }));
  }, [commandMode, needle, commandFuse, commands, fileFuse, files, onClose, onOpenFile]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const item = listRef.current?.children[selected] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={commandMode ? 'Run a command' : 'Go to file'}
      className="bg-background/40 absolute inset-0 z-40 grid justify-center pt-16 backdrop-blur-sm"
      onPointerDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-popover border-border ring-border/40 h-fit w-[34rem] max-w-[90vw] overflow-hidden rounded-lg border shadow-2xl ring-1">
        <div className="border-border focus-within:ring-accent3/60 flex items-center gap-2 border-b px-3 py-2 focus-within:ring-1">
          {commandMode ? (
            <Terminal className="text-notice-info/80 size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          )}
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected(previous => Math.min(previous + 1, results.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected(previous => Math.max(previous - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                results[selected]?.select();
              }
            }}
            placeholder={commandMode ? 'Run a command…' : 'Go to file… (type > for commands)'}
            className="text-body-sm placeholder:text-placeholder w-full bg-transparent outline-none"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="quick-open-results"
            aria-activedescendant={results[selected]?.id}
          />
        </div>
        <div
          ref={listRef}
          id="quick-open-results"
          role="listbox"
          aria-label={commandMode ? 'Commands' : 'Files'}
          className="max-h-80 overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <div className="text-caption text-muted-foreground px-3 py-6 text-center">
              {needle ? `No ${commandMode ? 'commands' : 'files'} match “${needle}”.` : commandMode ? 'No commands available.' : 'No files yet.'}
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                id={item.id}
                type="button"
                role="option"
                aria-selected={index === selected}
                onClick={item.select}
                onPointerMove={() => setSelected(index)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  index === selected ? 'bg-accent3/15 text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.kind === 'file' ? (
                  <FileText className="text-notice-info/70 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <Terminal className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                )}
                <span className="text-body-sm shrink-0">{item.label}</span>
                {item.hint && <span className="text-caption text-muted-foreground/70 truncate">{item.hint}</span>}
              </button>
            ))
          )}
        </div>
        <div className="border-border text-meta text-muted-foreground flex items-center gap-3 border-t px-3 py-1.5">
          <span>
            <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">↵</kbd>{' '}
            {commandMode ? 'run' : 'open'}
          </span>
          <span>
            <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">esc</kbd> dismiss
          </span>
          <span className="ml-auto">
            {commandMode ? 'Commands' : 'Files'}
            {results.length > 0 && (
              <span className="ml-1 tabular-nums">
                · {results.length}
                {results.length === MAX_RESULTS && '+'}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
