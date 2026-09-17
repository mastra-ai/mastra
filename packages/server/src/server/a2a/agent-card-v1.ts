import type { AgentCard } from '@mastra/core/a2a';
import { AgentCard as AgentCardCodec } from '@mastra/core/a2a/v1';
import type { z } from 'zod/v4';
import { agentCardV1ResponseSchema } from '../schemas/a2a';

export type AgentCardV1 = z.infer<typeof agentCardV1ResponseSchema>;

export function createV1AgentCard(legacyCard: AgentCard, protocolVersions: ('0.3' | '1.0')[]): AgentCardV1 {
  const card = AgentCardCodec.fromJSON({
    name: legacyCard.name,
    description: legacyCard.description,
    provider: legacyCard.provider,
    version: legacyCard.version,
    supportedInterfaces: protocolVersions.map(protocolVersion => ({
      url: legacyCard.url,
      protocolBinding: 'JSONRPC',
      protocolVersion,
    })),
    capabilities: {
      streaming: legacyCard.capabilities.streaming,
      pushNotifications: legacyCard.capabilities.pushNotifications,
      extensions: legacyCard.capabilities.extensions,
      extendedAgentCard: legacyCard.supportsAuthenticatedExtendedCard,
    },
    defaultInputModes: legacyCard.defaultInputModes,
    defaultOutputModes: legacyCard.defaultOutputModes,
    skills: legacyCard.skills,
  });

  // The codec omits protobuf defaults. Sign this final wire representation, not the SDK object.
  return agentCardV1ResponseSchema.parse(AgentCardCodec.toJSON(card));
}
