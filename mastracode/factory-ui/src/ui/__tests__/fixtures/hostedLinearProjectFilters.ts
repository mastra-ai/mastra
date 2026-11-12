import type { IntakeCandidateInfo } from '../../../api/types';
import type { LinearProject } from '../../domains/factory/services/linear';
import { offeredLinearIssue, wireSourceCards } from './boardSourceFilters';

// Hosted project picker values are opaque source IDs, not Linear's raw UUIDs.
export const docsWatchId = 'linear-project:eyJ3b3Jrc3BhY2VJZCI6IndvcmtzcGFjZS0xIiwicHJvamVjdElkIjoicHJvamVjdC1hIn0';
export const otherWorkspaceProjectId =
  'linear-project:eyJ3b3Jrc3BhY2VJZCI6IndvcmtzcGFjZS0yIiwicHJvamVjdElkIjoicHJvamVjdC1hIn0';
export const hostedTeamId = 'linear-team:eyJ3b3Jrc3BhY2VJZCI6IndvcmtzcGFjZS0xIiwidGVhbUlkIjoiZW5nIn0';
export const otherHostedTeamId = 'linear-team:eyJ3b3Jrc3BhY2VJZCI6IndvcmtzcGFjZS0yIiwidGVhbUlkIjoiZW5nIn0';

export const hostedProjects: LinearProject[] = [
  { id: docsWatchId, name: 'DocsWatch', state: 'started', teams: [] },
  { id: otherWorkspaceProjectId, name: 'Other workspace project', state: 'started', teams: [] },
];

export const hostedIssues: IntakeCandidateInfo[] = [
  offeredLinearIssue('ENG-101', docsWatchId, 'DocsWatch: new documentation request'),
  offeredLinearIssue('ENG-401', undefined, 'Unassigned project'),
];

export const hostedCards = wireSourceCards.map(item => {
  if (item.id === 'ENG-301')
    return {
      ...item,
      title: 'Other workspace card',
      metadata: { ...item.metadata, linearProjectId: otherWorkspaceProjectId },
    };
  if (item.metadata.linearProjectId !== 'project-a') return item;
  return { ...item, metadata: { ...item.metadata, linearProjectId: docsWatchId } };
});
