import type {
  ListSkillsResponse,
  ListWorkspacesResponse,
  SearchSkillsResponse,
  Skill,
  WorkspaceFsListResponse,
  WorkspaceFsReadResponse,
  WorkspaceInfoResponse,
} from '@mastra/client-js';
import type { SkillsShListResponse } from '@/domains/workspace/types';

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

// ---------------------------------------------------------------------------
// Read-only gating fixtures
//
// These drive the regression where the workspace-by-id page must derive its
// read-only state from the authoritative by-id info response (`safety.readOnly`)
// rather than the workspaces *list* entry, which can be empty/stale on a
// deep-link to `/workspaces/:id`.
// ---------------------------------------------------------------------------

// Workspaces list that does NOT contain the deep-linked workspace. The page
// only short-circuits to its empty state when the list is fully empty, so we
// keep an unrelated entry here; `selectedWorkspace` is still `undefined` for
// `gating-ws`, which is exactly the deep-link race the gate must survive.
export const listWithoutGatingWorkspace: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'other-ws',
      name: 'Other Workspace',
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

// List entry that reports the gating workspace as WRITABLE while the by-id info
// reports it as read-only — proves the by-id response wins.
export const gatingWorkspaceWritableList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'gating-ws',
      name: 'Gating Workspace',
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
        readOnly: false,
      },
    },
  ],
};

// Filesystem + skills workspace whose by-id info reports read-only. All mounts
// are read-only, so no write/manage action should be exposed.
export const readOnlyGatingWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'gating-ws',
  name: 'Gating Workspace',
  status: 'ready',
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
  mounts: [
    {
      path: '.',
      provider: 'local',
      readOnly: true,
      name: 'root',
    },
  ],
};

// Same workspace but writable: create/delete/add-skill actions must appear.
export const writableGatingWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'gating-ws',
  name: 'Gating Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: true,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: true,
  },
  safety: {
    readOnly: false,
  },
  mounts: [
    {
      path: '.',
      provider: 'local',
      readOnly: false,
      name: 'root',
    },
  ],
};

// Filesystem listing for the gating workspace so the tree renders a deletable
// file node (`README.md`) used to assert the per-node delete action.
export const gatingFsListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [{ name: 'README.md', type: 'file' }],
};

// Installed skills for the gating workspace (skills endpoint must be handled).
export const gatingSkills: ListSkillsResponse = {
  skills: [
    {
      name: 'code-review',
      path: '.agents/skills/code-review',
      description: 'Reviews code changes',
    },
  ],
  isSkillsConfigured: true,
};

// Popular skills.sh list fetched by the Add Skill dialog (writable path).
export const gatingPopularSkills: SkillsShListResponse = {
  skills: [],
  count: 0,
  limit: 10,
  offset: 0,
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
