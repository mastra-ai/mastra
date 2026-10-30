import type Docker from 'dockerode';
import { z } from 'zod';
const LAB_LABEL = 'dev.mastra.security-scanner.lab';
const labBrand: unique symbol = Symbol('owned-lab-boundary');
export type OwnedLabBoundary = {
  networkId: string;
  fixtureId: string;
  address: string;
  callback: string;
  token: string;
  upstreamCa?: Buffer;
  [labBrand]: true;
};
export function ownedApprovalCallback(boundary: OwnedLabBoundary, approvalId: string) {
  z.string().uuid().parse(approvalId);
  return `${boundary.callback}/${approvalId}`;
}
export async function ownedLabBoundary(
  client: Docker,
  fixtureId: string,
  networkId: string,
  token: string,
  upstreamCa?: Buffer,
): Promise<OwnedLabBoundary> {
  z.string().uuid().parse(token);
  const [fixture, network] = await Promise.all([
    client.getContainer(fixtureId).inspect(),
    client.getNetwork(networkId).inspect(),
  ]);
  const address = fixture.NetworkSettings.Networks[network.Name]?.IPAddress;
  if (
    !address ||
    !fixture.State.Running ||
    fixture.Config.Labels?.[LAB_LABEL] !== token ||
    network.Labels?.[LAB_LABEL] !== token ||
    !network.Internal
  )
    throw new Error('OWNED_LAB_REQUIRED');
  z.ipv4().parse(address);
  if (upstreamCa && (upstreamCa.length > 65536 || !upstreamCa.toString().startsWith('-----BEGIN CERTIFICATE-----')))
    throw new Error('LAB_CA_INVALID');
  return {
    networkId,
    fixtureId,
    address,
    callback: `http://${address}:18080/owned/callback`,
    token,
    ...(upstreamCa ? { upstreamCa: Buffer.from(upstreamCa) } : {}),
    [labBrand]: true,
  };
}
