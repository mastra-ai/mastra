import { describe, expect, it } from 'vitest';
import { reconciledBolaBinding } from '../src/investigation/bola-bindings.js';
import type { Target, Profile } from '../src/core/contracts.js';
import type { Scan } from '../src/discovery/contracts.js';
import type { BolaAssessment } from '../src/investigation/bola-store.js';

const assessment = {
  targetId: 'target-1',
  targetRevision: 4,
  policyRevision: 1,
  profiles: [{ profileId: 'profile-1', profileRevision: 2, credentialRevision: 1 }],
} as BolaAssessment;
const scan = { createdAt: '2026-11-02T10:00:00.000Z', roles: [{ profileId: 'profile-1', identity: 'READY' }] } as Scan;
const target = { revision: 4, policyRevision: 1 } as Target;
const profile = {
  id: 'profile-1',
  targetId: 'target-1',
  kind: 'api_key_header',
  revision: 3,
  credentialRevision: 1,
  identityResult: { status: 'READY', profileRevision: 3, checkedAt: '2026-11-02T10:01:00.000Z' },
} as Profile;
const bound = assessment.profiles[0]!;

describe('BOLA post-discovery binding', () => {
  it('accepts the scan-owned readiness revision and rejects credential rotation or scope change', () => {
    expect(reconciledBolaBinding(assessment, scan, target, profile, bound)).toMatchObject({
      targetRevision: 4,
      profileRevision: 3,
      credentialRevision: 1,
    });
    expect(() =>
      reconciledBolaBinding(assessment, scan, target, { ...profile, credentialRevision: 2 } as Profile, bound),
    ).toThrow('BOLA_DISCOVERY_BINDING_CHANGED');
    expect(() => reconciledBolaBinding(assessment, scan, { ...target, revision: 5 } as Target, profile, bound)).toThrow(
      'BOLA_REVISION_CHANGED',
    );
    expect(() =>
      reconciledBolaBinding(
        assessment,
        scan,
        target,
        {
          ...profile,
          identityResult: { ...profile.identityResult!, checkedAt: '2026-11-02T09:59:00.000Z' },
        } as Profile,
        bound,
      ),
    ).toThrow('BOLA_DISCOVERY_BINDING_CHANGED');
    expect(() =>
      reconciledBolaBinding(assessment, scan, target, { ...profile, revision: 4 } as Profile, bound),
    ).toThrow('BOLA_DISCOVERY_BINDING_CHANGED');
  });
});
