import type Docker from 'dockerode';
import { z } from 'zod';
import { setTimeout as pause } from 'node:timers/promises';
import type { ScanContext } from '../core/control-plane.js';
import type { DiscoveryImages } from './images.js';
import { ScanResources } from './resources.js';
import { ownedLabBoundary, type OwnedLabBoundary } from './lab.js';
import { readRuntimeFile, stageFiles } from './io.js';
import { SecretGuard } from './parser.js';
export const gatewayStatsSchema = z
  .object({
    /** Sanitized gateway event counters. */
    counts: z.record(z.string().max(160), z.number().int().nonnegative()),
    /** Remaining shared upstream request reservations. */
    remainingRequests: z.number().int().nonnegative(),
    /** Remaining shared response-byte budget. */
    remainingBytes: z.number().int().nonnegative(),
    /** Currently outstanding upstream reservations. */
    active: z.number().int().nonnegative(),
    /** Whether further upstream admission is blocked by an exhausted budget. */
    exhausted: z.boolean(),
    /** Exhausted dimension or peer-pin failure, or null while usable. */
    exhaustionReason: z.enum(['requests', 'bytes', 'time', 'peer-mismatch']).nullable(),
  })
  .strict();
/** Normalize an origin to its protocol, hostname and explicit or default numeric port. */
const originTuple = (origin: string) => {
  const url = new URL(origin);
  return [url.protocol.slice(0, -1), url.hostname, Number(url.port || (url.protocol === 'https:' ? 443 : 80))];
};
/** Use the profile identifier for API-key isolation and the role for legacy gateway profiles. */
export const gatewayRole = (profile: ScanContext['profiles'][number]) =>
  profile.kind === 'api_key_header' ? profile.id : profile.role;

/** Read the gateway's bounded state snapshot and validate its current receipt. */
export async function gatewayState(gateway: Docker.Container, guard: SecretGuard) {
  const state = gatewayStatsSchema.parse(
    JSON.parse((await readRuntimeFile(gateway, '/workspace/gateway-stats.json')).toString()),
  );
  if (guard.unsafe(JSON.stringify(state))) throw new Error('SANITIZED_COUNTERS_REJECTED');
  return state;
}
/** Start the owned policy gateway and expose lifecycle controls for the scan. */
export async function openGateway(
  resources: ScanResources,
  context: ScanContext,
  images: DiscoveryImages,
  lab: OwnedLabBoundary | undefined,
  signal: AbortSignal,
  guard: SecretGuard,
  setStage: (value: 'NETWORK' | 'GATEWAY') => void,
  invalidSessionComparison?: { publicProfileId: string; url: string },
) {
  const client = resources.client;
  const common: Docker.HostConfig = {
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges:true'],
    Memory: 536870912,
    MemorySwap: 536870912,
    PidsLimit: 128,
    LogConfig: { Type: 'none', Config: {} },
    Init: true,
  };
  setStage('NETWORK');
  const ingress = await resources.network(true);
  const egress = lab
    ? {
        network: client.getNetwork(lab.networkId),
        name: (await client.getNetwork(lab.networkId).inspect()).Name,
      }
    : await resources.network(false);
  if (lab) {
    const verified = await ownedLabBoundary(client, lab.fixtureId, lab.networkId, lab.token, lab.upstreamCa);
    if (verified.address !== lab.address || context.target.environment !== 'lab')
      throw new Error('LAB_BOUNDARY_CHANGED');
    if (
      context.target.application?.kind === 'rest_api' &&
      context.profiles.some(profile => profile.kind === 'api_key_header') &&
      new URL(context.target.entryUrl).protocol === 'http:' &&
      new URL(context.target.entryUrl).origin !== `http://${verified.address}:18080`
    )
      throw new Error('REST_HTTP_LAB_ORIGIN_REQUIRED');
  }
  if (
    !lab &&
    context.target.application?.kind === 'rest_api' &&
    context.profiles.some(profile => profile.kind === 'api_key_header') &&
    new URL(context.target.entryUrl).protocol !== 'https:'
  )
    throw new Error('INSECURE_AUTH_TRANSPORT');
  const gatewayIp = ingress.address(10);
  const profiles: Record<string, { role: string; header_file: string }> = {},
    headers: Record<string, string | null> = {},
    identities: Record<string, { endpoint: string; expected: string }> = {},
    accessChecks: Record<string, string> = {},
    credentialOrigins: Record<string, unknown> = {};
  const files: Record<string, { bytes: Buffer }> = {};
  const guardFiles = context.guardHeaders.map(item => `/workspace/guard-${item.profileId}.headers`);
  for (const item of context.guardHeaders)
    files[`guard-${item.profileId}.headers`] = {
      bytes: Buffer.from(
        Object.entries(item.headers)
          .map(([name, value]) => `${name}: ${value}\n`)
          .join(''),
      ),
    };
  for (let index = 0; index < context.profiles.length; index++) {
    const profile = context.profiles[index]!,
      header = context.headers[index]!,
      name = Object.keys(header)[0] ?? null,
      role = gatewayRole(profile);
    profiles[String(8080 + index)] = { role, header_file: `/workspace/${profile.id}.headers` };
    headers[role] = name;
    files[`${profile.id}.headers`] = { bytes: Buffer.from(name ? `${name}: ${header[name]}\n` : '') };
    const apiKey = context.target.authenticationDrivers?.find(driver => driver.profileId === profile.id);
    credentialOrigins[role] =
      profile.kind === 'public'
        ? null
        : profile.kind === 'api_key_header' && apiKey?.kind === 'api_key_header'
          ? originTuple(apiKey.credentialOrigins[0]!)
          : profile.kind === 'bearer' || profile.kind === 'header'
            ? originTuple(new URL(profile.identityEndpoint).origin)
            : null;
    if (profile.kind === 'api_key_header' && apiKey?.kind === 'api_key_header')
      accessChecks[role] = `${apiKey.credentialOrigins[0]}${apiKey.accessCheckPath}`;
    else if (profile.kind === 'bearer' || profile.kind === 'header')
      identities[role] = { endpoint: profile.identityEndpoint, expected: profile.expectedIdentity };
  }
  const config = {
    profiles,
    guard_files: guardFiles,
    headers,
    identities,
    access_checks: accessChecks,
    inject_credentials: context.target.application?.kind === 'rest_api',
    credential_origins: credentialOrigins,
    origins: context.target.approvedOrigins.map(originTuple),
    allowed_paths: context.target.allowedPaths,
    excluded_paths: context.target.excludedPaths,
    methods: context.target.permittedMethods,
    ...(lab ? { lab_ips: [lab.address], resolver_ip: lab.address } : {}),
    ...(invalidSessionComparison
      ? (() => {
          const profile = context.profiles.find(item => item.id === invalidSessionComparison.publicProfileId);
          const url = new URL(invalidSessionComparison.url);
          if (
            !lab ||
            context.target.environment !== 'lab' ||
            profile?.kind !== 'public' ||
            !context.target.approvedOrigins.includes(url.origin) ||
            url.search ||
            url.hash
          )
            throw new Error('INVALID_SESSION_COMPARISON_REJECTED');
          return {
            invalid_session_comparison: { role: profile.role, origin: originTuple(url.origin), path: url.pathname },
          };
        })()
      : {}),
    budget: {
      requests: context.target.scanLimits.maxRequests,
      response_bytes: context.target.scanLimits.maxResponseBytes,
      concurrent: context.target.scanLimits.maxConcurrency,
      seconds: context.target.scanLimits.maxDurationSeconds,
    },
  };
  files['policy.json'] = { bytes: Buffer.from(JSON.stringify(config)) };
  if (lab?.upstreamCa) files['upstream-ca.pem'] = { bytes: Buffer.from(lab.upstreamCa) };
  setStage('GATEWAY');
  const args = [
    'mitmdump',
    '-q',
    '-s',
    '/opt/scanner/policy.py',
    '--listen-host',
    gatewayIp,
    ...Object.keys(profiles).flatMap(port => ['--mode', `regular@${port}`]),
    ...[
      'confdir=/workspace/ca',
      'connection_strategy=lazy',
      'upstream_cert=false',
      'ssl_insecure=false',
      'rawtcp=false',
      'websocket=false',
      'http3=false',
      'http2=false',
      'flow_detail=0',
      ...(lab?.upstreamCa ? ['ssl_verify_upstream_trusted_ca=/workspace/upstream-ca.pem'] : []),
    ].flatMap(value => ['--set', value]),
  ];
  const created = await resources.container(
    {
      Entrypoint: [],
      Cmd: args,
      User: '10001:10001',
      WorkingDir: '/workspace',
      HostConfig: { ...common, NetworkMode: ingress.network.id },
      NetworkingConfig: { EndpointsConfig: { [ingress.name]: { IPAMConfig: { IPv4Address: gatewayIp } } } },
    },
    images.gateway,
  );
  const gateway = created.container;
  const resource = created.resource;
  await egress.network.connect({ Container: gateway.id });
  await stageFiles(gateway, files, true, signal);
  await gateway.start();
  const gatewayInspection = await gateway.inspect();
  if (
    gatewayInspection.HostConfig.LogConfig?.Type !== 'none' ||
    gatewayInspection.HostConfig.Privileged ||
    (gatewayInspection.HostConfig.CapAdd ?? []).length
  )
    throw new Error('GATEWAY_POLICY_MISMATCH');
  let ca: Buffer | undefined;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ca = await readRuntimeFile(gateway, '/workspace/ca/mitmproxy-ca-cert.pem');
      await gatewayState(gateway, guard);
      break;
    } catch {
      signal.throwIfAborted();
      await pause(100, undefined, { signal: signal });
    }
  }
  if (!ca || !ca.toString().startsWith('-----BEGIN CERTIFICATE-----')) throw new Error('SANDBOX_CA_UNAVAILABLE');
  await gatewayState(gateway, guard);

  return { container: gateway, resource, ip: gatewayIp, ingress, ca };
}
