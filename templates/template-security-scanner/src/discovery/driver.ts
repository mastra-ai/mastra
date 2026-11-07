import type Docker from 'dockerode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type { Settings } from '../config/settings.js';
import type { ScanContext } from '../core/control-plane.js';
import { ControlPlaneError } from '../core/contracts.js';
import { buildLocalImage, type ImageReceipt } from '../runtime/docker.js';
import { sandboxOptions } from '../runtime/sandbox.js';
import { buildDiscoveryImages, type DiscoveryImages } from './images.js';
import { ScanResources } from './resources.js';
import { DiscoveryStore } from './store.js';
import { privateNativeSandbox, type PrivateSandbox } from './native.js';
import { privateProcess } from './private-pipe.js';
import { katanaCommand } from './command.js';
import { DiscoveryParser, forbiddenCredentialValues, SecretGuard } from './parser.js';
import { browserSandboxStatus, inspectBrowser, BrowserInspectionError } from './browser.js';
import { control, readRuntimeFile, stageFiles } from './io.js';
import { verifyFirewall } from './firewall.js';
import { budgetSchema, roleResultSchema, type Scan, type Observation, type ScanReason } from './contracts.js';

import type { OwnedLabBoundary } from './lab.js';
export { ownedLabBoundary, type OwnedLabBoundary } from './lab.js';
import { openGateway, gatewayRole, gatewayStatsSchema } from './gateway.js';
import { RestJsonReader } from './rest.js';
import { privatePrincipal } from './principals.js';
/** Sanitized discovery-driver outcome and shared-budget snapshot. */
export type DriverResult = {
  /** Sanitized machine-readable reason for the recorded state. */
  reason: ScanReason;
  /** Whether this result is incomplete or contains withheld observations. */
  partial: boolean;
  /** Whether all owned resources were cleaned successfully. */
  cleanupComplete: boolean;
  /** Current shared-budget snapshot. */
  budget: Scan['budget'];
  /** Finite runtime failure code, or null when none was recorded. */
  diagnostic: Scan['diagnostic'];
  /** Sanitized gateway event counts keyed by allowlisted counter names. */
  networkCounters: Record<string, number>;
};
/** Allowlisted discovery boundary with cancellation and bounded output. */
export interface DiscoveryDriver {
  /** Execute bounded discovery using trusted runtime-resolved inputs. */
  discover(
    scan: Scan,
    context: ScanContext,
    signal: AbortSignal,
    publish: (observations: Observation[], role: Scan['roles'][number]) => Promise<void>,
    validate: () => Promise<void>,
  ): Promise<DriverResult>;
}
export class KatanaDiscoveryDriver implements DiscoveryDriver {
  constructor(
    private readonly settings: Settings,
    private readonly store: DiscoveryStore,
    private readonly lab?: OwnedLabBoundary,
  ) {}
  /** Run bounded discovery with confined identities, shared budgets and owned-resource cleanup. */
  async discover(
    scan: Scan,
    context: ScanContext,
    signal: AbortSignal,
    publish: (observations: Observation[], role: Scan['roles'][number]) => Promise<void>,
    validate: () => Promise<void>,
  ): Promise<DriverResult> {
    const resources = new ScanResources(this.settings, this.store, scan.id),
      client = resources.client;
    const guard = new SecretGuard(forbiddenCredentialValues(context.guardHeaders.map(item => item.headers)));
    const aborter = new AbortController();
    const joined = AbortSignal.any([
      signal,
      aborter.signal,
      AbortSignal.timeout(context.target.scanLimits.maxDurationSeconds * 1000 + 30000),
    ]);
    const principals = new Map<string, { source: string; value: string | null }>();
    let images: DiscoveryImages | undefined,
      image: ImageReceipt | undefined,
      gateway: Docker.Container | undefined,
      gatewayResource: Awaited<ReturnType<ScanResources['container']>>['resource'] | undefined;
    let reason: ScanReason = 'DISCOVERY_COMPLETE',
      partial = false,
      budget: Scan['budget'] = {
        remainingRequests: context.target.scanLimits.maxRequests,
        remainingBytes: context.target.scanLimits.maxResponseBytes,
        exhausted: false,
        reason: null,
      },
      cleanupComplete = false;
    let networkCounters: Record<string, number> = {};
    let networkStop: Promise<void> | undefined;
    let stage: NonNullable<Scan['diagnostic']> = 'INPUTS',
      diagnostic: Scan['diagnostic'] = null;
    /** Stop the gateway resource and retain any cleanup failure as the scan's terminal reason. */
    const stopNetwork = () => {
      if (gatewayResource)
        networkStop = resources.stop(gatewayResource).catch(() => {
          reason = 'CLEANUP_FAILED';
        });
    };
    joined.addEventListener('abort', stopNetwork, { once: true });
    /** Read and validate current gateway counters for shared discovery-budget accounting. */
    const snapshot = async () => {
      if (!gateway) throw new Error('GATEWAY_UNAVAILABLE');
      const state = gatewayStatsSchema.parse(
        JSON.parse((await readRuntimeFile(gateway, '/workspace/gateway-stats.json')).toString()),
      );
      if (guard.unsafe(JSON.stringify(state))) throw new Error('SANITIZED_COUNTERS_REJECTED');
      networkCounters = state.counts;
      budget = budgetSchema.parse({
        remainingRequests: state.remainingRequests,
        remainingBytes: state.remainingBytes,
        exhausted: state.exhausted,
        reason: state.exhaustionReason,
      });
      return state;
    };
    const common: Docker.HostConfig = {
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'],
      Memory: 536870912,
      MemorySwap: 536870912,
      PidsLimit: 128,
      LogConfig: { Type: 'none', Config: {} },
      Init: true,
    };
    try {
      await validate();
      joined.throwIfAborted();
      images = await buildDiscoveryImages(this.settings, joined, (imageId, inputHash) =>
        this.store.remember({ id: `${scan.id}:${imageId}`, imageId, kind: 'image', scanId: scan.id, token: inputHash }),
      );
      image = await buildLocalImage(this.settings, joined);
      for (const imageId of (image.cleanupImageIds ?? [image.imageId]).toReversed())
        await this.store.remember({
          id: `${scan.id}:${imageId}`,
          imageId,
          kind: 'image',
          scanId: scan.id,
          token: image.sourceHash,
          sharedBase: true,
        });
      const session = await openGateway(resources, context, images, this.lab, joined, guard, value => {
        stage = value;
      });
      gateway = session.container;
      gatewayResource = session.resource;
      const { ingress, ip: gatewayIp, ca } = session;
      await snapshot();
      for (let index = 0; index < context.profiles.length; index++) {
        await validate();
        joined.throwIfAborted();
        const profile = context.profiles[index]!,
          header = context.headers[index]!,
          port = 8080 + index;
        const anchor = await resources.container(
          {
            Entrypoint: [],
            Cmd: ['sleep', 'infinity'],
            HostConfig: {
              ...common,
              NetworkMode: ingress.network.id,
              Sysctls: { 'net.ipv4.ip_local_port_range': '40000 40031' },
            },
          },
          images.firewall,
        );
        await anchor.container.start();
        const anchorInspection = await anchor.container.inspect();
        if (
          anchorInspection.HostConfig.Sysctls?.['net.ipv4.ip_local_port_range'] !== '40000 40031' ||
          anchorInspection.HostConfig.Privileged ||
          (anchorInspection.HostConfig.CapAdd ?? []).length ||
          anchorInspection.HostConfig.LogConfig?.Type !== 'none'
        )
          throw new Error('ANCHOR_POLICY_MISMATCH');
        stage = 'FIREWALL';
        const helper = await resources.container(
          {
            Entrypoint: [],
            // PID 1 also bounds capability lifetime if the application exits.
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
          stage = 'FIREWALL_COMMAND';
          const policy = await control(
            helper.container,
            ['/bin/sh', '/opt/scanner/install-firewall.sh', gatewayIp, String(port)],
            7000,
            joined,
          );
          if (!policy.success) throw new Error('FIREWALL_UNAVAILABLE');
          stage = 'FIREWALL_RULES';
          verifyFirewall(JSON.parse(policy.stdout), gatewayIp, port);
          stage = 'FIREWALL_CAPABILITY';
          const helperInspection = await helper.container.inspect();
          const capabilities = await control(helper.container, ['cat', '/proc/self/status'], 2000, joined);
          const capNames = helperInspection.HostConfig.CapAdd?.map((name: string) => name.replace(/^CAP_/, ''));
          if (
            !capabilities.success ||
            !/^CapEff:\s+0*1000$/m.test(capabilities.stdout) ||
            !/^CapBnd:\s+0*1000$/m.test(capabilities.stdout) ||
            !/^NoNewPrivs:\s+1$/m.test(capabilities.stdout) ||
            !/^Seccomp:\s+2$/m.test(capabilities.stdout) ||
            helperInspection.HostConfig.LogConfig?.Type !== 'none' ||
            capNames?.join(',') !== 'NET_ADMIN' ||
            helperInspection.HostConfig.Privileged
          )
            throw new Error('HELPER_CAPABILITY_MISMATCH');
        } finally {
          if (helperTimer) clearTimeout(helperTimer);
          await resources.stop(helper.resource);
          await helper.container.remove({ force: true, v: true });
          await this.store.forget(helper.resource.id);
        }
        let sandbox: PrivateSandbox | undefined;
        const roleController = new AbortController(),
          roleSignal = AbortSignal.any([joined, roleController.signal]);
        const parser = new DiscoveryParser(context.target, profile, scan.request.mode, guard, () =>
          roleController.abort(),
        );
        let identityStatus: 'READY' | 'AUTH_REQUIRED' | 'UNAVAILABLE' =
          profile.kind === 'public' ? 'READY' : 'UNAVAILABLE';
        try {
          stage = 'NATIVE_SANDBOX';
          const intent = await resources.intent('container', image.imageId);
          const options = sandboxOptions(this.settings, image, intent.name);
          sandbox = await privateNativeSandbox(client, {
            ...options,
            network: `container:${anchor.container.id}`,
            labels: { ...options.labels, ...intent.labels, 'dev.mastra.security-scanner.profile': profile.id },
          });
          await stageFiles(
            sandbox.container,
            {
              headers: {
                bytes: Buffer.from(
                  Object.entries(context.target.application?.kind === 'rest_api' ? {} : header)
                    .map(([name, value]) => `${name}: ${value}\n`)
                    .join(''),
                ),
              },
              'chromium-safe': {
                bytes: await readFile(join(this.settings.root, 'scripts/runtime/chromium-safe.sh')),
                mode: 0o700,
              },
              'browser-inspect.sh': {
                bytes: await readFile(join(this.settings.root, 'scripts/runtime/browser-inspect.sh')),
                mode: 0o700,
              },
              certutil: { bytes: Buffer.from(images.certutil), mode: 0o700 },
              'mitm-ca.pem': { bytes: Buffer.from(ca) },
            },
            false,
            roleSignal,
          );
          const mkdir = await sandbox.executeCommand(
            'mkdir',
            ['-p', '-m', '700', '/workspace/private-tmp', '/workspace/.pki/nssdb'],
            { timeout: 3000, maxRetainedBytes: 0, abortSignal: roleSignal },
          );
          if (!mkdir.success) throw new Error('PRIVATE_DIRECTORY_UNAVAILABLE');
          if (scan.request.mode === 'headless')
            for (const args of [
              ['-N', '--empty-password', '-d', 'sql:/workspace/.pki/nssdb'],
              [
                '-A',
                '-d',
                'sql:/workspace/.pki/nssdb',
                '-n',
                'scanner-owned-interception',
                '-t',
                'C,,',
                '-i',
                '/workspace/mitm-ca.pem',
              ],
            ]) {
              const result = await sandbox.executeCommand('/workspace/certutil', args, {
                timeout: 5000,
                maxRetainedBytes: 0,
                abortSignal: roleSignal,
              });
              if (!result.success) throw new Error('SANDBOX_CA_IMPORT');
            }
          if (context.target.application?.kind === 'rest_api') {
            if (scan.request.mode !== 'http') throw new Error('REST_HEADLESS_UNSUPPORTED');
            const configured = context.target.authenticationDrivers?.find(item => item.profileId === profile.id);
            if (
              profile.kind !== 'public' &&
              (profile.kind !== 'api_key_header' || configured?.kind !== 'api_key_header')
            )
              throw new Error('REST_AUTHENTICATION_UNSUPPORTED');
            let principal: string | null = null;
            const principalSource =
              configured?.kind === 'api_key_header' && configured.principalJsonPointer
                ? JSON.stringify([
                    new URL(context.target.entryUrl).origin,
                    configured.accessCheckPath,
                    configured.principalJsonPointer,
                  ])
                : '';
            const reader = new RestJsonReader(
              sandbox,
              context.target,
              profile,
              `http://${gatewayIp}:${port}`,
              guard,
              roleSignal,
              validate,
              body => {
                principal = privatePrincipal(
                  body,
                  configured?.kind === 'api_key_header' ? configured.principalJsonPointer : undefined,
                );
              },
            );
            stage = 'IDENTITY';
            const result = await reader.discover(
              configured?.kind === 'api_key_header' ? configured.accessCheckPath : undefined,
              scan.request.operation === 'identity',
            );
            const state = await snapshot();
            identityStatus =
              profile.kind === 'public'
                ? 'READY'
                : (state.counts[`identity-${gatewayRole(profile)}-READY`] ?? 0) > 0 && result.accessReady
                  ? 'READY'
                  : (state.counts[`identity-${gatewayRole(profile)}-AUTH_REQUIRED`] ?? 0) > 0
                    ? 'AUTH_REQUIRED'
                    : 'UNAVAILABLE';
            if (identityStatus !== 'READY') {
              reason = identityStatus === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'IDENTITY_UNAVAILABLE';
              partial = true;
            }
            if (identityStatus !== 'READY') principal = null;
            const principalComparisons = [...principals].map(([profileId, previous]) => ({
              profileId,
              result:
                !principalSource || previous.source !== principalSource || principal === null || previous.value === null
                  ? ('UNKNOWN' as const)
                  : previous.value === principal
                    ? ('SAME' as const)
                    : ('DISTINCT' as const),
            }));
            principals.set(profile.id, { source: principalSource, value: principal });
            principal = null;
            const observations = identityStatus === 'READY' ? result.observations : [];
            const role = roleResultSchema.parse({
              profileId: profile.id,
              role: profile.role,
              source: 'rest-json',
              identity: identityStatus,
              principalComparisons,
              counters: { ...parser.counters, parsed: observations.length, withheld: result.partial ? 1 : 0 },
              partial: result.partial || identityStatus !== 'READY',
            });
            if (guard.unsafe(JSON.stringify({ observations, role }))) throw new Error('SANITIZED_EXPORT_REJECTED');
            stage = 'PUBLISH';
            await publish(observations, role);
            partial ||= role.partial;
          } else {
            /** Treat public profiles as ready and run the supported confined check for authenticated profiles. */
            const identity = async () => {
              if (profile.kind === 'public') return 'READY' as const;
              if (profile.kind === 'api_key_header') return 'UNAVAILABLE' as const;
              await validate();
              const before = await snapshot();
              await privateProcess(
                sandbox!,
                katanaCommand({
                  entryUrl: profile.identityEndpoint,
                  mode: 'http',
                  proxy: `http://${gatewayIp}:${port}`,
                }),
                { timeout: 15000, abortSignal: roleSignal, onStdout: () => {}, onStderr: () => {} },
              );
              const after = await snapshot();
              for (const status of ['AUTH_REQUIRED', 'READY', 'UNAVAILABLE'] as const)
                if (
                  (after.counts[`identity-${profile.role}-${status}`] ?? 0) >
                  (before.counts[`identity-${profile.role}-${status}`] ?? 0)
                )
                  return status;
              return 'UNAVAILABLE' as const;
            };
            stage = 'IDENTITY';
            identityStatus = await identity();
            if (identityStatus === 'READY' && scan.request.operation === 'discovery') {
              await validate();
              stage = 'DISCOVERY';
              let finished = false;
              const pending = privateProcess(
                sandbox,
                katanaCommand({
                  entryUrl: context.target.entryUrl,
                  mode: scan.request.mode,
                  proxy: `http://${gatewayIp}:${port}`,
                }),
                {
                  timeout: 45000,
                  abortSignal: roleSignal,
                  onStdout: chunk => parser.feed('stdout', chunk),
                  onStderr: chunk => parser.feed('stderr', chunk),
                },
              ).finally(() => {
                finished = true;
              });
              let verifiedBrowser = false;
              let browserFailure = false;
              try {
                if (scan.request.mode === 'headless')
                  for (let attempt = 0; attempt < 100 && !finished; attempt++) {
                    stage = 'BROWSER_ARGS';
                    const observed = await inspectBrowser(sandbox, guard, roleSignal);
                    if (observed.browserProcesses && !verifiedBrowser) {
                      stage = 'BROWSER_SANDBOX';
                      await browserSandboxStatus(sandbox, roleSignal, value => {
                        stage = value;
                      });
                      verifiedBrowser = true;
                    }
                    if (!finished) await pause(100, undefined, { signal: roleSignal });
                  }
              } catch (error) {
                if (error instanceof BrowserInspectionError) stage = error.stage;
                browserFailure = !roleSignal.aborted;
                roleController.abort();
              }
              const execution = await pending;
              if (browserFailure) throw new Error('BROWSER_POLICY_FAILED');
              if (scan.request.mode === 'headless' && !verifiedBrowser) throw new Error('BROWSER_SANDBOX_UNPROVEN');
              partial ||= !execution.success || Boolean(execution.pipe.stopReason);
              if (!roleSignal.aborted) identityStatus = await identity();
            }
            const result = parser.finish(partial || identityStatus !== 'READY');
            if (identityStatus !== 'READY') {
              result.counters.withheld += result.observations.length;
              result.observations = [];
              result.partial = true;
              reason = identityStatus === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'IDENTITY_UNAVAILABLE';
            }
            const role = roleResultSchema.parse({
              profileId: profile.id,
              role: profile.role,
              source: scan.request.mode === 'http' ? 'katana-http' : 'katana-headless',
              identity: identityStatus,
              counters: result.counters,
              partial: result.partial,
            });
            if (guard.unsafe(JSON.stringify({ observations: result.observations, role })))
              throw new Error('SANITIZED_EXPORT_REJECTED');
            stage = 'PUBLISH';
            await publish(result.observations, role);
            partial ||= result.partial;
            if (result.counters.policyDenied > 0) reason = 'POLICY_BLOCKED';
            else if (result.counters.upstreamUnverified > 0) reason = 'UPSTREAM_UNVERIFIED';
            if (parser.stopped) {
              reason = 'OUTPUT_BOUND';
              break;
            }
            if (identityStatus !== 'READY') break;
          }
        } catch (error) {
          const prefix = parser.finish(true);
          if (profile.kind !== 'public') {
            prefix.counters.withheld += prefix.observations.length;
            prefix.observations = [];
            identityStatus = 'UNAVAILABLE';
          }
          const role = roleResultSchema.parse({
            profileId: profile.id,
            role: profile.role,
            source: scan.request.mode === 'http' ? 'katana-http' : 'katana-headless',
            identity: identityStatus,
            counters: prefix.counters,
            partial: true,
          });
          await publish(prefix.observations, role).catch(() => undefined);
          throw error;
        } finally {
          if (sandbox) await sandbox.destroy();
        }
        stage = 'DRAIN';
        for (let attempt = 0; attempt < 50; attempt++) {
          const state = await snapshot();
          if (state.exhausted) break;
          if (!state.active) break;
          if (attempt === 49) throw new Error('ACTIVE_RESERVATION_UNSETTLED');
          await pause(100, undefined, { signal: joined });
        }
        if ((await snapshot()).exhausted) {
          reason = 'BUDGET_EXHAUSTED';
          partial = true;
          break;
        }
      }
      await snapshot();
    } catch (error) {
      diagnostic = stage;
      partial = true;
      const exhausted = gateway
        ? await snapshot()
            .then(state => state.exhausted)
            .catch(() => false)
        : false;
      reason = signal.aborted
        ? 'CANCELLED_BY_OPERATOR'
        : error instanceof ControlPlaneError && error.code === 'AUTH_REQUIRED'
          ? 'AUTH_REQUIRED'
          : exhausted
            ? 'BUDGET_EXHAUSTED'
            : reason === 'DISCOVERY_COMPLETE'
              ? 'RUNTIME_UNAVAILABLE'
              : reason;
      if (!exhausted) budget = { remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' };
    } finally {
      joined.removeEventListener('abort', stopNetwork);
      if (networkStop) await networkStop;
      if (gatewayResource)
        await resources.stop(gatewayResource).catch(() => {
          reason = 'CLEANUP_FAILED';
        });
      cleanupComplete = await resources.cleanup();
      images?.certutil.fill(0);
      if (!cleanupComplete) {
        reason = 'CLEANUP_FAILED';
        diagnostic = 'CLEANUP';
      }
      principals.clear();
      guard.clear();
    }
    if (partial && reason === 'DISCOVERY_COMPLETE') reason = 'DISCOVERY_PARTIAL';
    return { reason, partial, cleanupComplete, budget, diagnostic, networkCounters };
  }
}
