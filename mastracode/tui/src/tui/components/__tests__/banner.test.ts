import stripAnsi from 'strip-ansi';
import { describe, it, expect, afterEach } from 'vitest';
import { renderBanner } from '../banner.js';

describe('renderBanner', () => {
  const originalColumns = process.stdout.columns;

  afterEach(() => {
    // Restore original columns
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  function setColumns(n: number) {
    Object.defineProperty(process.stdout, 'columns', {
      value: n,
      writable: true,
      configurable: true,
    });
  }

  it('renders multi-line block art for wide terminals', () => {
    setColumns(80);
    const result = renderBanner('0.2.0');
    const plain = stripAnsi(result);
    const lines = plain.split('\n');
    // 3 lines of art + 1 version line
    expect(lines.length).toBe(4);
    expect(plain).toContain('█');
    expect(plain).toContain('▀');
  });

  it('includes the version string', () => {
    setColumns(80);
    const result = renderBanner('1.2.3');
    const plain = stripAnsi(result);
    expect(plain).toContain('v1.2.3');
  });

  it('uses short MASTRA art for medium terminals (30-49 cols)', () => {
    setColumns(40);
    const result = renderBanner('0.2.0');
    const plain = stripAnsi(result);
    const lines = plain.split('\n');
    // Short art is 24 chars wide, should not contain CODE letters
    expect(lines.length).toBe(4);
    // First line of short art is 24 chars; full art is 42
    expect(lines[0]!.length).toBeLessThan(30);
  });

  it('falls back to compact single line for narrow terminals', () => {
    setColumns(25);
    const result = renderBanner('0.2.0');
    const plain = stripAnsi(result);
    expect(plain).toContain('Mastra Code');
    expect(plain).toContain('v0.2.0');
    // Should be a single line (no block art)
    expect(plain.split('\n').length).toBe(1);
  });

  it('uses compact format for custom appName', () => {
    setColumns(80);
    const result = renderBanner('1.0.0', 'My Custom App');
    const plain = stripAnsi(result);
    expect(plain).toContain('My Custom App');
    expect(plain).toContain('v1.0.0');
    // Should NOT contain block art characters
    expect(plain).not.toContain('█');
  });
});
