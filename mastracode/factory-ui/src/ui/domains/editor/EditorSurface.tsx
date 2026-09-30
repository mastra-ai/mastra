import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  AlertTriangle,
  ChevronRight,
  Diff,
  FolderTree,
  GitBranch,
  History,
  ListTree,
  Quote,
  Save,
  Search,
  Settings,
  TerminalSquare,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useParams, useSearchParams } from 'react-router';

import {
  useEditorFile,
  useEditorFileOriginal,
  useEditorLspQuery,
  useEditorTree,
  useSaveEditorFile,
} from '../../../hooks/use-editor';
import type { EditorLspQueryKind, EditorLspSymbol } from '../../../api/types';
import { useWorkspaceChanges } from '../../../hooks/use-fs';
import { useThreadWorkItem } from '../../../hooks/useThreadWorkItem';
import { useChatSessionContext } from '../chat/context/useChatSessionContext';

import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../api/keys';
import type { EditorLspCodeAction } from '../../../api/types';

import { CodeMirrorSurface, type CodeMirrorApi, type LineRange } from './CodeMirrorSurface';
import { PierreFileSurface } from './PierreFileSurface';
import type { CodeLensAction, CodeLensEntry } from './editor-code-lens';
import { EditorContextMenu } from './EditorContextMenu';
import { EditorTabs } from './EditorTabs';
import { EditorSettingsDialog } from './EditorSettingsDialog';
import { loadEditorSettings, saveEditorSettings, type EditorSettings } from './editor-settings';
import { editorThemeStyle, loadEditorTheme, saveEditorTheme, type EditorThemeId } from './editor-themes';
import { QuickOpenDialog, type QuickOpenCommand } from './QuickOpenDialog';
import { useAgentActiveFiles } from './use-agent-activity';
import { useBlame } from '../../../hooks/use-blame';
import { useEditorCollab } from './use-editor-collab';
import { FileTree } from './FileTree';
import { OutlinePanel } from './OutlinePanel';
import { ReferencesPanel, type ReferencesResult } from './ReferencesPanel';
import { RunnerPanel } from './RunnerPanel';
import { ScmPanel } from './ScmPanel';
import { SearchPanel } from './SearchPanel';
import { SendSelectionBar } from './SendSelectionBar';
import { useEditorBufferActions, useEditorBuffers, type PendingSelection } from './buffers';

type LeftTab = 'files' | 'search' | 'outline' | 'scm' | 'refs';

type GotoKind = Extract<EditorLspQueryKind, 'definition' | 'typeDefinition' | 'implementation'>;

/** Symbol kinds worth a code lens — things an agent can meaningfully act on. */
const LENS_KINDS = new Set(['function', 'method', 'constructor', 'class', 'interface', 'enum', 'struct']);

const LENS_PROMPTS: Record<CodeLensAction, (name: string) => string> = {
  explain: name => `Explain what \`${name}\` does and how it fits into the codebase.`,
  refactor: name => `Refactor \`${name}\` to improve clarity and structure without changing behavior.`,
  tests: name => `Add tests covering \`${name}\`, including edge cases.`,
};

/** Parse a `lines` query param of the form `12` or `12-40` (1-indexed). */
function parseLinesParam(raw: string | null): LineRange | null {
  if (!raw) return null;
  const match = /^(\d+)(?:-(\d+))?$/.exec(raw.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isFinite(start) || start < 1) return null;
  return { start, end: Math.max(start, end) };
}

function formatLinesParam(range: { startLine: number; endLine: number }): string {
  return range.startLine === range.endLine ? `${range.startLine}` : `${range.startLine}-${range.endLine}`;
}

/** Icon-only toggle/action button for the editor header, labelled via tooltip. */
function HeaderIconButton({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  pressed: boolean;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            aria-label={label}
            disabled={disabled}
            className={cn(
              'focus-visible:ring-accent3/60 grid size-7 place-items-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-1',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
              pressed
                ? 'bg-fill text-foreground'
                : 'text-muted-foreground hover:bg-fill-subtle hover:text-foreground',
            )}
          >
            {icon}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface EditorSurfaceProps {
  workspacePath: string;
  threadId?: string;
}

/**
 * The editor tab of the session view. Fills the chat stage when the URL
 * carries `?view=editor`. File and selection state round-trip through query
 * params so any editor position is a shareable permalink:
 *
 *   ?view=editor&file=src/foo.ts&lines=10-24
 *
 * Send-to-agent reuses the surrounding chat session context, so the composer
 * dispatches as a steer while a run is live and as a new message otherwise.
 */
export function EditorSurface({ workspacePath, threadId }: EditorSurfaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { resourceId, projectPath, baseUrl } = useChatSessionContext();

  const [leftTab, setLeftTab] = useState<LeftTab>('files');

  const buffers = useEditorBuffers();
  const actions = useEditorBufferActions();
  const activePath = buffers.activePath;

  const activeBuffer = activePath ? buffers.buffers[activePath] : undefined;

  const tree = useEditorTree(workspacePath);
  const changes = useWorkspaceChanges(workspacePath, { enabled: true });
  // While a buffer has unsaved edits, poll the disk copy — if the agent (or
  // anything else) rewrites the file underneath, we surface it as drift.
  const activeFile = useEditorFile(workspacePath, activePath ?? undefined, {
    pollMs: activeBuffer?.dirty ? 3000 : undefined,
  });
  const saveMutation = useSaveEditorFile();

  // Absolute paths are LSP go-to results outside the checkout (node_modules
  // through the npx cache, the TypeScript stdlib…). They're served by the
  // read-only library route: no saving, no git diff, no further LSP queries.
  const activeIsExternal = Boolean(activePath?.startsWith('/'));

  // ── Inline diff (unified merge view against git HEAD) ────────────────────
  const [diffMode, setDiffMode] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [blameEnabled, setBlameEnabled] = useState(false);
  const blameQuery = useBlame(workspacePath, activePath ?? undefined, {
    enabled: blameEnabled && !activeIsExternal,
  });
  const blameLines = blameEnabled && blameQuery.data?.available ? blameQuery.data.lines : null;
  const original = useEditorFileOriginal(workspacePath, activePath ?? undefined, {
    enabled: diffMode && !activeIsExternal,
  });
  const diffOriginal =
    diffMode && !activeIsExternal && original.data ? (original.data.exists ? original.data.content : '') : null;

  // ── Session-aware auto-open ──────────────────────────────────────────────
  // Review sessions (the thread's work item sits on the review board) open
  // every changed file so the reviewer can tab through the PR. Other sessions
  // open only files with uncommitted edits — the work in flight.
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const workItem = useThreadWorkItem(factoryId, threadId, sessionId);
  const isReview = workItem.data?.board === 'review';
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!changes.data?.available) return;
    // In a factory context, wait for the board so review sessions are
    // recognized before we pick which set to open.
    if (factoryId && workItem.isPending) return;
    autoOpenedRef.current = true;

    const openable = changes.data.changes.filter(entry => entry.status !== 'deleted' && !entry.binary);
    const targets = isReview ? openable : openable.filter(entry => entry.uncommitted);
    if (!targets.length) return;

    const previouslyActive = buffers.activePath;
    for (const entry of targets.slice(0, 20)) actions.open(entry.path);
    // A permalinked file stays the active tab; auto-opened files sit behind it.
    if (previouslyActive) actions.setActive(previouslyActive);
    if (isReview) setDiffMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes.data, workItem.isPending, isReview, factoryId]);

  // ── Permalink: apply ?file= / ?lines= once on mount ──────────────────────
  // A "jump" is a one-shot line-range target for a specific file. It comes
  // from the URL on first mount or from clicking a search match, and it is
  // cleared as soon as the user moves to another file so stale jumps never
  // re-apply.
  const appliedPermalinkRef = useRef(false);
  const [jump, setJump] = useState<{ path: string; range: LineRange } | null>(null);
  useEffect(() => {
    if (appliedPermalinkRef.current) return;
    appliedPermalinkRef.current = true;
    const file = searchParams.get('file');
    if (!file) return;
    const range = parseLinesParam(searchParams.get('lines'));
    if (range) setJump({ path: file, range });
    actions.open(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (jump && activePath !== jump.path) setJump(null);
  }, [jump, activePath]);

  function openFile(path: string, line?: number) {
    setJump(line ? { path, range: { start: line, end: line } } : null);
    actions.open(path);
  }

  // ── Permalink: reflect active file + selection back into the URL ─────────
  // `exitingRef` stops this sync once we've navigated back to the chat view:
  // clearing the selection re-renders before the exit navigation applies, and
  // without the guard this effect would queue a write computed from the stale
  // params — re-adding `view=editor` and undoing the exit.
  const exitingRef = useRef(false);
  const pendingSelection = buffers.pendingSelection;
  useEffect(() => {
    if (!appliedPermalinkRef.current || exitingRef.current) return;
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (activePath) next.set('file', activePath);
        else next.delete('file');
        if (pendingSelection && pendingSelection.path === activePath) {
          next.set('lines', formatLinesParam(pendingSelection));
        } else {
          next.delete('lines');
        }
        return next;
      },
      { replace: true },
    );
  }, [activePath, pendingSelection, setSearchParams]);

  // Fold server content into a per-buffer baseline for dirty tracking.
  const baseline = activeFile.data?.content ?? '';
  const draftContent = activePath ? buffers.buffers[activePath]?.draft : undefined;
  const editorContent = draftContent ?? baseline;

  useEffect(() => {
    if (!activePath) return;
    const buffer = buffers.buffers[activePath];
    const content = activeFile.data?.content;
    if (buffer && buffer.draft === undefined && content !== undefined) {
      // First load — seed the buffer with server content so subsequent
      // reloads compare against a stable baseline.
      actions.updateDraft(activePath, content, content);
      actions.markClean(activePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, activeFile.data?.content]);

  function handleSave() {
    if (!activePath || activeIsExternal) return;
    void (async () => {
      let content = buffers.buffers[activePath]?.draft ?? '';
      if (settings.formatOnSave) {
        const response = await lspQuery({
          path: activePath,
          line: 1,
          character: 1,
          kind: 'formatting',
          content,
        });
        const edits = response?.edits ?? [];
        if (edits.length && editorApiRef.current) {
          // Dispatching is synchronous, so the buffer content is fresh right
          // after — persist exactly what's on screen.
          editorApiRef.current.applyTextEdits(edits);
          content = editorApiRef.current.content();
        }
      }
      await saveMutation.mutateAsync({ workspacePath, path: activePath, content });
      actions.markClean(activePath);
    })();
  }

  function handleSelection(payload: { startLine: number; endLine: number; snippet: string } | null) {
    if (!activePath) return;
    // Manual selections write their own composer draft — drop any lens prompt.
    setLensPrompt(null);
    if (!payload) {
      actions.setSelection(null);
      return;
    }
    const next: PendingSelection = { path: activePath, ...payload };
    actions.setSelection(next);
  }

  // ── Theme + settings ─────────────────────────────────────────────────────
  const [editorTheme, setEditorTheme] = useState<EditorThemeId>(loadEditorTheme);
  const [settings, setSettings] = useState<EditorSettings>(loadEditorSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  function selectTheme(id: EditorThemeId) {
    setEditorTheme(id);
    saveEditorTheme(id);
  }
  function updateSettings(next: EditorSettings) {
    setSettings(next);
    saveEditorSettings(next);
  }

  // ── Agent activity: which files a running tool call is touching ─────────
  const agentActivity = useAgentActiveFiles();

  // ── Multiplayer: join the active file's collab room (HTTP-polled Yjs) ────
  const collab = useEditorCollab(
    workspacePath,
    activePath ?? undefined,
    !activeIsExternal && settings.multiplayer,
    settings.displayName,
  );

  // Opt-in Pierre editor surface via `?editor=pierre`. Default stays on the
  // CodeMirror path until Pierre reaches feature parity (hover, autocomplete,
  // collab remote-cursor rendering all still to wire).
  const usePierreEditor = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('editor') === 'pierre';
  }, []);

  // Pierre surface uses its own polled LSP diagnostics fetch instead of the
  // in-editor lint extension. Leaving null keeps markers off until wired.
  const diagnostics = null;

  // ── LSP: hover + go-to commands ──────────────────────────────────────────
  const lspQuery = useEditorLspQuery(workspacePath);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; line: number; character: number } | null>(
    null,
  );
  const [lspBusy, setLspBusy] = useState(false);

  // Transient status pill over the editor for LSP outcomes that don't
  // navigate — "no definition found" etc. must be visible, not silent.
  const [lspNotice, setLspNotice] = useState<string | null>(null);
  const lspNoticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function showLspNotice(text: string) {
    clearTimeout(lspNoticeTimer.current);
    setLspNotice(text);
    lspNoticeTimer.current = setTimeout(() => setLspNotice(null), 3500);
  }
  useEffect(() => () => clearTimeout(lspNoticeTimer.current), []);

  const GOTO_LABELS: Record<GotoKind, string> = {
    definition: 'definition',
    typeDefinition: 'type definition',
    implementation: 'implementation',
  };

  async function goTo(kind: GotoKind, position: { line: number; character: number }) {
    if (!activePath) return;
    if (activeIsExternal) {
      showLspNotice('Code intelligence isn’t available in read-only library files.');
      return;
    }
    setLspBusy(true);
    try {
      const response = await lspQuery({
        path: activePath,
        line: position.line,
        character: position.character,
        kind,
        content: editorContent,
      });
      const label = GOTO_LABELS[kind];
      if (!response) {
        showLspNotice('Code intelligence request failed.');
        return;
      }
      if (!response.available) {
        showLspNotice('Code intelligence isn’t available for this workspace.');
        return;
      }
      const locations = response.locations ?? [];
      if (!locations.length) {
        showLspNotice(`No ${label} found.`);
        return;
      }
      // Prefer in-workspace results; external hits (node_modules, stdlib
      // outside the checkout) open read-only through the library route.
      const target = locations.find(location => !location.external) ?? locations[0];
      if (!target) {
        showLspNotice(`No ${label} found.`);
        return;
      }
      openFile(target.path, target.line);
    } finally {
      setLspBusy(false);
    }
  }

  // ── Refactoring: rename symbol, quick fixes, format document ────────────
  const queryClient = useQueryClient();
  const editorApiRef = useRef<CodeMirrorApi | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<{
    line: number;
    character: number;
    currentName: string;
    value: string;
  } | null>(null);
  const [actionsMenu, setActionsMenu] = useState<{ x: number; y: number; actions: EditorLspCodeAction[] } | null>(
    null,
  );

  function startRename(position: { line: number; character: number }) {
    if (!activePath || activeIsExternal) return;
    const currentName = editorApiRef.current?.wordAt(position);
    if (!currentName) {
      showLspNotice('Place the cursor on a symbol to rename it.');
      return;
    }
    setRenamePrompt({ ...position, currentName, value: currentName });
  }

  async function performRename(prompt: NonNullable<typeof renamePrompt>) {
    setRenamePrompt(null);
    const newName = prompt.value.trim();
    if (!activePath || !newName || newName === prompt.currentName) return;
    setLspBusy(true);
    try {
      // The server applies rename edits to files on disk, so the buffer must
      // match disk before we ask — flush any unsaved edits first.
      if (activeBuffer?.dirty) {
        await saveMutation.mutateAsync({ workspacePath, path: activePath, content: editorContent });
        actions.markClean(activePath);
      }
      const response = await lspQuery({
        path: activePath,
        line: prompt.line,
        character: prompt.character,
        kind: 'rename',
        newName,
        content: editorContent,
      });
      if (!response?.available) {
        showLspNotice('Code intelligence isn’t available for this workspace.');
        return;
      }
      const files = response.rename?.files ?? [];
      if (!files.length) {
        showLspNotice(`Nothing to rename here.`);
        return;
      }
      // The server already rewrote every file on disk; mirror the current
      // file's edits into the open buffer so it matches disk immediately.
      if (response.edits?.length) {
        editorApiRef.current?.applyTextEdits(response.edits);
        actions.markClean(activePath);
      }
      for (const file of files) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.editorFile(workspacePath, file.path) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) });
      const skipped = files.filter(file => !file.applied && file.path !== activePath).length;
      showLspNotice(
        `Renamed to ${newName} in ${files.length} file${files.length === 1 ? '' : 's'}${skipped ? ` (${skipped} read-only skipped)` : ''}.`,
      );
    } finally {
      setLspBusy(false);
    }
  }

  async function quickFix(position: { x: number; y: number; line: number; character: number }) {
    if (!activePath || activeIsExternal) return;
    setLspBusy(true);
    try {
      const response = await lspQuery({
        path: activePath,
        line: position.line,
        character: position.character,
        kind: 'codeActions',
        content: editorContent,
      });
      if (!response?.available) {
        showLspNotice('Code intelligence isn’t available for this workspace.');
        return;
      }
      const available = (response.actions ?? []).filter(action => action.edits.length > 0);
      if (!available.length) {
        showLspNotice('No quick fixes here.');
        return;
      }
      setActionsMenu({ x: position.x, y: position.y, actions: available });
    } finally {
      setLspBusy(false);
    }
  }

  async function formatDocument() {
    if (!activePath || activeIsExternal) return;
    setLspBusy(true);
    try {
      const response = await lspQuery({
        path: activePath,
        line: 1,
        character: 1,
        kind: 'formatting',
        content: editorContent,
      });
      if (!response?.available) {
        showLspNotice('Code intelligence isn’t available for this workspace.');
        return;
      }
      const edits = response.edits ?? [];
      if (!edits.length) {
        showLspNotice('Already formatted.');
        return;
      }
      editorApiRef.current?.applyTextEdits(edits);
      showLspNotice('Formatted document.');
    } finally {
      setLspBusy(false);
    }
  }

  // ── Disk drift: someone rewrote the file we're editing ──────────────────
  // While the buffer is dirty the file query polls; if disk stops matching
  // the baseline our edits are based on, the agent (or another editor) has
  // touched the same file and the user picks how to resolve it.
  const diskContent = activeFile.data?.content;
  const [driftMerge, setDriftMerge] = useState(false);
  const drifted = Boolean(
    activePath &&
      !activeIsExternal &&
      activeBuffer?.dirty &&
      activeBuffer.baseline !== undefined &&
      diskContent !== undefined &&
      diskContent !== activeBuffer.baseline,
  );
  useEffect(() => {
    if (!drifted) setDriftMerge(false);
  }, [drifted]);

  function takeTheirs() {
    if (!activePath || diskContent === undefined) return;
    editorApiRef.current?.replaceContent(diskContent);
    actions.replaceDraft(activePath, diskContent);
    setDriftMerge(false);
  }

  function keepMine() {
    if (!activePath || diskContent === undefined) return;
    actions.rebase(activePath, diskContent);
    setDriftMerge(false);
  }

  // Clean buffers simply follow disk — agent edits appear as soon as the
  // query refreshes, no ceremony needed.
  useEffect(() => {
    if (!activePath || activeIsExternal || diskContent === undefined) return;
    const buffer = buffers.buffers[activePath];
    if (!buffer || buffer.baseline === undefined || buffer.dirty) return;
    if (diskContent === buffer.baseline) return;
    editorApiRef.current?.replaceContent(diskContent);
    actions.replaceDraft(activePath, diskContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, activeIsExternal, diskContent]);

  // ── References + outline (document symbols) ─────────────────────────────
  const [references, setReferences] = useState<ReferencesResult | null>(null);
  const [symbols, setSymbols] = useState<EditorLspSymbol[] | null>(null);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [cursorLine, setCursorLine] = useState<number | null>(null);

  async function findReferences(position: { line: number; character: number }) {
    if (!activePath || activeIsExternal) return;
    const symbol = editorApiRef.current?.wordAt(position) ?? 'symbol';
    setLspBusy(true);
    try {
      const response = await lspQuery({
        path: activePath,
        line: position.line,
        character: position.character,
        kind: 'references',
        content: editorContent,
      });
      if (!response?.available) {
        showLspNotice('Code intelligence isn’t available for this workspace.');
        return;
      }
      const locations = response.locations ?? [];
      if (!locations.length) {
        showLspNotice('No references found.');
        return;
      }
      setReferences({ symbol, locations });
      setLeftTab('refs');
    } finally {
      setLspBusy(false);
    }
  }

  function clearReferences() {
    setReferences(null);
    setLeftTab('files');
  }

  // Symbols back both the Outline tab and the breadcrumb bar, so they refresh
  // whenever the active file (or its saved baseline) changes — not just when
  // the Outline tab is visible.
  const symbolsSeqRef = useRef(0);
  useEffect(() => {
    setCursorLine(null);
    if (!activePath || activeIsExternal) {
      setSymbols(null);
      setSymbolsLoading(false);
      return;
    }
    const seq = ++symbolsSeqRef.current;
    setSymbolsLoading(true);
    void (async () => {
      const response = await lspQuery({ path: activePath, line: 1, character: 1, kind: 'symbols' });
      if (symbolsSeqRef.current !== seq) return;
      setSymbols(response?.available ? (response.symbols ?? []) : null);
      setSymbolsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, activeIsExternal, baseline]);

  // The symbol chain enclosing the cursor, innermost last.
  const breadcrumbs = useMemo(() => {
    if (!symbols || cursorLine === null) return [];
    const chain: EditorLspSymbol[] = [];
    let level: EditorLspSymbol[] | undefined = symbols;
    while (level) {
      const hit: EditorLspSymbol | undefined = level.find(
        symbol => symbol.line <= cursorLine && cursorLine <= symbol.endLine,
      );
      if (!hit) break;
      chain.push(hit);
      level = hit.children;
    }
    return chain;
  }, [symbols, cursorLine]);

  // ── Agent code lenses: Explain / Refactor / Add tests above symbols ─────
  const codeLenses = useMemo(() => {
    if (!symbols || activeIsExternal) return [];
    const out: CodeLensEntry[] = [];
    const walk = (list: EditorLspSymbol[], depth: number) => {
      for (const symbol of list) {
        if (LENS_KINDS.has(symbol.kind)) {
          out.push({ line: symbol.line, endLine: symbol.endLine, name: symbol.name, kind: symbol.kind });
        }
        // Top-level symbols and their direct members (class methods) only —
        // deeper nesting turns the file into a button farm.
        if (depth < 1 && symbol.children) walk(symbol.children, depth + 1);
      }
    };
    walk(symbols, 0);
    return out.slice(0, 100);
  }, [symbols, activeIsExternal]);

  // A lens action pre-fills the send-to-agent composer with the symbol's
  // source and a task; the user edits or just hits Enter.
  const [lensPrompt, setLensPrompt] = useState<string | null>(null);
  function handleLensAction(action: CodeLensAction, entry: CodeLensEntry) {
    if (!activePath) return;
    const lines = editorContent.split('\n');
    const snippet = lines.slice(entry.line - 1, entry.endLine).join('\n');
    setLensPrompt(LENS_PROMPTS[action](entry.name));
    actions.setSelection({ path: activePath, startLine: entry.line, endLine: entry.endLine, snippet });
  }

  // ── Quick open (Cmd+P) + command palette (Cmd+Shift+P) ──────────────────
  const [quickOpen, setQuickOpen] = useState<'files' | 'commands' | null>(null);
  const quickOpenFiles = useMemo(
    () => (tree.data?.entries ?? []).filter(entry => entry.type === 'file').map(entry => entry.path),
    [tree.data?.entries],
  );
  const paletteCommands: QuickOpenCommand[] = [
    { id: 'save', label: 'Save File', hint: '⌘S', run: handleSave },
    { id: 'format', label: 'Format Document', hint: '⇧⌥F', run: () => void formatDocument() },
    {
      id: 'rename',
      label: 'Rename Symbol',
      hint: 'F2',
      run: () => {
        const cursor = editorApiRef.current?.cursor();
        if (cursor) startRename(cursor);
      },
    },
    {
      id: 'goto-definition',
      label: 'Go to Definition',
      hint: 'F12',
      run: () => {
        const cursor = editorApiRef.current?.cursor();
        if (cursor) void goTo('definition', cursor);
      },
    },
    {
      id: 'find-references',
      label: 'Find All References',
      hint: '⇧F12',
      run: () => {
        const cursor = editorApiRef.current?.cursor();
        if (cursor) void findReferences(cursor);
      },
    },
    { id: 'show-outline', label: 'Show Outline', run: () => setLeftTab('outline') },
    { id: 'show-scm', label: 'Show Source Control', run: () => setLeftTab('scm') },
    { id: 'toggle-diff', label: 'Toggle Inline Diff', run: () => setDiffMode(previous => !previous) },
    { id: 'toggle-runner', label: 'Toggle Command Runner', run: () => setRunnerOpen(previous => !previous) },
    { id: 'toggle-blame', label: 'Toggle Git Blame', run: () => setBlameEnabled(previous => !previous) },
    { id: 'settings', label: 'Editor Settings', run: () => setSettingsOpen(true) },
    { id: 'show-files', label: 'Show Files Sidebar', run: () => setLeftTab('files') },
    { id: 'search-files', label: 'Search in Files', run: () => setLeftTab('search') },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'p') return;
      event.preventDefault();
      setQuickOpen(event.shiftKey ? 'commands' : 'files');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col" data-testid="editor-surface">
      <PanelGroup direction="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={22} minSize={15}>
          <div className="border-border bg-card flex h-full min-h-0 flex-col border-r">
            <div className="border-border flex h-9 shrink-0 items-center gap-1 border-b px-1">
              <HeaderIconButton
                label="Files"
                pressed={leftTab === 'files'}
                onClick={() => setLeftTab('files')}
                icon={<FolderTree className="size-4" />}
              />
              <HeaderIconButton
                label="Search"
                pressed={leftTab === 'search'}
                onClick={() => setLeftTab('search')}
                icon={<Search className="size-4" />}
              />
              <HeaderIconButton
                label="Outline"
                pressed={leftTab === 'outline'}
                onClick={() => setLeftTab('outline')}
                icon={<ListTree className="size-4" />}
              />
              <HeaderIconButton
                label="Source control"
                pressed={leftTab === 'scm'}
                onClick={() => setLeftTab('scm')}
                icon={<GitBranch className="size-4" />}
              />
              {references && (
                <HeaderIconButton
                  label={`References to ${references.symbol}`}
                  pressed={leftTab === 'refs'}
                  onClick={() => setLeftTab('refs')}
                  icon={<Quote className="size-4" />}
                />
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-1">
              {leftTab === 'files' && tree.data ? (
                <FileTree
                  entries={tree.data.entries}
                  activePath={activePath}
                  onOpen={path => openFile(path)}
                  activity={agentActivity}
                />
              ) : leftTab === 'search' ? (
                <SearchPanel workspacePath={workspacePath} onOpen={openFile} />
              ) : leftTab === 'outline' ? (
                activePath ? (
                  <OutlinePanel
                    symbols={symbols}
                    loading={symbolsLoading}
                    activeLine={cursorLine}
                    onJump={line => activePath && openFile(activePath, line)}
                  />
                ) : (
                  <div className="text-caption text-muted-foreground px-2 py-3">Open a file to see its outline.</div>
                )
              ) : leftTab === 'scm' ? (
                <ScmPanel
                  workspacePath={workspacePath}
                  onOpen={path => {
                    openFile(path);
                    setDiffMode(true);
                  }}
                />
              ) : leftTab === 'refs' && references ? (
                <ReferencesPanel result={references} onOpen={openFile} onClear={clearReferences} />
              ) : (
                <div className="text-caption text-muted-foreground flex items-center gap-2 p-3">
                  {tree.isFetching ? (
                    <>
                      <Spinner className="size-3.5" /> Loading tree…
                    </>
                  ) : (
                    'No files.'
                  )}
                </div>
              )}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="bg-border hover:bg-border-hover data-[resize-handle-state=drag]:bg-accent3 w-px transition-colors" />
        <Panel minSize={30}>
          <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
            <EditorTabs
              openPaths={buffers.openPaths}
              activePath={activePath}
              buffers={buffers.buffers}
              onSelect={actions.setActive}
              onClose={actions.close}
              isAgentActive={agentActivity.isActiveFile}
              trailing={
                <>
                  <HeaderIconButton
                    label={blameEnabled ? 'Hide git blame' : 'Show git blame'}
                    pressed={blameEnabled}
                    disabled={!activePath || activeIsExternal}
                    onClick={() => setBlameEnabled(previous => !previous)}
                    icon={<History className="size-4" />}
                  />
                  <HeaderIconButton
                    label={
                      activeIsExternal
                        ? 'Read-only library file'
                        : diffMode
                          ? 'Hide inline diff'
                          : 'Show inline diff'
                    }
                    pressed={diffMode && !activeIsExternal}
                    disabled={!activePath || activeIsExternal}
                    onClick={() => setDiffMode(previous => !previous)}
                    icon={<Diff className="size-4" />}
                  />
                  <HeaderIconButton
                    label={
                      activeIsExternal
                        ? 'Read-only library file'
                        : saveMutation.isPending
                          ? 'Saving…'
                          : activeBuffer?.dirty
                            ? 'Save (⌘S)'
                            : 'Save — no unsaved changes'
                    }
                    pressed={false}
                    disabled={activeIsExternal || !activeBuffer?.dirty || saveMutation.isPending}
                    onClick={handleSave}
                    icon={saveMutation.isPending ? <Spinner className="size-4" /> : <Save className="size-4" />}
                  />
                  <span className="bg-border mx-1 h-4 w-px" aria-hidden />
                  <HeaderIconButton
                    label={runnerOpen ? 'Hide command runner' : 'Command runner'}
                    pressed={runnerOpen}
                    onClick={() => setRunnerOpen(previous => !previous)}
                    icon={<TerminalSquare className="size-4" />}
                  />
                  <HeaderIconButton
                    label="Editor settings"
                    pressed={settingsOpen}
                    onClick={() => setSettingsOpen(true)}
                    icon={<Settings className="size-4" />}
                  />
                </>
              }
            />
            {activePath && breadcrumbs.length > 0 && (
              <nav
                aria-label="Symbol path"
                className="border-border bg-card text-caption text-muted-foreground flex h-7 shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap border-b px-2"
              >
                <span className="text-foreground/90 shrink-0 truncate font-medium">{activePath.split('/').pop()}</span>
                {breadcrumbs.map((symbol, index) => (
                  <span key={`${symbol.name}-${symbol.line}-${index}`} className="flex min-w-0 items-center gap-1">
                    <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
                    <button
                      type="button"
                      onClick={() => openFile(activePath, symbol.line)}
                      title={`${symbol.kind} · line ${symbol.line}`}
                      className="hover:text-foreground focus-visible:ring-accent3/60 focus-visible:outline-none focus-visible:ring-1 truncate rounded px-1"
                    >
                      {symbol.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            {drifted && (
              <div
                role="alert"
                className="border-notice-warning/40 bg-notice-warning/5 flex h-9 shrink-0 items-center gap-2 border-b px-3"
              >
                <AlertTriangle className="text-notice-warning size-4 shrink-0" aria-hidden />
                <span className="text-caption text-foreground min-w-0 truncate">
                  This file changed on disk while you were editing.
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={driftMerge ? 'default' : 'ghost'}
                    onClick={() => setDriftMerge(previous => !previous)}
                  >
                    {driftMerge ? 'Hide comparison' : 'Compare'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Discard your local edits and load the disk version"
                    onClick={takeTheirs}
                    className="text-notice-destructive hover:text-notice-destructive"
                  >
                    Take theirs
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title="Keep your edits — next save will overwrite the disk version"
                    onClick={keepMine}
                  >
                    Keep mine
                  </Button>
                </div>
              </div>
            )}
            <div
              className="bg-background relative min-h-0 flex-1"
              data-editor-theme={editorTheme}
              style={editorThemeStyle(editorTheme)}
            >
              {lspNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-popover/95 border-border text-caption text-foreground absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1.5 shadow-lg backdrop-blur-sm"
                >
                  {lspNotice}
                </div>
              )}
              <div className="pointer-events-none absolute right-3 top-2 z-10 flex items-center gap-2">
                {collab.peers.length > 0 && (
                  <div
                    className="pointer-events-auto flex items-center -space-x-1.5"
                    aria-label={`${collab.peers.length} peer${collab.peers.length === 1 ? '' : 's'} editing`}
                  >
                    {collab.peers.slice(0, 4).map(peer => (
                      <Tooltip key={peer.clientId}>
                        <TooltipTrigger
                          render={
                            <span
                              className="bg-card grid size-5 place-items-center rounded-full border-2 text-[9px] font-semibold uppercase shadow-sm"
                              style={{ color: peer.color, borderColor: peer.color }}
                            >
                              {peer.name.slice(0, 1)}
                            </span>
                          }
                        />
                        <TooltipContent>{peer.name} is editing with you</TooltipContent>
                      </Tooltip>
                    ))}
                    {collab.peers.length > 4 && (
                      <span className="bg-card border-border text-meta text-muted-foreground grid size-5 place-items-center rounded-full border-2 font-semibold">
                        +{collab.peers.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {activeIsExternal && (
                  <div className="pointer-events-auto bg-card/95 border-border text-meta text-muted-foreground rounded-md border px-2 py-0.5 backdrop-blur-sm">
                    Read-only · library file
                  </div>
                )}
              </div>
              {activePath ? (
                activeFile.isPending ? (
                  <div className="grid h-full place-items-center">
                    <div className="text-caption text-muted-foreground flex flex-col items-center gap-2">
                      <Spinner aria-label="Loading file" className="size-5" />
                      <span>Loading {activePath.split('/').pop()}…</span>
                    </div>
                  </div>
                ) : activeFile.isError ? (
                  <div className="text-body-sm text-notice-destructive grid h-full place-items-center px-4 text-center">
                    Couldn’t load {activePath}: {activeFile.error instanceof Error ? activeFile.error.message : 'unknown error'}
                  </div>
                ) : activeFile.data?.contentType === 'unsupported' ? (
                  <div className="text-body-sm text-muted-foreground grid h-full place-items-center px-4 text-center">
                    Binary or oversized file — can’t edit here.
                  </div>
                ) : usePierreEditor ? (
                  <PierreFileSurface
                    path={activePath}
                    initialContent={editorContent}
                    readOnly={activeIsExternal}
                    selectLines={jump && jump.path === activePath ? jump.range : null}
                    diagnostics={activeIsExternal ? null : diagnostics}
                    blame={blameLines}
                    codeLenses={activeIsExternal ? undefined : codeLenses}
                    onCodeLensAction={handleLensAction}
                    onCursorLineChange={setCursorLine}
                    onChange={next => actions.updateDraft(activePath, next, baseline)}
                    onSaveShortcut={handleSave}
                    apiRef={editorApiRef}
                    settings={settings}
                  />
                ) : (
                  <CodeMirrorSurface
                    path={activePath}
                    initialContent={editorContent}
                    readOnly={activeIsExternal}
                    selectLines={jump && jump.path === activePath ? jump.range : null}
                    diffOriginal={driftMerge && diskContent !== undefined ? diskContent : diffOriginal}
                    collab={collab.binding}
                    lspQuery={activeIsExternal ? undefined : lspQuery}
                    onContextMenu={setContextMenu}
                    onGotoDefinition={position => void goTo('definition', position)}
                    onRename={startRename}
                    onFindReferences={position => void findReferences(position)}
                    onCursorLineChange={setCursorLine}
                    codeLenses={activeIsExternal ? undefined : codeLenses}
                    onCodeLensAction={handleLensAction}
                    blame={blameLines}
                    onFormat={() => void formatDocument()}
                    apiRef={editorApiRef}
                    settings={settings}
                    onChange={next => actions.updateDraft(activePath, next, baseline)}
                    onSelectionChange={handleSelection}
                    onSaveShortcut={handleSave}
                  />
                )
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
                    <FolderTree className="size-8 opacity-40" aria-hidden />
                    <div className="text-body-sm">Pick a file to start editing</div>
                    <div className="text-caption text-muted-foreground/80">
                      Press <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">⌘P</kbd> for
                      quick open
                    </div>
                  </div>
                </div>
              )}
            </div>
            {runnerOpen && (
              <RunnerPanel
                workspacePath={workspacePath}
                onJump={(path, line) => openFile(path, line)}
                onClose={() => setRunnerOpen(false)}
              />
            )}
            {buffers.pendingSelection && (
              <SendSelectionBar
                key={`${buffers.pendingSelection.path}:${buffers.pendingSelection.startLine}:${buffers.pendingSelection.endLine}:${lensPrompt ?? ''}`}
                selection={buffers.pendingSelection}
                resourceId={resourceId || undefined}
                projectPath={projectPath}
                baseUrl={baseUrl}
                initialText={lensPrompt ?? undefined}
                onDismiss={() => {
                  setLensPrompt(null);
                  actions.setSelection(null);
                }}
                onSent={() => {
                  exitingRef.current = true;
                  setLensPrompt(null);
                  actions.setSelection(null);
                  // Return to the session view so the user sees the agent pick
                  // the message up without a manual toggle.
                  setSearchParams(
                    previous => {
                      const next = new URLSearchParams(previous);
                      next.delete('view');
                      next.delete('file');
                      next.delete('lines');
                      return next;
                    },
                    { replace: true },
                  );
                }}
              />
            )}
          </div>
        </Panel>
      </PanelGroup>
      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDismiss={() => setContextMenu(null)}
          items={[
            {
              id: 'definition',
              label: 'Go to Definition',
              disabled: lspBusy,
              onSelect: () => void goTo('definition', contextMenu),
            },
            {
              id: 'type-definition',
              label: 'Go to Type Definition',
              disabled: lspBusy,
              onSelect: () => void goTo('typeDefinition', contextMenu),
            },
            {
              id: 'implementation',
              label: 'Find Implementations',
              disabled: lspBusy,
              onSelect: () => void goTo('implementation', contextMenu),
            },
            {
              id: 'references',
              label: 'Find All References',
              disabled: lspBusy || activeIsExternal,
              onSelect: () => void findReferences(contextMenu),
            },
            {
              id: 'rename',
              label: 'Rename Symbol',
              disabled: lspBusy || activeIsExternal,
              onSelect: () => startRename(contextMenu),
            },
            {
              id: 'quick-fix',
              label: 'Quick Fix…',
              disabled: lspBusy || activeIsExternal,
              onSelect: () => void quickFix(contextMenu),
            },
            {
              id: 'format',
              label: 'Format Document',
              disabled: lspBusy || activeIsExternal,
              onSelect: () => void formatDocument(),
            },
          ]}
        />
      )}
      {actionsMenu && (
        <EditorContextMenu
          x={actionsMenu.x}
          y={actionsMenu.y}
          onDismiss={() => setActionsMenu(null)}
          items={actionsMenu.actions.map((action, index) => ({
            id: `action-${index}`,
            label: action.title,
            onSelect: () => {
              editorApiRef.current?.applyTextEdits(action.edits);
              setActionsMenu(null);
            },
          }))}
        />
      )}
      {renamePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Rename ${renamePrompt.currentName}`}
          className="bg-background/40 absolute inset-0 z-30 grid place-items-start justify-center pt-24 backdrop-blur-sm"
          onPointerDown={event => {
            if (event.target === event.currentTarget) setRenamePrompt(null);
          }}
        >
          <form
            className="bg-popover border-border ring-border/40 w-80 rounded-lg border p-3 shadow-2xl ring-1"
            onSubmit={event => {
              event.preventDefault();
              void performRename(renamePrompt);
            }}
          >
            <div className="text-caption text-muted-foreground pb-2">
              Rename <span className="text-foreground font-mono">{renamePrompt.currentName}</span>
            </div>
            <input
              autoFocus
              value={renamePrompt.value}
              onChange={event => setRenamePrompt({ ...renamePrompt, value: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setRenamePrompt(null);
                }
              }}
              onFocus={event => event.currentTarget.select()}
              className="text-body-sm bg-field border-border focus:border-border-focus focus:ring-accent3/60 w-full rounded-md border px-2 py-1 font-mono outline-none focus:ring-1"
              spellCheck={false}
            />
            <div className="text-meta text-muted-foreground flex items-center gap-3 pt-2">
              <span>
                <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">↵</kbd> rename across files
              </span>
              <span>
                <kbd className="border-border bg-fill-subtle rounded border px-1 font-mono">esc</kbd> cancel
              </span>
            </div>
          </form>
        </div>
      )}
      <QuickOpenDialog
        open={quickOpen !== null}
        mode={quickOpen ?? 'files'}
        files={quickOpenFiles}
        commands={paletteCommands}
        onOpenFile={path => openFile(path)}
        onClose={() => setQuickOpen(null)}
      />
      <EditorSettingsDialog
        open={settingsOpen}
        settings={settings}
        theme={editorTheme}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
        onThemeChange={selectTheme}
      />
      {threadId ? null : (
        <div className="border-border bg-card text-meta text-muted-foreground border-t px-3 py-1">
          Open a thread to send selections to the agent.
        </div>
      )}
    </div>
  );
}
