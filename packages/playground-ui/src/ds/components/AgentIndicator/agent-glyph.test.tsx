// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { agentGlyph } from './agent-glyph';
import { AgentIndicator } from './agent-indicator';
import { agentIndicatorStates } from './poses';

const KINDS: Record<string, string> = { 'trail-cut': 'cut', 'trail-ink': 'ink' };

function drawing(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-part]')]
    .filter(part => Number(part.getAttribute('stroke-width') ?? 1) > 0 && Number(part.getAttribute('r') ?? 1) > 0)
    .map(part => {
      const kind = part.getAttribute('data-part') ?? '';
      const shape = ['d', 'stroke-width', 'cx', 'cy', 'r'].map(name => part.getAttribute(name) ?? '');
      return [KINDS[kind] ?? kind, ...shape].join(' ');
    })
    .toSorted();
}

afterEach(cleanup);

describe('agentGlyph', () => {
  it('draws each pose as a row icon exactly as the indicator holds it', () => {
    for (const state of agentIndicatorStates) {
      const Glyph = agentGlyph(state);
      const still = drawing(render(<Glyph />).container);
      const live = drawing(render(<AgentIndicator state={state} />).container);

      expect(
        still.some(part => part.startsWith('body M')),
        state,
      ).toBe(true);
      expect(still, state).toEqual(live);
      cleanup();
    }
  });

  it('cuts its details out of the shape, as the indicator does', () => {
    const Terminal = agentGlyph('running');
    const { container } = render(<Terminal />);

    const mask = container.querySelector('mask');
    expect(mask?.querySelectorAll('path[d]').length).toBeGreaterThan(0);
    expect(container.querySelector('g[mask]')?.getAttribute('mask')).toBe(`url(#${mask?.id})`);
  });
});
