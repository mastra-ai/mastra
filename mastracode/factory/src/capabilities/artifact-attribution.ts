import type { FactoryAuthUser } from '../auth.js';

export interface FactoryArtifactSession {
  role: string;
  workItemRef: string;
  runId: string;
}

export type FactoryArtifactAttribution =
  | {
      kind: 'human';
      userId: string;
      displayName: string;
      /** Used only for a commit trailer; never rendered into artifact text. */
      email?: string;
      session: FactoryArtifactSession;
    }
  | {
      kind: 'automation';
      source: string;
      id: string;
      session: FactoryArtifactSession;
    };

export interface FactoryArtifactTrigger {
  source: string;
  id: string;
}

export function requireFactoryArtifactAttribution(
  attribution: FactoryArtifactAttribution | undefined,
): FactoryArtifactAttribution {
  if (!attribution) throw new Error('Factory artifact attribution is required for source-control writes.');
  return attribution;
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Resolve artifact provenance from server-owned authentication and run state.
 * Agent/tool input is intentionally absent from this contract.
 */
export function resolveFactoryArtifactAttribution(input: {
  user: FactoryAuthUser | undefined;
  userId: string;
  session: FactoryArtifactSession;
  trigger?: FactoryArtifactTrigger;
}): FactoryArtifactAttribution {
  const trigger = input.trigger;
  if (trigger || input.userId === 'factory-rule-dispatcher') {
    return {
      kind: 'automation',
      source: nonEmpty(trigger?.source) ?? 'factory rule',
      id: nonEmpty(trigger?.id) ?? input.session.runId,
      session: input.session,
    };
  }

  return {
    kind: 'human',
    userId: input.userId,
    // Email is deliberately not a visible-name fallback. The stable user id is
    // preferable to leaking an address when a provider supplies no name.
    displayName: nonEmpty(input.user?.name) ?? input.userId,
    ...(nonEmpty(input.user?.email) ? { email: nonEmpty(input.user?.email) } : {}),
    session: input.session,
  };
}

export function artifactAttributionLine(attribution: FactoryArtifactAttribution): string {
  return attribution.kind === 'human'
    ? `Actor: ${attribution.displayName} (${attribution.userId})`
    : `Trigger: ${attribution.source} · ${attribution.id}`;
}

export function artifactAttributionFooter(attribution: FactoryArtifactAttribution): string {
  return attribution.kind === 'human'
    ? `— via Mastra Factory · actor: ${attribution.displayName}`
    : `— via Mastra Factory · trigger: ${attribution.source} ${attribution.id}`;
}

export function appendPullRequestAttribution(
  body: string | null | undefined,
  attribution: FactoryArtifactAttribution | undefined,
): string {
  const content = body
    ?.trimEnd()
    .replace(/(?:\n\n)?---\n🏭 Opened by Mastra Factory\n(?:Actor|Trigger):[^\n]*\nSession:[^\n]*$/u, '')
    .trimEnd();
  // VersionControl is public and older JavaScript consumers may not yet pass
  // this newly required field. Factory-owned call sites always do; preserve a
  // legacy caller's content rather than crashing inside the provider adapter.
  if (!attribution) return content ?? '';
  const block = [
    '---',
    '🏭 Opened by Mastra Factory',
    artifactAttributionLine(attribution),
    `Session: ${attribution.session.role}/${attribution.session.workItemRef} · run ${attribution.session.runId}`,
  ].join('\n');
  return content ? `${content}\n\n${block}` : block;
}

export function appendArtifactAttributionFooter(
  body: string | null | undefined,
  attribution: FactoryArtifactAttribution | undefined,
): string {
  const content = body
    ?.trimEnd()
    .replace(/(?:\n\n)?— via Mastra Factory · (?:actor|trigger):[^\n]*$/u, '')
    .trimEnd();
  if (!attribution) return content ?? '';
  const footer = artifactAttributionFooter(attribution);
  return content ? `${content}\n\n${footer}` : footer;
}

export function commitCoAuthor(attribution: FactoryArtifactAttribution): { name: string; email: string } | undefined {
  if (attribution.kind !== 'human' || !attribution.email) return undefined;
  return { name: attribution.displayName, email: attribution.email };
}
