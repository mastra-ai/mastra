import { randomBytes, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createClient } from '@libsql/client';
import { loadSettings } from '../src/config/settings.js';
import { setup } from '../src/runtime/setup.js';
import { startControlPlane } from '../src/http/server.js';
import { readExampleBoundary, startExampleTransport } from '../example-target-api/transport.js';
import { keyVerifier, initializeExampleData } from '../example-target-api/store.js';
import { selectedBolaCandidate, type BolaCandidate } from '../src/investigation/bola-contracts.js';
import {
  MastraBolaModels,
  type BolaBudget,
  type BolaModels,
  type BolaProof,
} from '../src/investigation/bola-models.js';
import type { Agent } from '@mastra/core/agent';
import { BolaStore, type BolaAssessment } from '../src/investigation/bola-store.js';
import { BolaAssessmentService } from '../src/investigation/bola-service.js';
import { ScanService } from '../src/discovery/service.js';
import { KatanaDiscoveryDriver } from '../src/discovery/driver.js';
import type { IdentityBinding, Profile, Target, Policy } from '../src/core/contracts.js';
import { ownerIdentity, OWNER_LABEL, dockerClient } from '../src/runtime/docker.js';
import { control } from '../src/discovery/io.js';
import type { BolaVerificationHook } from '../src/investigation/bola-driver.js';
import type Docker from 'dockerode';

const baseSettings = loadSettings({
  ...process.env,
  CONTROL_BOOTSTRAP_SECRET: undefined,
  SCANNER_ENCRYPTION_KEY: undefined,
});
const client = dockerClient(baseSettings);
const labels = { label: [`${OWNER_LABEL}=${ownerIdentity(baseSettings)}`] };
const inventory = async () => ({
  containers: (await client.listContainers({ all: true, filters: labels })).map(item => item.Id).sort(),
  networks: (await client.listNetworks({ filters: labels })).map(item => item.Id).sort(),
  images: (await client.listImages({ all: true, filters: labels })).map(item => item.Id).sort(),
});

const fakeModels: BolaModels = {
  async select(candidates: BolaCandidate[], budget: BolaBudget) {
    await budget.reserve('sherlock', 1024, 512);
    const candidate = candidates.find(
      item => item.routeTemplate === '/api/orders/{id}' && item.prerequisite === 'collection_detail',
    )!;
    return {
      value: {
        checkerId: 'bola_rest_read',
        candidateId: candidate.id,
        evidenceIds: candidate.evidenceIds,
        rationaleCode: 'OBSERVED_OWNER_DETAIL',
        hypothesis: 'alternate_account_reads_owner_object',
        confidence: 'medium',
        limitations: ['single_object', 'two_accounts', 'bounded_get_only'],
      },
      modelId: 'local-deterministic-sherlock',
      usageTokens: 100,
    };
  },
  /** Return a local BOLA interpretation from the actual proof after checking policy and reserving allowance. */
  async interpret(proof: BolaProof, policy, budget: BolaBudget) {
    expect(policy).toEqual({ objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403, 404] });
    await budget.reserve('dupin', 512, 256);
    return {
      value: {
        outcome:
          proof.completed && proof.alternateStatus === 200 && proof.bodyMatches
            ? ('CONFIRMED' as const)
            : ('NOT_REPRODUCED' as const),
      },
      modelId: 'local-deterministic-dupin',
      usageTokens: 50,
    };
  },
  async review(_proof: BolaProof, policy, budget: BolaBudget) {
    expect(policy).toEqual({ objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403, 404] });
    await budget.reserve('watson', 512, 256);
    return {
      value: { vote: 'agree' as const, reasonCode: 'MATCHED_PRIVATE_RESPONSE' },
      modelId: 'local-deterministic-watson',
      usageTokens: 50,
    };
  },
};

/** Run the vulnerable or protected owned BOLA journey and verify the selected lifecycle scenario. */
async function journey(
  mode: 'vulnerable' | 'protected',
  scenario:
    | 'normal'
    | 'collectionDetailOnly'
    | 'storeFailure'
    | 'reusedScanFailure'
    | 'shutdownScanAdmission'
    | 'shutdownAssessmentAdmission'
    | 'sameKey'
    | 'sameAccount'
    | 'missingPrincipal'
    | 'mismatchedPrincipal'
    | 'cancel'
    | 'retention'
    | 'crash'
    | 'buildCrash'
    | 'debt'
    | 'interpretationDisagrees'
    | 'reviewDisagrees'
    | 'bothDisagree' = 'normal',
) {
  const before = await inventory();
  expect(before.containers).toEqual([]);
  expect(before.networks).toEqual([]);
  const seed = await initializeExampleData(baseSettings.root);
  const secondaryKey = randomBytes(32).toString('base64url');
  if (scenario === 'sameAccount') {
    const db = createClient({ url: `file:${baseSettings.dataDirectory}/example-target/db/example.db` });
    try {
      await db.execute({
        sql: 'INSERT INTO example_api_keys(key_verifier,user_id) VALUES (?,?)',
        args: [keyVerifier(secondaryKey), seed.users[0].id],
      });
    } finally {
      db.close();
    }
  }
  const example = await startExampleTransport(baseSettings, mode);
  const labBaseline = await inventory();
  const boundary = await readExampleBoundary(baseSettings);
  const databaseName = `bola-${mode}-${randomUUID()}`;
  const settings = loadSettings(
    {
      DATABASE_URL: `file:./data/${databaseName}.db`,
      CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url'),
      SCANNER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      SCANNER_DISCOVERY_ENABLED: 'true',
      SCANNER_INVESTIGATION_ENABLED: 'true',
    },
    baseSettings.root,
  );
  let server: Awaited<ReturnType<typeof startControlPlane>> | undefined;
  let browser: Browser | undefined;
  let crashChild: ChildProcess | undefined;
  let restoreRemoval: (() => void) | undefined;
  let inducedRemovals = 0;
  let debtReadyResolve: () => void = () => undefined;
  const debtReady = new Promise<void>(resolve => {
    debtReadyResolve = resolve;
  });
  let hostCanary: Server | undefined;
  let hostCanaryPort = 0;
  let hostCanaryHits = 0;
  let canaryResult: { hostDenied: boolean; ingressAllowed: boolean; filesClean: boolean } | undefined;
  /** Attach the owned verifier to the test ingress network for confinement canary checks. */
  const verifierHook: BolaVerificationHook = async ({ verifier, gatewayIp, ingressNetworkId }) => {
    const ingress = await client.getNetwork(ingressNetworkId).inspect();
    const hostIp = ingress.IPAM?.Config?.[0]?.Gateway;
    if (!hostIp || !hostCanaryPort) throw new Error('CANARY_BOUNDARY_UNAVAILABLE');
    /** Probe the selected owned address and port from the real verifier container. */
    const probe = async (address: string, port: number) => {
      const output = await control(
        verifier,
        [
          'python3',
          '-c',
          'import socket,sys;\ntry:\n s=socket.create_connection((sys.argv[1],int(sys.argv[2])),1); s.close(); print("OPEN")\nexcept OSError:\n print("DENIED")',
          address,
          String(port),
        ],
        2500,
      );
      return output.success ? output.stdout.trim() : 'ERROR';
    };
    const listing = await control(
      verifier,
      [
        'python3',
        '-c',
        'import json,os,pathlib; x=json.loads(pathlib.Path("/workspace/request.json").read_text()); print(json.dumps({"files":sorted(os.listdir("/workspace")),"keys":[sorted(i) for i in x["requests"]]}))',
      ],
      2500,
    );
    const shape = listing.success ? (JSON.parse(listing.stdout) as { files: string[]; keys: string[][] }) : null;
    canaryResult = {
      hostDenied: (await probe(hostIp, hostCanaryPort)) === 'DENIED',
      ingressAllowed: (await probe(gatewayIp, 8080)) === 'OPEN',
      filesClean:
        JSON.stringify(shape) ===
        JSON.stringify({
          files: ['mitm-ca.pem', 'request.json', 'verify-bola.py'],
          keys: [
            ['proxy', 'url'],
            ['proxy', 'url'],
          ],
        }),
    };
  };
  const debtHook: BolaVerificationHook = async ({ verifier, signal }) => {
    const prototype = Object.getPrototypeOf(verifier) as { remove: (...args: unknown[]) => Promise<unknown> };
    const original = prototype.remove;
    const exactId = verifier.id;
    const exactName = (await verifier.inspect()).Name.replace(/^\//, '');
    prototype.remove = function (this: Docker.Container, ...args: unknown[]) {
      if (this.id === exactId || this.id === exactName) {
        inducedRemovals++;
        return Promise.reject(new Error('INDUCED_BOLA_REMOVE_FAILURE'));
      }
      return original.apply(this, args);
    };
    restoreRemoval = () => {
      prototype.remove = original;
    };
    debtReadyResolve();
    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) reject(new Error('BOLA_CANCELLED'));
      else signal.addEventListener('abort', () => reject(new Error('BOLA_CANCELLED')), { once: true });
    });
  };
  const calls = { select: 0, interpret: 0, review: 0 };
  const cancelModels: BolaModels = {
    ...fakeModels,
    async select(_candidates, _budget, signal) {
      calls.select++;
      await new Promise<never>((_resolve, reject) => {
        if (signal.aborted) reject(new Error('CANCELLED'));
        else signal.addEventListener('abort', () => reject(new Error('CANCELLED')), { once: true });
      });
      throw new Error('CANCELLED');
    },
    async interpret(proof, policy, budget, signal) {
      calls.interpret++;
      return fakeModels.interpret(proof, policy, budget, signal);
    },
    async review(proof, policy, budget, signal) {
      calls.review++;
      return fakeModels.review(proof, policy, budget, signal);
    },
  };
  /** Assert that serialized model input excludes the example accounts' credential representations. */
  const assertModelPrivacy = (input: unknown) => {
    const exported = JSON.stringify(input);
    for (const user of seed.users) {
      expect(exported).not.toContain(user.id);
      expect(exported).not.toContain(user.key);
    }
    expect(exported).not.toContain(secondaryKey);
  };
  let modelCalls = 0;
  const guardedModels: BolaModels = {
    async select(candidates, budget, signal) {
      modelCalls++;
      assertModelPrivacy(candidates);
      return fakeModels.select(candidates, budget, signal);
    },
    async interpret(proof, policy, budget, signal) {
      modelCalls++;
      assertModelPrivacy(proof);
      return fakeModels.interpret(proof, policy, budget, signal);
    },
    async review(proof, policy, budget, signal) {
      modelCalls++;
      assertModelPrivacy(proof);
      return fakeModels.review(proof, policy, budget, signal);
    },
  };
  const disagreement = ['interpretationDisagrees', 'reviewDisagrees', 'bothDisagree'].includes(scenario);
  const disagreementModels: BolaModels = {
    ...fakeModels,
    /** Run the local interpretation fixture and apply the selected disagreement scenario. */
    async interpret(proof, policy, budget, signal) {
      const result = await fakeModels.interpret(proof, policy, budget, signal);
      return scenario === 'interpretationDisagrees' || scenario === 'bothDisagree'
        ? { ...result, value: { outcome: 'INCONCLUSIVE' as const } }
        : result;
    },
    /** Run the local review fixture and apply the selected independent disagreement scenario. */
    async review(proof, policy, budget, signal) {
      const result = await fakeModels.review(proof, policy, budget, signal);
      return scenario === 'reviewDisagrees' || scenario === 'bothDisagree'
        ? { ...result, value: { vote: 'disagree' as const, reasonCode: 'PROOF_UNCERTAIN' } }
        : result;
    },
  };
  let bodyError: unknown;
  try {
    expect(boundary).toBeTruthy();
    if (mode === 'vulnerable' && scenario === 'normal') {
      hostCanary = createServer((_request, response) => {
        hostCanaryHits++;
        response.writeHead(200).end('owned-host-canary');
      });
      await new Promise<void>((resolve, reject) => {
        hostCanary!.once('error', reject);
        hostCanary!.listen(0, '0.0.0.0', resolve);
      });
      const address = hostCanary.address();
      if (!address || typeof address === 'string') throw new Error('HOST_CANARY_NOT_READY');
      hostCanaryPort = address.port;
      expect((await fetch(`http://127.0.0.1:${hostCanaryPort}/owned`)).status).toBe(200);
      expect(hostCanaryHits).toBe(1);
    }
    await setup(settings);
    server = await startControlPlane(
      settings,
      0,
      undefined,
      boundary!,
      undefined,
      undefined,
      scenario === 'cancel' ? cancelModels : disagreement ? disagreementModels : guardedModels,
      hostCanary ? verifierHook : scenario === 'debt' ? debtHook : undefined,
    );
    const login = await fetch(`${server.url}/api/session`, {
      method: 'POST',
      headers: { origin: server.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
    });
    expect(login.status).toBe(201);
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const csrf = ((await login.json()) as { csrfToken: string }).csrfToken;
    /** Send a real authenticated JSON request with optional revision binding to the isolated control plane. */
    const call = async <T>(path: string, method = 'GET', body?: unknown, revision?: number) => {
      const response = await fetch(`${server!.url}${path}`, {
        method,
        headers: {
          origin: server!.url,
          cookie,
          'x-csrf-token': csrf,
          'content-type': 'application/json',
          ...(revision ? { 'if-match': `"${revision}"` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: (await response.json()) as T };
    };
    const limits = { maxRequests: 40, maxDurationSeconds: 90, maxResponseBytes: 131072, maxConcurrency: 1 };
    const policy = await call<Policy>('/api/policies', 'POST', {
      name: 'Owned REST example',
      permittedMethods: ['GET', 'HEAD'],
      scanLimits: limits,
      retention: { evidenceDays: 1, approvedBy: 'example-operator' },
    });
    expect(policy.status).toBe(201);
    const origin = `http://${boundary!.address}:18080`;
    /** Build a revision-bound operator GET rule for the selected route and audience. */
    const rule = (pathTemplate: string, audience: 'user' | 'public', revision: number) => ({
      version: 1,
      method: 'GET',
      pathTemplate,
      source: 'operator',
      operatorRevision: revision,
      audience,
      ...(audience === 'user' ? { objectPolicy: 'owner' } : {}),
      expectedUnauthorizedStatus: audience === 'user' ? [401, 403, 404] : [],
    });
    /** Build the route rules required by the selected collection/detail test scenario. */
    const rules = (revision: number) => [
      rule('/api/orders', 'user', revision),
      rule('/api/orders/{id}', 'user', revision),
      ...(scenario === 'collectionDetailOnly' ? [] : [rule('/api/orders/{id}/receipt', 'user', revision)]),
      rule('/api/products', 'public', revision),
    ];
    const target = await call<Target>('/api/targets', 'POST', {
      name: `${mode} orders`,
      entryUrl: `${origin}/api/orders`,
      approvedOrigins: [origin],
      allowedPaths: ['/api', '/openapi.json'],
      excludedPaths: [],
      permittedMethods: ['GET', 'HEAD'],
      environment: 'lab',
      authorizationEvidenceRef: 'operator:owned-example',
      authorizationConfirmed: true,
      policyId: policy.data.id,
      policyRevision: policy.data.revision,
      schedule: { enabled: false, timezone: 'UTC' },
      scanLimits: limits,
      authProfileIds: [],
      application: {
        kind: 'rest_api',
        version: 1,
        discoveryModes: ['openapi', 'observed_json'],
        openApiUrl: `${origin}/openapi.json`,
      },
      routeAccessRules: rules(1),
    });
    expect(target.status).toBe(201);
    const registered: Profile[] = [];
    for (const [index, user] of seed.users.entries()) {
      const fresh = await call<Target>(`/api/targets/${target.data.id}`);
      const profile = await call<Profile>(
        `/api/targets/${target.data.id}/profiles`,
        'POST',
        {
          kind: 'api_key_header',
          name: `Example user ${index + 1}`,
          role: `user${index + 1}`,
          credential: {
            value:
              scenario === 'sameKey'
                ? seed.users[0].key
                : scenario === 'sameAccount' && index === 1
                  ? secondaryKey
                  : user.key,
          },
        },
        fresh.data.revision,
      );
      expect(profile.status).toBe(201);
      registered.push(profile.data);
    }
    const beforeDrivers = (await call<Target>(`/api/targets/${target.data.id}`)).data;
    const { id: _id, owner: _owner, revision: _revision, ...replacement } = beforeDrivers;
    const updated = await call<Target>(
      `/api/targets/${target.data.id}`,
      'PUT',
      {
        ...replacement,
        authenticationDrivers: registered.map((profile, index) => ({
          kind: 'api_key_header',
          version: 1,
          profileId: profile.id,
          secretRef: profile.id,
          credentialOrigins: [origin],
          headerName: 'x-api-key',
          accessCheckPath: '/api/orders',
          ...(scenario === 'missingPrincipal'
            ? {}
            : {
                principalJsonPointer: scenario === 'mismatchedPrincipal' && index === 1 ? '/orders/0/id' : '/principal',
              }),
          refresh: 'reregister',
        })),
        routeAccessRules: rules(beforeDrivers.revision + 1),
      },
      beforeDrivers.revision,
    );
    expect(updated.status).toBe(200);
    const bindings: IdentityBinding[] = [];
    for (const profile of registered) {
      const binding = {
        targetRevision: updated.data.revision,
        policyRevision: policy.data.revision,
        profileId: profile.id,
        profileRevision: profile.revision,
        credentialRevision: profile.credentialRevision,
      };
      const checked = await call<Profile>(
        `/api/targets/${target.data.id}/profiles/${profile.id}/check`,
        'POST',
        binding,
      );
      expect(checked.status, JSON.stringify({ profile: profile.id, response: checked.data })).toBe(200);
      expect(
        checked.data.identityResult?.status ??
          (checked.data as unknown as { identity: { status: string } }).identity.status,
      ).toBe('READY');
      bindings.push({ ...binding, profileRevision: checked.data.revision });
    }
    const { id: _updatedId, owner: _updatedOwner, revision: _updatedRevision, ...currentTargetInput } = updated.data;
    const changedTarget = await call<Target>(
      `/api/targets/${target.data.id}`,
      'PUT',
      { ...currentTargetInput, routeAccessRules: rules(updated.data.revision + 1) },
      updated.data.revision,
    );
    expect(changedTarget.status).toBe(200);
    const stale = await call<{ code: string }>(`/api/targets/${target.data.id}/assessments`, 'POST', {
      targetRevision: changedTarget.data.revision,
      policyRevision: policy.data.revision,
      profiles: bindings.map(item => ({ ...item, targetRevision: changedTarget.data.revision })),
      idempotencyKey: randomUUID(),
    });
    expect(stale.status).toBe(409);
    expect(stale.data.code).toBe('BOLA_PROFILES_NOT_READY');
    for (let index = 0; index < bindings.length; index++) {
      const current = bindings[index]!;
      const fresh = { ...current, targetRevision: changedTarget.data.revision };
      const checked = await call<Profile>(
        `/api/targets/${target.data.id}/profiles/${current.profileId}/check`,
        'POST',
        fresh,
      );
      expect(checked.status, JSON.stringify({ index, response: checked.data })).toBe(200);
      bindings[index] = { ...fresh, profileRevision: checked.data.revision };
    }
    const duplicated = await call<{ code: string }>(`/api/targets/${target.data.id}/assessments`, 'POST', {
      targetRevision: changedTarget.data.revision,
      policyRevision: policy.data.revision,
      profiles: [bindings[0], bindings[0]],
      idempotencyKey: randomUUID(),
    });
    expect(duplicated.status).toBe(400);
    expect(duplicated.data.code).toBe('INVALID_INPUT');
    const admission = {
      targetRevision: changedTarget.data.revision,
      policyRevision: policy.data.revision,
      profiles: bindings,
      idempotencyKey: randomUUID(),
    };
    if (scenario === 'storeFailure') {
      const triggerDb = createClient({ url: settings.databaseUrl });
      try {
        await triggerDb.execute(`CREATE TRIGGER fail_bola_assessment_insert
          BEFORE INSERT ON scanner_bola_assessments
          BEGIN SELECT RAISE(ABORT, 'induced assessment storage failure'); END`);
      } finally {
        triggerDb.close();
      }
      const originalDiscover = KatanaDiscoveryDriver.prototype.discover;
      const failedKeys = new Set<string>();
      let discoverStarts = 0;
      KatanaDiscoveryDriver.prototype.discover = async function (
        this: KatanaDiscoveryDriver,
        ...args: Parameters<KatanaDiscoveryDriver['discover']>
      ) {
        if (failedKeys.has(args[0].request.idempotencyKey)) discoverStarts++;
        return originalDiscover.apply(this, args);
      };
      const db = createClient({ url: settings.databaseUrl });
      try {
        for (let attempt = 0; attempt < 20; attempt++) {
          const idempotencyKey = attempt === 0 ? admission.idempotencyKey : randomUUID();
          failedKeys.add(idempotencyKey);
          const failed = await call<{ code: string }>(`/api/targets/${target.data.id}/assessments`, 'POST', {
            ...admission,
            idempotencyKey,
          });
          const persisted = await db.execute({
            sql: 'SELECT data FROM scanner_discovery_scans WHERE idempotency_key=?',
            args: [idempotencyKey],
          });
          const persistedScan = persisted.rows[0]
            ? (JSON.parse(String(persisted.rows[0].data)) as { state: string; cleanup: string; reason: string })
            : null;
          expect(failed.status).toBe(503);
          expect(failed.data.code).toBe('BOLA_STORE_ADMISSION_FAILED');
          expect(persisted.rows).toHaveLength(1);
          expect(['CANCELLED', 'FAILED']).toContain(persistedScan?.state);
          expect(persistedScan).toMatchObject({
            cleanup: 'COMPLETE',
            reason: 'RUNTIME_UNAVAILABLE',
            partial: true,
          });
          expect((await db.execute('SELECT id FROM scanner_bola_assessments')).rows).toHaveLength(0);
          expect((await db.execute('SELECT id FROM scanner_bola_findings')).rows).toHaveLength(0);
          expect(modelCalls).toBe(0);
          expect(discoverStarts).toBe(0);
        }
      } finally {
        db.close();
        KatanaDiscoveryDriver.prototype.discover = originalDiscover;
      }
      return;
    }
    if (scenario === 'reusedScanFailure') {
      let release!: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      let enter!: () => void;
      const entered = new Promise<void>(resolve => (enter = resolve));
      const originalDiscover = KatanaDiscoveryDriver.prototype.discover;
      KatanaDiscoveryDriver.prototype.discover = async function (
        this: KatanaDiscoveryDriver,
        ...args: Parameters<KatanaDiscoveryDriver['discover']>
      ) {
        if (args[0].request.idempotencyKey === admission.idempotencyKey) {
          enter();
          await Promise.race([
            held,
            new Promise<void>(resolve => {
              if (args[2].aborted) resolve();
              else args[2].addEventListener('abort', () => resolve(), { once: true });
            }),
          ]);
          if (args[2].aborted) throw new Error('REUSED_SCAN_ABORTED');
        }
        return originalDiscover.apply(this, args);
      };
      try {
        const ordinary = await call<{ id: string }>(`/api/targets/${target.data.id}/scans`, 'POST', {
          ...admission,
          mode: 'http',
          operation: 'discovery',
        });
        expect(ordinary.status).toBe(202);
        await entered;
        const triggerDb = createClient({ url: settings.databaseUrl });
        try {
          await triggerDb.execute(`CREATE TRIGGER fail_reused_bola_assessment_insert
            BEFORE INSERT ON scanner_bola_assessments
            BEGIN SELECT RAISE(ABORT, 'induced assessment storage failure'); END`);
        } finally {
          triggerDb.close();
        }
        try {
          const failed = await call<{ code: string }>(`/api/targets/${target.data.id}/assessments`, 'POST', admission);
          expect(failed.status).toBe(503);
          expect(failed.data.code).toBe('BOLA_STORE_ADMISSION_FAILED');
          const current = await call<{ id: string; state: string; cleanup: string }>(`/api/scans/${ordinary.data.id}`);
          expect(current.status).toBe(200);
          expect(current.data).toMatchObject({ id: ordinary.data.id, state: 'RUNNING', cleanup: 'PENDING' });
          const db = createClient({ url: settings.databaseUrl });
          try {
            expect((await db.execute('SELECT id FROM scanner_bola_assessments')).rows).toHaveLength(0);
            expect((await db.execute('SELECT id FROM scanner_bola_findings')).rows).toHaveLength(0);
          } finally {
            db.close();
          }
          expect(modelCalls).toBe(0);
        } finally {
          const db = createClient({ url: settings.databaseUrl });
          try {
            await db.execute('DROP TRIGGER IF EXISTS fail_reused_bola_assessment_insert');
          } finally {
            db.close();
          }
        }
        release();
        let completed: { state: string; cleanup: string } | undefined;
        for (let attempt = 0; attempt < 400; attempt++) {
          completed = (await call<{ state: string; cleanup: string }>(`/api/scans/${ordinary.data.id}`)).data;
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(completed.state)) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        expect(completed).toMatchObject({ state: 'COMPLETED', cleanup: 'COMPLETE' });
      } finally {
        release();
        KatanaDiscoveryDriver.prototype.discover = originalDiscover;
      }
      return;
    }
    if (scenario === 'shutdownScanAdmission' || scenario === 'shutdownAssessmentAdmission') {
      let release!: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      let enter!: () => void;
      const entered = new Promise<void>(resolve => (enter = resolve));
      let enterClose!: () => void;
      const closing = new Promise<void>(resolve => (enterClose = resolve));
      let admissionHeld = true;
      let storeClosedBeforeAdmissionFinished = false;
      let scanId = '';
      let capturedService: BolaAssessmentService | undefined;
      const originalAdmit = ScanService.prototype.admitWithReceipt;
      const originalCreate = BolaStore.prototype.create;
      const originalServiceClose = BolaAssessmentService.prototype.close;
      const originalStoreClose = BolaStore.prototype.close;
      ScanService.prototype.admitWithReceipt = async function (
        this: ScanService,
        ...args: Parameters<ScanService['admitWithReceipt']>
      ) {
        const receipt = await originalAdmit.apply(this, args);
        const scan = receipt.scan;
        if ((args[2] as { idempotencyKey?: string }).idempotencyKey === admission.idempotencyKey) {
          scanId = scan.id;
          if (scenario === 'shutdownScanAdmission') {
            enter();
            await held;
          }
        }
        return receipt;
      };
      BolaStore.prototype.create = async function (this: BolaStore, ...args: Parameters<BolaStore['create']>) {
        const result = await originalCreate.apply(this, args);
        if (args[0].idempotencyKey === admission.idempotencyKey && scenario === 'shutdownAssessmentAdmission') {
          enter();
          await held;
        }
        return result;
      };
      BolaAssessmentService.prototype.close = function (this: BolaAssessmentService) {
        capturedService = this;
        enterClose();
        return originalServiceClose.call(this);
      };
      BolaStore.prototype.close = function (this: BolaStore) {
        if (this === capturedService?.store && admissionHeld) storeClosedBeforeAdmissionFinished = true;
        return originalStoreClose.call(this);
      };
      let request: Promise<unknown> | undefined;
      let stopped: Promise<void> | undefined;
      try {
        request = call(`/api/targets/${target.data.id}/assessments`, 'POST', admission).catch(() => undefined);
        await Promise.race([
          entered,
          request.then(() => {
            throw new Error('ADMISSION_LATCH_NOT_REACHED');
          }),
        ]);
        stopped = server.close();
        await closing;
        // Drain already-resolved microtasks; the latch fixes the overlap without a timing sleep.
        await new Promise<void>(resolve => setImmediate(resolve));
        admissionHeld = false;
        release();
        await Promise.all([stopped, request]);
        expect(storeClosedBeforeAdmissionFinished).toBe(false);
        const db = createClient({ url: settings.databaseUrl });
        try {
          const scans = await db.execute({
            sql: 'SELECT data FROM scanner_discovery_scans WHERE id=?',
            args: [scanId],
          });
          expect(scans.rows).toHaveLength(1);
          const scan = JSON.parse(String(scans.rows[0]!.data)) as { state: string; cleanup: string };
          expect(['CANCELLED', 'COMPLETED']).toContain(scan.state);
          expect(scan.cleanup).toBe('COMPLETE');
          const assessments = await db.execute('SELECT data FROM scanner_bola_assessments');
          expect(assessments.rows).toHaveLength(scenario === 'shutdownScanAdmission' ? 0 : 1);
          for (const row of assessments.rows) {
            expect(JSON.parse(String(row.data))).toMatchObject({
              state: 'BLOCKED',
              reason: 'SERVER_STOPPED',
              usedRequests: 0,
              usedTokens: 0,
              modelEvents: [],
              verificationJobId: null,
              findingId: null,
            });
          }
          expect((await db.execute('SELECT id FROM scanner_bola_findings')).rows).toEqual([]);
        } finally {
          db.close();
        }
        await expect(
          capturedService!.admit('local-operator', target.data.id, {
            ...admission,
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toMatchObject({ code: 'SERVER_CLOSING' });
      } finally {
        admissionHeld = false;
        release();
        await Promise.allSettled([stopped, request]);
        ScanService.prototype.admitWithReceipt = originalAdmit;
        BolaStore.prototype.create = originalCreate;
        BolaAssessmentService.prototype.close = originalServiceClose;
        BolaStore.prototype.close = originalStoreClose;
      }
      return;
    }
    if (scenario === 'crash' || scenario === 'buildCrash') {
      await server.close();
      crashChild = spawn(process.execPath, ['--import', 'tsx', 'tests/bola-crash-child.ts'], {
        cwd: baseSettings.root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          DATABASE_URL: settings.DATABASE_URL,
          CONTROL_BOOTSTRAP_SECRET: settings.CONTROL_BOOTSTRAP_SECRET,
          SCANNER_ENCRYPTION_KEY: settings.SCANNER_ENCRYPTION_KEY,
          SCANNER_DISCOVERY_ENABLED: 'true',
          SCANNER_INVESTIGATION_ENABLED: 'true',
          ...(scenario === 'buildCrash' ? { BOLA_CRASH_WINDOW: 'post-build' } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const child = crashChild;
      const lines: string[] = [];
      let pending = '';
      let childError = '';
      child.stdout!.on('data', (chunk: Buffer) => {
        pending += chunk.toString();
        const parts = pending.split('\n');
        pending = parts.pop() ?? '';
        lines.push(...parts);
      });
      child.stderr!.on('data', (chunk: Buffer) => {
        childError = (childError + chunk.toString()).slice(-4096);
      });
      /** Wait for the child process's selected readiness line within the bounded polling window. */
      const waitLine = async (prefix: string) => {
        for (let attempt = 0; attempt < 1200; attempt++) {
          const line = lines.find(item => item.startsWith(prefix));
          if (line) return line;
          if (child.exitCode !== null || child.signalCode !== null) {
            const codes = [...new Set(childError.match(/\b[A-Z][A-Z0-9_]{4,}\b/g) ?? [])].slice(0, 12);
            throw new Error(
              `CRASH_CHILD_EXITED_EARLY:${JSON.stringify({ exitCode: child.exitCode, signal: child.signalCode, codes })}`,
            );
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('CRASH_CHILD_TIMEOUT');
      };
      const ready = await waitLine('SERVER_READY ');
      const childUrl = ready.slice('SERVER_READY '.length);
      expect(childUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const childLogin = await fetch(`${childUrl}/api/session`, {
        method: 'POST',
        headers: { origin: childUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
      });
      expect(childLogin.status).toBe(201);
      const childCookie = childLogin.headers.get('set-cookie')!.split(';')[0]!;
      const childCsrf = ((await childLogin.json()) as { csrfToken: string }).csrfToken;
      const admitted = await fetch(`${childUrl}/api/targets/${target.data.id}/assessments`, {
        method: 'POST',
        headers: {
          origin: childUrl,
          cookie: childCookie,
          'x-csrf-token': childCsrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify(admission),
      });
      expect(admitted.status).toBe(202);
      const crashAssessment = (await admitted.json()) as BolaAssessment;
      await waitLine(scenario === 'buildCrash' ? 'IMAGE_BUILT_BEFORE_RECEIPT' : 'VERIFIER_READY');
      const activeRecord = await fetch(`${childUrl}/api/assessments/${crashAssessment.id}`, {
        headers: { origin: childUrl, cookie: childCookie },
      });
      const activeAssessment = (await activeRecord.json()) as BolaAssessment;
      expect(activeAssessment).toMatchObject({ state: 'VERIFYING', verificationCleanup: 'PENDING' });
      expect(activeAssessment.verificationJobId).toBeTruthy();
      const db = createClient({ url: settings.databaseUrl });
      try {
        const intents = await db.execute({
          sql: 'SELECT COUNT(*) AS total FROM scanner_discovery_resources WHERE scan_id=? AND id LIKE ?',
          args: [activeAssessment.verificationJobId!, `${activeAssessment.verificationJobId}:acquiring:%`],
        });
        expect(Number(intents.rows[0]?.total)).toBe(scenario === 'buildCrash' ? 1 : 2);
        if (scenario === 'buildCrash') {
          const records = await db.execute({
            sql: 'SELECT data FROM scanner_discovery_resources WHERE scan_id=? ORDER BY rowid',
            args: [activeAssessment.verificationJobId!],
          });
          expect(records.rows).toHaveLength(1);
          const intent = JSON.parse(String(records.rows[0]!.data)) as { imageId: string; token: string };
          const image = await client.getImage(intent.imageId).inspect();
          expect(image.Id).toMatch(/^sha256:[a-f0-9]{64}$/);
          expect(image.Id).not.toBe(intent.imageId);
          expect(image.Config.Labels?.[OWNER_LABEL]).toBe(ownerIdentity(settings));
          expect(image.Config.Labels?.['dev.mastra.security-scanner.input']).toBe(intent.token);
        }
      } finally {
        db.close();
      }
      const orphaned = await inventory();
      if (scenario === 'crash') expect(orphaned.containers.length).toBeGreaterThan(labBaseline.containers.length);
      else expect(orphaned.images.length).toBeGreaterThan(labBaseline.images.length);
      const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
      expect(child.kill('SIGKILL')).toBe(true);
      await exited;
      crashChild = undefined;
      server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
      const restartLogin = await fetch(`${server.url}/api/session`, {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
      });
      const cookie = restartLogin.headers.get('set-cookie')!.split(';')[0]!;
      const recovered = await fetch(`${server.url}/api/assessments/${crashAssessment.id}`, {
        headers: { origin: server.url, cookie },
      });
      expect(recovered.status).toBe(200);
      expect((await recovered.json()) as BolaAssessment).toMatchObject({
        state: 'BLOCKED',
        reason: 'PROCESS_INTERRUPTED',
        verificationCleanup: 'COMPLETE',
        proof: null,
        findingId: null,
      });
      expect(await inventory()).toEqual(labBaseline);
      return;
    }
    const started = await call<BolaAssessment>(`/api/targets/${target.data.id}/assessments`, 'POST', admission);
    expect(started.status, JSON.stringify(started.data)).toBe(202);
    if (scenario === 'debt') {
      await Promise.race([
        debtReady,
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('DEBT_HOOK_TIMEOUT')), 120_000)),
      ]);
      const current = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
      expect(current.data).toMatchObject({ state: 'VERIFYING', verificationCleanup: 'PENDING' });
      const denied = await call<{ code: string }>(
        `/api/assessments/${started.data.id}/cancel`,
        'POST',
        {},
        current.data.revision,
      );
      expect(denied.status).toBe(503);
      expect(denied.data.code).toBe('BOLA_CANCEL_CLEANUP_DEBT');
      expect(inducedRemovals).toBeGreaterThan(0);
      const debt = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
      expect(debt.data).toMatchObject({
        state: 'CANCEL_REQUESTED',
        reason: 'BOLA_CLEANUP_DEBT',
        verificationCleanup: 'DEBT',
        proof: null,
        findingId: null,
      });
      expect((await inventory()).containers.length).toBeGreaterThan(labBaseline.containers.length);
      await server.close();
      restoreRemoval?.();
      restoreRemoval = undefined;
      server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
      const again = await fetch(`${server.url}/api/session`, {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
      });
      const cookie = again.headers.get('set-cookie')!.split(';')[0]!;
      const recovered = await fetch(`${server.url}/api/assessments/${started.data.id}`, {
        headers: { origin: server.url, cookie },
      });
      expect(recovered.status).toBe(200);
      expect((await recovered.json()) as BolaAssessment).toMatchObject({
        state: 'CANCELLED',
        reason: 'BOLA_CANCELLED',
        verificationCleanup: 'COMPLETE',
        findingId: null,
      });
      expect(await inventory()).toEqual(labBaseline);
      return;
    }
    const initial = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
    expect(initial.status).toBe(200);
    expect(initial.data.id).toBe(started.data.id);
    let scanStatus: { status: number; data: { state: string; reason: string; cleanup: string } } | undefined;
    for (let attempt = 0; attempt < 400; attempt++) {
      scanStatus = await call<{ state: string; reason: string; cleanup: string }>(`/api/scans/${started.data.scanId}`);
      if (
        ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'AUTH_REQUIRED', 'CANCELLED'].includes(scanStatus.data.state)
      )
        break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(scanStatus?.data.state, JSON.stringify(scanStatus)).toBe('COMPLETED');
    if (scenario === 'cancel') {
      let planning: BolaAssessment | undefined;
      for (let attempt = 0; attempt < 100; attempt++) {
        const current = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
        if (current.data.state === 'PLANNING') {
          planning = current.data;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      expect(planning?.state).toBe('PLANNING');
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(server.url);
      await page.getByLabel('Bootstrap secret').fill(settings.CONTROL_BOOTSTRAP_SECRET!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Scans', exact: true })
        .click();
      await page.getByRole('button', { name: 'Cancel assessment' }).click();
      const cancelled = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
      expect(cancelled.status).toBe(200);
      expect(cancelled.data).toMatchObject({
        state: 'CANCELLED',
        reason: 'BOLA_CANCELLED',
        usedRequests: 0,
        proof: null,
      });
      await page.getByText('CANCELLED', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await browser.close();
      browser = undefined;
      expect(calls).toEqual({ select: 1, interpret: 0, review: 0 });
      await server.close();
      const interrupted = createClient({ url: settings.databaseUrl });
      try {
        await interrupted.execute({
          sql: "UPDATE scanner_bola_assessments SET state='CANCEL_REQUESTED',data=json_set(data,'$.state','CANCEL_REQUESTED') WHERE id=?",
          args: [started.data.id],
        });
      } finally {
        interrupted.close();
      }
      server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
      const again = await fetch(`${server.url}/api/session`, {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
      });
      const cookie = again.headers.get('set-cookie')!.split(';')[0]!;
      const persisted = await fetch(`${server.url}/api/assessments/${started.data.id}`, {
        headers: { origin: server.url, cookie },
      });
      expect(persisted.status).toBe(200);
      expect(((await persisted.json()) as BolaAssessment).state).toBe('CANCELLED');
      return;
    }
    let result: BolaAssessment | undefined;
    let lastResponse: { status: number; data: BolaAssessment } | undefined;
    const history: Array<{ status: number; id?: string; owner?: string; state?: string; revision?: number }> = [];
    for (let attempt = 0; attempt < 600; attempt++) {
      lastResponse = await call<BolaAssessment>(`/api/assessments/${started.data.id}`);
      if (lastResponse.status === 200) result = lastResponse.data;
      if (attempt % 20 === 0)
        history.push({
          status: lastResponse.status,
          ...(lastResponse.status === 200
            ? {
                id: lastResponse.data.id,
                owner: (lastResponse.data as unknown as { owner: string }).owner,
                state: lastResponse.data.state,
                revision: (lastResponse.data as unknown as { revision: number }).revision,
              }
            : {}),
        });
      if (result && ['COMPLETED', 'BLOCKED'].includes(result.state)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(result?.state, JSON.stringify({ reason: result?.reason, lastResponse, scanStatus, history })).toBe(
      'COMPLETED',
    );
    const unverifiedPrincipal = ['sameKey', 'sameAccount', 'missingPrincipal', 'mismatchedPrincipal'].includes(
      scenario,
    );
    /** Audit persisted assessment tables for example credential leakage before cleanup. */
    const assertPrivate = async () => {
      const db = createClient({ url: settings.databaseUrl });
      try {
        for (const table of [
          'scanner_discovery_scans',
          'scanner_discovery_evidence',
          'scanner_bola_assessments',
          'scanner_bola_findings',
        ]) {
          const rows = await db.execute(`SELECT data FROM ${table}`);
          const exported = JSON.stringify(rows.rows);
          for (const user of seed.users) {
            expect(exported).not.toContain(user.id);
            expect(exported).not.toContain(user.key);
          }
          expect(exported).not.toContain(secondaryKey);
        }
      } finally {
        db.close();
      }
    };
    await assertPrivate();
    if (unverifiedPrincipal) {
      expect(result!).toMatchObject({
        outcome: 'INCONCLUSIVE',
        findingId: null,
        usedRequests: 0,
        usedTokens: 0,
        proof: null,
        modelEvents: [],
        reason:
          scenario === 'sameKey' || scenario === 'sameAccount' ? 'BOLA_PRINCIPALS_SAME' : 'BOLA_PRINCIPALS_UNVERIFIED',
      });
      expect((await call<{ items: unknown[] }>('/api/bola-findings?limit=25&offset=0')).data.items).toEqual([]);
      expect((scanStatus!.data as unknown as { roles: unknown[] }).roles).toHaveLength(2);
      await server.close();
      server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
      const session = await fetch(`${server.url}/api/session`, {
        method: 'POST',
        headers: { origin: server.url, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
      });
      const response = await fetch(`${server.url}/api/assessments/${result!.id}`, {
        headers: { origin: server.url, cookie: session.headers.get('set-cookie')!.split(';')[0]! },
      });
      expect(await response.json()).toMatchObject({
        outcome: 'INCONCLUSIVE',
        reason: result!.reason,
        modelEvents: [],
        usedRequests: 0,
      });
      await assertPrivate();
      return;
    }
    expect(result!.proof?.principalComparison).toBe('DISTINCT');
    expect(new Set(result!.candidates.map(item => item.prerequisite))).toEqual(
      new Set(scenario === 'collectionDetailOnly' ? ['collection_detail'] : ['collection_detail', 'detail_receipt']),
    );
    expect(result!.selected?.routeTemplate).toBe('/api/orders/{id}');
    expect(result!.proof?.requestCount).toBe(2);
    expect(result!.verificationCleanup).toBe('COMPLETE');
    if (hostCanary) {
      expect(canaryResult).toEqual({ hostDenied: true, ingressAllowed: true, filesClean: true });
      expect(hostCanaryHits).toBe(1);
    }
    expect(result!.proof).toMatchObject({
      verifierCredentialFree: true,
      firewallVerified: true,
      directFixtureDenied: true,
      gatewayCredentialInjections: 2,
    });
    expect(result!.proof!.verifiedGatewayPeers).toBeGreaterThanOrEqual(2);
    expect(result!.selection).toMatchObject({
      rationaleCode: 'OBSERVED_OWNER_DETAIL',
      hypothesis: 'alternate_account_reads_owner_object',
      confidence: 'medium',
      limitations: ['single_object', 'two_accounts', 'bounded_get_only'],
    });
    expect(result!.usedRequests).toBe(2);
    expect(result!.usedTokens).toBeGreaterThan(0);
    expect(result!.candidates.every(item => item.routeTemplate !== '/api/products')).toBe(true);
    if (disagreement) {
      expect(result!.proof).toMatchObject({
        completed: true,
        ownerStatus: 200,
        alternateStatus: 200,
        bodyMatches: true,
      });
      expect(result!).toMatchObject({
        outcome: 'INCONCLUSIVE',
        findingId: null,
        reason:
          scenario === 'interpretationDisagrees'
            ? 'INTERPRETATION_DISAGREEMENT'
            : scenario === 'reviewDisagrees'
              ? 'REVIEW_DISAGREEMENT'
              : 'BOTH_DISAGREE',
      });
      expect(result!.modelEvents.map(item => item.role)).toEqual(['sherlock', 'dupin', 'watson']);
      expect((await call<{ items: unknown[] }>('/api/bola-findings?limit=25&offset=0')).data.items).toEqual([]);
    }
    const replay = await call<BolaAssessment>(`/api/targets/${target.data.id}/assessments`, 'POST', admission);
    expect(replay.status).toBe(202);
    expect(replay.data.id).toBe(result!.id);
    const changedReplay = await call<{ code: string }>(`/api/targets/${target.data.id}/assessments`, 'POST', {
      ...admission,
      targetRevision: admission.targetRevision + 1,
    });
    expect(changedReplay.status).toBe(409);
    expect(changedReplay.data.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(JSON.stringify(result)).not.toContain(seed.users[0].key);
    expect(JSON.stringify(result)).not.toContain(seed.users[1].key);
    if (mode === 'vulnerable' && !disagreement) {
      expect(result!.outcome).toBe('CONFIRMED');
      expect(result!.findingId).toBeTruthy();
      expect(result!.modelEvents.map(item => item.role)).toEqual(['sherlock', 'dupin', 'watson']);
      const finding = await call<{ id: string; assessmentId: string; checkerId: string; samePrivateResponse: boolean }>(
        `/api/bola-findings/${result!.findingId}`,
      );
      expect(finding.status).toBe(200);
      expect(finding.data).toMatchObject({
        id: result!.findingId,
        assessmentId: result!.id,
        checkerId: 'bola_rest_read',
        samePrivateResponse: true,
        distinctPrincipals: true,
      });
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(server.url);
      await page.getByLabel('Bootstrap secret').fill(settings.CONTROL_BOOTSTRAP_SECRET!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Findings', exact: true })
        .click();
      await page.getByText(result!.findingId!, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Scans', exact: true })
        .click();
      await page.getByRole('button', { name: result!.id.slice(0, 8), exact: true }).click();
      await page.getByText('Checker: bola_rest_read', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
      await page.getByText('Gateway requests: 2', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
      await browser.close();
      browser = undefined;
    } else if (mode === 'protected') {
      expect(result!.outcome).toBe('NOT_REPRODUCED');
      expect(result!.findingId).toBeNull();
      expect(result!.proof?.alternateStatus).toBe(403);
      expect(result!.modelEvents.map(item => item.role)).toEqual(['sherlock', 'dupin']);
      const findings = await call<{ items: unknown[] }>('/api/bola-findings?limit=25&offset=0');
      expect(findings.status).toBe(200);
      expect(findings.data.items).toEqual([]);
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(server.url);
      await page.getByLabel('Bootstrap secret').fill(settings.CONTROL_BOOTSTRAP_SECRET!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Scans', exact: true })
        .click();
      await page.getByRole('button', { name: result!.id.slice(0, 8), exact: true }).click();
      await page.getByText('alternate status: 403', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Findings', exact: true })
        .click();
      await page.getByText('No confirmed REST BOLA findings.').waitFor({ state: 'visible', timeout: 15000 });
      await browser.close();
      browser = undefined;
    }
    await server.close();
    if (scenario === 'retention') {
      const db = createClient({ url: settings.databaseUrl });
      try {
        await db.execute({
          sql: "UPDATE scanner_bola_assessments SET data=json_set(data,'$.expiresAt',?) WHERE id=?",
          args: ['2000-01-01T00:00:00.000Z', started.data.id],
        });
      } finally {
        db.close();
      }
    }
    server = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
    const again = await fetch(`${server.url}/api/session`, {
      method: 'POST',
      headers: { origin: server.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
    });
    const nextCookie = again.headers.get('set-cookie')!.split(';')[0]!;
    const persisted = await fetch(`${server.url}/api/assessments/${started.data.id}`, {
      headers: { origin: server.url, cookie: nextCookie },
    });
    expect(persisted.status).toBe(200);
    const persistedRecord = (await persisted.json()) as BolaAssessment;
    expect(persistedRecord.outcome).toBe(
      disagreement ? 'INCONCLUSIVE' : mode === 'vulnerable' ? 'CONFIRMED' : 'NOT_REPRODUCED',
    );
    expect(persistedRecord.reason).toBe(result!.reason);
    if (scenario === 'retention') {
      expect(persistedRecord).toMatchObject({
        evidenceAvailability: 'expired',
        candidates: [],
        selected: null,
        selection: null,
        proof: null,
      });
      expect(persistedRecord.findingId).toBe(result!.findingId);
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(server.url);
      await page.getByLabel('Bootstrap secret').fill(settings.CONTROL_BOOTSTRAP_SECRET!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Scans', exact: true })
        .click();
      await page.getByRole('button', { name: persistedRecord.id.slice(0, 8), exact: true }).click();
      await page.getByText('Evidence: expired', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Findings', exact: true })
        .click();
      await page.getByText('confidence medium', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
      await browser.close();
      browser = undefined;
    }
    if (mode === 'vulnerable' && !disagreement) {
      const persistedFinding = await fetch(`${server.url}/api/bola-findings/${result!.findingId}`, {
        headers: { origin: server.url, cookie: nextCookie },
      });
      expect(persistedFinding.status).toBe(200);
      const findingRecord = (await persistedFinding.json()) as {
        assessmentId: string;
        selection: { confidence: string; evidenceIds?: string[] };
      };
      expect(findingRecord.assessmentId).toBe(result!.id);
      if (scenario === 'retention') {
        expect(findingRecord.selection.confidence).toBe('medium');
        expect(findingRecord.selection.evidenceIds).toBeUndefined();
      }
    }
  } catch (error) {
    bodyError = error;
    throw error;
  } finally {
    restoreRemoval?.();
    if (crashChild && crashChild.exitCode === null && crashChild.signalCode === null) {
      const exited = new Promise<void>(resolve => crashChild!.once('exit', () => resolve()));
      crashChild.kill('SIGKILL');
      await exited;
    }
    await browser?.close();
    const serverClose = await Promise.allSettled([server?.close() ?? Promise.resolve()]);
    if (scenario === 'crash' || scenario === 'buildCrash' || scenario === 'debt') {
      const residual = await inventory();
      if (JSON.stringify(residual) !== JSON.stringify(labBaseline)) {
        const recovery = await startControlPlane(settings, 0, undefined, boundary!, undefined, undefined, fakeModels);
        await recovery.close();
      }
    }
    await example.close();
    if (scenario === 'sameAccount') {
      const db = createClient({ url: `file:${baseSettings.dataDirectory}/example-target/db/example.db` });
      try {
        await db.execute({
          sql: 'DELETE FROM example_api_keys WHERE key_verifier=?',
          args: [keyVerifier(secondaryKey)],
        });
      } finally {
        db.close();
      }
    }
    if (hostCanary)
      await new Promise<void>((resolve, reject) => {
        hostCanary!.closeAllConnections();
        hostCanary!.close(error => (error ? reject(error) : resolve()));
      });
    for (const path of [settings.databasePath, settings.mastraDatabasePath])
      for (const suffix of ['', '-wal', '-shm', '-journal']) await rm(`${path}${suffix}`, { force: true });
    const cleanupErrors: unknown[] = [];
    try {
      const residual = await inventory();
      expect(residual.containers).toEqual(before.containers);
      expect(residual.networks).toEqual(before.networks);
      expect(residual.images).toEqual(before.images);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (serverClose[0]?.status === 'rejected') cleanupErrors.push(serverClose[0].reason);
    if (cleanupErrors.length) {
      if (bodyError) throw new AggregateError([bodyError, ...cleanupErrors], 'Test body and cleanup failed');
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(cleanupErrors, 'Test cleanup failed');
    }
  }
}

describe('one-button REST BOLA assessment against the owned Hono API', () => {
  it('sends only the fixed owner rule context with the completed proof to both model prompts', async () => {
    const prompts: unknown[] = [];
    const agent = (object: unknown) =>
      ({
        async generate(prompt: string) {
          prompts.push(JSON.parse(prompt));
          return { object, usage: { totalTokens: 1 } };
        },
      }) as unknown as Agent;
    const models = new MastraBolaModels(
      {
        sherlock: agent(null),
        dupin: agent({ outcome: 'CONFIRMED' }),
        watson: agent({ vote: 'agree', reasonCode: 'MATCHED_PRIVATE_RESPONSE' }),
      },
      'local-explorer',
      'local-judge',
    );
    const proof: BolaProof = {
      checkerId: 'bola_rest_read',
      candidateId: randomUUID(),
      ownerStatus: 200,
      alternateStatus: 200,
      bodyMatches: true,
      upstreamObserved: true,
      requestCount: 2,
      completed: true,
      verifierCredentialFree: true,
      firewallVerified: true,
      directFixtureDenied: true,
      gatewayCredentialInjections: 2,
      verifiedGatewayPeers: 2,
    };
    const policy = { objectPolicy: 'owner' as const, expectedUnauthorizedStatus: [403, 404] };
    const budget: BolaBudget = {
      async reserve(_role, bytes, tokens) {
        expect(bytes).toBeGreaterThan(0);
        expect(tokens).toBe(256);
      },
    };
    const signal = new AbortController().signal;
    expect((await models.interpret(proof, policy, budget, signal)).value.outcome).toBe('CONFIRMED');
    expect((await models.review(proof, policy, budget, signal)).value.vote).toBe('agree');
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt).toMatchObject({ proof, policy });
      expect(Object.keys(prompt as object).sort()).toEqual(['policy', 'proof', 'task']);
      expect(JSON.stringify(prompt)).not.toMatch(/\/api\/orders|x-api-key|PRIVATE_RESPONSE_MARKER/);
    }
  });

  it('rejects an unrelated or unsupported model selection before gateway execution', () => {
    const candidate = { id: randomUUID(), evidenceIds: [randomUUID(), randomUUID()] } as BolaCandidate;
    expect(() =>
      selectedBolaCandidate(
        {
          checkerId: 'bola_rest_read',
          candidateId: randomUUID(),
          evidenceIds: candidate.evidenceIds,
          rationaleCode: 'UNKNOWN_ROUTE',
          hypothesis: 'alternate_account_reads_owner_object',
          confidence: 'medium',
          limitations: ['single_object'],
        },
        [candidate],
      ),
    ).toThrow();
    expect(() =>
      selectedBolaCandidate(
        {
          checkerId: 'script_checker',
          candidateId: candidate.id,
          evidenceIds: candidate.evidenceIds,
          rationaleCode: 'UNKNOWN_CHECKER',
          hypothesis: 'alternate_account_reads_owner_object',
          confidence: 'medium',
          limitations: ['single_object'],
        },
        [candidate],
      ),
    ).toThrow();
    expect(() =>
      selectedBolaCandidate(
        {
          checkerId: 'bola_rest_read',
          candidateId: candidate.id,
          evidenceIds: [candidate.evidenceIds[0], randomUUID()],
          rationaleCode: 'MISSING_PREREQUISITE',
          hypothesis: 'alternate_account_reads_owner_object',
          confidence: 'medium',
          limitations: ['single_object'],
        },
        [candidate],
      ),
    ).toThrow();
  });
  it(
    'does not confirm BOLA when two profiles use the same account key',
    () => journey('protected', 'sameKey'),
    300_000,
  );
  it(
    'does not confirm BOLA when two distinct keys authenticate the same account',
    () => journey('protected', 'sameAccount'),
    300_000,
  );
  it(
    'keeps missing principal configuration inconclusive without verifier or model calls',
    () => journey('vulnerable', 'missingPrincipal'),
    300_000,
  );
  it(
    'keeps incompatible principal pointers inconclusive without comparing unrelated fields',
    () => journey('vulnerable', 'mismatchedPrincipal'),
    300_000,
  );
  it(
    'stops a newly admitted scan when assessment storage rejects it',
    () => journey('protected', 'storeFailure'),
    300_000,
  );
  it(
    'does not cancel an independent scan reused by a failed assessment admission',
    () => journey('protected', 'reusedScanFailure'),
    300_000,
  );
  it(
    'drains in-flight scan admission before closing assessments',
    () => journey('protected', 'shutdownScanAdmission'),
    300_000,
  );
  it(
    'drains in-flight assessment persistence before closing assessments',
    () => journey('protected', 'shutdownAssessmentAdmission'),
    300_000,
  );
  it(
    'assesses a collection and detail without requiring receipt routes',
    () => journey('protected', 'collectionDetailOnly'),
    300_000,
  );
  it('records a reviewed positive only for the owner detail in vulnerable mode', () => journey('vulnerable'), 300_000);
  it('records protected comparison without a finding', () => journey('protected'), 300_000);
  it(
    'retains interpretation disagreement after a completed positive proof',
    () => journey('vulnerable', 'interpretationDisagrees'),
    300_000,
  );
  it(
    'retains review disagreement after a completed positive proof',
    () => journey('vulnerable', 'reviewDisagrees'),
    300_000,
  );
  it(
    'retains both disagreements after a completed positive proof',
    () => journey('vulnerable', 'bothDisagree'),
    300_000,
  );
  it(
    'cancels after discovery without a later model or gateway request and persists across restart',
    () => journey('vulnerable', 'cancel'),
    300_000,
  );
  it(
    'redacts expired assessment paths and proof while preserving minimal finding audit',
    () => journey('vulnerable', 'retention'),
    300_000,
  );
  it('reconciles the exact verifier job after a real child SIGKILL', () => journey('vulnerable', 'crash'), 300_000);
  it(
    'reconciles a built image before the ID receipt after a real child SIGKILL',
    () => journey('vulnerable', 'buildCrash'),
    300_000,
  );
  it(
    'keeps cancellation in debt after an exact removal failure and retries on restart',
    () => journey('vulnerable', 'debt'),
    300_000,
  );
});
