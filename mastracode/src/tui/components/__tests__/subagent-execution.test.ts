import type { TUI } from '@mariozechner/pi-tui';
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

    expect(lines.some(l => l.includes('┌──'))).toBe(true);
    expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
    expect(lines.some(l => l.includes('└──'))).toBe(true);
    expect(lines.some(l => l.includes('subagent'))).toBe(true);
    expect(lines.some(l => l.includes('explore'))).toBe(true);
  });

  it('renders tool call activity while running', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('search_content'))).toBe(true);
    expect(lines.some(l => l.includes('⋯'))).toBe(true);
  });

  it('marks tool calls as completed', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    comp.addToolEnd('search_content', 'found 3 matches', false);
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('✓') && l.includes('search_content'))).toBe(true);
  });

  it('shows error status on tool call failure', () => {
    const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui);
    comp.addToolStart('search_content', { pattern: 'foo' });
    comp.addToolEnd('search_content', 'error: file not found', true);
    const lines = renderPlain(comp);

    expect(lines.some(l => l.includes('✗') && l.includes('search_content'))).toBe(true);
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
      expect(lines.some(l => l.includes('┌──'))).toBe(true);
      expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(lines.some(l => l.includes('└──'))).toBe(true);
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
      expect(lines.some(l => l.includes('┌──'))).toBe(true);
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
      expect(lines[0]).toContain('└──');
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
      expect(lines[0]).toContain('└──');
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
      expect(lines.some(l => l.includes('┌──'))).toBe(true);
      expect(lines.some(l => l.includes('Find all usages of X'))).toBe(true);
      expect(lines.some(l => l.includes('search_content'))).toBe(true);
      expect(lines.some(l => l.includes('└──'))).toBe(true);
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
      expect(lines.some(l => l.includes('┌──'))).toBe(true);

      // Toggle back to collapsed
      comp.toggleExpanded();
      lines = nonEmpty(renderPlain(comp));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('└──');
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
      expect(lines[0]).toContain('└──');
    });

    it('shows full content while still running (not yet finished)', () => {
      const comp = new SubagentExecutionComponent('explore', 'Find usages', mockTui, undefined, {
        collapseOnComplete: true,
      });
      comp.addToolStart('search_content', { pattern: 'foo' });

      const lines = nonEmpty(renderPlain(comp));

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some(l => l.includes('┌──'))).toBe(true);
      expect(lines.some(l => l.includes('Find usages'))).toBe(true);
    });
  });
});
