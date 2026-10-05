import { visibleWidth } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, it, expect } from 'vitest';
import { HeaderComponent, LOGO_HEADER, LOGO_LARGE, renderHeader } from '../banner.js';

const INFO = ['Project: mastra', 'Resource ID: mastra-c597b1a88f39', 'Branch: main', 'Worktree of: /dev/mastra'];
const plain = (lines: string[]) => lines.map(l => stripAnsi(l));

describe('renderHeader', () => {
  it('puts the logo beside the title and info on wide terminals', () => {
    const lines = plain(renderHeader(100, { version: '1.2.3', info: INFO }));
    expect(lines).toHaveLength(LOGO_HEADER.length);
    expect(lines[0]).toContain('⣠⣶⣶⣄');
    expect(lines[0]).toContain('Mastra Code v1.2.3');
    expect(lines[4]).toContain('Worktree of: /dev/mastra');
  });

  it('pads the info block to the logo height when there is no worktree line', () => {
    const lines = plain(renderHeader(100, { version: '1.2.3', info: INFO.slice(0, 3) }));
    expect(lines).toHaveLength(LOGO_HEADER.length);
    expect(lines[0]).toContain('Mastra Code v1.2.3');
    // Blank row under the title, then the three info lines down to the logo's last row.
    expect(lines[1]!.trimEnd()).toBe(LOGO_HEADER[1]!.trimEnd());
    expect(lines[2]).toContain('Project: mastra');
    expect(lines[4]).toContain('Branch: main');
  });

  it('stacks the logo above the info when there is no room beside it', () => {
    const lines = plain(renderHeader(44, { version: '0.2.0', info: INFO }));
    expect(lines.slice(0, LOGO_HEADER.length).join('\n')).toContain('⣠⣶⣶⣄');
    expect(lines).toContain('Mastra Code v0.2.0');
    expect(lines.at(-1)).toBe('Worktree of: /dev/mastra');
  });

  it('falls back to a single text line on very narrow terminals', () => {
    const lines = plain(renderHeader(25, { version: '0.2.0', info: INFO }));
    expect(lines).toEqual(['◆ Mastra Code v0.2.0']);
  });

  it('uses the compact format without the logo for a custom appName', () => {
    const lines = plain(renderHeader(100, { version: '1.0.0', appName: 'My Custom App', info: INFO }));
    expect(lines).toEqual(['◆ My Custom App v1.0.0']);
  });
});

describe('logo', () => {
  it.each([
    ['header', LOGO_HEADER],
    ['large', LOGO_LARGE],
  ])('%s logo rows are mirror-symmetric around the middle circle', (_name, rows) => {
    // Braille dot columns: flip each cell's two columns and reverse the row (the right-hand bridge from
    // the top-right blob down to the bottom-right circle is the only intentionally asymmetric part).
    const width = Math.max(...rows.map(r => visibleWidth(r)));
    const toDots = (row: string) =>
      [...row.padEnd(width, ' ')].flatMap(ch => {
        const bits = ch === ' ' ? 0 : ch.codePointAt(0)! - 0x2800;
        const left = [0x01, 0x02, 0x04, 0x40].map(b => (bits & b ? 1 : 0)).join('');
        const right = [0x08, 0x10, 0x20, 0x80].map(b => (bits & b ? 1 : 0)).join('');
        return [left, right];
      });
    const bottom = toDots(rows.at(-1)!);
    expect(bottom).toEqual([...bottom].reverse());
  });
});

describe('HeaderComponent', () => {
  it('re-lays out for the width it is rendered at', () => {
    const header = new HeaderComponent({ version: '1.0.0', info: INFO });
    expect(plain(header.render(120))).toHaveLength(LOGO_HEADER.length);
    expect(plain(header.render(24))).toEqual([' ◆ Mastra Code v1.0.0']);
  });
});
