import { describe, it, expect } from 'vitest';
import { buildHelpText } from '../help-overlay.js';

describe('buildHelpText', () => {
  const baseOpts = { modes: 1, customSlashCommands: [] };

  it('includes command entries', () => {
    const text = buildHelpText(baseOpts);
    expect(text).toContain('/new');
    expect(text).toContain('/threads');
    expect(text).toContain('/settings');
    expect(text).toContain('/models');
    expect(text).not.toContain('/models:pack');
    expect(text).toContain('/help');
  });

  it('includes shell section', () => {
    const text = buildHelpText(baseOpts);
    expect(text).toContain('Shell');
    expect(text).toContain('!<cmd>');
  });

  it('includes keyboard shortcuts', () => {
    const text = buildHelpText(baseOpts);
    expect(text).toContain('Ctrl+C');
    expect(text).toContain('Ctrl+D');
    expect(text).toContain('Ctrl+F');
    expect(text).toContain('Ctrl+T');
    expect(text).toContain('Ctrl+E');
    expect(text).toContain('Ctrl+Y');
    expect(text).toContain('Ctrl+Z');
  });

  it('shows ⇧+Tab and /mode when multiple modes', () => {
    const text = buildHelpText({ ...baseOpts, modes: 3 });
    expect(text).toContain('⇧+Tab');
    expect(text).toMatch(/\/mode\s+Switch/);
  });

  it('hides ⇧+Tab and /mode when single mode', () => {
    const text = buildHelpText(baseOpts);
    expect(text).not.toContain('⇧+Tab');
    expect(text).not.toMatch(/\/mode\s+Switch/);
  });

  it('shows custom slash commands', () => {
    const text = buildHelpText({
      ...baseOpts,
      customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod', template: '', sourcePath: '' }],
    });
    expect(text).toContain('//deploy');
    expect(text).toContain('Deploy to prod');
  });
});
