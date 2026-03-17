import type { TUI } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ToolExecutionComponentEnhanced } from '../tool-execution-enhanced.js';
import type { ToolResult } from '../tool-execution-interface.js';

const mockTui = { requestRender: () => {} } as unknown as TUI;
const WIDTH = 100;

function renderPlain(component: ToolExecutionComponentEnhanced): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

function toResult(text: string, isError = false): ToolResult {
  return {
    isError,
    content: [{ type: 'text', text }],
  };
}

describe('ToolExecutionComponentEnhanced recall rendering', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: WIDTH,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  it('renders recall list results with summary metadata and previews', () => {
    const component = new ToolExecutionComponentEnhanced(
      'recall',
      { mode: 'list', cursor: 'msg-2', page: 1, limit: 2 },
      {},
      mockTui,
    );

    component.updateResult(
      toResult(
        JSON.stringify({
          mode: 'list',
          cursor: 'msg-2',
          page: 1,
          limit: 2,
          direction: 'forward',
          count: 2,
          hasMore: true,
          items: [
            {
              id: 'msg-2',
              role: 'assistant',
              createdAt: '2026-03-12T18:00:00.000Z',
              preview: 'Cursor preview',
              isCursor: true,
            },
            {
              id: 'msg-3',
              role: 'user',
              createdAt: '2026-03-12T18:00:05.000Z',
              preview: 'Follow-up preview',
              isCursor: false,
            },
          ],
        }),
      ),
    );

    const lines = renderPlain(component);

    expect(lines.some(line => line.includes('recall msg-2 (list)'))).toBe(true);
    expect(lines.some(line => line.includes('mode=list') && line.includes('direction=forward'))).toBe(true);
    expect(lines.some(line => line.includes('★ 2026-03-12T18:00:00.000Z  assistant  msg-2'))).toBe(true);
    expect(lines.some(line => line.includes('Cursor preview'))).toBe(true);
    expect(lines.some(line => line.includes('Follow-up preview'))).toBe(true);
  });

  it('renders recall inspect results with inspected ids and transcript', () => {
    const component = new ToolExecutionComponentEnhanced(
      'recall',
      { mode: 'inspect', cursor: 'msg-2', messageIds: ['msg-2', 'msg-3'] },
      {},
      mockTui,
    );

    component.updateResult(
      toResult(
        JSON.stringify({
          mode: 'inspect',
          cursor: 'msg-2',
          page: 1,
          limit: 20,
          count: 2,
          inspectedIds: ['msg-2', 'msg-3'],
          items: [
            {
              id: 'msg-2',
              role: 'assistant',
              createdAt: '2026-03-12T18:00:00.000Z',
              preview: 'Cursor preview',
              isCursor: true,
            },
            {
              id: 'msg-3',
              role: 'user',
              createdAt: '2026-03-12T18:00:05.000Z',
              preview: 'Follow-up preview',
              isCursor: false,
            },
          ],
          messages: '<message role="assistant">hello</message>\n<message role="user">hi</message>',
        }),
      ),
    );

    const lines = renderPlain(component);

    expect(lines.some(line => line.includes('recall msg-2 (inspect)'))).toBe(true);
    expect(lines.some(line => line.includes('inspectedIds=msg-2, msg-3'))).toBe(true);
    expect(lines.some(line => line.includes('<message role="assistant">hello</message>'))).toBe(true);
    expect(lines.some(line => line.includes('<message role="user">hi</message>'))).toBe(true);
  });
});
