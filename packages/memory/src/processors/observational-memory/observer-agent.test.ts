import { describe, expect, it } from 'vitest';

import {
  buildObserverSystemPrompt,
  formatMessagesForObserver,
  optimizeObservationsForContext,
  parseMultiThreadObserverOutput,
  parseObserverOutput,
  sortObservationsByTime,
} from './observer-agent';

describe('optimizeObservationsForContext', () => {
  it('should strip yellow and green emojis', () => {
    const observations = `
- 🔴 Critical info
- 🟡 Medium info
- 🟢 Low info
      `;

    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('🔴 Critical info');
    expect(optimized).not.toContain('🟡');
    expect(optimized).not.toContain('🟢');
  });

  it('should strip anchor IDs before injecting context', () => {
    const observations = '[O1] - 🔴 Critical info\n[O2] - 🟡 Medium info';
    const optimized = optimizeObservationsForContext(observations);

    expect(optimized).toContain('🔴 Critical info');
    expect(optimized).toContain('- Medium info');
    expect(optimized).not.toContain('[O1]');
    expect(optimized).not.toContain('[O2]');
  });

  it('should preserve red emojis', () => {
    const observations = '- 🔴 Critical user preference';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('🔴');
  });

  it('should simplify arrows', () => {
    const observations = '- Task -> completed successfully';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('->');
  });

  it('should collapse multiple newlines', () => {
    const observations = `Line 1



Line 2`;
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('\n\n\n');
  });

  it('should preserve markdown link text', () => {
    const observations = '- 🔴 Agent shared [the setup guide](https://example.com/setup)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[the setup guide](https://example.com/setup)');
  });

  it('should preserve multiple markdown links on one line', () => {
    const observations = '- 🔴 Compared [option A](https://example.com/a) and [option B](https://example.com/b)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[option A](https://example.com/a)');
    expect(optimized).toContain('[option B](https://example.com/b)');
  });

  it('should preserve markdown links using fragment targets', () => {
    const observations = '- 🔴 Rendered [Item name](#preview=item&id=abc123)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[Item name](#preview=item&id=abc123)');
  });

  it('should still strip semantic tags that are not markdown links', () => {
    const observations = '- 🔴 [tag one, tag two] User prefers direct answers';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('[tag one, tag two]');
    expect(optimized).toContain('User prefers direct answers');
  });

  it('should strip semantic tags while preserving an adjacent markdown link', () => {
    const observations = '- 🔴 [internal] Agent shared [the guide](https://example.com/guide)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('[internal]');
    expect(optimized).toContain('[the guide](https://example.com/guide)');
  });

  it('should preserve collapsed item markers', () => {
    const observations = '- 🔴 History trimmed [72 items collapsed - ID: b1fa]';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[72 items collapsed - ID: b1fa]');
  });
});

describe('Observer event order', () => {
  it('asks the Observer to list observations in the order events happened', () => {
    expect(buildObserverSystemPrompt(false)).toContain('in the order the events happened (not by importance)');
    expect(buildObserverSystemPrompt(true)).toContain('in the order the events happened (not by importance)');
  });

  it('shows the time on every tool line, even within the same minute, so tool events can be ordered against user messages', () => {
    const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 7, 31, 17, minute, second));
    const toolPart = (toolCallId: string, toolName: string, result: string) => ({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName, args: {}, result },
    });
    const input = formatMessagesForObserver(
      [
        {
          id: 'a1',
          role: 'assistant',
          createdAt: at(29, 50),
          threadId: 't',
          content: {
            format: 2,
            parts: [
              toolPart('c1', 'task_update', 'ok'),
              toolPart('c2', 'submit_plan', 'Plan was not approved. The user will send revision instructions next.'),
            ],
          },
        },
        {
          id: 'u1',
          role: 'user',
          createdAt: at(35),
          threadId: 't',
          content: { format: 2, parts: [{ type: 'text', text: 'Add a validation step that clusters real traces.' }] },
        },
      ] as any,
      { timeZone: 'UTC' },
    );

    const toolLines = input.split('\n').filter(line => line.startsWith('Tool '));
    expect(toolLines.length).toBeGreaterThanOrEqual(3);
    for (const line of toolLines) expect(line).toMatch(/^Tool (Call|Result) \S+ \(5:29 PM\):/);
    expect(input).toMatch(/User \(5:35 PM\):/);
  });
});

describe('sortObservationsByTime', () => {
  it('moves an observation listed out of order back to when it happened, keeping its sub-items', () => {
    const observations = [
      'Date: Aug 31, 2026',
      '* 🔴 (13:35) User asked for a validation step',
      '* 🟡 (13:24) Agent revised the plan',
      '  * -> Fixed sequencing',
      '* 🟡 (13:29) Plan was not approved; waiting for revision instructions',
    ].join('\n');

    expect(sortObservationsByTime(observations)).toBe(
      [
        'Date: Aug 31, 2026',
        '* 🟡 (13:24) Agent revised the plan',
        '  * -> Fixed sequencing',
        '* 🟡 (13:29) Plan was not approved; waiting for revision instructions',
        '* 🔴 (13:35) User asked for a validation step',
      ].join('\n'),
    );
  });

  it('keeps the written order for observations with the same time and sorts each date separately', () => {
    const observations = [
      'Date: Dec 4, 2025',
      '* 🔴 (14:31) Second',
      '* 🟡 (14:30) First A',
      '* 🟡 (14:30) First B',
      '',
      'Date: Dec 5, 2025',
      '* 🔴 (09:20) Later',
      '* 🟡 (09:15) Earlier',
    ].join('\n');

    expect(sortObservationsByTime(observations)).toBe(
      [
        'Date: Dec 4, 2025',
        '* 🟡 (14:30) First A',
        '* 🟡 (14:30) First B',
        '* 🔴 (14:31) Second',
        '',
        'Date: Dec 5, 2025',
        '* 🟡 (09:15) Earlier',
        '* 🔴 (09:20) Later',
      ].join('\n'),
    );
  });

  it('orders AM/PM times', () => {
    const observations = ['Date: Aug 31, 2026', '* 🔴 (1:35 PM) User', '* 🟡 (11:50 AM) Agent'].join('\n');
    expect(sortObservationsByTime(observations)).toBe(
      ['Date: Aug 31, 2026', '* 🟡 (11:50 AM) Agent', '* 🔴 (1:35 PM) User'].join('\n'),
    );
  });

  it.each([
    ['an observation has no time', ['* 🔴 (13:35) User', '* 🟡 Agent revised the plan']],
    ['12-hour times without AM/PM span different hours', ['* 🔴 (1:35) User', '* 🟡 (11:50) Agent']],
    ['AM/PM and plain times are mixed', ['* 🔴 (1:35 PM) User', '* 🟡 (11:50) Agent']],
    ['a top-level line is not a list item', ['* 🔴 (13:35) User', 'Some heading', '* 🟡 (13:24) Agent']],
  ])('leaves a date group as written when %s', (_, lines) => {
    const observations = ['Date: Aug 31, 2026', ...lines].join('\n');
    expect(sortObservationsByTime(observations)).toBe(observations);
  });

  it('leaves observations without a date header unchanged', () => {
    const observations = '* 🔴 (13:35) User\n* 🟡 (13:24) Agent';
    expect(sortObservationsByTime(observations)).toBe(observations);
  });

  it('is applied to single-thread and multi-thread Observer output', () => {
    const body = 'Date: Aug 31, 2026\n* 🔴 (13:35) User\n* 🟡 (13:24) Agent';
    const sorted = 'Date: Aug 31, 2026\n* 🟡 (13:24) Agent\n* 🔴 (13:35) User';

    expect(parseObserverOutput(`<observations>\n${body}\n</observations>`).observations).toBe(sorted);
    const multi = parseMultiThreadObserverOutput(
      `<observations>\n<thread id="t1">\n${body}\n</thread>\n</observations>`,
    );
    expect(multi.threads.get('t1')?.observations).toBe(sorted);
  });
});
