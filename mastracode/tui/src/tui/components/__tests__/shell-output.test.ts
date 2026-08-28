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

  return { Container, Spacer, Text };
});

vi.mock('../ansi.js', () => ({
  truncateAnsi: mocks.truncateAnsi,
}));

vi.mock('../../theme.js', () => ({
  getTermWidth: () => 80,
  theme: {
    bold: (value: string) => value,
    fg: (_tone: string, value: string) => value,
  },
}));

import { ShellStreamComponent } from '../shell-output.js';

function renderedText(component: ShellStreamComponent) {
  component.render(80);
  return mocks.textNodes.join('\n');
}

function renderedLines(component: ShellStreamComponent) {
  return renderedText(component).split('\n');
}

describe('ShellStreamComponent', () => {
  beforeEach(() => {
    mocks.textNodes.length = 0;
    mocks.truncateAnsi.mockClear();
  });

  it('renders incremental output, flushes partial lines on finish, and shows failure footer', () => {
    const component = new ShellStreamComponent('pnpm test');

    component.appendOutput('stdout one\nstderr partial');

    expect(renderedText(component)).toContain('│ stdout one');
    expect(renderedText(component)).toContain('│ stderr partial');
    expect(renderedText(component)).toContain('$ pnpm test');
    expect(renderedText(component)).toContain('⋯');

    component.finish(2);

    expect(renderedText(component)).toContain('│ stdout one');
    expect(renderedText(component)).toContain('│ stderr partial');
    expect(renderedText(component)).toContain('✗');
    expect(renderedText(component)).toContain('Exit code: 2');
  });

  it('keeps only the latest 200 lines and shows the latest 20 while collapsed', () => {
    const component = new ShellStreamComponent('seq 205');
    const output = Array.from({ length: 205 }, (_, index) => `line-${index + 1}`).join('\n') + '\n';

    component.appendOutput(output);

    const collapsedLines = renderedLines(component);
    expect(collapsedLines).not.toContain('│ line-5');
    expect(collapsedLines).not.toContain('│ line-185');
    expect(collapsedLines).toContain('│ line-186');
    expect(collapsedLines).toContain('│ line-205');
    expect(collapsedLines).toContain('│ ... 180 more lines (Ctrl+E to expand)');

    component.setExpanded(true);

    const expandedLines = renderedLines(component);
    expect(expandedLines).not.toContain('│ line-5');
    expect(expandedLines).toContain('│ line-6');
    expect(expandedLines).toContain('│ line-205');
    expect(expandedLines).not.toContain('│ ... 180 more lines (Ctrl+E to expand)');
  });

  it('truncates output lines to the terminal width minus shell borders', () => {
    const component = new ShellStreamComponent('echo long');

    component.appendOutput('x'.repeat(120) + '\n');
    component.render(80);

    expect(mocks.truncateAnsi).toHaveBeenCalledWith('x'.repeat(120), 74);
  });
});
