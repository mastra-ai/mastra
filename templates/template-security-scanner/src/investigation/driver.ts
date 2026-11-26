import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Settings } from '../config/settings.js';
import { ControlPlaneError, pathAllowed } from '../core/contracts.js';
import type { ControlPlane } from '../core/control-plane.js';
import { ScanResources } from '../discovery/resources.js';
import type { DiscoveryStore } from '../discovery/store.js';
import { buildDiscoveryImages, type DiscoveryImages } from '../discovery/images.js';
import { openGateway, gatewayState } from '../discovery/gateway.js';
import { forbiddenCredentialValues, SecretGuard } from '../discovery/parser.js';
import { control, stageFiles } from '../discovery/io.js';
import { ownedApprovalCallback, ownedLabBoundary, type OwnedLabBoundary } from '../discovery/lab.js';
import type { Scan } from '../discovery/contracts.js';
import type { Approval, Hypothesis, OwnedResource } from './store.js';
import type { VerificationDriver } from './service.js';
import { verificationProofSchema, type VerificationProof } from './verification.js';
import { z } from 'zod';
import { buildLocalImage, type ImageReceipt } from '../runtime/docker.js';
import { verifyBrowserRead } from './browser.js';

const responseSchema = z
  .object({
    results: z
      .array(
        z
          .object({
            code: z.enum(['COMPLETE', 'INVALID_REQUEST', 'INVALID_HEADERS', 'RESPONSE_BOUND', 'NETWORK_FAILURE']),
            status: z.number().int().min(100).max(599).optional(),
            upstreamObserved: z.boolean().optional(),
            observedHeader: z.string().max(300).nullable().optional(),
            location: z.url().max(2048).nullable().optional(),
            marker: z
              .string()
              .regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/)
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

type Request = {
  name: string;
  url: string;
  proxy: string;
  headersFile: string;
  method: 'GET';
  invalidSession?: true;
  headerName?: string;
};
const empty = (
  category: Hypothesis['category'],
  surfacePresent: boolean,
  prerequisitesReady: boolean,
): VerificationProof => ({
  source: 'policy-precheck',
  category,
  completed: false,
  surfacePresent,
  prerequisitesReady,
  identityValid: true,
  scopeApproved: true,
  requestCount: 0,
  evidence: [],
  withheld: false,
});

export class OwnedGatewayVerifier implements VerificationDriver {
  private activeImageUsers = 0;
  private imageRelease: Promise<void> = Promise.resolve();
  private readonly pendingImageReleases: Array<{
    jobId: string;
    images: DiscoveryImages;
    browserImage?: ImageReceipt;
  }> = [];
  private imageCleanupDebt = false;
  constructor(
    private readonly settings: Settings,
    private readonly controlPlane: ControlPlane,
    private readonly discoveryStore: DiscoveryStore,
    private readonly lab?: OwnedLabBoundary,
  ) {}
  /** Recover interrupted verification resources from their persisted ownership receipts. */
  async recover(jobIds: string[]) {
    for (const id of jobIds) {
      if (!(await new ScanResources(this.settings, this.discoveryStore, id).cleanup()))
        throw new ControlPlaneError('VERIFICATION_CLEANUP_DEBT', 503);
    }
  }
  /** Execute the allowlisted checker inside its authorized target and owned-resource boundary. */
  async verify(input: {
    jobId: string;
    scan: Scan;
    hypothesis: Hypothesis;
    approval: Approval | null;
    resource: OwnedResource | null;
    signal: AbortSignal;
  }) {
    const { jobId, scan, hypothesis, approval, resource } = input;
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(hypothesis.maxDurationSeconds * 1000)]);
    signal.throwIfAborted();
    if (!this.lab) throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
    const context = await this.controlPlane.store.write(tx =>
      this.controlPlane.scanContext(
        scan.owner,
        scan.targetId,
        {
          ...scan.request,
          profiles: scan.request.profiles.map(binding => ({
            ...binding,
            profileRevision:
              hypothesis.lineage.profiles.find(item => item.profileId === binding.profileId)?.profileRevision ??
              binding.profileRevision,
          })),
        },
        tx,
      ),
    );
    const resources = new ScanResources(this.settings, this.discoveryStore, jobId);
    let images: DiscoveryImages | undefined;
    let browserImage: ImageReceipt | undefined;
    this.activeImageUsers++;
    try {
      await this.imageRelease;
      if (this.imageCleanupDebt) throw new ControlPlaneError('VERIFICATION_CLEANUP_DEBT', 503);
      if (context.target.environment !== 'lab') throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
      const verified = await ownedLabBoundary(
        resources.client,
        this.lab.fixtureId,
        this.lab.networkId,
        this.lab.token,
        this.lab.upstreamCa,
      );
      if (verified.address !== this.lab.address) throw new ControlPlaneError('OWNED_LAB_CHANGED', 409);
      const evidence = await this.discoveryStore.evidence(scan.id, scan.owner, 512, 0);
      const selected = evidence.filter(item => hypothesis.evidenceIds.includes(item.id));
      const surface = selected.find(
        item =>
          item.observation.method === 'GET' &&
          item.observation.kind === (hypothesis.category === 'ssrf' ? 'form' : 'endpoint'),
      );
      if (!surface) return empty(hypothesis.category, false, false);
      const url = surface.observation.origin + surface.observation.path;
      if (
        !context.target.approvedOrigins.includes(surface.observation.origin) ||
        !pathAllowed(surface.observation.path, context.target)
      )
        throw new ControlPlaneError('OUT_OF_SCOPE', 403);
      const byRole = new Map(context.profiles.map((profile, index) => [profile.role, { profile, index }]));
      const byId = new Map(context.profiles.map((profile, index) => [profile.id, { profile, index }]));
      const requests: Request[] = [];
      /** Add a verification read only for a profile with ready recorded scan identity. */
      const add = (name: string, profileId: string, invalidSession = false) => {
        const entry = byId.get(profileId);
        if (!entry || !scan.roles.some(role => role.profileId === profileId && role.identity === 'READY'))
          throw new ControlPlaneError('PRECONDITION_MISSING', 409);
        requests.push({
          name,
          url,
          proxy: `http://GATEWAY:${8080 + entry.index}`,
          headersFile: `/workspace/${entry.profile.id}.headers`,
          method: 'GET',
          ...(invalidSession ? { invalidSession: true as const } : {}),
        });
      };
      if (hypothesis.category !== 'ssrf') {
        if (
          !resource ||
          resource.id !== hypothesis.resourceBindingId ||
          resource.targetId !== scan.targetId ||
          resource.path !== surface.observation.path ||
          resource.category !== hypothesis.category ||
          resource.targetRevision !== hypothesis.lineage.targetRevision ||
          resource.policyRevision !== hypothesis.lineage.policyRevision
        )
          return empty(hypothesis.category, true, false);
        if (resource.category === 'idor') {
          add('owner', resource.ownerProfileId);
          add('alternate', resource.alternateProfileId);
        } else if (resource.category === 'authentication_bypass') {
          add('authenticated', resource.authenticatedProfileId);
          add('public', resource.publicProfileId);
          add('invalid-session', resource.publicProfileId, true);
        } else if (resource.category === 'bfla') {
          add('admin', resource.adminProfileId);
          add('low', resource.lowProfileId);
        } else {
          add(resource.category, resource.publicProfileId);
          if (resource.category === 'misconfiguration') requests[0]!.headerName = resource.headerName;
          if (resource.category === 'open_redirect') {
            const redirectUrl = new URL(url);
            redirectUrl.searchParams.set(resource.parameter, resource.destination);
            requests[0]!.url = redirectUrl.href;
          }
        }
      } else if (
        !approval ||
        approval.callback !== ownedApprovalCallback(verified, approval.id) ||
        approval.decision !== 'approved' ||
        !approval.consumed ||
        !surface.observation.parameterNames.includes('url')
      )
        return empty(hypothesis.category, true, false);
      else {
        const entry = byRole.get(surface.observation.role);
        if (!entry) return empty(hypothesis.category, true, false);
        const targetUrl = new URL(url);
        targetUrl.searchParams.set('url', approval.callback);
        requests.push({
          name: 'active',
          url: targetUrl.href,
          proxy: `http://GATEWAY:${8080 + entry.index}`,
          headersFile: `/workspace/${entry.profile.id}.headers`,
          method: 'GET',
        });
      }
      if (requests.length > hypothesis.maxRequests) throw new ControlPlaneError('BUDGET_EXCEEDED', 403);
      const guard = new SecretGuard(forbiddenCredentialValues(context.guardHeaders.map(item => item.headers)));
      images = await buildDiscoveryImages(this.settings, signal, (imageId, inputHash) =>
        this.discoveryStore.remember({
          id: `${jobId}:${imageId}`,
          imageId,
          kind: 'image',
          scanId: jobId,
          token: inputHash,
        }),
      );
      const gateway = await openGateway(
        resources,
        context,
        images,
        this.lab,
        signal,
        guard,
        () => undefined,
        resource?.category === 'authentication_bypass' ? { publicProfileId: resource.publicProfileId, url } : undefined,
      );
      const before = await gatewayState(gateway.container, guard);
      const callbackBefore = hypothesis.category === 'ssrf' ? await this.callbackCount(resources, approval!.id) : 0;
      const configured = requests.map(item => ({ ...item, proxy: item.proxy.replace('GATEWAY', gateway.ip) }));
      const verifier = await resources.container(
        {
          Entrypoint: [],
          Cmd: ['sleep', 'infinity'],
          User: '10001:10001',
          WorkingDir: '/workspace',
          HostConfig: {
            NetworkMode: gateway.ingress.network.id,
            CapDrop: ['ALL'],
            SecurityOpt: ['no-new-privileges:true'],
            Memory: 268435456,
            MemorySwap: 268435456,
            PidsLimit: 64,
            LogConfig: { Type: 'none', Config: {} },
            Init: true,
          },
        },
        images.gateway,
      );
      await stageFiles(
        verifier.container,
        {
          'verify-readonly.py': {
            bytes: await readFile(join(this.settings.root, 'scripts/runtime/verify-readonly.py')),
          },
          'request.json': { bytes: Buffer.from(JSON.stringify({ requests: configured })) },
          'mitm-ca.pem': { bytes: Buffer.from(gateway.ca) },
          ...Object.fromEntries(
            context.profiles.map((profile, index) => [
              `${profile.id}.headers`,
              {
                bytes: Buffer.from(
                  Object.entries(context.headers[index] ?? {})
                    .map(([name, value]) => `${name}: ${value}\n`)
                    .join(''),
                ),
              },
            ]),
          ),
        },
        true,
        signal,
      );
      await verifier.container.start();
      const inspection = await verifier.container.inspect();
      if (
        Object.keys(inspection.NetworkSettings.Networks).length !== 1 ||
        !inspection.NetworkSettings.Networks[gateway.ingress.name] ||
        inspection.HostConfig.Privileged ||
        (inspection.HostConfig.CapAdd ?? []).length ||
        inspection.HostConfig.LogConfig?.Type !== 'none'
      )
        throw new ControlPlaneError('VERIFIER_ISOLATION_FAILED', 503);
      const output = await control(
        verifier.container,
        ['python3', '/workspace/verify-readonly.py'],
        Math.min(45000, hypothesis.maxDurationSeconds * 1000),
        signal,
      );
      if (!output.success || output.stderr || guard.unsafe(output.stdout))
        throw new ControlPlaneError('VERIFIER_OUTPUT_REJECTED', 503);
      const parsed = responseSchema.parse(JSON.parse(output.stdout));
      let browserRead: Awaited<ReturnType<typeof verifyBrowserRead>> | undefined;
      if (
        resource?.category === 'cors' &&
        parsed.results[0]?.code === 'COMPLETE' &&
        parsed.results[0].status === 200 &&
        parsed.results[0].upstreamObserved &&
        parsed.results[0].marker === resource.marker
      ) {
        browserImage = await buildLocalImage(this.settings, signal);
        for (const imageId of (browserImage.cleanupImageIds ?? [browserImage.imageId]).toReversed())
          await this.discoveryStore.remember({
            id: `${jobId}:${imageId}`,
            imageId,
            kind: 'image',
            scanId: jobId,
            token: browserImage.sourceHash,
            sharedBase: true,
          });
        const entry = byId.get(resource.publicProfileId)!;
        browserRead = await verifyBrowserRead({
          settings: this.settings,
          resources,
          images,
          image: browserImage,
          networkId: gateway.ingress.network.id,
          gatewayIp: gateway.ip,
          port: 8080 + entry.index,
          url,
          marker: resource.marker,
          guard,
          signal,
        });
      }
      const after = await gatewayState(gateway.container, guard);
      const requestCount = before.remainingRequests - after.remainingRequests;
      if (
        requestCount < 0 ||
        requestCount > hypothesis.maxRequests ||
        requestCount !== requests.length + (browserRead ? 1 : 0)
      )
        throw new ControlPlaneError('VERIFICATION_BOUNDARY_FAILED', 409);
      if (parsed.results.some(item => item.code !== 'COMPLETE' || item.status === undefined || !item.upstreamObserved))
        return { ...empty(hypothesis.category, true, true), source: 'owned-gateway' as const, requestCount };
      const base = {
        source: 'owned-gateway' as const,
        completed: true,
        surfacePresent: true,
        prerequisitesReady: true,
        identityValid: true,
        scopeApproved: true,
        requestCount,
        withheld: false,
      };
      /** Read an optional marker from the indexed verification result. */
      const marker = (index: number) => parsed.results[index]?.marker ?? null;
      const status = (index: number) => parsed.results[index]!.status!;
      if (status(0) === 404)
        return { ...empty(hypothesis.category, false, true), source: 'owned-gateway' as const, requestCount };
      if (
        resource &&
        ['misconfiguration', 'information_exposure', 'cors'].includes(resource.category) &&
        status(0) !== 200
      )
        return { ...empty(hypothesis.category, true, true), source: 'owned-gateway' as const, requestCount };
      if (
        resource &&
        ['idor', 'authentication_bypass', 'bfla'].includes(resource.category) &&
        (!('marker' in resource) || marker(0) !== resource.marker || status(0) !== 200)
      )
        return { ...empty(hypothesis.category, true, false), source: 'owned-gateway' as const, requestCount };
      if (resource?.category === 'idor')
        return verificationProofSchema.parse({
          ...base,
          category: 'idor',
          evidence: ['owner response', 'alternate response'].map(kind => ({ id: randomUUID(), kind })),
          observation: {
            category: 'idor',
            ownerStatus: status(0),
            alternateStatus: status(1),
            ownerIdentity: resource.ownerProfileId,
            alternateIdentity: resource.alternateProfileId,
            resourceOwned: true,
            ownerMarker: marker(0) ?? '',
            alternateMarker: marker(1),
          },
        });
      if (resource?.category === 'authentication_bypass')
        return verificationProofSchema.parse({
          ...base,
          category: 'authentication_bypass',
          evidence: ['authenticated baseline', 'public response', 'invalid-session response'].map(kind => ({
            id: randomUUID(),
            kind,
          })),
          observation: {
            category: 'authentication_bypass',
            protectedStatus: status(0),
            publicStatus: status(1),
            invalidSessionStatus: status(2),
            protectedMarker: marker(0) ?? '',
            publicMarker: marker(1),
            invalidSessionMarker: marker(2),
          },
        });
      if (resource?.category === 'bfla')
        return verificationProofSchema.parse({
          ...base,
          category: 'bfla',
          evidence: ['admin response', 'low-role response'].map(kind => ({ id: randomUUID(), kind })),
          observation: {
            category: 'bfla',
            adminStatus: status(0),
            lowStatus: status(1),
            rolesDistinct: true,
            readOnly: true,
            adminMarker: marker(0) ?? '',
            lowMarker: marker(1),
          },
        });
      if (resource?.category === 'misconfiguration')
        return verificationProofSchema.parse({
          ...base,
          category: resource.category,
          evidence: [{ id: randomUUID(), kind: 'observed header' }],
          observation: {
            category: resource.category,
            headerName: resource.headerName,
            expectedValue: resource.expectedValue,
            observedValue: parsed.results[0]!.observedHeader ?? null,
          },
        });
      if (resource?.category === 'open_redirect')
        return verificationProofSchema.parse({
          ...base,
          category: resource.category,
          evidence: [{ id: randomUUID(), kind: 'Location header' }],
          observation: {
            category: resource.category,
            approvedOrigin: surface.observation.origin,
            submittedDestination: resource.destination,
            location: parsed.results[0]!.location ?? null,
            followed: false,
          },
        });
      if (resource?.category === 'information_exposure')
        return verificationProofSchema.parse({
          ...base,
          category: resource.category,
          evidence: [{ id: randomUUID(), kind: 'response marker' }],
          observation: {
            category: resource.category,
            marker: resource.marker,
            observedMarker: marker(0),
            publicResponse: true,
          },
        });
      if (resource?.category === 'cors') {
        if (marker(0) !== resource.marker)
          return { ...empty('cors', true, false), source: 'owned-gateway' as const, requestCount };
        if (!browserRead?.completed)
          return { ...empty('cors', true, true), source: 'owned-gateway' as const, requestCount };
        return verificationProofSchema.parse({
          ...base,
          category: 'cors',
          evidence: [{ id: randomUUID(), kind: 'browser cross-origin read' }],
          observation: {
            category: 'cors',
            browserCrossOrigin: true,
            sensitiveFixture: true,
            responseReadable: browserRead.readable,
          },
        });
      }
      const callbackAfter = await this.callbackCount(resources, approval!.id);
      return verificationProofSchema.parse({
        ...base,
        category: 'ssrf',
        evidence: ['callback counter', 'approval binding'].map(kind => ({ id: randomUUID(), kind })),
        observation: {
          category: 'ssrf',
          environment: 'lab',
          approvalId: approval!.id,
          approvalCurrent: true,
          ownedCallback: true,
          callbackObserved: callbackAfter === callbackBefore + 1,
        },
      });
    } finally {
      for (const header of context.headers) for (const name of Object.keys(header)) delete header[name];
      for (const item of context.guardHeaders) for (const name of Object.keys(item.headers)) delete item.headers[name];
      const complete = await resources.cleanup(Boolean(images)).catch(() => false);
      if (!complete) this.imageCleanupDebt = true;
      if (images) this.pendingImageReleases.push({ jobId, images, ...(browserImage ? { browserImage } : {}) });
      this.activeImageUsers--;
      if (this.activeImageUsers === 0 && !this.imageCleanupDebt && this.pendingImageReleases.length) {
        const releases = this.pendingImageReleases.splice(0);
        this.imageRelease = (async () => {
          for (const release of releases) {
            release.images.certutil.fill(0);
            if (!(await new ScanResources(this.settings, this.discoveryStore, release.jobId).cleanup())) {
              this.imageCleanupDebt = true;
              throw new ControlPlaneError('VERIFICATION_CLEANUP_DEBT', 503);
            }
          }
        })();
      }
      await this.imageRelease;
      if (!complete) throw new ControlPlaneError('VERIFICATION_CLEANUP_DEBT', 503);
    }
  }
  /** Read the bounded owned callback receipt used to evaluate SSRF evidence. */
  private async callbackCount(resources: ScanResources, approvalId: string) {
    if (!this.lab) throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
    const receipt = await control(resources.client.getContainer(this.lab.fixtureId), [
      'python',
      '-c',
      'import urllib.request;print(urllib.request.urlopen("http://127.0.0.1:18090/stats",timeout=2).read().decode())',
    ]);
    if (!receipt.success) throw new ControlPlaneError('CALLBACK_RECEIPT_UNAVAILABLE', 503);
    const counts = z.record(z.string(), z.number().int().nonnegative()).parse(JSON.parse(receipt.stdout));
    return counts[`owned-callback-received:${approvalId}`] ?? 0;
  }
}
