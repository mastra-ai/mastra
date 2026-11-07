import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type Docker from 'dockerode';
import { z } from 'zod';
import type { Settings } from '../config/settings.js';
import { ControlPlaneError, pathAllowed, type Target } from '../core/contracts.js';
import type { ControlPlane } from '../core/control-plane.js';
import { buildDiscoveryImages } from '../discovery/images.js';
import { verifyFirewall } from '../discovery/firewall.js';
import { openGateway, gatewayState } from '../discovery/gateway.js';
import { control, stageFiles } from '../discovery/io.js';
import { ownedLabBoundary, type OwnedLabBoundary } from '../discovery/lab.js';
import { forbiddenCredentialValues, SecretGuard } from '../discovery/parser.js';
import { ScanResources } from '../discovery/resources.js';
import type { DiscoveryStore } from '../discovery/store.js';
import type { Scan } from '../discovery/contracts.js';
import type { BolaCandidate } from './bola-contracts.js';
import type { BolaProof } from './bola-models.js';

const resultSchema = z
  .object({
    results: z
      .array(
        z
          .object({
            code: z.enum(['COMPLETE', 'INVALID_REQUEST', 'RESPONSE_BOUND', 'INVALID_JSON', 'NETWORK_FAILURE']),
            status: z.number().int().min(100).max(599).optional(),
            upstreamObserved: z.boolean().optional(),
            bodySha256: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .length(2),
  })
  .strict();

/** Internal lab hook: receives only a credential-free verifier after firewall installation. */
export type BolaVerificationHook = (input: {
  verifier: Docker.Container;
  gatewayIp: string;
  ingressNetworkId: string;
  signal: AbortSignal;
}) => Promise<void>;

/** Internal lab hook invoked after image inspection and before the image ID receipt. */
export type BolaImageBuildHook = (kind: 'gateway' | 'firewall', tag: string, imageId: string) => Promise<void>;

/** Two fixed GETs share the authorized gateway but use distinct sealed API-key profiles. */
export class BolaGatewayDriver {
  constructor(
    private readonly settings: Settings,
    private readonly control: ControlPlane,
    private readonly discoveryStore: DiscoveryStore,
    private readonly lab?: OwnedLabBoundary,
    private readonly verificationHook?: BolaVerificationHook,
    private readonly imageBuildHook?: BolaImageBuildHook,
  ) {}
  /** Release the exact owned resources retained by a BOLA verification job. */
  async cleanupJob(jobId: string) {
    const resources = new ScanResources(this.settings, this.discoveryStore, jobId);
    const cleaned = await resources.cleanup();
    return cleaned && (await this.discoveryStore.resources(jobId)).length === 0;
  }
  /** Verify the observed collection/detail candidate with isolated role reads and bounded evidence. */
  async verify(scan: Scan, candidate: BolaCandidate, jobId: string, signal: AbortSignal): Promise<BolaProof> {
    const context = await this.control.store.write(tx =>
      this.control.scanContext(scan.owner, scan.targetId, scan.request, tx),
    );
    const target: Target = context.target;
    if (
      target.application?.kind !== 'rest_api' ||
      !target.authorizationConfirmed ||
      !target.approvedOrigins.includes(candidate.origin) ||
      !pathAllowed(candidate.path, target) ||
      !target.permittedMethods.includes('GET') ||
      !candidate.path.startsWith('/')
    )
      throw new ControlPlaneError('BOLA_SCOPE_CHANGED', 409);
    const ownerIndex = context.profiles.findIndex(profile => profile.id === candidate.ownerProfileId);
    const alternateIndex = context.profiles.findIndex(profile => profile.id === candidate.alternateProfileId);
    if (
      ownerIndex < 0 ||
      alternateIndex < 0 ||
      ownerIndex === alternateIndex ||
      context.profiles[ownerIndex]?.kind !== 'api_key_header' ||
      context.profiles[alternateIndex]?.kind !== 'api_key_header' ||
      scan.roles.some(
        role =>
          [candidate.ownerProfileId, candidate.alternateProfileId].includes(role.profileId) &&
          role.identity !== 'READY',
      )
    )
      throw new ControlPlaneError('BOLA_PROFILES_UNAVAILABLE', 409);
    if (target.environment === 'lab' && !this.lab) throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
    if (this.lab) {
      const verified = await ownedLabBoundary(
        new ScanResources(this.settings, this.discoveryStore, scan.id).client,
        this.lab.fixtureId,
        this.lab.networkId,
        this.lab.token,
        this.lab.upstreamCa,
      );
      if (verified.address !== this.lab.address) throw new ControlPlaneError('OWNED_LAB_CHANGED', 409);
    }
    const resources = new ScanResources(this.settings, this.discoveryStore, jobId);
    const guard = new SecretGuard(forbiddenCredentialValues(context.guardHeaders.map(item => item.headers)));
    let images: Awaited<ReturnType<typeof buildDiscoveryImages>> | undefined;
    try {
      images = await buildDiscoveryImages(
        this.settings,
        signal,
        (imageId, inputHash) =>
          this.discoveryStore.remember({
            id: `${jobId}:${imageId}`,
            imageId,
            kind: 'image',
            scanId: jobId,
            token: inputHash,
          }),
        (tag, inputHash) =>
          this.discoveryStore.remember({
            id: `${jobId}:acquiring:${tag}`,
            imageId: tag,
            kind: 'image',
            scanId: jobId,
            token: inputHash,
          }),
        this.imageBuildHook,
      );
      const bounded = {
        ...context,
        target: {
          ...target,
          scanLimits: {
            ...target.scanLimits,
            maxRequests: Math.min(2, target.scanLimits.maxRequests),
            maxResponseBytes: Math.min(32768, target.scanLimits.maxResponseBytes),
            maxDurationSeconds: Math.min(30, target.scanLimits.maxDurationSeconds),
            maxConcurrency: 1,
          },
        },
      };
      const gateway = await openGateway(resources, bounded, images, this.lab, signal, guard, () => undefined);
      const before = await gatewayState(gateway.container, guard);
      const url = `${candidate.origin}${candidate.path}`;
      const requests = [ownerIndex, alternateIndex].map(index => ({
        url,
        proxy: `http://${gateway.ip}:${8080 + index}`,
      }));
      const verifierInput = Buffer.from(JSON.stringify({ requests }));
      const verifierCode = await readFile(join(this.settings.root, 'scripts/runtime/verify-bola.py'));
      const verifierCa = Buffer.from(gateway.ca);
      if ([verifierInput, verifierCode, verifierCa].some(bytes => guard.unsafe(bytes.toString())))
        throw new ControlPlaneError('BOLA_VERIFIER_CREDENTIAL_BOUNDARY', 503);
      const ports = [8080 + ownerIndex, 8080 + alternateIndex].sort((a, b) => a - b);
      if (ports[0] !== 8080 || ports[1] !== 8081) throw new ControlPlaneError('BOLA_PORT_RANGE_INVALID', 409);
      const common = {
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        Memory: 268435456,
        MemorySwap: 268435456,
        PidsLimit: 64,
        LogConfig: { Type: 'none', Config: {} },
        Init: true,
      };
      const anchor = await resources.container(
        {
          Entrypoint: [],
          Cmd: ['sleep', 'infinity'],
          HostConfig: {
            ...common,
            NetworkMode: gateway.ingress.network.id,
            Sysctls: { 'net.ipv4.ip_local_port_range': '40000 40031' },
          },
        },
        images.firewall,
      );
      await anchor.container.start();
      const anchorState = await anchor.container.inspect();
      if (
        anchorState.HostConfig.Sysctls?.['net.ipv4.ip_local_port_range'] !== '40000 40031' ||
        anchorState.HostConfig.Privileged ||
        (anchorState.HostConfig.CapAdd ?? []).length ||
        anchorState.HostConfig.LogConfig?.Type !== 'none'
      )
        throw new ControlPlaneError('BOLA_ANCHOR_POLICY', 503);
      const helper = await resources.container(
        {
          Entrypoint: [],
          Cmd: ['sleep', '10'],
          HostConfig: {
            ...common,
            NetworkMode: `container:${anchor.container.id}`,
            CapAdd: ['NET_ADMIN'],
            ReadonlyRootfs: true,
          },
        },
        images.firewall,
      );
      let helperTimer: NodeJS.Timeout | undefined;
      try {
        await helper.container.start();
        helperTimer = setTimeout(() => void resources.stop(helper.resource).catch(() => undefined), 9000);
        const policy = await control(
          helper.container,
          ['/bin/sh', '/opt/scanner/install-firewall.sh', gateway.ip, String(ports[0]), String(ports[1])],
          7000,
          signal,
        );
        if (!policy.success) throw new ControlPlaneError('BOLA_FIREWALL_UNAVAILABLE', 503);
        verifyFirewall(JSON.parse(policy.stdout), gateway.ip, [ports[0]!, ports[1]!]);
        const helperState = await helper.container.inspect();
        const capabilities = await control(helper.container, ['cat', '/proc/self/status'], 2000, signal);
        if (
          !capabilities.success ||
          !/^CapEff:\s+0*1000$/m.test(capabilities.stdout) ||
          !/^CapBnd:\s+0*1000$/m.test(capabilities.stdout) ||
          !/^NoNewPrivs:\s+1$/m.test(capabilities.stdout) ||
          !/^Seccomp:\s+2$/m.test(capabilities.stdout) ||
          helperState.HostConfig.CapAdd?.map((name: string) => name.replace(/^CAP_/, '')).join(',') !== 'NET_ADMIN' ||
          helperState.HostConfig.Privileged ||
          helperState.HostConfig.LogConfig?.Type !== 'none'
        )
          throw new ControlPlaneError('BOLA_HELPER_CAPABILITY', 503);
      } finally {
        if (helperTimer) clearTimeout(helperTimer);
        await resources.stop(helper.resource);
        await helper.container.remove({ force: true, v: true });
        await this.discoveryStore.forget(helper.resource.id);
      }
      const verifier = await resources.container(
        {
          Entrypoint: [],
          Cmd: ['sleep', 'infinity'],
          User: '10001:10001',
          WorkingDir: '/workspace',
          HostConfig: {
            ...common,
            NetworkMode: `container:${anchor.container.id}`,
          },
        },
        images.gateway,
      );
      await stageFiles(
        verifier.container,
        {
          'verify-bola.py': { bytes: verifierCode },
          'request.json': { bytes: verifierInput },
          'mitm-ca.pem': { bytes: verifierCa },
        },
        true,
        signal,
      );
      await verifier.container.start();
      const inspection = await verifier.container.inspect();
      if (
        inspection.HostConfig.NetworkMode !== `container:${anchor.container.id}` ||
        inspection.HostConfig.Privileged ||
        (inspection.HostConfig.CapAdd ?? []).length ||
        inspection.HostConfig.LogConfig?.Type !== 'none'
      )
        throw new ControlPlaneError('BOLA_VERIFIER_ISOLATION_FAILED', 503);
      await this.verificationHook?.({
        verifier: verifier.container,
        gatewayIp: gateway.ip,
        ingressNetworkId: gateway.ingress.network.id,
        signal,
      });
      let directFixtureDenied: boolean | null = null;
      if (this.lab) {
        const canary = await control(
          verifier.container,
          [
            'python3',
            '-c',
            'import socket,sys;\ntry:\n s=socket.create_connection((sys.argv[1],18080),1); s.close(); print("OPEN")\nexcept OSError:\n print("DENIED")',
            this.lab.address,
          ],
          2500,
          signal,
        );
        directFixtureDenied = canary.success && canary.stdout.trim() === 'DENIED' && !canary.stderr;
        if (!directFixtureDenied) throw new ControlPlaneError('BOLA_DIRECT_EGRESS_OPEN', 503);
      }
      const output = await control(verifier.container, ['python3', '/workspace/verify-bola.py'], 20000, signal);
      if (!output.success || output.stderr || guard.unsafe(output.stdout))
        throw new ControlPlaneError('BOLA_VERIFIER_OUTPUT_REJECTED', 503);
      const parsed = resultSchema.parse(JSON.parse(output.stdout));
      const after = await gatewayState(gateway.container, guard);
      const requestCount = before.remainingRequests - after.remainingRequests;
      const gatewayCredentialInjections =
        (after.counts['credential-injected'] ?? 0) - (before.counts['credential-injected'] ?? 0);
      const verifiedGatewayPeers = (after.counts['peer-verified'] ?? 0) - (before.counts['peer-verified'] ?? 0);
      if (gatewayCredentialInjections !== requestCount || verifiedGatewayPeers < 2)
        throw new ControlPlaneError('BOLA_GATEWAY_IDENTITY_BOUNDARY', 503);
      if (requestCount < 0 || requestCount > 2) throw new ControlPlaneError('BOLA_REQUEST_BOUNDARY_FAILED', 409);
      const [owner, alternate] = parsed.results;
      const completed =
        requestCount === 2 &&
        owner?.code === 'COMPLETE' &&
        alternate?.code === 'COMPLETE' &&
        owner.upstreamObserved === true &&
        alternate.upstreamObserved === true &&
        owner.status === 200 &&
        Boolean(owner.bodySha256) &&
        alternate.status !== undefined &&
        (alternate.status !== 200 || Boolean(alternate.bodySha256));
      return {
        checkerId: 'bola_rest_read',
        candidateId: candidate.id,
        ownerStatus: owner?.status ?? null,
        alternateStatus: alternate?.status ?? null,
        bodyMatches: completed && alternate?.status === 200 ? owner?.bodySha256 === alternate.bodySha256 : null,
        upstreamObserved: owner?.upstreamObserved === true && alternate?.upstreamObserved === true,
        requestCount,
        completed,
        verifierCredentialFree: true,
        firewallVerified: true,
        directFixtureDenied,
        gatewayCredentialInjections,
        verifiedGatewayPeers,
      };
    } finally {
      guard.clear();
      for (const header of context.headers) for (const name of Object.keys(header)) delete header[name];
      for (const item of context.guardHeaders) for (const name of Object.keys(item.headers)) delete item.headers[name];
      let complete = false;
      try {
        complete = await this.cleanupJob(jobId);
      } finally {
        images?.certutil.fill(0);
      }
      if (!complete) throw new ControlPlaneError('BOLA_CLEANUP_DEBT', 503);
    }
  }
}
