import type {
  ListSkillsResponse,
  ListWorkspacesResponse,
  SearchSkillsResponse,
  Skill,
  WorkspaceFsListResponse,
  WorkspaceFsReadResponse,
  WorkspaceInfoResponse,
} from '@mastra/client-js';

export const workspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'global-ws',
      name: 'Global Workspace',
      status: 'active',
      source: 'mastra',
      capabilities: {
        hasFilesystem: false,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: false,
      },
      safety: {
        readOnly: false,
      },
    },
  ],
};

// Configured workspace with no capabilities so the editor renders the main
// layout without firing filesystem/skill UI requests.
export const configuredWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'global-ws',
  name: 'Global Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: false,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: false,
  },
};

export const emptySkills: ListSkillsResponse = {
  skills: [],
  isSkillsConfigured: false,
};

// Filesystem-enabled workspace with BM25 search so the editor renders the file
// tree split AND the search button is available (search capability).
// Marked read-only so skill-management UI (AddSkillDialog) is not mounted,
// keeping the search-swap test focused on the editor/search swap behavior.
export const searchableWorkspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'fs-ws',
      name: 'Filesystem Workspace',
      status: 'active',
      source: 'mastra',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: true,
        canVector: false,
        canHybrid: false,
        hasSkills: false,
      },
      safety: {
        readOnly: true,
      },
    },
  ],
};

export const searchableWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'fs-ws',
  name: 'Filesystem Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: true,
    hasSandbox: false,
    canBM25: true,
    canVector: false,
    canHybrid: false,
    hasSkills: false,
  },
};

export const workspaceFsListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    { name: 'README.md', type: 'file' },
    { name: 'src', type: 'directory' },
  ],
};

// Agent-owned filesystem workspace so the attached-entity badge renders and
// links back to the owning agent.
export const agentWorkspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'agent-ws',
      name: 'Agent Workspace',
      status: 'active',
      source: 'agent',
      agentId: 'weather-agent',
      agentName: 'Weather Agent',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: false,
      },
      safety: {
        readOnly: true,
      },
    },
  ],
};

export const agentWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'agent-ws',
  name: 'Agent Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: true,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: false,
  },
};

// Filesystem + skills workspace so the editor renders the file tree AND the
// search view exposes the "Search Skills" section. Read-only so the
// skill-management dialog (AddSkillDialog) is not mounted.
export const skillsSearchWorkspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'skills-ws',
      name: 'Skills Workspace',
      status: 'active',
      source: 'mastra',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: true,
      },
      safety: {
        readOnly: true,
      },
    },
  ],
};

export const skillsSearchWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'skills-ws',
  name: 'Skills Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: true,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: true,
  },
};

// At least one configured skill so `canSearchSkills` is true.
export const configuredSkills: ListSkillsResponse = {
  skills: [
    {
      name: 'code-review',
      path: '.agents/skills/code-review',
      description: 'Reviews code changes',
    },
  ],
  isSkillsConfigured: true,
};

// Skills-search hit. The server returns `skillPath` as the skill *directory*
// and `source` as the matched file relative to it (here `SKILL.md`); the page
// joins them to resolve the real workspace file path opened in the viewer.
export const skillsSearchResponse: SearchSkillsResponse = {
  query: 'review',
  results: [
    {
      skillName: 'code-review',
      skillPath: '.agents/skills/code-review',
      source: 'SKILL.md',
      content: 'Use this skill to review code changes for correctness and style.',
      score: 0.92,
    },
  ],
};

// Content returned when the selected skill file is opened in the file viewer.
export const skillFileContent: WorkspaceFsReadResponse = {
  path: '.agents/skills/code-review/SKILL.md',
  content: '# Code Review\n\nUse this skill to review code changes.',
  type: 'file',
  mimeType: 'text/markdown',
};

// Filesystem listing that includes the skill directory, so the tree can render
// the skill as a first-class node and selecting it opens the overview pane.
export const skillsFsListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    { name: 'README.md', type: 'file' },
    { name: '.agents', type: 'directory' },
    { name: '.agents/skills', type: 'directory' },
    { name: '.agents/skills/code-review', type: 'directory' },
    { name: '.agents/skills/code-review/SKILL.md', type: 'file', size: 2048 },
  ],
};

// Full skill details returned by `getSkill().details()` for the overview pane.
export const codeReviewSkillDetails: Skill = {
  name: 'code-review',
  path: '.agents/skills/code-review',
  description: 'Reviews code changes for correctness and style.',
  instructions: '# Code Review\n\nUse this skill to review code changes for correctness and style.',
  source: { type: 'local', projectPath: '.agents/skills/code-review' },
  references: [],
  scripts: [],
  assets: [],
};
