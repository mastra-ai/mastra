import type { BoardSnapshot } from '../../../domains/factory/services/workItems';
import type { RepositoryCommitsPage } from '../../../domains/factory/services/commits';
export const emptyBoard: BoardSnapshot = { workItems: [], runningSessionIds: [], parkedSessionIds: [] };
export const emptyCommits: RepositoryCommitsPage = { commits: [], branch: 'main' };
