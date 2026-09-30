import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Eraser, ExternalLink, Play, Square, TerminalSquare, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { PreviewBase } from '../../../api/types';
import { useSessionPreviewBase } from '../../../hooks/use-preview-base';
import {
  useRunnerPoll,
  useRunnerScripts,
  useRunnerStartMutation,
  useRunnerStopMutation,
} from '../../../hooks/use-runner';
import { buildSandboxPreviewUrl, detectLocalhostUrls } from './preview-url';
import {
  applyCompletion,
  classifyToken,
  completionCandidates,
  loadHistory,
  parseAnsi,
  saveHistory,
  tokenizeCommand,
  type AnsiSpan,
  type TokenKind,
} from './runner-terminal';

/**
 * `path:line[:col]` references in command output — the path must contain a
 * slash and a file extension so bare timestamps and ratios don't match.
 */
const FILE_REF = /((?:[\w.@~-]+\/)+[\w.@~-]+\.\w{1,8}):(\d+)(?::\d+)?/g;

/** Design-system tokens for each token class in the prompt preview. */
const TOKEN_STYLE: Record<TokenKind, string> = {
  command: 'text-foreground font-semibold',
  flag: 'text-notice-warning',
  path: 'text-notice-info',
  string: 'text-notice-success',
  value: 'text-muted-foreground',
};

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
            className="text-notice-success underline decoration-dotted underline-offset-2 hover:decoration-solid"
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
            className="text-notice-info underline decoration-dotted underline-offset-2 hover:decoration-solid"
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

/** Render the current command with per-token syntax highlighting. */
function PromptPreview({ command }: { command: string }) {
  const trimmed = command.trimEnd();
  if (!trimmed) return null;
  const tokens = tokenizeCommand(trimmed);
  return (
    <div className="text-caption pointer-events-none absolute inset-x-0 -top-5 flex gap-1 truncate px-2 font-mono">
      <span className="text-muted-foreground/70">›</span>
      {tokens.map((token, index) => (
        <span key={`${index}-${token}`} className={TOKEN_STYLE[classifyToken(token, index)]}>
          {token}
        </span>
      ))}
    </div>
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
      className="text-meta text-notice-success border-notice-success/30 hover:bg-notice-success/10 flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono"
    >
      <ExternalLink size={10} className="shrink-0" />
      <span className="truncate">:{port}</span>
      <span className="text-muted-foreground/70 max-w-40 truncate">{displayUrl}</span>
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
  const [runId, setRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const poll = useRunnerPoll(workspacePath, runId ?? undefined);
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
    setCommand(text);
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

  return (
    <div className="border-border bg-card flex h-56 shrink-0 flex-col border-t" data-testid="runner-panel">
      <div className="border-border relative flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
        {(scriptChips.length > 0 || detectedPorts.length > 0) && (
          <div className="flex max-w-[45%] shrink-0 flex-wrap items-center gap-1 overflow-hidden">
            {scriptChips.map(script => (
              <button
                key={script.name}
                type="button"
                title={script.command}
                disabled={running}
                onClick={() => void run(`npm run ${script.name}`)}
                className="text-meta text-muted-foreground hover:bg-fill-subtle hover:text-foreground focus-visible:ring-accent3/60 focus-visible:outline-none focus-visible:ring-1 border-border shrink-0 rounded border px-1.5 py-0.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {script.name}
              </button>
            ))}
            {detectedPorts.map(port => (
              <PreviewChip key={`preview-${port}`} port={port} previewBase={previewBase} />
            ))}
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          <PromptPreview command={command} />
          <input
            ref={inputRef}
            value={command}
            onChange={event => {
              setCommand(event.target.value);
              setHistoryCursor(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={running ? 'Waiting for the current command to finish…' : 'Run a command (Tab to complete, ↑ history)'}
            spellCheck={false}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={completionOpen}
            className="text-body-sm placeholder:text-placeholder w-full bg-transparent font-mono outline-none"
          />
          {completionOpen && completions.length > 0 && (
            <div
              role="listbox"
              className="border-border bg-popover absolute bottom-full left-0 z-20 mb-1 max-h-56 w-72 max-w-full overflow-auto rounded-md border py-1 shadow-lg"
            >
              <div className="text-meta text-muted-foreground border-border/50 mb-1 flex items-center justify-between border-b px-2 pb-1">
                <span>Suggestions</span>
                <span>
                  <kbd className="border-border rounded border px-1 font-mono">Tab</kbd> to accept
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
                    'text-caption block w-full truncate px-2 py-1 text-left font-mono',
                    index === completionIndex
                      ? 'bg-accent3/15 text-foreground'
                      : 'text-muted-foreground hover:bg-fill-subtle hover:text-foreground',
                  )}
                >
                  {candidate}
                </button>
              ))}
            </div>
          )}
        </div>
        {running ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Stop command (Ctrl+C)"
            title="Stop command (Ctrl+C)"
            disabled={stop.isPending}
            onClick={stopRun}
          >
            <Square size={14} />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Run command"
            title="Run command (Enter)"
            disabled={!command.trim() || start.isPending}
            onClick={() => void run()}
          >
            {start.isPending ? <Spinner className="size-4" /> : <Play size={14} />}
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Clear output"
          title="Clear output (Ctrl+L)"
          disabled={!rawOutput}
          onClick={() => setClearAt(rawOutput.length)}
        >
          <Eraser size={14} />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Close runner" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
      <div
        ref={outputRef}
        onScroll={event => {
          const el = event.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="text-caption min-h-0 flex-1 overflow-y-auto px-2 py-1.5 font-mono"
      >
        {!runId ? (
          <div className="grid h-full place-items-center px-3">
            {startError ? (
              <Txt variant="caption" className="text-notice-destructive text-center">
                {startError}
              </Txt>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                <TerminalSquare size={20} className="opacity-40" aria-hidden />
                <Txt variant="caption" className="text-muted-foreground">
                  Output shows here. file:line refs and localhost URLs are clickable.
                </Txt>
                <div className="text-meta text-muted-foreground/80 flex items-center gap-3">
                  <span>
                    <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">Tab</kbd> complete
                  </span>
                  <span>
                    <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">↑</kbd> history
                  </span>
                  <span>
                    <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">Ctrl+L</kbd> clear
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {visibleOutput.split('\n').map((line, index) => (
              <OutputLine key={index} line={line} onJump={onJump} previewBase={previewBase} />
            ))}
            <div
              className={cn(
                'text-meta pt-1',
                running
                  ? 'text-muted-foreground'
                  : exitCode === 0
                    ? 'text-notice-success'
                    : 'text-notice-destructive',
              )}
            >
              {running ? (
                <span className="flex items-center gap-1.5">
                  <Spinner className="size-3" /> Running {poll.data?.command ?? command}…
                </span>
              ) : (
                `Exited with code ${exitCode ?? '?'}.`
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
