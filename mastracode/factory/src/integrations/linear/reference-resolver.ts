import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { FactoryReferenceResolver, ReferencedFactoryProject } from '../base.js';
import type { LinearIssueDetail } from './integration.js';
import { isSelfManagedTeamSourceId } from './source-ids.js';
import type { LinearConnectionRow } from './storage.js';

const MAX_REFERENCES_PER_MESSAGE = 5;
const ISSUE_URL_RE = /https?:\/\/linear\.app\/[^/\s>|]+\/issue\/([A-Za-z][A-Za-z0-9]{0,9}-\d{1,7})\b/g;
const ISSUE_KEY_RE = /(?<![\w/-])([A-Z][A-Z0-9]{0,9}-\d{1,7})(?![\w-])/g;

export function extractLinearIssueIdentifiers(text: string): string[] {
  const identifiers = new Set<string>();
  for (const match of text.matchAll(ISSUE_URL_RE)) identifiers.add(match[1]!.toUpperCase());
  for (const match of text.matchAll(ISSUE_KEY_RE)) identifiers.add(match[1]!);
  return [...identifiers].slice(0, MAX_REFERENCES_PER_MESSAGE);
}

export interface LinearReferenceLookup {
  loadConnection(orgId: string): Promise<LinearConnectionRow | null>;
  getFreshAccessToken(connection: LinearConnectionRow): Promise<string>;
  fetchIssueDetail(
    accessToken: string,
    idOrIdentifier: string,
  ): Promise<Pick<LinearIssueDetail, 'identifier' | 'projectId' | 'teamId'> | null>;
  sourceMatchesIssue(sourceId: string, issue: Pick<LinearIssueDetail, 'projectId' | 'teamId'>): boolean;
}

export function createLinearReferenceResolver({
  linear,
  intake,
}: {
  linear: LinearReferenceLookup;
  intake: Pick<IntakeStorage, 'listBindings'>;
}): FactoryReferenceResolver {
  return async ({ orgId, text }) => {
    const identifiers = extractLinearIssueIdentifiers(text);
    if (identifiers.length === 0) return [];

    const bindings = await intake.listBindings({ orgId, integrationId: 'linear' });
    if (bindings.length === 0) return [];
    const connection = await linear.loadConnection(orgId);
    if (!connection) return [];
    const accessToken = await linear.getFreshAccessToken(connection);

    const referenced: ReferencedFactoryProject[] = [];
    for (const identifier of identifiers) {
      const issue = await linear.fetchIssueDetail(accessToken, identifier);
      if (!issue) continue;
      const matching = bindings.filter(binding => linear.sourceMatchesIssue(binding.sourceId, issue));
      const winner = matching.find(binding => !isSelfManagedTeamSourceId(binding.sourceId)) ?? matching[0];
      if (winner) referenced.push({ reference: identifier, factoryProjectId: winner.factoryProjectId });
    }
    return referenced;
  };
}
