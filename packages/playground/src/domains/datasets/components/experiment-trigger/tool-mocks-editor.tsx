import { Button, Icon, Input, Label, Switch, Textarea } from '@mastra/playground-ui';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

/** Kind of mock answer a row configures (function mocks are code-only — never offered here). */
export type ToolMockKind = 'output' | 'error' | 'expect';

/**
 * One editable mock row. Free-form text fields keep exactly what the user
 * typed; parsing happens in validation and payload building so a half-typed
 * JSON value never gets mangled mid-edit.
 */
export interface ToolMockRow {
  /** Stable local key for list rendering and per-row errors. */
  id: string;
  toolName: string;
  kind: ToolMockKind;
  /** Stub output (kind: output): JSON or plain text. */
  outputText: string;
  /** Injected error (kind: error). */
  errorMessage: string;
  errorName: string;
  /** "Also assert calls" disclosure on stub/error rows — expect fields only count while visible. */
  assertCallsOpen: boolean;
  expectArgsText: string;
  expectCalledTimesText: string;
}

let nextRowId = 0;

export function createToolMockRow(): ToolMockRow {
  nextRowId += 1;
  return {
    id: `tool-mock-row-${nextRowId}`,
    toolName: '',
    kind: 'output',
    outputText: '',
    errorMessage: '',
    errorName: '',
    assertCallsOpen: false,
    expectArgsText: '',
    expectCalledTimesText: '',
  };
}

/**
 * Lenient value parse shared by validation and the payload builder, mirroring
 * the dataset JSON-cell idiom: text that *looks* like JSON (object, array, or
 * quoted string) must parse — a typo there is an error, not data — while plain
 * words fall back to the raw string so `sunny` works without quoting.
 */
function parseLooseJsonText(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const looksLikeJson = /^[[{"]/.test(trimmed);
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return looksLikeJson ? { ok: false } : { ok: true, value: text };
  }
}

/** Parses the calledTimes text field. Empty is "not set"; anything else must be an integer >= 0. */
function parseCalledTimesText(text: string): { ok: true; value?: number } | { ok: false } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

/** Expect fields only count while they are visible in the UI — what you see is what you send. */
function expectFieldsActive(row: ToolMockRow): boolean {
  return row.kind === 'expect' || row.assertCallsOpen;
}

export interface ToolMockRowIssues {
  toolName?: string;
  output?: string;
  error?: string;
  expect?: string;
}

/**
 * Validates rows for Run gating. Returns a map of row id → issues; an empty
 * map means every row is sendable. Duplicate tool names are flagged on the
 * later rows (the server keys mocks by tool name, so duplicates would
 * silently overwrite each other).
 */
export function validateToolMockRows(rows: ToolMockRow[]): Map<string, ToolMockRowIssues> {
  const issues = new Map<string, ToolMockRowIssues>();
  const addIssue = (rowId: string, issue: ToolMockRowIssues) => {
    issues.set(rowId, { ...issues.get(rowId), ...issue });
  };

  const seenNames = new Set<string>();
  for (const row of rows) {
    const toolName = row.toolName.trim();
    if (!toolName) {
      addIssue(row.id, { toolName: 'Tool name is required.' });
    } else if (seenNames.has(toolName)) {
      addIssue(row.id, { toolName: `Duplicate tool name — "${toolName}" already has a mock.` });
    } else {
      seenNames.add(toolName);
    }

    if (row.kind === 'output') {
      if (!row.outputText.trim()) {
        addIssue(row.id, { output: 'Stub output is required.' });
      } else if (!parseLooseJsonText(row.outputText).ok) {
        addIssue(row.id, { output: 'Invalid JSON — fix it, or remove the leading {, [ or " for a plain string.' });
      }
    }

    if (row.kind === 'error' && !row.errorMessage.trim()) {
      addIssue(row.id, { error: 'Error message is required.' });
    }

    if (expectFieldsActive(row)) {
      const hasArgs = Boolean(row.expectArgsText.trim());
      const hasCalledTimes = Boolean(row.expectCalledTimesText.trim());
      if (hasArgs && !parseLooseJsonText(row.expectArgsText).ok) {
        addIssue(row.id, { expect: 'Expected args is not valid JSON.' });
      }
      if (!parseCalledTimesText(row.expectCalledTimesText).ok) {
        addIssue(row.id, { expect: 'calledTimes must be a whole number of 0 or more.' });
      }
      if (row.kind === 'expect' && !hasArgs && !hasCalledTimes) {
        addIssue(row.id, { expect: 'Add expected args, calledTimes, or both.' });
      }
    }
  }

  return issues;
}

export function areToolMockRowsValid(rows: ToolMockRow[]): boolean {
  return validateToolMockRows(rows).size === 0;
}

/**
 * One `toolMocks` entry of the trigger payload. The field is not on the
 * client param type yet (client types catch up in the stacked PR), so it
 * rides through the same wider-local-shape pattern as
 * `buildToolReplayPayload`'s `matching`.
 */
export interface ToolMockPayloadEntry {
  output?: unknown;
  error?: { name?: string; message: string };
  expect?: { args?: unknown; calledTimes?: number };
}

/**
 * Builds the `toolMocks` trigger payload from the editor rows. Returns
 * undefined when nothing sendable is configured, so callers can spread
 * `...(toolMocks ? { toolMocks } : {})` exactly like toolReplay. Rows that
 * fail validation are skipped defensively — Run gating keeps them from ever
 * reaching this point.
 */
export function buildToolMocksPayload(rows: ToolMockRow[]): Record<string, ToolMockPayloadEntry> | undefined {
  // Built as a Map so hostile tool names (`__proto__`, `toString`, …) behave
  // like any other key instead of colliding with Object.prototype.
  const entries = new Map<string, ToolMockPayloadEntry>();

  for (const row of rows) {
    const toolName = row.toolName.trim();
    if (!toolName || entries.has(toolName)) continue;

    const entry: ToolMockPayloadEntry = {};

    if (row.kind === 'output') {
      if (!row.outputText.trim()) continue;
      const parsed = parseLooseJsonText(row.outputText);
      if (!parsed.ok) continue;
      entry.output = parsed.value;
    } else if (row.kind === 'error') {
      const message = row.errorMessage.trim();
      if (!message) continue;
      const name = row.errorName.trim();
      entry.error = { ...(name ? { name } : {}), message };
    }

    if (expectFieldsActive(row)) {
      const expect: { args?: unknown; calledTimes?: number } = {};
      if (row.expectArgsText.trim()) {
        const parsedArgs = parseLooseJsonText(row.expectArgsText);
        if (!parsedArgs.ok) continue;
        expect.args = parsedArgs.value;
      }
      const calledTimes = parseCalledTimesText(row.expectCalledTimesText);
      if (!calledTimes.ok) continue;
      if (calledTimes.value !== undefined) expect.calledTimes = calledTimes.value;
      if (Object.keys(expect).length > 0) entry.expect = expect;
    }

    // The API requires at least one of output/error/expect per entry.
    if (Object.keys(entry).length === 0) continue;

    entries.set(toolName, entry);
  }

  return entries.size > 0 ? Object.fromEntries(entries) : undefined;
}

const KIND_OPTIONS: { value: ToolMockKind; label: string }[] = [
  { value: 'output', label: 'Stub output' },
  { value: 'error', label: 'Inject error' },
  { value: 'expect', label: 'Expect only' },
];

export interface ToolMocksEditorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rows: ToolMockRow[];
  onRowsChange: (rows: ToolMockRow[]) => void;
  /** Tool names of the selected agent, offered as suggestions — free text stays allowed. */
  toolSuggestions?: string[];
  disabled?: boolean;
}

/**
 * Layout-agnostic editor for per-tool data mocks on experiment runs (agent
 * targets only — callers gate on target type). Rows map 1:1 to the trigger
 * payload's `toolMocks` entries: stub an output, inject an error, or only
 * assert calls. Works standalone (mock-only runs) and alongside tool replay.
 */
export function ToolMocksEditor({
  enabled,
  onEnabledChange,
  rows,
  onRowsChange,
  toolSuggestions,
  disabled,
}: ToolMocksEditorProps) {
  const suggestionsListId = useId();
  const issues = validateToolMockRows(rows);

  const updateRow = (rowId: string, patch: Partial<ToolMockRow>) => {
    onRowsChange(rows.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="tool-mocks-toggle">Mock tools</Label>
        <Switch
          id="tool-mocks-toggle"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label="Mock tools"
        />
      </div>

      {enabled && (
        <div className="grid gap-4 pt-1">
          <p className="text-ui-sm text-neutral3">
            Mocked tools answer with the configured value instead of running — unmocked tools still run live.
          </p>

          {toolSuggestions && toolSuggestions.length > 0 && (
            <datalist id={suggestionsListId}>
              {toolSuggestions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}

          {rows.map(row => {
            const rowIssues = issues.get(row.id);
            const showAssertCalls = row.kind !== 'expect';
            return (
              <div key={row.id} className="grid gap-2 rounded-lg border border-border1 p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-1">
                    <Input
                      value={row.toolName}
                      onChange={event => updateRow(row.id, { toolName: event.target.value })}
                      placeholder="Tool name"
                      aria-label="Tool name"
                      list={toolSuggestions && toolSuggestions.length > 0 ? suggestionsListId : undefined}
                      disabled={disabled}
                      error={Boolean(rowIssues?.toolName)}
                    />
                    {rowIssues?.toolName && <p className="text-ui-sm text-negative1">{rowIssues.toolName}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRowsChange(rows.filter(other => other.id !== row.id))}
                    disabled={disabled}
                    aria-label="Remove mock"
                    className="text-neutral2 hover:text-negative1"
                  >
                    <Icon size="sm">
                      <Trash2 />
                    </Icon>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1" role="group" aria-label="Mock kind">
                  {KIND_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={row.kind === option.value ? 'outline' : 'ghost'}
                      size="sm"
                      aria-pressed={row.kind === option.value}
                      onClick={() => updateRow(row.id, { kind: option.value })}
                      disabled={disabled}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                {row.kind === 'output' && (
                  <div className="grid gap-1">
                    <Textarea
                      value={row.outputText}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        updateRow(row.id, { outputText: event.target.value })
                      }
                      placeholder='{"result": "ok"} — or plain text'
                      aria-label="Stub output (JSON or plain text)"
                      className="font-mono text-xs min-h-[60px]"
                      disabled={disabled}
                    />
                    {rowIssues?.output ? (
                      <p className="text-ui-sm text-negative1">{rowIssues.output}</p>
                    ) : (
                      <p className="text-ui-sm text-neutral3">
                        JSON is parsed; anything else is sent as a plain string.
                      </p>
                    )}
                  </div>
                )}

                {row.kind === 'error' && (
                  <div className="grid gap-1">
                    <Input
                      value={row.errorMessage}
                      onChange={event => updateRow(row.id, { errorMessage: event.target.value })}
                      placeholder="Error message"
                      aria-label="Error message"
                      disabled={disabled}
                      error={Boolean(rowIssues?.error)}
                    />
                    <Input
                      value={row.errorName}
                      onChange={event => updateRow(row.id, { errorName: event.target.value })}
                      placeholder="Error name (optional)"
                      aria-label="Error name (optional)"
                      disabled={disabled}
                    />
                    {rowIssues?.error && <p className="text-ui-sm text-negative1">{rowIssues.error}</p>}
                  </div>
                )}

                {showAssertCalls && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-self-start"
                    aria-expanded={row.assertCallsOpen}
                    onClick={() => updateRow(row.id, { assertCallsOpen: !row.assertCallsOpen })}
                    disabled={disabled}
                  >
                    <Icon size="sm">{row.assertCallsOpen ? <ChevronDown /> : <ChevronRight />}</Icon>
                    Also assert calls
                  </Button>
                )}

                {expectFieldsActive(row) && (
                  <div className="grid gap-1">
                    <Textarea
                      value={row.expectArgsText}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        updateRow(row.id, { expectArgsText: event.target.value })
                      }
                      placeholder='Expected args, e.g. {"city": "Paris"} (optional)'
                      aria-label="Expected args (JSON, optional)"
                      className="font-mono text-xs min-h-[60px]"
                      disabled={disabled}
                    />
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row.expectCalledTimesText}
                      onChange={event => updateRow(row.id, { expectCalledTimesText: event.target.value })}
                      placeholder="calledTimes (optional)"
                      aria-label="Expected call count (calledTimes)"
                      disabled={disabled}
                    />
                    {rowIssues?.expect && <p className="text-ui-sm text-negative1">{rowIssues.expect}</p>}
                    <p className="text-ui-sm text-neutral3">calledTimes 0 = must not be called.</p>
                  </div>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => onRowsChange([...rows, createToolMockRow()])}
            disabled={disabled}
          >
            <Icon size="sm">
              <Plus />
            </Icon>
            Add mock
          </Button>

          <p className="text-ui-sm text-neutral3">
            Function mocks (replacing execute) are code-only — see the startExperiment docs.
          </p>
        </div>
      )}
    </div>
  );
}
