import { describe, it, expect, vi } from 'vitest';
import stripAnsi from 'strip-ansi';
import { HelpOverlayComponent } from '../help-overlay.js';

function renderText(overlay: HelpOverlayComponent): string {
  return stripAnsi(overlay.render(120).join('\n'));
}

describe('HelpOverlayComponent', () => {
  const baseOpts = { modes: 1, customSlashCommands: [], onClose: vi.fn() };

  it('renders Help title', () => {
    const text = renderText(new HelpOverlayComponent(baseOpts));
    expect(text).toContain('Help');
  });

  it('renders command entries', () => {
    const text = renderText(new HelpOverlayComponent(baseOpts));
    expect(text).toContain('/new');
    expect(text).toContain('/threads');
    expect(text).toContain('/settings');
    expect(text).toContain('/help');
  });

  it('renders shell section', () => {
    const text = renderText(new HelpOverlayComponent(baseOpts));
    expect(text).toContain('Shell');
    expect(text).toContain('!<cmd>');
  });

  it('renders keyboard shortcuts', () => {
    const text = renderText(new HelpOverlayComponent(baseOpts));
    expect(text).toContain('Ctrl+C');
    expect(text).toContain('Ctrl+D');
    expect(text).toContain('Ctrl+F');
    expect(text).toContain('Ctrl+T');
    expect(text).toContain('Ctrl+E');
    expect(text).toContain('Ctrl+Y');
    expect(text).toContain('Ctrl+Z');
  });

  it('shows ⇧Tab when multiple modes', () => {
    const text = renderText(new HelpOverlayComponent({ ...baseOpts, modes: 3 }));
    expect(text).toContain('⇧Tab');
    expect(text).toMatch(/\/mode\s+Switch/);
  });

  it('hides ⇧Tab and /mode when single mode', () => {
    const text = renderText(new HelpOverlayComponent(baseOpts));
    expect(text).not.toContain('⇧Tab');
    expect(text).not.toMatch(/\/mode\s+Switch/);
  });

  it('shows custom slash commands', () => {
    const text = renderText(
      new HelpOverlayComponent({
        ...baseOpts,
        customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod' }],
      }),
    );
    expect(text).toContain('//deploy');
    expect(text).toContain('Deploy to prod');
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    const overlay = new HelpOverlayComponent({ ...baseOpts, onClose });
    overlay.handleInput('\x1b');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
