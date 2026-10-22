import { describe, expect, it } from 'vitest';

import {
  formatInstallingLabel,
  formatRegistryError,
  formatUpdateHeader,
  formatUpdateOutcome,
  formatUpToDate,
} from './update-output.js';
import type { UpdateStyle } from './update-output.js';

const plain: UpdateStyle = { accent: s => s, muted: s => s, error: s => s, warning: s => s, bold: s => s };
const tagged: UpdateStyle = {
  accent: s => `<a>${s}</a>`,
  muted: s => `<m>${s}</m>`,
  error: s => `<e>${s}</e>`,
  warning: s => `<w>${s}</w>`,
  bold: s => `<b>${s}</b>`,
};

describe('update output', () => {
  it('shows the current version, or the move to the new one', () => {
    expect(formatUpdateHeader(plain, '1.0.0')).toBe('Mastra Code  v1.0.0');
    expect(formatUpdateHeader(plain, '1.0.0', '1.1.0')).toBe('Mastra Code  v1.0.0 → v1.1.0');
    expect(formatUpdateHeader(tagged, '1.0.0', '1.1.0')).toBe(
      '<b>Mastra Code</b>  <m>v1.0.0 →</m> <a><b>v1.1.0</b></a>',
    );
  });

  it('formats the simple states', () => {
    expect(formatUpToDate(tagged)).toBe('<a>✓</a> Up to date');
    expect(formatRegistryError(plain)).toBe("✗ Couldn't reach the npm registry. Check your connection and try again.");
    expect(formatInstallingLabel(tagged, { via: 'pnpm', command: 'pnpm add -g mastracode@1.1.0' })).toBe(
      'Installing with pnpm  <m>pnpm add -g mastracode@1.1.0</m>',
    );
  });

  it('reports an update, with a restart hint inside the TUI', () => {
    const outcome = { status: 'updated', message: '', via: 'pnpm' } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual(['✓ Updated with pnpm']);
    expect(formatUpdateOutcome(plain, outcome, '1.1.0', { restartHint: true })).toEqual([
      '✓ Updated with pnpm. Run mastracode to start the new version.',
    ]);
  });

  it('shows the error details and the command to run when the install fails', () => {
    const outcome = {
      status: 'failed',
      message: '',
      command: 'npm install -g mastracode@1.1.0',
      details: 'npm ERR! code EACCES\nnpm ERR! permission denied',
    } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual([
      '✗ Update failed',
      '  npm ERR! code EACCES',
      '  npm ERR! permission denied',
      '',
      'Run it yourself:  npm install -g mastracode@1.1.0',
    ]);
  });

  it('leaves out the command when there is nothing to run', () => {
    const outcome = {
      status: 'failed',
      message: '',
      details: 'The npm registry returned an unexpected version.',
    } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual([
      '✗ Update failed',
      '  The npm registry returned an unexpected version.',
    ]);
  });

  it('points to the owning tool when another tool manages the install', () => {
    const outcome = {
      status: 'unchanged',
      message: '',
      command: 'brew upgrade mastracode',
      installDir: '/opt/homebrew/Cellar/mastracode/1.0.0/libexec',
      managedBy: 'Homebrew',
    } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual([
      '! Installed with Homebrew, so update it there:',
      '',
      '  brew upgrade mastracode',
    ]);
  });

  it('explains when the install ran but the running copy is still old', () => {
    const outcome = {
      status: 'unchanged',
      message: '',
      command: 'pnpm add -g mastracode@1.1.0',
      installDir: '/opt/tools/mastracode',
      runningVersion: '1.0.0',
      ranWith: 'pnpm',
    } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual([
      "! This Mastra Code wasn't updated",
      "  pnpm installed v1.1.0, but the copy you're running is still v1.0.0",
      '  at /opt/tools/mastracode',
      '',
      'Update it with the tool that installed it, or run:  pnpm add -g mastracode@1.1.0',
    ]);
  });

  it('explains when the package manager does not manage the running copy', () => {
    const outcome = {
      status: 'unchanged',
      message: '',
      command: 'npm install -g mastracode@1.1.0',
      installDir: '/opt/tools/mastracode',
    } as const;
    expect(formatUpdateOutcome(plain, outcome, '1.1.0')).toEqual([
      "! This Mastra Code wasn't updated",
      '  It was installed by another tool, at /opt/tools/mastracode',
      '',
      'Update it with the tool that installed it, or run:  npm install -g mastracode@1.1.0',
    ]);
  });
});
