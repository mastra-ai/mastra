import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalSandbox } from '../../sandbox/local-sandbox';
import { Workspace } from '../../workspace';
import { executeCommandTool, executeCommandWithBackgroundTool } from '../execute-command';
import { getProcessOutputTool } from '../get-process-output';
import { applyTokenLimitSandwich } from '../output-helpers';

// Issue #28411: when execute_command's token safety net cuts the middle out of
// long output, the notice must say which lines were dropped, so the agent can
// read exactly that range (e.g. `cmd | sed -n '24,199p'`) instead of re-running
// everything piece by piece.
//
// The commands below print `seq` output, so the content of every line is its own
// line number. That lets each test check the notice against the lines the model
// actually received.

const NOTICE_RE = /\[\.\.\.output truncated[^\]]*\.\.\.\]/;

interface ParsedNotice {
  notice: string;
  head: string;
  tail: string;
}

function splitAtNotice(result: string): ParsedNotice {
  const match = result.match(NOTICE_RE);
  if (!match || match.index === undefined) {
    throw new Error(`no sandwich truncation notice in output:\n${result.slice(0, 500)}`);
  }
  const before = result.slice(0, match.index);
  const after = result.slice(match.index + match[0].length);
  // The notice sits on its own line between head and tail.
  return {
    notice: match[0],
    head: before.endsWith('\n') ? before.slice(0, -1) : before,
    tail: after.startsWith('\n') ? after.slice(1) : after,
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/**
 * Check that the notice describes exactly what the model saw for `seq first last`
 * output: the head range, the tail range, the dropped range, and any line that was
 * cut part-way through.
 */
function expectNoticeMatchesSeqOutput(parsed: ParsedNotice, first: number, last: number) {
  const { notice, head, tail } = parsed;

  const headRange = notice.match(/showing first ~\d+ tokens \(lines? (\d+)(?:-(\d+))?\)/);
  const tailRange = notice.match(/last ~\d+ tokens \(lines? (\d+)(?:-(\d+))?\)/);
  expect(headRange, `head range missing from: ${notice}`).not.toBeNull();
  expect(tailRange, `tail range missing from: ${notice}`).not.toBeNull();

  const headFrom = Number(headRange![1]);
  const headTo = Number(headRange![2] ?? headRange![1]);
  const tailFrom = Number(tailRange![1]);
  const tailTo = Number(tailRange![2] ?? tailRange![1]);

  expect(headFrom).toBe(first);
  expect(tailTo).toBe(last);
  expect(headTo).toBeLessThan(tailFrom);

  const headCut = notice.includes(`the end of line ${headTo}`);
  const tailCut = notice.includes(`the start of line ${tailFrom}`);

  // Head: lines headFrom..headTo, where the last one may be cut short.
  const fullHead = range(headFrom, headTo).join('\n');
  if (headCut) {
    expect(fullHead.startsWith(head)).toBe(true);
    expect(head.length).toBeLessThan(fullHead.length);
  } else {
    expect(head).toBe(fullHead);
  }

  // Tail: lines tailFrom..tailTo, where the first one may be missing its start.
  const fullTail = range(tailFrom, tailTo).join('\n');
  const tailBody = tail.slice(0, tail.lastIndexOf(String(tailTo)) + String(tailTo).length);
  if (tailCut) {
    expect(fullTail.endsWith(tailBody)).toBe(true);
    expect(tailBody.length).toBeLessThan(fullTail.length);
  } else {
    expect(tailBody).toBe(fullTail);
  }

  // Dropped: every line strictly between the head and the tail.
  const droppedFrom = headTo + 1;
  const droppedTo = tailFrom - 1;
  expect(droppedTo).toBeGreaterThanOrEqual(droppedFrom);
  const droppedClause = droppedFrom === droppedTo ? `line ${droppedFrom}` : `lines ${droppedFrom}-${droppedTo}`;
  expect(notice).toMatch(/dropped /);
  expect(notice).toContain(droppedClause);
  for (const n of [droppedFrom, droppedTo]) {
    expect(head.split('\n')).not.toContain(String(n));
    expect(tail.split('\n')).not.toContain(String(n));
  }
}

describe.skipIf(process.platform === 'win32')('sandwich truncation reports line ranges (#28411)', () => {
  let dir: string;
  let workspace: Workspace;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sandwich-lines-'));
    workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: dir }),
      tools: {
        mastra_workspace_execute_command: { maxOutputTokens: 200 },
        mastra_workspace_get_process_output: { maxOutputTokens: 200 },
      },
    });
    await workspace.init();
  });

  afterEach(async () => {
    await workspace.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('execute_command names the dropped lines when output exceeds the token limit', async () => {
    const result = await executeCommandTool.execute!({ command: 'seq 1 3000', tail: 0 }, { workspace } as any);

    expectNoticeMatchesSeqOutput(splitAtNotice(String(result)), 1, 3000);
  });

  it('keeps the token counts alongside the line ranges', async () => {
    const result = await executeCommandTool.execute!({ command: 'seq 1 3000', tail: 0 }, { workspace } as any);

    const { notice } = splitAtNotice(String(result));
    expect(notice).toMatch(/showing first ~20 tokens .*\+ last ~180 tokens .*of ~\d+ tokens\.\.\.\]$/);
  });

  it('treats \\r\\n as one line break at both cuts', async () => {
    const result = String(
      await executeCommandTool.execute!(
        { command: `awk 'BEGIN { for (i = 1; i <= 3000; i++) printf "%d\\r\\n", i }'`, tail: 0 },
        { workspace } as any,
      ),
    );

    const raw = splitAtNotice(result);
    expect(raw.head.endsWith('\r')).toBe(false);
    expect(raw.tail.startsWith('\r')).toBe(false);
    expect(raw.tail.startsWith('\n')).toBe(false);
    // With the carriage returns removed, the notice must describe the kept lines exactly.
    expectNoticeMatchesSeqOutput(splitAtNotice(result.replace(/\r/g, '')), 1, 3000);
  });

  it('numbers lines from the full command output when a line-based tail was applied first', async () => {
    // tail: 2500 keeps lines 501-3000; the token limit then cuts the middle of those.
    const result = String(
      await executeCommandTool.execute!({ command: 'seq 1 3000', tail: 2500 }, { workspace } as any),
    );

    expect(result.startsWith('[showing last 2500 of 3000 lines]\n')).toBe(true);
    const parsed = splitAtNotice(result.slice('[showing last 2500 of 3000 lines]\n'.length));
    expectNoticeMatchesSeqOutput(parsed, 501, 3000);
  });

  it('get_process_output names the dropped lines of a background process', async () => {
    const started = await executeCommandWithBackgroundTool.execute!({ command: 'seq 1 3000', background: true }, {
      workspace,
    } as any);
    const pid = String(started).match(/PID: (.+)\)/)![1]!;

    const result = await getProcessOutputTool.execute!({ pid, wait: true, tail: 0 }, { workspace } as any);

    expectNoticeMatchesSeqOutput(splitAtNotice(String(result)), 1, 3000);
  });
});

describe('applyTokenLimitSandwich line ranges (#28411)', () => {
  // Ten lines that are each far longer than the head or tail budget, so both cuts
  // land mid-line.
  const longLines = Array.from({ length: 10 }, (_, i) => `L${i + 1}:` + 'x'.repeat(400)).join('\n');

  it('says when the head and tail cut through a line', async () => {
    const result = await applyTokenLimitSandwich(longLines, 20, 0.5);
    const { notice } = splitAtNotice(result);

    expect(notice).toContain('dropped the end of line 1, lines 2-9 and the start of line 10;');
    expect(notice).toContain('showing first ~10 tokens (line 1) + last ~10 tokens (line 10)');
  });

  it('describes a cut inside a single long line', async () => {
    const result = await applyTokenLimitSandwich('word '.repeat(500), 20, 0.5);
    const { notice } = splitAtNotice(result);

    expect(notice).toContain('dropped the middle of line 1;');
  });

  it('counts dropped lines from line 1 when the head budget is zero', async () => {
    const result = await applyTokenLimitSandwich(longLines, 20, 0);
    const { notice, head } = splitAtNotice(result);

    expect(head).toBe('');
    expect(notice).toContain('dropped lines 1-9 and the start of line 10;');
  });

  it('counts dropped lines to the last line when the tail budget is zero', async () => {
    const result = await applyTokenLimitSandwich(longLines, 20, 1);
    const { notice } = splitAtNotice(result);

    expect(notice).toContain('dropped the end of line 1 and lines 2-10;');
  });

  it('does not claim a drop when the kept head and tail already cover every character', async () => {
    // Token estimates round per character here, so head + tail can meet or overlap.
    const result = await applyTokenLimitSandwich('😀'.repeat(8), 10, 0.1);
    const { notice, head, tail } = splitAtNotice(result);

    expect((head + tail).match(/😀/gu)?.length).toBeGreaterThanOrEqual(8);
    expect(notice).not.toContain('dropped');
  });

  it('reports exact whole-line ranges when the cuts land on line breaks', async () => {
    const output = range(1, 400)
      .map(n => `line ${n}`)
      .join('\n');
    const result = await applyTokenLimitSandwich(output, 100, 0.2);
    const { notice, head, tail } = splitAtNotice(result);

    const headLines = head.split('\n');
    const tailLines = tail.split('\n');
    const lastHead = headLines.at(-1)!;
    const firstTail = tailLines[0]!;
    // Whatever the cut points, the notice must agree with what was kept.
    const headTo = headLines.length;
    const tailFrom = 400 - tailLines.length + 1;
    expect(notice).toContain(`(lines 1-${headTo})`);
    expect(notice).toContain(`(lines ${tailFrom}-400)`);
    expect(notice).toContain(`lines ${headTo + 1}-${tailFrom - 1}`);
    expect(notice.includes(`the end of line ${headTo}`)).toBe(lastHead !== `line ${headTo}`);
    expect(notice.includes(`the start of line ${tailFrom}`)).toBe(firstTail !== `line ${tailFrom}`);
  });
});
