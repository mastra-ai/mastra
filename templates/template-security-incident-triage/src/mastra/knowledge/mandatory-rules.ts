/** Exact mandatory statements published in the checked-in procedures. */
export const mandatoryRulesByRunbook = Object.freeze({
  'RB-IDENTITY-001': Object.freeze([
    'Missing required evidence requires manual review.',
    'A `soc_manager` must approve the exact structured plan, target, previous role, session identifiers, impact, rollback, expiration, and plan hash before any allowed action.',
  ]),
  'RB-IDENTITY-002': Object.freeze([
    'Missing policy or session evidence requires manual review.',
    'A `soc_manager` must approve the exact structured plan, session, subject, impact, rollback, expiration, and plan hash.',
  ]),
  'RB-IDENTITY-003': Object.freeze([
    'Invalid signatures or missing required evidence require manual review rather than automatic conclusions.',
    'A `soc_manager` must approve the exact structured plan, session, device ID, subject, impact, rollback, expiration, and plan hash before either allowed action.',
  ]),
});
