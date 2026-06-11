// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ToolMockRow } from '../tool-mocks-editor';
import {
  areToolMockRowsValid,
  buildToolMocksPayload,
  createToolMockRow,
  ToolMocksEditor,
  validateToolMockRows,
} from '../tool-mocks-editor';

function makeRow(patch: Partial<ToolMockRow>): ToolMockRow {
  return { ...createToolMockRow(), ...patch };
}

describe('buildToolMocksPayload', () => {
  it('parses JSON stub outputs and keeps plain text as a raw string', () => {
    expect(
      buildToolMocksPayload([
        makeRow({ toolName: 'weatherInfo', kind: 'output', outputText: '{"temp": 20}' }),
        makeRow({ toolName: 'greeting', kind: 'output', outputText: 'sunny with a chance of rain' }),
      ]),
    ).toEqual({
      weatherInfo: { output: { temp: 20 } },
      greeting: { output: 'sunny with a chance of rain' },
    });
  });

  it('parses bare numbers and booleans to typed values; quoting forces a string', () => {
    // JSON.parse is tried on everything: `20` mocks the number 20, `"20"` the
    // string '20'. Only non-JSON words (parse failure) ride as raw text.
    expect(
      buildToolMocksPayload([
        makeRow({ toolName: 'getTemperature', kind: 'output', outputText: '20' }),
        makeRow({ toolName: 'isOpen', kind: 'output', outputText: 'true' }),
        makeRow({ toolName: 'getCount', kind: 'output', outputText: '"20"' }),
      ]),
    ).toEqual({
      getTemperature: { output: 20 },
      isOpen: { output: true },
      getCount: { output: '20' },
    });
  });

  it('builds the error shape with the optional name only when set', () => {
    expect(
      buildToolMocksPayload([
        makeRow({ toolName: 'sendEmail', kind: 'error', errorMessage: 'mail service down', errorName: 'MailError' }),
        makeRow({ toolName: 'chargeCard', kind: 'error', errorMessage: 'declined' }),
      ]),
    ).toEqual({
      sendEmail: { error: { name: 'MailError', message: 'mail service down' } },
      chargeCard: { error: { message: 'declined' } },
    });
  });

  it('builds expect-only entries including calledTimes 0 (must not be called)', () => {
    expect(
      buildToolMocksPayload([
        makeRow({ toolName: 'chargeCard', kind: 'expect', expectCalledTimesText: '0' }),
        makeRow({ toolName: 'searchDocs', kind: 'expect', expectArgsText: '{"q": "refund"}' }),
      ]),
    ).toEqual({
      chargeCard: { expect: { calledTimes: 0 } },
      searchDocs: { expect: { args: { q: 'refund' } } },
    });
  });

  it('attaches expect fields to a stub only while the assert-calls disclosure is open', () => {
    const base = {
      toolName: 'weatherInfo',
      kind: 'output' as const,
      outputText: '"sunny"',
      expectArgsText: '{"city": "Paris"}',
      expectCalledTimesText: '2',
    };
    expect(buildToolMocksPayload([makeRow({ ...base, assertCallsOpen: true })])).toEqual({
      weatherInfo: { output: 'sunny', expect: { args: { city: 'Paris' }, calledTimes: 2 } },
    });
    // Closed disclosure = hidden fields = not sent (what you see is what you send).
    expect(buildToolMocksPayload([makeRow({ ...base, assertCallsOpen: false })])).toEqual({
      weatherInfo: { output: 'sunny' },
    });
  });

  it('returns undefined when there is nothing sendable', () => {
    expect(buildToolMocksPayload([])).toBeUndefined();
    expect(buildToolMocksPayload([makeRow({ toolName: '', kind: 'output', outputText: '"x"' })])).toBeUndefined();
    expect(buildToolMocksPayload([makeRow({ toolName: 'tool', kind: 'output', outputText: '' })])).toBeUndefined();
    // JSON-looking but malformed output never ships a broken value.
    expect(buildToolMocksPayload([makeRow({ toolName: 'tool', kind: 'output', outputText: '{oops' })])).toBeUndefined();
    // Expect-only with no fields has nothing to assert.
    expect(buildToolMocksPayload([makeRow({ toolName: 'tool', kind: 'expect' })])).toBeUndefined();
  });

  it('keeps the first entry when duplicate tool names slip through', () => {
    expect(
      buildToolMocksPayload([
        makeRow({ toolName: 'weatherInfo', kind: 'output', outputText: '"first"' }),
        makeRow({ toolName: 'weatherInfo', kind: 'output', outputText: '"second"' }),
      ]),
    ).toEqual({ weatherInfo: { output: 'first' } });
  });
});

describe('validateToolMockRows', () => {
  it('requires a tool name and flags later duplicates', () => {
    const unnamed = makeRow({ kind: 'output', outputText: '"x"' });
    const first = makeRow({ toolName: 'weatherInfo', kind: 'output', outputText: '"x"' });
    const dupe = makeRow({ toolName: 'weatherInfo', kind: 'output', outputText: '"y"' });

    const issues = validateToolMockRows([unnamed, first, dupe]);
    expect(issues.get(unnamed.id)?.toolName).toBe('Tool name is required.');
    expect(issues.get(first.id)).toBeUndefined();
    expect(issues.get(dupe.id)?.toolName).toContain('Duplicate tool name');
  });

  it('rejects empty and JSON-looking-but-malformed stub outputs, allows plain strings', () => {
    const empty = makeRow({ toolName: 'a', kind: 'output', outputText: '   ' });
    const malformed = makeRow({ toolName: 'b', kind: 'output', outputText: '{"temp": ' });
    const plain = makeRow({ toolName: 'c', kind: 'output', outputText: 'sunny' });

    const issues = validateToolMockRows([empty, malformed, plain]);
    expect(issues.get(empty.id)?.output).toBe('Stub output is required.');
    expect(issues.get(malformed.id)?.output).toContain('Invalid JSON');
    expect(issues.get(plain.id)).toBeUndefined();
  });

  it('requires a message on error rows', () => {
    const row = makeRow({ toolName: 'sendEmail', kind: 'error', errorName: 'MailError' });
    expect(validateToolMockRows([row]).get(row.id)?.error).toBe('Error message is required.');
  });

  it('requires at least one expect field on expect-only rows and validates both', () => {
    const emptyExpect = makeRow({ toolName: 'a', kind: 'expect' });
    const badArgs = makeRow({ toolName: 'b', kind: 'expect', expectArgsText: '{nope' });
    const badCount = makeRow({ toolName: 'c', kind: 'expect', expectCalledTimesText: '-1' });
    const zero = makeRow({ toolName: 'd', kind: 'expect', expectCalledTimesText: '0' });

    const issues = validateToolMockRows([emptyExpect, badArgs, badCount, zero]);
    expect(issues.get(emptyExpect.id)?.expect).toBe('Add expected args, calledTimes, or both.');
    expect(issues.get(badArgs.id)?.expect).toBe('Expected args is not valid JSON.');
    expect(issues.get(badCount.id)?.expect).toContain('whole number of 0 or more');
    expect(issues.get(zero.id)).toBeUndefined();
  });

  it('ignores expect fields on stub rows while the disclosure is closed', () => {
    const row = makeRow({
      toolName: 'weatherInfo',
      kind: 'output',
      outputText: '"sunny"',
      assertCallsOpen: false,
      expectArgsText: '{broken',
    });
    expect(areToolMockRowsValid([row])).toBe(true);
    expect(areToolMockRowsValid([{ ...row, assertCallsOpen: true }])).toBe(false);
  });
});

function EditorHarness({
  initialRows = [],
  toolSuggestions,
}: {
  initialRows?: ToolMockRow[];
  toolSuggestions?: string[];
}) {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<ToolMockRow[]>(initialRows);
  return (
    <ToolMocksEditor
      enabled={enabled}
      onEnabledChange={setEnabled}
      rows={rows}
      onRowsChange={setRows}
      toolSuggestions={toolSuggestions}
    />
  );
}

describe('ToolMocksEditor', () => {
  afterEach(cleanup);

  it('renders only the toggle row until enabled, then shows the code-only note for function mocks', () => {
    render(<EditorHarness />);

    expect(screen.getByRole('switch', { name: 'Mock tools' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add mock' })).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));

    expect(screen.getByRole('button', { name: 'Add mock' })).toBeDefined();
    expect(screen.getByText(/Function mocks \(replacing execute\) are code-only/)).toBeDefined();
  });

  it('adds and removes rows and switches between the three mock kinds', () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    // Stub output is the default kind.
    expect(screen.getByLabelText('Stub output (JSON or plain text)')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Inject error' }));
    expect(screen.queryByLabelText('Stub output (JSON or plain text)')).toBeNull();
    expect(screen.getByLabelText('Error message')).toBeDefined();
    expect(screen.getByLabelText('Error name (optional)')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Expect only' }));
    expect(screen.getByLabelText('Expected args (JSON, optional)')).toBeDefined();
    expect(screen.getByLabelText('Expected call count (calledTimes)')).toBeDefined();
    expect(screen.getByText('calledTimes 0 = must not be called.')).toBeDefined();
    // Expect-only rows have no extra disclosure — the fields are already there.
    expect(screen.queryByRole('button', { name: 'Also assert calls' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove mock' }));
    expect(screen.queryByLabelText('Tool name')).toBeNull();
  });

  it('reveals the assert-calls fields on stub rows behind the disclosure', () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    expect(screen.queryByLabelText('Expected args (JSON, optional)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Also assert calls' }));

    expect(screen.getByLabelText('Expected args (JSON, optional)')).toBeDefined();
    expect(screen.getByLabelText('Expected call count (calledTimes)')).toBeDefined();
  });

  it('shows the invalid-JSON hint for a JSON-looking stub output', () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    fireEvent.change(screen.getByLabelText('Tool name'), { target: { value: 'weatherInfo' } });
    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), { target: { value: '{"temp": ' } });

    expect(screen.getByText(/Invalid JSON/)).toBeDefined();

    fireEvent.change(screen.getByLabelText('Stub output (JSON or plain text)'), { target: { value: '{"temp": 20}' } });
    expect(screen.queryByText(/Invalid JSON/)).toBeNull();
  });

  it('flags duplicate tool names inline', () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    const nameInputs = screen.getAllByLabelText('Tool name');
    fireEvent.change(nameInputs[0], { target: { value: 'weatherInfo' } });
    fireEvent.change(nameInputs[1], { target: { value: 'weatherInfo' } });

    expect(screen.getByText('Duplicate tool name — "weatherInfo" already has a mock.')).toBeDefined();
  });

  it('offers the agent tools as datalist suggestions while keeping free text', () => {
    render(<EditorHarness toolSuggestions={['weatherInfo', 'sendEmail']} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mock tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock' }));

    const nameInput = screen.getByLabelText('Tool name');
    const listId = nameInput.getAttribute('list');
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId!);
    const options = within(datalist as HTMLElement).queryAllByRole('option', { hidden: true });
    expect(options.map(option => (option as HTMLOptionElement).value)).toEqual(['weatherInfo', 'sendEmail']);

    // Free text not in the suggestions stays allowed.
    fireEvent.change(nameInput, { target: { value: 'someCustomTool' } });
    expect((nameInput as HTMLInputElement).value).toBe('someCustomTool');
  });
});
