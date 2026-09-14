import type { RequestContext } from '../../request-context';

export interface SkillReadiness {
  /** Instructions injected by SkillSearchProcessor in this request's latest model step. */
  readonly readySkills: readonly string[];
  /** Names visible through this request's authorized Workspace skill catalog. */
  readonly availableSkills: readonly string[];
}

// Native processor state only. Weak keys prevent request retention; readers cannot write it.
const readiness = new WeakMap<RequestContext, () => SkillReadiness | undefined>();

export function setSkillReadiness(context: RequestContext, read: () => SkillReadiness | undefined): void {
  readiness.set(context, read);
}

/** No request snapshot means no skill is ready (including cold resume). */
export function getSkillReadiness(context?: RequestContext): SkillReadiness | undefined {
  return context ? readiness.get(context)?.() : undefined;
}
