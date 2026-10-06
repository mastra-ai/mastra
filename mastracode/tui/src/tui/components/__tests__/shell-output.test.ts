import stripAnsi from 'strip-ansi';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  textNodes: [] as string[],
  truncateAnsi: vi.fn((text: string) => text),
}));

vi.mock('@earendil-works/pi-tui', () => {
  class Container {
    children: unknown[] = [];

    addChild(child: unknown): void {
      this.children.push(child);
    }

    clear(): void {
      this.children = [];
      mocks.textNodes.length = 0;
    }

    invalidate(): void {}

    render(_width: number): string[] {
      return [];
    }
  }

  class Spacer {
    constructor(_height: number) {}
  }

  class Text {
    constructor(text: string) {
      mocks.textNodes.push(text);
    }
  }

  return { Container, Spacer, Text, visibleWidth: (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '').length };
});

vi.mock('../ansi.js', () => ({
  truncateAnsi: mocks.truncateAnsi,
}));

vi.mock('../../theme.js', () => ({
  getTermWidth: () => 80,
  surfaceShade: () => '#222222',
  theme: {
    bold: (value: string) => value,
    fg: (_tone: string, value: string) => value,
  },
}));

import { ShellStreamComponent } from '../shell-output.js';

/** Rendered rows without ANSI codes or the panel's trailing background padding. */
function renderedLines(component: ShellStreamComponent) {
  component.render(80);
  return stripAnsi(mocks.textNodes.join('\n'))
    .split('\n')
    .map(line => line.trimEnd());
}

/** The rows of the shaded output panel, between the ▄ top edge and the ▀ bottom edge. */
function panelRows(lines: string[]) {
  const top = lines.findIndex(line => /^▄+$/.test(line));
  const bottom = lines.findIndex(line => /^▀+$/.test(line));
  expect(top).toBeGreaterThan(0);
  expect(bottom).toBe(lines.length - 1);
  return lines.slice(top + 1, bottom);
}

describe('ShellStreamComponent', () => {
  beforeEach(() => {
    mocks.textNodes.length = 0;
    mocks.truncateAnsi.mockClear();
  });

  it('renders incremental output, flushes partial lines on finish, and shows the failure state', () => {
    const component = new ShellStreamComponent('pnpm test');

    component.appendOutput('stdout one\nstderr partial');

    const running = renderedLines(component);
    // Running: dot + command, no duration or failure mark yet.
    expect(running[0]).toBe('• $ pnpm test');
    expect(panelRows(running)).toEqual(['  stdout one', '  stderr partial']);
    expect(running.join('\n')).not.toMatch(/[│╭╰]/);

    component.finish(2);

    const finished = renderedLines(component);
    expect(finished[0]).toMatch(/^• \$ pnpm test \d+ms ✗$/);
    // The partial line is flushed and the exit code is the last panel row.
    expect(panelRows(finished)).toEqual(['  stdout one', '  stderr partial', '  Exit code: 2']);
  });

  it('renders only the title row when there is no output', () => {
    const component = new ShellStreamComponent('true');
    component.finish(0);

    const lines = renderedLines(component);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^• \$ true \d+ms$/);
  });

  it('keeps only the latest 200 lines and shows the latest 20 while collapsed', () => {
    const component = new ShellStreamComponent('seq 205');
    const output = Array.from({ length: 205 }, (_, index) => `line-${index + 1}`).join('\n') + '\n';

    component.appendOutput(output);

    const collapsed = panelRows(renderedLines(component));
    expect(collapsed).toHaveLength(21);
    // Truncation note sits at the top of the panel.
    expect(collapsed[0]).toBe('  … 180 earlier lines · ctrl+e to expand');
    expect(collapsed[1]).toBe('  line-186');
    expect(collapsed.at(-1)).toBe('  line-205');
    expect(collapsed).not.toContain('  line-185');

    component.setExpanded(true);

    const expanded = panelRows(renderedLines(component));
    expect(expanded).toHaveLength(200);
    expect(expanded[0]).toBe('  line-6');
    expect(expanded.at(-1)).toBe('  line-205');
    expect(expanded).not.toContain('  line-5');
    expect(expanded.some(line => line.includes('earlier lines'))).toBe(false);
  });

  it('truncates output lines to the terminal width minus the panel indent', () => {
    const component = new ShellStreamComponent('echo long');

    component.appendOutput('x'.repeat(120) + '\n');
    component.render(80);

    expect(mocks.truncateAnsi).toHaveBeenCalledWith('x'.repeat(120), 77);
  });
});
