import { HTTPException } from '../http-exception';
import {
  agentVersionLabelPathParams,
  agentVersionLabelsPathParams,
  agentVersionLabelSchema,
  deleteAgentVersionLabelQuerySchema,
  deleteAgentVersionLabelResponseSchema,
  listAgentVersionLabelsQuerySchema,
  listAgentVersionLabelsResponseSchema,
  setAgentVersionLabelBodySchema,
} from '../schemas/agent-version-labels';
import type { AgentVersionLabel } from '../schemas/agent-version-labels';
import { createRoute } from '../server-adapter/routes/route-builder';
import { assertStoredResourceScope, getStoredResourceScope } from '../utils';

import { assertReadAccess, assertWriteAccess } from './authorship';
import {
  VERSION_LABEL_PATTERN,
  createVersionLabelApiError,
  handleVersionLabelError,
  validateVersionLabelSelector,
} from './version-label-errors';

type LabelRouteContext = {
  mastra: Parameters<typeof getStoredResourceScope>[0] & {
    getStorage(): {
      getStore(name: 'agents'): Promise<AgentLabelStore | null | undefined>;
    } | null;
    getEditor(): { agent: { clearCache(agentId: string): void } } | undefined;
  };
  requestContext: NonNullable<Parameters<typeof getStoredResourceScope>[1]>;
};

type AgentVersion = {
  id: string;
  agentId: string;
  versionNumber: number;
};

type VersionLabelPointer = {
  entityType: 'agent';
  entityId: string;
  label: string;
  versionId: string;
  revisionToken: string;
  createdAt: Date;
  updatedAt: Date;
};

type VersionLabelStorageChannel = {
  list(input: {
    entityType: 'agent';
    entityId: string;
    page?: number;
    perPage?: number | false;
  }): Promise<{ labels: VersionLabelPointer[] }>;
  set(input: {
    entityType: 'agent';
    entityId: string;
    label: string;
    versionId: string;
    expectedRevisionToken: string | null;
  }): Promise<VersionLabelPointer>;
  delete(input: {
    entityType: 'agent';
    entityId: string;
    label: string;
    expectedRevisionToken: string;
  }): Promise<{ deleted: boolean }>;
};

type AgentLabelStore = {
  versionLabels?: VersionLabelStorageChannel;
  getById(agentId: string): Promise<{
    activeVersionId?: string;
    metadata?: Record<string, unknown> | null;
    authorId?: string | null;
    visibility?: 'private' | 'public';
  } | null>;
  getVersion(versionId: string): Promise<AgentVersion | null>;
  listVersions(input: {
    agentId: string;
    page?: number;
    perPage?: number | false;
  }): Promise<{ versions: AgentVersion[] }>;
};

async function getAccessibleAgentLabelStore(
  { mastra, requestContext }: LabelRouteContext,
  agentId: string,
  access: 'read' | 'publish',
) {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }

  const agentsStore = await storage.getStore('agents');
  if (!agentsStore) {
    throw new HTTPException(500, { message: 'Agents storage domain is not available' });
  }

  const agent = await agentsStore.getById(agentId);
  if (!agent) {
    throw createVersionLabelApiError('ENTITY_NOT_FOUND', 'Stored agent not found.', { agentId });
  }

  try {
    assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));
    if (access === 'read') {
      assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: agentId, record: agent });
    } else {
      assertWriteAccess({
        requestContext,
        resource: 'stored-agents',
        resourceId: agentId,
        action: 'publish',
        record: agent,
      });
    }
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw createVersionLabelApiError('ENTITY_NOT_FOUND', 'Stored agent not found.', { agentId });
    }
    throw error;
  }

  const versionLabels = agentsStore.versionLabels;
  if (!versionLabels) {
    throw createVersionLabelApiError(
      'VERSION_LABELS_UNSUPPORTED',
      'Version labels are not supported for this entity type and storage adapter.',
      { entityType: 'agent', entityId: agentId },
    );
  }

  return { agent, agentsStore, versionLabels };
}

function assertVersionTarget(
  version: AgentVersion | undefined,
  input: { agentId: string; versionId: string; label: string },
): AgentVersion {
  if (
    !version ||
    version.agentId !== input.agentId ||
    !Number.isSafeInteger(version.versionNumber) ||
    version.versionNumber < 1
  ) {
    throw createVersionLabelApiError(
      'VERSION_LABEL_INTEGRITY_ERROR',
      'The version label points to an invalid version.',
      {
        entityId: input.agentId,
        label: input.label,
        versionId: input.versionId,
      },
    );
  }
  return version;
}

function throwLabelIntegrityError(pointer: Pick<VersionLabelPointer, 'entityId' | 'label' | 'versionId'>): never {
  throw createVersionLabelApiError('VERSION_LABEL_INTEGRITY_ERROR', 'The version label points to an invalid version.', {
    entityId: pointer.entityId,
    label: pointer.label,
    versionId: pointer.versionId,
  });
}

function assertCustomPointer(
  pointer: VersionLabelPointer,
  expected: { agentId: string; label?: string; versionId?: string },
): void {
  if (
    pointer.entityType !== 'agent' ||
    pointer.entityId !== expected.agentId ||
    (expected.label !== undefined && pointer.label !== expected.label) ||
    (expected.versionId !== undefined && pointer.versionId !== expected.versionId) ||
    !VERSION_LABEL_PATTERN.test(pointer.label) ||
    pointer.label === 'production' ||
    pointer.label === 'latest' ||
    typeof pointer.revisionToken !== 'string' ||
    pointer.revisionToken.length === 0 ||
    !(pointer.updatedAt instanceof Date) ||
    Number.isNaN(pointer.updatedAt.getTime())
  ) {
    throwLabelIntegrityError(pointer);
  }
}

function serializeCustomLabel(pointer: VersionLabelPointer, version: AgentVersion): AgentVersionLabel {
  return {
    name: pointer.label,
    kind: 'custom',
    versionId: pointer.versionId,
    versionNumber: version.versionNumber,
    revisionToken: pointer.revisionToken,
    updatedAt: pointer.updatedAt.toISOString(),
  };
}

function validatePublicVersionLabel(label: string): void {
  validateVersionLabelSelector(label);
  if (label === 'production' || label === 'latest') {
    throw createVersionLabelApiError('RESERVED_LABEL', 'The version label is reserved and cannot be mutated.', {
      label,
    });
  }
}

function compareLabelNames(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

/** GET /stored/agents/:agentId/labels - List computed and custom labels. */
export const LIST_AGENT_VERSION_LABELS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/labels',
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  responseType: 'json',
  pathParamSchema: agentVersionLabelsPathParams,
  queryParamSchema: listAgentVersionLabelsQuerySchema,
  responseSchema: listAgentVersionLabelsResponseSchema,
  summary: 'List agent version labels',
  description: 'Returns production, latest, and custom version labels for a stored agent',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, page, perPage, requestContext }) => {
    try {
      const resolvedPage = page ?? 0;
      const resolvedPerPage = perPage ?? 50;
      const { agent, agentsStore, versionLabels } = await getAccessibleAgentLabelStore(
        { mastra, requestContext } as LabelRouteContext,
        agentId,
        'read',
      );

      const [{ versions }, customResult] = await Promise.all([
        agentsStore.listVersions({ agentId, page: 0, perPage: false }),
        versionLabels.list({ entityType: 'agent', entityId: agentId, page: 0, perPage: false }),
      ]);
      const versionsById = new Map(versions.map(version => [version.id, version]));
      const labels: AgentVersionLabel[] = [];

      if (agent.activeVersionId) {
        const version = assertVersionTarget(versionsById.get(agent.activeVersionId), {
          agentId,
          versionId: agent.activeVersionId,
          label: 'production',
        });
        labels.push({
          name: 'production',
          kind: 'production',
          versionId: version.id,
          versionNumber: version.versionNumber,
        });
      }

      const latestVersion = versions.reduce<AgentVersion | undefined>(
        (latest, version) => (!latest || version.versionNumber > latest.versionNumber ? version : latest),
        undefined,
      );
      if (latestVersion) {
        labels.push({
          name: 'latest',
          kind: 'latest',
          versionId: latestVersion.id,
          versionNumber: latestVersion.versionNumber,
        });
      }

      const customLabels = [...customResult.labels].sort((left, right) => compareLabelNames(left.label, right.label));
      const seenCustomLabels = new Set<string>();
      for (const pointer of customLabels) {
        assertCustomPointer(pointer, { agentId });
        if (seenCustomLabels.has(pointer.label)) throwLabelIntegrityError(pointer);
        seenCustomLabels.add(pointer.label);
        const version = assertVersionTarget(versionsById.get(pointer.versionId), {
          agentId,
          versionId: pointer.versionId,
          label: pointer.label,
        });
        labels.push(serializeCustomLabel(pointer, version));
      }

      const offset = resolvedPage * resolvedPerPage;
      return {
        labels: labels.slice(offset, offset + resolvedPerPage),
        pagination: {
          total: labels.length,
          page: resolvedPage,
          perPage: resolvedPerPage,
          hasMore: offset + resolvedPerPage < labels.length,
        },
      };
    } catch (error) {
      return handleVersionLabelError(error, 'Error listing agent version labels');
    }
  },
});

/** PUT /stored/agents/:agentId/labels/:label - Create or move a custom label. */
export const SET_AGENT_VERSION_LABEL_ROUTE = createRoute({
  method: 'PUT',
  path: '/stored/agents/:agentId/labels/:label',
  requiresAuth: true,
  requiresPermission: 'stored-agents:publish',
  responseType: 'json',
  pathParamSchema: agentVersionLabelPathParams,
  bodySchema: setAgentVersionLabelBodySchema,
  responseSchema: agentVersionLabelSchema,
  summary: 'Set agent version label',
  description: 'Creates or compare-and-swap moves a custom agent version label',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, label, versionId, expectedRevisionToken, requestContext }) => {
    try {
      validatePublicVersionLabel(label);
      const { agentsStore, versionLabels } = await getAccessibleAgentLabelStore(
        { mastra, requestContext } as LabelRouteContext,
        agentId,
        'publish',
      );

      const version = await agentsStore.getVersion(versionId);
      if (!version || version.agentId !== agentId) {
        throw createVersionLabelApiError('VERSION_NOT_FOUND', 'Version not found for stored agent.', {
          agentId,
          versionId,
        });
      }

      const pointer = await versionLabels.set({
        entityType: 'agent',
        entityId: agentId,
        label,
        versionId,
        expectedRevisionToken,
      });
      assertCustomPointer(pointer, { agentId, label, versionId });
      mastra.getEditor()?.agent.clearCache(agentId);
      return serializeCustomLabel(pointer, version);
    } catch (error) {
      return handleVersionLabelError(error, 'Error setting agent version label');
    }
  },
});

/** DELETE /stored/agents/:agentId/labels/:label - Delete a custom label with CAS. */
export const DELETE_AGENT_VERSION_LABEL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:agentId/labels/:label',
  requiresAuth: true,
  requiresPermission: 'stored-agents:publish',
  responseType: 'json',
  pathParamSchema: agentVersionLabelPathParams,
  queryParamSchema: deleteAgentVersionLabelQuerySchema,
  responseSchema: deleteAgentVersionLabelResponseSchema,
  summary: 'Delete agent version label',
  description: 'Deletes a custom agent version label using its last observed revision token',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, label, expectedRevisionToken, requestContext }) => {
    try {
      validatePublicVersionLabel(label);
      const { versionLabels } = await getAccessibleAgentLabelStore(
        { mastra, requestContext } as LabelRouteContext,
        agentId,
        'publish',
      );
      const result = await versionLabels.delete({
        entityType: 'agent',
        entityId: agentId,
        label,
        expectedRevisionToken,
      });
      if (result.deleted) {
        mastra.getEditor()?.agent.clearCache(agentId);
      }
      return { success: true as const, deleted: result.deleted };
    } catch (error) {
      return handleVersionLabelError(error, 'Error deleting agent version label');
    }
  },
});
