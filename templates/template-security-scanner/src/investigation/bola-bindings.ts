import { ControlPlaneError, type IdentityBinding, type Profile, type Target } from '../core/contracts.js';
import type { Scan } from '../discovery/contracts.js';
import type { BolaAssessment } from './bola-store.js';

/** Accept only the bound identity or the scan's own readiness revision. */
export function reconciledBolaBinding(
  assessment: BolaAssessment,
  scan: Scan,
  target: Target,
  profile: Profile,
  bound: BolaAssessment['profiles'][number],
): IdentityBinding {
  if (target.revision !== assessment.targetRevision || target.policyRevision !== assessment.policyRevision)
    throw new ControlPlaneError('BOLA_REVISION_CHANGED', 409);
  const revisionDelta = profile.revision - bound.profileRevision;
  if (
    profile.id !== bound.profileId ||
    profile.targetId !== assessment.targetId ||
    profile.kind !== 'api_key_header' ||
    (revisionDelta !== 0 && revisionDelta !== 1) ||
    profile.credentialRevision !== bound.credentialRevision ||
    profile.identityResult?.status !== 'READY' ||
    profile.identityResult.profileRevision !== profile.revision ||
    (revisionDelta === 1 && !(Date.parse(profile.identityResult.checkedAt) >= Date.parse(scan.createdAt))) ||
    !scan.roles.some(role => role.profileId === profile.id && role.identity === 'READY')
  )
    throw new ControlPlaneError('BOLA_DISCOVERY_BINDING_CHANGED', 409);
  return {
    targetRevision: target.revision,
    policyRevision: target.policyRevision,
    profileId: profile.id,
    profileRevision: profile.revision,
    credentialRevision: profile.credentialRevision,
  };
}
