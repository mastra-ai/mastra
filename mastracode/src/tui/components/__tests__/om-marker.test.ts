import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

vi.mock('chalk', () => {
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../../theme.js', () => ({
  BOX_INDENT: 0,
  theme: {
    fg: (_tone: string, value: string) => value,
  },
}));

import { OMMarkerComponent } from '../om-marker.js';

describe('OMMarkerComponent activation rendering', () => {
  it('renders TTL expiry as a separate muted line', () => {
    const ttlMarker = new OMMarkerComponent({
      type: 'om_activation_ttl',
      activateAfterIdle: 300_000,
      ttlExpiredMs: 66_000_000,
    });

    const activationMarker = new OMMarkerComponent({
      type: 'om_activation',
      operationType: 'observation',
      tokensActivated: 7300,
      observationTokens: 400,
    });

    const ttlText = stripAnsi(ttlMarker.render(120).join('\n'));
    const activationText = stripAnsi(activationMarker.render(120).join('\n'));

    expect(ttlText).toContain('Idle timeout (5m) exceeded by 18h20m, activating observations');
    expect(activationText).toContain('✓ Activated observations: -7.3k msg tokens, +0.4k obs tokens');
    expect(activationText).not.toContain('TTL');
  });

  it('renders reflection activation without TTL suffix', () => {
    const activationMarker = new OMMarkerComponent({
      type: 'om_activation',
      operationType: 'reflection',
      tokensActivated: 2400,
      observationTokens: 600,
    });

    const activationText = stripAnsi(activationMarker.render(120).join('\n'));

    expect(activationText).toContain('✓ Activated reflection: -2.4k msg tokens, +0.6k obs tokens');
    expect(activationText).not.toContain('TTL');
  });
});
