import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  it('renders task and borders while running', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find all usages of X', mockTui, 'claude-sonnet-4-20250514');
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('╭──'))).toBe(true);
    expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
    expect(lines.some(l => l.includes('╰──'))).toBe(true);
    expect(lines.some(l => l.includes('subagent'))).toBe(true);
    expect(lines.some(l => l.includes('explore'))).toBe(true);
  });

  it('renders fork as the type and the parent model id when forked', () => {
    const comp = new SubagentExecutionComponent('explore', 'Summarize context', mockTui, 'openai/gpt-5.5', {
      forked: true,
    });
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('subagent fork openai/gpt-5.5'))).toBe(true);
    expect(lines.some(l => l.includes('subagent explore fork'))).toBe(false);
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

      // Should still show full bordered box content
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('╭──'))).toBe(true);
      expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(lines.some(l => l.includes('╰──'))).toBe(true);
      expect(lines.some(l => l.includes('✓'))).toBe(true);
    });

    it('keeps full content visible even when setExpanded(false) is called', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
      comp.addToolStart('view', { path: 'foo.ts' });
      comp.addToolEnd('view', 'contents', false);
      comp.finish(false, 5000);

      // Even explicitly setting expanded=false should NOT collapse without the option
      comp.setExpanded(false);
      const lines = nonEmpty(renderPlain(comp));

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('╭──'))).toBe(true);
    });
  });

  // ─── Opt-in collapse behavior ──────────────────────────────────────────

  describe('collapse on completion (collapseOnComplete: true)', () => {
    it('collapses to a single footer line when finished and not expanded', () => {
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
      expect(lines[0]).toContain('╰──');
      expect(lines[0]).toContain('subagent');
      expect(lines[0]).toContain('explore');
      expect(lines[0]).toContain('✓');
    });

    it('collapses to footer on error completion too', () => {
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
      expect(lines[0]).toContain('╰──');
      expect(lines[0]).toContain('✗');
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

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('╭──'))).toBe(true);
      expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(lines.some(l => l.includes('search_content'))).toBe(true);
      expect(lines.some(l => l.includes('╰──'))).toBe(true);
    });

    it('can stay expanded on completion and show the final result', () => {
      const comp = new SubagentExecutionComponent('explore', 'List files', mockTui, 'openai/gpt-5.5', {
        expandOnComplete: true,
      });
      comp.addToolStart('find_files', { path: '/tmp/quiet-tool-demo' });
      comp.addToolEnd('find_files', 'browser-demo.html', false);

      comp.finish(false, 10, 'nested\nbrowser-demo.html');

      const lines = nonEmpty(renderPlain(comp));
      expect(lines.some(l => l.includes('╭──'))).toBe(true);
      expect(lines.some(l => l.includes('List files'))).toBe(true);
      expect(lines.some(l => l.includes('find_files'))).toBe(true);
      expect(lines.some(l => l.includes('nested'))).toBe(true);
      expect(lines.some(l => l.includes('browser-demo.html'))).toBe(true);
      expect(lines.some(l => l.includes('subagent explore openai/gpt-5.5'))).toBe(true);
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
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('╭──'))).toBe(true);

      // Toggle back to collapsed
      comp.toggleExpanded();
      lines = nonEmpty(renderPlain(comp));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('╰──');
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
      expect(lines[0]).toContain('╰──');
    });

    it('shows full content while still running (not yet finished)', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui, undefined, {
        collapseOnComplete: true,
      });
      comp.addToolStart('search_content', { pattern: 'foo' });

      const lines = nonEmpty(renderPlain(comp));

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('╭──'))).toBe(true);
      expect(lines.some(l => l.includes('Find usages'))).toBe(true);
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
