import { MastraA2AError } from '@mastra/core/a2a';
import type { Mastra } from '@mastra/core/mastra';
import type { A2AProtocolVersion } from '@mastra/core/server';

export function resolveA2AProtocolVersions(mastra: Mastra, agentId: string): A2AProtocolVersion[] {
  const config = mastra.getServer()?.a2a;
  const registeredAgents = mastra.listAgents();
  const canonicalId =
    Object.values(registeredAgents).find(agent => agent.id === agentId)?.id ?? registeredAgents[agentId]?.id ?? agentId;
  const registrationKey = Object.keys(registeredAgents).find(key => registeredAgents[key]?.id === canonicalId);
  const versions = config?.agents?.[canonicalId]?.protocolVersions ??
    (registrationKey ? config?.agents?.[registrationKey]?.protocolVersions : undefined) ??
    config?.protocolVersions ?? ['0.3', '1.0'];

  if (!Array.isArray(versions)) {
    throw new TypeError('A2A protocolVersions must be an array');
  }
  for (const version of versions) {
    if (version !== '0.3' && version !== '1.0') {
      throw MastraA2AError.versionNotSupported(String(version));
    }
  }
  return [...new Set(versions)];
}

export function assertA2AProtocolVersion(mastra: Mastra, agentId: string, protocolVersion: A2AProtocolVersion): void {
  if (!resolveA2AProtocolVersions(mastra, agentId).includes(protocolVersion)) {
    throw MastraA2AError.versionNotSupported(protocolVersion);
  }
}
