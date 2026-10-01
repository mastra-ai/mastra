import { cn } from '@mastra/playground-ui/utils/cn';
import { Eraser, ExternalLink, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { PreviewBase } from '../../../api/types';
import { useSessionPreviewBase } from '../../../hooks/use-preview-base';
import {
  useRunnerScripts,
  useRunnerStartMutation,
  useRunnerStopMutation,
  useRunnerStream,
} from '../../../hooks/use-runner';
import { EDITOR_THEME } from './editor-themes';
import { buildSandboxPreviewUrl, detectLocalhostUrls } from './preview-url';
import './runner-terminal.css';
import {
  applyCompletion,
  completionCandidates,
  loadHistory,
  parseAnsi,
  saveHistory,
  type AnsiSpan,
} from './runner-terminal';

/**
 * `path:line[:col]` references in command output — the path must contain a
 * slash and a file extension so bare timestamps and ratios don't match.
 */
const FILE_REF = /((?:[\w.@~-]+\/)+[\w.@~-]+\.\w{1,8}):(\d+)(?::\d+)?/g;

/** Prompt glyph. Kept as a constant so future prompt/theming stays central. */
const PROMPT = '❯';

/** Render one ANSI-styled span with our design-system colour tokens. */
function AnsiSpanElement({ span, children }: { span: AnsiSpan; children: ReactNode }) {
  const style: React.CSSProperties = {};
  if (span.fg && !span.inverse) style.color = span.fg;
  if (span.bg && !span.inverse) style.backgroundColor = span.bg;
  if (span.inverse) {
    if (span.fg) style.backgroundColor = span.fg;
    if (span.bg) style.color = span.bg;
  }
  if (span.dim) style.opacity = 0.7;
  return (
    <span
      style={style}
      className={cn(
        span.bold && 'font-semibold',
        span.italic && 'italic',
        span.underline && 'underline',
        span.strikethrough && 'line-through',
      )}
    >
      {children}
    </span>
  );
}

/**
 * A single anchor point inside one span's content, sorted by offset so we can
 * emit them in order without slicing the string twice.
 */
interface LineAnchor {
  /** Match start inside the span's content. */
  start: number;
  /** Match end inside the span's content (exclusive). */
  end: number;
  /** Element to render for the match. */
  node: ReactNode;
}

/** Render one output line: ANSI colours applied, then file:line + localhost URLs linkified. */
export function OutputLine({
  line,
  onJump,
  previewBase,
}: {
  line: string;
  onJump(path: string, line: number): void;
  previewBase: PreviewBase | undefined;
}) {
  const spans = useMemo(() => parseAnsi(line), [line]);
  const parts: ReactNode[] = [];

  spans.forEach((span, spanIndex) => {
    // Collect every anchor in this span — file:line refs and localhost URLs
    // together — then splice them into the raw text in order. When two
    // matches overlap (rare, but a URL that ends with a path could look
    // like a file ref) the URL wins because it comes first in insertion
    // order and the overlap filter drops the later one.
    const anchors: LineAnchor[] = [];
    for (const match of detectLocalhostUrls(span.content)) {
      const url = buildSandboxPreviewUrl(match.port, previewBase);
      const target = match.path ? new URL(match.path, url).toString() : url;
      anchors.push({
        start: match.start,
        end: match.start + match.match.length,
        node: (
          <a
            key={`${spanIndex}-url-${match.start}`}
            href={target}
            target="_blank"
            rel="noreferrer"
            className="text-(--term-accent) underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {match.match}
          </a>
        ),
      });
    }
    for (const match of span.content.matchAll(FILE_REF)) {
      const [text, path, lineNumber] = match;
      const start = match.index;
      const end = start + text.length;
      if (anchors.some(a => a.start < end && start < a.end)) continue;
      anchors.push({
        start,
        end,
        node: (
          <button
            key={`${spanIndex}-file-${start}-${text}`}
            type="button"
            onClick={() => onJump(path!, Number(lineNumber))}
            className="text-(--amber-400) underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {text}
          </button>
        ),
      });
    }
    anchors.sort((a, b) => a.start - b.start);

    const inner: ReactNode[] = [];
    let cursor = 0;
    for (const anchor of anchors) {
      if (anchor.start > cursor) inner.push(span.content.slice(cursor, anchor.start));
      inner.push(anchor.node);
      cursor = anchor.end;
    }
    if (cursor < span.content.length) inner.push(span.content.slice(cursor));
    parts.push(
      <AnsiSpanElement key={spanIndex} span={span}>
        {inner.length ? inner : '\u00a0'}
      </AnsiSpanElement>,
    );
  });

  return <div className="break-all whitespace-pre-wrap">{parts.length ? parts : '\u00a0'}</div>;
}

/**
 * Compact chip in the terminal top-strip for each script or detected port —
 * rendered as terminal-tinted link chips rather than DS buttons so the whole
 * strip reads as prompt affordances instead of app UI.
 */
function ChipButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-(--term-accent)/80 hover:text-(--term-accent) hover:bg-(--term-accent)/10 disabled:hover:bg-transparent focus-visible:ring-(--term-accent)/40 shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Minimal icon button styled for the terminal chrome. */
function IconButton({
  onClick,
  disabled,
  ariaLabel,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className="text-(--term-muted) hover:bg-(--term-line) hover:text-(--term-fg) focus-visible:ring-(--term-accent)/40 grid size-6 shrink-0 place-items-center rounded focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/**
 * Compact chip in the runner header for each sandbox-local port that has
 * printed a URL — hovering shows the canonical preview URL, clicking opens
 * it in a new tab. When preview subdomains aren't wired (or when we're on a
 * remote deploy without a parent host) the chip still opens `localhost:PORT`
 * so the click always does *something* useful.
 */
function PreviewChip({ port, previewBase }: { port: number; previewBase: PreviewBase | undefined }) {
  const url = buildSandboxPreviewUrl(port, previewBase);
  const label = `Open preview on port ${port}`;
  const displayUrl = previewBase?.available ? url.replace(/^https?:\/\//, '') : `localhost:${port}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`${label} — ${url}`}
      className="text-(--term-accent)/80 hover:text-(--term-accent) hover:bg-(--term-accent)/10 focus-visible:ring-(--term-accent)/40 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1"
    >
      <ExternalLink size={10} className="shrink-0" />
      <span>:{port}</span>
      <span className="text-(--term-muted) max-w-40 truncate">{displayUrl}</span>
    </a>
  );
}

interface RunnerPanelProps {
  workspacePath: string;
  onJump(path: string, line: number): void;
  onClose(): void;
}

/** Bottom command runner: pick a script or type a command, watch it stream. */
export function RunnerPanel({ workspacePath, onJump, onClose }: RunnerPanelProps) {
  const scripts = useRunnerScripts(workspacePath);
  const previewBaseQuery = useSessionPreviewBase(workspacePath);
  const previewBase = previewBaseQuery.data;
  const start = useRunnerStartMutation();
  const stop = useRunnerStopMutation();
  const [command, setCommand] = useState('');
  // The command echoed in scrollback — the input clears on submit (like a
  // real terminal), so the echo can't read from `command`.
  const [lastCommand, setLastCommand] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const poll = useRunnerStream(workspacePath, runId ?? undefined);
  const running = Boolean(runId && (poll.data ? poll.data.running : true));

  // Persistent command history + in-session navigation cursor. `historyCursor`
  // is null when the user is editing a fresh line; Up/Down move through the
  // past-commands stack and restore the draft when the user reaches the end.
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const draftBeforeHistory = useRef<string>('');

  // Autocomplete popover state. `activeCompletion` is the highlighted row;
  // Escape closes the menu, Tab accepts, Enter runs the completed command.
  const scriptNames = scripts.data?.scripts.map(s => s.name) ?? [];
  const completions = useMemo(
    () => completionCandidates(command, scriptNames, history),
    [command, scriptNames, history],
  );
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);
  useEffect(() => setCompletionIndex(0), [command]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Cleared display state — when the user hits Ctrl+L we don't stop the run,
  // we just hide the accumulated output up to that point.
  const [clearAt, setClearAt] = useState(0);
  const rawOutput = poll.data?.output ?? '';
  const visibleOutput = clearAt > 0 ? rawOutput.slice(clearAt) : rawOutput;

  // Follow the output as it streams unless the user scrolled up.
  const outputRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const el = outputRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [visibleOutput]);

  // Track which sandbox-local ports have printed a listening URL in the
  // visible output. `detectedPorts` is derived (not stored) so it stays
  // consistent with what the user actually sees — clearing the view via
  // Ctrl+L hides the chip until the URL is printed again.
  const detectedPorts = useMemo(() => {
    const seen = new Set<number>();
    for (const line of visibleOutput.split('\n')) {
      for (const found of detectLocalhostUrls(line)) seen.add(found.port);
    }
    return Array.from(seen).sort((a, b) => a - b);
  }, [visibleOutput]);

  async function run(next?: string) {
    const text = (next ?? command).trim();
    if (!text || start.isPending || running) return;
    setStartError(null);
    // Clear the prompt immediately, like a real terminal — the command is
    // echoed into scrollback instead. Restored below if the start fails.
    setCommand('');
    setLastCommand(text);
    setCompletionOpen(false);
    // Push into history unless it's a duplicate of the most recent entry;
    // Zsh-style dedupe keeps the up-arrow list scannable.
    const nextHistory = history[history.length - 1] === text ? history : [...history, text];
    setHistory(nextHistory);
    saveHistory(nextHistory);
    setHistoryCursor(null);
    setClearAt(0);
    try {
      const result = await start.mutateAsync({ workspacePath, command: text });
      setRunId(result.runId);
    } catch (error) {
      setCommand(text);
      setStartError(error instanceof Error ? error.message : 'Could not start the command.');
    }
  }

  function acceptCompletion(candidate: string) {
    setCommand(applyCompletion(command, candidate));
    setCompletionOpen(false);
    setHistoryCursor(null);
    inputRef.current?.focus();
  }

  function stopRun() {
    if (!runId) return;
    stop.mutate({ workspacePath, runId });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Ctrl-U — kill line, like readline. Handles both Ctrl and Cmd for macOS
    // users but stays out of the OS text-edit shortcuts by requiring Ctrl.
    if (event.ctrlKey && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      setCommand('');
      setHistoryCursor(null);
      return;
    }
    // Ctrl-C — send stop when a run is active; otherwise fall through so the
    // browser's own copy shortcut still works when text is selected.
    if (event.ctrlKey && event.key.toLowerCase() === 'c' && running) {
      event.preventDefault();
      stopRun();
      return;
    }
    // Ctrl-L — clear the visible output without touching the run.
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setClearAt(rawOutput.length);
      return;
    }
    if (event.key === 'Escape') {
      if (completionOpen) {
        setCompletionOpen(false);
        return;
      }
      if (command) {
        setCommand('');
        setHistoryCursor(null);
      }
      return;
    }
    if (event.key === 'Tab' && completions.length > 0) {
      event.preventDefault();
      if (completions.length === 1) {
        acceptCompletion(completions[0]!);
      } else {
        setCompletionOpen(true);
      }
      return;
    }
    if (completionOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setCompletionIndex(previous => {
        const next = previous + (event.key === 'ArrowDown' ? 1 : -1);
        return (next + completions.length) % completions.length;
      });
      return;
    }
    if (completionOpen && event.key === 'Enter') {
      event.preventDefault();
      const choice = completions[completionIndex];
      if (choice) acceptCompletion(choice);
      return;
    }
    if (event.key === 'ArrowUp') {
      if (history.length === 0) return;
      event.preventDefault();
      if (historyCursor === null) {
        draftBeforeHistory.current = command;
        setHistoryCursor(history.length - 1);
        setCommand(history[history.length - 1]!);
      } else {
        const next = Math.max(0, historyCursor - 1);
        setHistoryCursor(next);
        setCommand(history[next]!);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      if (historyCursor === null) return;
      event.preventDefault();
      const next = historyCursor + 1;
      if (next >= history.length) {
        setHistoryCursor(null);
        setCommand(draftBeforeHistory.current);
      } else {
        setHistoryCursor(next);
        setCommand(history[next]!);
      }
      return;
    }
    if (event.key === 'Enter' && !completionOpen) {
      event.preventDefault();
      void run();
    }
  }

  const exitCode = poll.data?.exitCode;
  const scriptChips = (scripts.data?.scripts ?? []).slice(0, 6);
  const echoedCommand = poll.data?.command ?? (runId ? lastCommand : '');
  // The terminal palette follows the editor's (only) theme swatch.
  const { swatch } = EDITOR_THEME;

  return (
    <div
      className="runner-terminal border-border flex h-64 shrink-0 flex-col border-t font-mono text-[13px] leading-relaxed"
      style={
        {
          '--term-fg-dark': swatch.dark.fg,
          '--term-accent-dark': swatch.dark.accent,
        } as React.CSSProperties
      }
      data-testid="runner-panel"
    >
      {/* Terminal chrome — tab-bar-like strip with title + chips + actions. */}
      <div className="border-(--term-line) flex shrink-0 items-center gap-1 border-b px-3 py-1">
        <span className="text-(--term-muted) text-[11px] uppercase tracking-widest">terminal</span>
        {scriptChips.length > 0 && (
          <>
            <span className="text-(--term-faint) mx-1">·</span>
            <div className="flex flex-wrap items-center gap-0.5">
              {scriptChips.map(script => (
                <ChipButton
                  key={script.name}
                  title={script.command}
                  disabled={running}
                  onClick={() => void run(`npm run ${script.name}`)}
                >
                  {script.name}
                </ChipButton>
              ))}
            </div>
          </>
        )}
        {detectedPorts.length > 0 && (
          <>
            <span className="text-(--term-faint) mx-1">·</span>
            <div className="flex flex-wrap items-center gap-0.5">
              {detectedPorts.map(port => (
                <PreviewChip key={`preview-${port}`} port={port} previewBase={previewBase} />
              ))}
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {running && (
            <IconButton
              onClick={stopRun}
              disabled={stop.isPending}
              ariaLabel="Stop command (Ctrl+C)"
              title="Stop (Ctrl+C)"
            >
              <Square size={12} />
            </IconButton>
          )}
          <IconButton
            onClick={() => setClearAt(rawOutput.length)}
            disabled={!rawOutput}
            ariaLabel="Clear output (Ctrl+L)"
            title="Clear (Ctrl+L)"
          >
            <Eraser size={12} />
          </IconButton>
          <IconButton onClick={onClose} ariaLabel="Close terminal" title="Close">
            <X size={12} />
          </IconButton>
        </div>
      </div>

      {/* Terminal body — scrollback with the prompt anchored at the bottom of
          the same scroll region, so the input scrolls with output the way a
          real terminal does. */}
      <div
        ref={outputRef}
        onScroll={event => {
          const el = event.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        onClick={event => {
          // Click anywhere in the scrollback to focus the prompt, but let
          // text selection (drag) and inner anchor clicks keep their default.
          if ((event.target as HTMLElement).closest('a, button')) return;
          if (window.getSelection()?.toString()) return;
          inputRef.current?.focus();
        }}
        className="min-h-0 flex-1 cursor-text overflow-y-auto px-3 py-2"
      >
        {startError && (
          <div className="text-(--red-400)">
            <span>✗</span> {startError}
          </div>
        )}
        {runId && (
          <>
            {/* Echo the command that was run at the top, so scrollback reads
                like a normal terminal session: prompt + output + next prompt. */}
            {echoedCommand && (
              <div className="flex items-baseline gap-2">
                <span className="text-(--term-accent) select-none">{PROMPT}</span>
                <span className="whitespace-pre-wrap">{echoedCommand}</span>
              </div>
            )}
            {visibleOutput.split('\n').map((line, index) => (
              <OutputLine key={index} line={line} onJump={onJump} previewBase={previewBase} />
            ))}
            {running ? (
              <div className="text-(--term-muted) flex items-center gap-1.5 pt-0.5 text-[11px]">
                <span className="bg-(--term-accent) inline-block size-1.5 animate-pulse rounded-full" />
                running…
              </div>
            ) : (
              <div className="text-(--term-muted) pt-0.5 text-[11px]">
                <span className={exitCode === 0 ? 'text-(--term-accent)' : 'text-(--red-400)'}>
                  {exitCode === 0 ? '✓' : '✗'}
                </span>{' '}
                exit {exitCode ?? '?'}
              </div>
            )}
          </>
        )}
        {/* Prompt line — always visible at the bottom, inside the scroll
            region so the caret follows the output like tmux/xterm. */}
        <div className="relative flex items-baseline gap-2 pt-1">
          <span className="text-(--term-accent) select-none">{PROMPT}</span>
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              value={command}
              onChange={event => {
                setCommand(event.target.value);
                setHistoryCursor(null);
              }}
              onKeyDown={onKeyDown}
              placeholder={running ? '' : ''}
              spellCheck={false}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={completionOpen}
              aria-label="Terminal command"
              className="caret-(--term-accent) placeholder:text-(--term-faint) w-full bg-transparent font-mono outline-none"
            />
            {completionOpen && completions.length > 0 && (
              <div
                role="listbox"
                className="border-(--term-line) bg-(--term-raised) absolute bottom-full left-0 z-20 mb-1 max-h-56 w-72 max-w-full overflow-auto rounded border py-1 shadow-2xl"
              >
                <div className="border-(--term-line) text-(--term-muted) mb-1 flex items-center justify-between border-b px-2 pb-1 text-[10px] uppercase tracking-wider">
                  <span>Suggestions</span>
                  <span>
                    <kbd className="border-(--term-line) bg-(--term-line) rounded border px-1 font-mono">Tab</kbd>{' '}
                    accept
                  </span>
                </div>
                {completions.map((candidate, index) => (
                  <button
                    key={candidate}
                    type="button"
                    role="option"
                    aria-selected={index === completionIndex}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => acceptCompletion(candidate)}
                    className={cn(
                      'block w-full truncate px-2 py-1 text-left font-mono text-[12px]',
                      index === completionIndex
                        ? 'bg-(--term-accent)/15'
                        : 'text-(--term-muted) hover:bg-(--term-line) hover:text-(--term-fg)',
                    )}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
