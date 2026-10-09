import type { LinearIssue, LinearProject } from '../../domains/factory/services/linear';
import { linearIssue, wireSourceCards } from './boardSourceFilters';

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

export const hostedIssues: LinearIssue[] = [
  linearIssue('ENG-101', docsWatchId, 'DocsWatch: new documentation request'),
  // A card filed before project metadata was available must use its live issue.
  linearIssue('ENG-103', docsWatchId, 'DocsWatch: legacy planning card'),
  linearIssue('ENG-301', otherWorkspaceProjectId, 'Other workspace card'),
  linearIssue('ENG-401', null, 'Unassigned project'),
].map(issue => ({
  ...issue,
  sourceId: issue.projectId === otherWorkspaceProjectId ? otherHostedTeamId : hostedTeamId,
}));

export const hostedCards = wireSourceCards.map(item => {
  if (item.id === 'ENG-301')
    return {
      ...item,
      title: 'Other workspace card',
      metadata: { ...item.metadata, linearProjectId: otherWorkspaceProjectId },
    };
  if (item.id === 'ENG-103')
    return { ...item, title: 'DocsWatch: legacy planning card', metadata: { labels: ['feature'] } };
  if (item.metadata.linearProjectId !== 'project-a') return item;
  return { ...item, metadata: { ...item.metadata, linearProjectId: docsWatchId } };
});
