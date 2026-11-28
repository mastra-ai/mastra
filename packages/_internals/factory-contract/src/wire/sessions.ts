/**
 * Wire shapes for Factory user sessions and the Factory project a session belongs to.
 */
import type { ThinkingLevelSetting } from '@mastra/core/llm/reasoning';

import type { ModelPack } from '../model-packs.js';

export interface FactoryUserSessionOwner {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface FactoryUserSession {
  id: string;
  sessionId: string;
  projectRepositoryId: string;
  orgId: string;
  userId: string;
  /**
   * Memory resource the session runs under (the Factory for runs and Slack
   * sessions, the owner for user sessions). Only the single-session read reports it.
   */
  resourceId?: string;
  owner?: FactoryUserSessionOwner;
  visibility: 'org' | 'private';
  title?: string;
  branch: string;
  baseBranch: string;
  sandboxId: string | null;
  sandboxWorkdir: string | null;
  materializedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What the viewer may do with this session, computed by the server. */
  capabilities?: {
    recreateSandbox: boolean;
    takeOwnership: boolean;
    switchModel?: boolean;
    ownershipLock?: SessionOwnershipLock;
  };
  /** The cards this session follows: the ones it asked for or subscribed to. Only the list read reports it. */
  followedWorkItemIds?: readonly string[];
}

/** Why a session the viewer doesn't own keeps its owner. */
export type SessionOwnershipLock = 'card' | 'slack-thread' | 'side-session';

/**
 * Where a Factory's sessions and runs get their model and credentials: `factory` uses the organization's for both,
 * `user` the session owner's for both, and `hybrid` the owner's for interactive sessions and the organization's for
 * work-item runs.
 */
export type FactoryModelScope = 'factory' | 'user' | 'hybrid';

/** A Factory project row from `/web/factory/projects`. */
export interface FactoryProjectPayload {
  id: string;
  name: string;
  /** Org-wide default model for factory runs; null when unset. */
  defaultModelId?: string | null;
  /** Where sessions and runs get their model and credentials. */
  modelScope?: FactoryModelScope;
  /** Thinking level every session and run uses until it picks its own. */
  defaultThinkingLevel?: ThinkingLevelSetting;
  modelPacks?: ModelPack[];
  defaultModelPackId?: string | null;
}

/** Browser-shaped view of a repository linked to a Factory project. */
export interface LinkedRepositoryPayload {
  projectRepositoryId: string;
  provider?: 'github' | 'gitlab';
  /** Provider repository/project id; stable across renames. */
  externalId?: string;
  slug: string;
  gitBranch?: string;
}

/** A Factory project with its linked repositories flattened across connections. */
export interface FactoryProjectSnapshot extends FactoryProjectPayload {
  repositories: LinkedRepositoryPayload[];
}

export type FactoryProject = FactoryProjectSnapshot;
