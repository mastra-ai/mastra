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

  it('renders provider-change activation as a separate muted line', () => {
    const providerChangeMarker = new OMMarkerComponent({
      type: 'om_activation_provider_change',
      previousModel: 'openai/gpt-4o',
      currentModel: 'anthropic/claude-3-7-sonnet',
    });

    const activationMarker = new OMMarkerComponent({
      type: 'om_activation',
      operationType: 'observation',
      tokensActivated: 7300,
      observationTokens: 400,
    });

    const providerChangeText = stripAnsi(providerChangeMarker.render(120).join('\n'));
    const activationText = stripAnsi(activationMarker.render(120).join('\n'));

    expect(providerChangeText).toContain(
      'Model changed openai/gpt-4o → anthropic/claude-3-7-sonnet, activating observations',
    );
    expect(activationText).toContain('✓ Activated observations: -7.3k msg tokens, +0.4k obs tokens');
  });

  it('renders reflection activation as obs-pool compression without TTL suffix', () => {
    const activationMarker = new OMMarkerComponent({
      type: 'om_activation',
      operationType: 'reflection',
      tokensActivated: 19340,
      observationTokens: 17077,
    });

    const activationText = stripAnsi(activationMarker.render(120).join('\n'));

    expect(activationText).toContain('✓ Activated reflection: 19.3k → 17.1k obs tokens (-2.3k)');
    expect(activationText).not.toContain('msg tokens');
    expect(activationText).not.toContain('TTL');
  });
});
