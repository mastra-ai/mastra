import type {
  FactoryHealthFinding,
  FactoryHealthFindingKind,
  FactoryHealthRepair,
  FactoryHealthReport,
} from '@mastra/factory/supervisor/health';

import { requestJson } from '../../factory/services/request';

export type { FactoryHealthFinding, FactoryHealthFindingKind, FactoryHealthRepair, FactoryHealthReport };

/**
 * The supervisor session is addressed deterministically from the factory id
 * (mirrors `supervisorResourceId` on the server) so the page can bind the chat
 * without a round trip; `POST …/supervisor/session` confirms the same address
 * once ownership is verified.
 */
export function supervisorSessionAddress(factoryProjectId: string): { resourceId: string; threadId: string } {
  const resourceId = `factory-supervisor:${factoryProjectId}`;
  return { resourceId, threadId: resourceId };
}

export function ensureSupervisorSession(
  baseUrl: string,
  factoryProjectId: string,
): Promise<{ sessionId: string; threadId: string; factoryProjectId: string }> {
  return requestJson(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/supervisor/session`, {
    method: 'POST',
  });
}

export function getSupervisorHealth(baseUrl: string, factoryProjectId: string): Promise<FactoryHealthReport> {
  return requestJson(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/supervisor/health`);
}

export function supervisorAskPath(factoryProjectId: string, question: string): string {
  return `/factories/${factoryProjectId}/supervisor?${new URLSearchParams({ ask: question })}`;
}

/** A question the person can hand to the supervisor about one finding. */
export function findingPrompt(finding: FactoryHealthFinding): string {
  const subject = finding.workItemNumber ? `#${finding.workItemNumber}` : finding.title;
  return `Explain the "${finding.kind}" finding on ${subject} (${finding.id}) and tell me what you'd do about it.`;
}
