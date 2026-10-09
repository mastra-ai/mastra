import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingInlineComponent } from '../onboarding-inline.js';

function makeOnboarding(rows: number) {
  return new OnboardingInlineComponent({
    tui: { terminal: { rows, columns: 100 }, requestRender: vi.fn() } as any,
    authProviders: [{ label: 'Anthropic (Claude Pro/Max)', value: 'anthropic', loggedIn: false }],
    modePacks: [{ id: 'anthropic', name: 'Anthropic', description: 'All Anthropic models', models: {} } as any],
    omPacks: [{ id: 'haiku', name: 'Claude Haiku', description: 'Via API key', modelId: 'anthropic/claude-haiku-4-5' }],
    hasProviderAccess: true,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    onLogin: vi.fn(),
    onSelectModel: vi.fn(),
  } as any);
}

const visible = (lines: string[]) => lines.map(line => stripAnsi(line));

describe('OnboardingInlineComponent full-screen layout', () => {
  it('fills the terminal with the logo, the step indicator and the current step, centered', () => {
    const lines = visible(makeOnboarding(40).render(100));

    expect(lines).toHaveLength(40);
    expect(lines.every(line => line.length === 100)).toBe(true);
    const text = lines.join('\n');
    expect(text).toContain('⣴⣾⣿⣷⣦');
    expect(text).toMatch(/● Welcome {3}○ Sign in {3}○ Models {3}○ Approval/);
    expect(text).toContain('Welcome to Mastra Code');
    expect(text).not.toContain('👋');
    // Centered: the step indicator starts well away from the left edge.
    const stepper = lines.find(line => line.includes('● Welcome'))!;
    expect(stepper.indexOf('●')).toBeGreaterThan(10);
  });

  it('drops the logo on short terminals but keeps the step', () => {
    const lines = visible(makeOnboarding(14).render(100));

    expect(lines).toHaveLength(14);
    const text = lines.join('\n');
    expect(text).not.toContain('⣿');
    expect(text).toContain('Welcome to Mastra Code');
  });
});
