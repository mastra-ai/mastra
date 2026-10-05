import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentExecutionComponent } from '../subagent-execution.js';

// Minimal mock TUI — only requestRender() is called by SubagentExecutionComponent
const mockTui = { requestRender: () => {} } as unknown as TUI;

// Terminal width used for render()
const WIDTH = 80;

function renderPlain(component: SubagentExecutionComponent): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

function nonEmpty(lines: string[]): string[] {
  return lines.filter(l => l.trim().length > 0);
}

/**
 * Splits a tool-style block into its "● title" row and the rows of the shaded panel between the ▄ and ▀ edges.
 * Asserts the block uses that structure and no box borders.
 */
function toolBlockParts(lines: string[]): { title: string; panel: string[] } {
  const top = lines.findIndex(l => /^▄+$/.test(l.trim()));
  const bottom = lines.findIndex(l => /^▀+$/.test(l.trim()));
  expect(lines[0]).toMatch(/^● /);
  expect(top).toBe(1);
  expect(bottom).toBe(lines.length - 1);
  expect(lines.join('\n')).not.toMatch(/[╭╰│]/);
  return { title: lines[0]!, panel: lines.slice(top + 1, bottom) };
}

describe('SubagentExecutionComponent', () => {
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

  it('uses elapsed time when finish has no reported duration', () => {
    vi.useFakeTimers();
    try {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
      vi.advanceTimersByTime(12_300);
      comp.finish(false, undefined, 'done');
      expect(comp['durationMs']).toBe(12_300);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the reported duration when finish is called again without one', () => {
    vi.useFakeTimers();
    try {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
      comp.finish(false, 4_000);
      vi.advanceTimersByTime(9_000);
      comp.finish(false, undefined, 'final');
      expect(comp['durationMs']).toBe(4_000);
      expect(comp['finalResult']).toBe('final');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the title row and the task on a panel while running', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find all usages of X', mockTui, 'claude-sonnet-4-20250514');
    const { title, panel } = toolBlockParts(renderPlain(comp));

    expect(title.trimEnd()).toBe('● subagent explore claude-sonnet-4-20250514');
    expect(panel.map(l => l.trimEnd())).toEqual(['  Find all usages of X']);
  });

  it('renders fork as the type and the parent model id when forked', () => {
    const comp = new SubagentExecutionComponent('explore', 'Summarize context', mockTui, 'openai/gpt-5.5', {
      forked: true,
    });
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('subagent fork openai/gpt-5.5'))).toBe(true);
    expect(lines.some(l => l.includes('subagent explore fork'))).toBe(false);
  });

  it('matches ordinary tool background lifecycle indicators', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Inspect architecture', mockTui);
    comp.setBackgroundTaskId('task-1');

    expect(renderPlain(comp).join('\n')).toContain('◌ background · task-1');

    comp.finish(false, 1000, 'done');
    expect(renderPlain(comp).join('\n')).toContain('✓ background · task-1');

    const failed = new SubagentExecutionComponent('alexandria', 'Inspect architecture', mockTui);
    failed.setBackgroundTaskId('task-2');
    failed.finish(true, 1000, 'failed');
    expect(renderPlain(failed).join('\n')).toContain('✗ background · task-2');
  });

  it('renders tool call activity while running', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('search_content'))).toBe(true);
    expect(lines.some(l => l.includes('⋯'))).toBe(true);
  });

  it('honors custom labels, icons, and activity height', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Answer question', mockTui, undefined, {
      label: 'mastra',
      maxActivityLines: 3,
      icons: { running: '…', success: 'ok', error: 'bad' },
    });
    for (let i = 0; i < 5; i++) {
      comp.addToolStart(`tool_${i}`, { value: `${i}` });
    }
    const lines = renderPlain(comp);
    const rendered = lines.join('\n');

    expect(rendered).toContain('mastra alexandria');
    expect(rendered).toContain('… tool_4');
    expect(rendered).toContain('2 more above');
    expect(rendered).not.toContain('tool_0');
  });

  it('marks tool calls as completed', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    comp.addToolEnd('search_content', 'found 3 matches', false);
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('✓') && l.includes('search_content'))).toBe(true);
  });

  it('uses available line width for long string args', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Inspect architecture', mockTui);
    comp.addToolStart('view', { path: '.sources/mastra/packages/core/src/agent/workflows/agent-execution-loop.ts' });
    const rendered = renderPlain(comp).join('\n');

    expect(rendered).toContain('.sources/mastra/packages/core/src/agent/workflows/agent');
    expect(rendered).not.toContain('.sources/mastra/packages/core/src/agent/wor…');
  });

  it('shows error status on tool call failure', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    comp.addToolEnd('search_content', 'error: file not found', true);
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('✗') && l.includes('search_content'))).toBe(true);
  });

  it('keeps assistant text in chronological activity order with tools', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Answer question', mockTui);
    comp.setText('First answer draft');
    comp.addToolStart('find_files', { pattern: '**/CODE_OF_CONDUCT*' });
    comp.addToolEnd('find_files', 'CODE_OF_CONDUCT.md', false);
    comp.setText('First answer draft Final answer after lookup');

    const rendered = renderPlain(comp).join('\n');

    expect(rendered.indexOf('First answer draft')).toBeLessThan(rendered.indexOf('find_files'));
    expect(rendered.indexOf('find_files')).toBeLessThan(rendered.indexOf('Final answer after lookup'));
  });

  it('does not repeat unchanged full text snapshots after tool calls', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Answer question', mockTui);
    comp.setText('That initial grep only scanned a few directories.');
    comp.addToolStart('execute_command', { command: 'rg -l package.json' });
    comp.addToolEnd('execute_command', 'ok', false);
    comp.setText('That initial grep only scanned a few directories.');
    comp.addToolStart('execute_command', { command: 'find . -name package.json' });
    comp.addToolEnd('execute_command', 'ok', false);
    comp.setText('That initial grep only scanned a few directories.');

    const rendered = renderPlain(comp).join('\n');

    expect(rendered.match(/That initial grep only scanned a few directories\./g)).toHaveLength(1);
    expect(rendered).toContain('rg -l package.json');
    expect(rendered).toContain('find . -name package.json');
  });

  it('does not duplicate streamed assistant text as the expanded final result', () => {
    const comp = new SubagentExecutionComponent('alexandria', 'Answer question', mockTui, undefined, {
      expandOnComplete: true,
    });
    comp.setText('Final answer after lookup');
    comp.finish(false, 5000, 'Final answer after lookup');

    const rendered = renderPlain(comp).join('\n');

    expect(rendered.match(/Final answer after lookup/g)).toHaveLength(1);
  });

  // ─── Default behavior: NO collapse ──────────────────────────────────────

  describe('default behavior (collapseOnComplete: false)', () => {
    it('keeps full content visible after finish', () => {
      const comp = new SubagentExecutionComponent(
        'explore',
        'Find all usages of X',
        mockTui,
        'claude-sonnet-4-20250514',
      );
      comp.addToolStart('search_content', { pattern: 'foo' });
      comp.addToolEnd('search_content', 'found 3 matches', false);
      comp.finish(false, 12300);

      const lines = nonEmpty(renderPlain(comp));

      // Should still show the title and the full panel content
      const { title, panel } = toolBlockParts(lines);
      expect(title).toContain('subagent explore claude-sonnet-4-20250514 12.3s');
      // Success is shown by the dot alone, not an icon in the title.
      expect(title).not.toContain('✓');
      expect(panel.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(panel.some(l => l.includes('✓') && l.includes('search_content'))).toBe(true);
    });

    it('keeps full content visible even when setExpanded(false) is called', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
      comp.addToolStart('view', { path: 'foo.ts' });
      comp.addToolEnd('view', 'contents', false);
      comp.finish(false, 5000);

      // Even explicitly setting expanded=false should NOT collapse without the option
      comp.setExpanded(false);
      const lines = nonEmpty(renderPlain(comp));

      const { panel } = toolBlockParts(lines);
      expect(panel.some(l => l.includes('Find usages'))).toBe(true);
      expect(panel.some(l => l.includes('view'))).toBe(true);
    });
  });

  // ─── Opt-in collapse behavior ──────────────────────────────────────────

  describe('collapse on completion (collapseOnComplete: true)', () => {
    it('collapses to the single title row when finished and not expanded', () => {
      const comp = new SubagentExecutionComponent(
        'explore',
        'Find all usages of X',
        mockTui,
        'claude-sonnet-4-20250514',
        { collapseOnComplete: true },
      );
      comp.addToolStart('search_content', { pattern: 'foo' });
      comp.addToolEnd('search_content', 'found 3 matches', false);
      comp.addToolStart('view', { path: 'src/index.ts' });
      comp.addToolEnd('view', 'file contents...', false);

      comp.finish(false, 12300);

      const lines = nonEmpty(renderPlain(comp));

      expect(lines).toHaveLength(1);
      expect(lines[0]!.trimEnd()).toBe('● subagent explore claude-sonnet-4-20250514 12.3s');
    });

    it('collapses to the title row on error completion too, keeping the error icon', () => {
      const comp = new SubagentExecutionComponent(
        'execute',
        'Implement feature Y',
        mockTui,
        'claude-sonnet-4-20250514',
        { collapseOnComplete: true },
      );
      comp.addToolStart('write_file', { path: 'foo.ts' });
      comp.addToolEnd('write_file', 'written', false);

      comp.finish(true, 5000, 'Something went wrong');

      const lines = nonEmpty(renderPlain(comp));

      expect(lines).toHaveLength(1);
      expect(lines[0]!.trimEnd()).toBe('● subagent execute claude-sonnet-4-20250514 5.0s ✗');
    });

    it('shows full content when expanded after completion', () => {
      const comp = new SubagentExecutionComponent(
        'explore',
        'Find all usages of X',
        mockTui,
        'claude-sonnet-4-20250514',
        { collapseOnComplete: true },
      );
      comp.addToolStart('search_content', { pattern: 'foo' });
      comp.addToolEnd('search_content', 'found 3 matches', false);

      comp.finish(false, 12300);

      // Expand
      comp.setExpanded(true);
      const lines = nonEmpty(renderPlain(comp));

      const { title, panel } = toolBlockParts(lines);
      expect(title).toContain('subagent explore');
      expect(panel.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(panel.some(l => l.includes('search_content'))).toBe(true);
    });

    it('can stay expanded on completion and show the final result', () => {
      const comp = new SubagentExecutionComponent('explore', 'List files', mockTui, 'openai/gpt-5.5', {
        expandOnComplete: true,
      });
      comp.addToolStart('find_files', { path: '/tmp/quiet-tool-demo' });
      comp.addToolEnd('find_files', 'browser-demo.html', false);

      comp.finish(false, 10, 'nested\nbrowser-demo.html');

      const lines = nonEmpty(renderPlain(comp));
      const { title, panel } = toolBlockParts(lines);
      expect(title).toContain('subagent explore openai/gpt-5.5');
      expect(panel.some(l => l.includes('List files'))).toBe(true);
      expect(panel.some(l => l.includes('find_files'))).toBe(true);
      // The final result is the end of the panel.
      expect(panel.at(-2)).toContain('nested');
      expect(panel.at(-1)).toContain('browser-demo.html');
    });

    it('toggleExpanded works correctly after completion', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui, undefined, {
        collapseOnComplete: true,
      });
      comp.addToolStart('search_content', { pattern: 'foo' });
      comp.addToolEnd('search_content', 'found 3', false);
      comp.finish(false, 5000);

      // Initially collapsed after finish
      let lines = nonEmpty(renderPlain(comp));
      expect(lines).toHaveLength(1);

      // Toggle to expanded
      comp.toggleExpanded();
      lines = nonEmpty(renderPlain(comp));
      expect(toolBlockParts(lines).panel.some(l => l.includes('search_content'))).toBe(true);

      // Toggle back to collapsed
      comp.toggleExpanded();
      lines = nonEmpty(renderPlain(comp));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^● subagent explore/);
    });

    it('auto-collapses even if user expanded during execution', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui, undefined, {
        collapseOnComplete: true,
      });
      comp.addToolStart('search_content', { pattern: 'foo' });

      // User expands during execution
      comp.setExpanded(true);
      let lines = nonEmpty(renderPlain(comp));
      expect(lines.length).toBeGreaterThan(1);

      // Finish should auto-collapse regardless
      comp.finish(false, 5000);
      lines = nonEmpty(renderPlain(comp));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^● subagent explore/);
    });

    it('shows full content while still running (not yet finished)', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui, undefined, {
        collapseOnComplete: true,
      });
      comp.addToolStart('search_content', { pattern: 'foo' });

      const lines = nonEmpty(renderPlain(comp));

      const { panel } = toolBlockParts(lines);
      expect(panel.some(l => l.includes('Find usages'))).toBe(true);
      expect(panel.some(l => l.includes('search_content'))).toBe(true);
    });

    it('keeps the latest activity visible when completed activity is capped', () => {
      const comp = new SubagentExecutionComponent('alexandria', 'Answer a question', mockTui);
      for (let i = 0; i < 20; i++) {
        comp.addToolStart(`tool_${i}`, { path: `file-${i}.ts` });
        comp.addToolEnd(`tool_${i}`, 'ok', false);
      }
      comp.finish(false, 5000);

      const rendered = renderPlain(comp).join('\n');

      expect(rendered).toContain('more above (ctrl+e to expand)');
      expect(rendered).toContain('tool_19');
      expect(rendered).not.toContain('tool_0');
    });
  });
});
