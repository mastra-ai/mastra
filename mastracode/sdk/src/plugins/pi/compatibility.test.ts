import { describe, expect, it } from 'vitest';
import {
  createPiPackageCompatibility,
  getPiPackageCompatibilityStatus,
  PI_COMPATIBILITY_TARGET_VERSION,
  type PiCapabilityCompatibility,
  type PiCapabilitySupport,
} from './compatibility.js';

function capability(name: string, support: PiCapabilitySupport): PiCapabilityCompatibility {
  return {
    name,
    support,
    evidence: [{ source: `fixture:${name}` }],
    diagnostics: [],
  };
}

describe('Pi package compatibility', () => {
  it.each([
    { supports: ['direct'] as const, expected: 'pi-compatible' },
    { supports: ['adapted'] as const, expected: 'pi-compatible' },
    { supports: ['direct', 'adapted'] as const, expected: 'pi-compatible' },
    { supports: ['direct', 'version-gated'] as const, expected: 'pi-partial' },
    { supports: ['adapted', 'unsupported'] as const, expected: 'pi-partial' },
    { supports: ['unsupported'] as const, expected: 'pi-incompatible' },
    { supports: ['version-gated'] as const, expected: 'pi-incompatible' },
    { supports: [] as const, expected: 'pi-incompatible' },
  ])('aggregates $supports as $expected', ({ supports, expected }) => {
    const capabilities = supports.map((support, index) => capability(`capability-${index}`, support));

    expect(getPiPackageCompatibilityStatus(capabilities)).toBe(expected);
  });

  it('cannot report a package with unsupported capabilities as fully compatible', () => {
    const report = createPiPackageCompatibility([
      capability('registerTool', 'adapted'),
      capability('registerMarkdownTransformer', 'unsupported'),
    ]);

    expect(report).toMatchObject({
      targetApiVersion: PI_COMPATIBILITY_TARGET_VERSION,
      status: 'pi-partial',
    });
    expect(report.status).not.toBe('pi-compatible');
  });

  it('preserves attributed capability and package diagnostics', () => {
    const unsupported = capability('registerEntryRenderer', 'unsupported');
    unsupported.diagnostics.push({
      severity: 'warning',
      capability: unsupported.name,
      extensionId: 'fixture-extension',
      message: 'Session entry renderers are not supported.',
    });

    const report = createPiPackageCompatibility(
      [unsupported],
      [
        {
          severity: 'error',
          extensionId: 'fixture-extension',
          message: 'No compatible capabilities were registered.',
        },
      ],
    );

    expect(report.capabilities[0]?.diagnostics[0]).toMatchObject({
      capability: 'registerEntryRenderer',
      extensionId: 'fixture-extension',
    });
    expect(report.diagnostics[0]?.extensionId).toBe('fixture-extension');
  });
});
