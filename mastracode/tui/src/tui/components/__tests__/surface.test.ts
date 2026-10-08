import chalk from 'chalk';
import { afterEach, describe, expect, it } from 'vitest';

import { halfBlockPanel } from '../surface.js';

const level = chalk.level;

describe('halfBlockPanel', () => {
  afterEach(() => {
    chalk.level = level;
  });

  it('draws the body and both edges in the same truecolor shade', () => {
    chalk.level = 3;
    const [top, body, bottom] = halfBlockPanel(['hi'], 6, '#2a2a2e');
    expect(top).toContain('\x1b[38;2;42;42;46m▄▄▄▄▄▄');
    expect(body).toContain('\x1b[48;2;42;42;46m');
    expect(bottom).toContain('\x1b[38;2;42;42;46m▀▀▀▀▀▀');
  });

  it('uses one nearest 256-color gray for the body and edges on 256-color terminals', () => {
    chalk.level = 2;
    const [top, body, bottom] = halfBlockPanel(['hi'], 6, '#2a2a2e');
    // #2a2a2e is closest to gray 235 (#262626).
    expect(top).toContain('\x1b[38;5;235m');
    expect(body).toContain('\x1b[48;5;235m');
    expect(bottom).toContain('\x1b[38;5;235m');
    expect(body).not.toContain('48;2;');
  });

  it('keeps tinted panels neutral on 256-color terminals instead of a saturated cube color', () => {
    chalk.level = 2;
    // A cream panel (Gruvbox Light) lands on the gray ramp, not peach (#ffd7af, 223).
    expect(halfBlockPanel(['hi'], 6, '#f3e9c0')[1]).toMatch(/\x1b\[48;5;(2[3-5]\d|231)m/);
  });

  it('leaves out the shade and blanks the edges without colors', () => {
    chalk.level = 0;
    const [top, body, bottom] = halfBlockPanel(['hi'], 6, '#2a2a2e');
    expect(top).toBe('      ');
    expect(bottom).toBe('      ');
    expect(body).not.toMatch(/\x1b\[48;/);
    expect(body).toContain('hi');
  });
});
