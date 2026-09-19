import type {
  BranchMemoryThreadResponse,
  GetMemoryThreadBranchHistoryResponse,
  ListMemoryThreadBranchesResponse,
} from '@mastra/client-js';

export const SOURCE_THREAD_ID = 'thread-source';
export const CHILD_THREAD_ID = 'thread-branch-child';
export const SECOND_CHILD_THREAD_ID = 'thread-branch-child-2';
export const FORK_MESSAGE_ID = 'msg-fork-point';

const sourceThread = {
  id: SOURCE_THREAD_ID,
  title: 'Source thread',
  resourceId: 'resource-1',
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-09-01T11:00:00.000Z'),
};

const childThread = {
  id: CHILD_THREAD_ID,
  title: 'Child branch',
  resourceId: 'resource-1',
  createdAt: new Date('2026-09-02T10:00:00.000Z'),
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
};

const secondChildThread = {
  id: SECOND_CHILD_THREAD_ID,
  title: 'Second branch',
  resourceId: 'resource-1',
  createdAt: new Date('2026-09-03T10:00:00.000Z'),
  updatedAt: new Date('2026-09-03T10:00:00.000Z'),
};

const childBranch = {
  parentThreadId: SOURCE_THREAD_ID,
  branchPointMessageId: FORK_MESSAGE_ID,
  branchPointCreatedAt: new Date('2026-09-01T10:30:00.000Z'),
  branchCreatedAt: new Date('2026-09-02T10:00:00.000Z'),
};

const secondChildBranch = {
  parentThreadId: SOURCE_THREAD_ID,
  branchPointMessageId: FORK_MESSAGE_ID,
  branchPointCreatedAt: new Date('2026-09-01T10:30:00.000Z'),
  branchCreatedAt: new Date('2026-09-03T10:00:00.000Z'),
};

export const branchHistoryFromChild: GetMemoryThreadBranchHistoryResponse = {
  history: [
    { thread: sourceThread, branch: null },
    { thread: childThread, branch: childBranch },
  ],
};

export const branchHistoryOfRoot: GetMemoryThreadBranchHistoryResponse = {
  history: [{ thread: sourceThread, branch: null }],
};

export const childBranchesOfSource: ListMemoryThreadBranchesResponse = {
  total: 2,
  page: 0,
  perPage: false,
  hasMore: false,
  branches: [
    { thread: childThread, branch: childBranch },
    { thread: secondChildThread, branch: secondChildBranch },
  ],
};

export const noBranches: ListMemoryThreadBranchesResponse = {
  total: 0,
  page: 0,
  perPage: false,
  hasMore: false,
  branches: [],
};

export const branchCreatedResponse: BranchMemoryThreadResponse = {
  thread: childThread,
  branch: childBranch,
};

export const branchingUnsupportedError = {
  error: { code: 'BRANCHING_UNSUPPORTED', message: 'Thread branching is not supported by this memory implementation.' },
};

export const branchThreadNotFoundError = {
  error: { code: 'BRANCH_NOT_FOUND', message: 'Thread branch was not found or is not accessible.' },
};
