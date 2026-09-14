import { MastraA2AError } from '@mastra/core/a2a';
import type { A2AConfig, A2AProtocolVersion } from '@mastra/core/server';

export const DEFAULT_A2A_PROTOCOL_VERSIONS = ['1.0', '0.3'] as const satisfies readonly A2AProtocolVersion[];

export type A2AAgentCardSkill = {
  id: string;
  name: string;
  description: string;
  tags?: string[];
};

export type A2AAgentCardInput = {
  name: string;
  description: string;
  executionUrl: string;
  provider?: {
    organization: string;
    url: string;
  };
  version: string;
  pushNotifications: boolean;
  skills: A2AAgentCardSkill[];
};

export type RenderedA2AAgentCard = Record<string, unknown> & {
  name: string;
  description: string;
  version: string;
  skills: A2AAgentCardSkill[];
  signatures?: Array<{
    protected: string;
    signature: string;
    header?: Record<string, unknown>;
  }>;
};

function validateProtocolVersions(versions: readonly A2AProtocolVersion[]): readonly A2AProtocolVersion[] {
  if (versions.length === 0) {
    throw MastraA2AError.invalidRequest('A2A protocolVersions must contain at least one version');
  }

  if (new Set(versions).size !== versions.length) {
    throw MastraA2AError.invalidRequest('A2A protocolVersions must not contain duplicates');
  }

  return versions;
}

export function resolveAgentProtocolVersions(config: A2AConfig | undefined, agentId: string) {
  return validateProtocolVersions(
    config?.agents?.[agentId]?.protocolVersions ?? config?.protocolVersions ?? DEFAULT_A2A_PROTOCOL_VERSIONS,
  );
}

function supportedInterfaces(input: A2AAgentCardInput, versions: readonly A2AProtocolVersion[]) {
  return versions.map(protocolVersion => ({
    url: input.executionUrl,
    protocolBinding: 'JSONRPC',
    protocolVersion,
  }));
}

function capabilities(input: A2AAgentCardInput) {
  return {
    streaming: true,
    pushNotifications: input.pushNotifications,
    extensions: [],
  };
}

export function renderAgentCard({
  input,
  requestedVersion,
  protocolVersions,
}: {
  input: A2AAgentCardInput;
  requestedVersion: A2AProtocolVersion;
  protocolVersions: readonly A2AProtocolVersion[];
}): RenderedA2AAgentCard {
  validateProtocolVersions(protocolVersions);

  if (!protocolVersions.includes(requestedVersion)) {
    throw MastraA2AError.versionNotSupported(requestedVersion);
  }

  const common = {
    name: input.name,
    description: input.description,
    provider: input.provider,
    version: input.version,
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: input.skills,
  };

  if (requestedVersion === '1.0') {
    return {
      ...common,
      supportedInterfaces: supportedInterfaces(input, protocolVersions),
      capabilities: {
        ...capabilities(input),
        extendedAgentCard: false,
      },
      securitySchemes: {},
      securityRequirements: [],
    };
  }

  return {
    ...common,
    protocolVersion: '0.3.0',
    url: input.executionUrl,
    preferredTransport: 'JSONRPC',
    additionalInterfaces: [],
    supportedInterfaces: supportedInterfaces(input, protocolVersions),
    supportsAuthenticatedExtendedCard: false,
    security: [],
    securitySchemes: {},
    capabilities: {
      ...capabilities(input),
      stateTransitionHistory: false,
    },
  };
}
