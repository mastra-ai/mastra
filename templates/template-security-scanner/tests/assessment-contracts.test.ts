import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applicationDriverSchema } from '../src/core/application-drivers.js';
import { authenticationDriverSchema } from '../src/core/authentication-drivers.js';
import { ControlPlane } from '../src/core/control-plane.js';
import { CredentialVault } from '../src/core/credentials.js';
import { routeAccessRuleSchema, ownerOnlyReadRule } from '../src/core/route-access.js';
import { DomainStore } from '../src/core/store.js';
import {
  categoryCompatibility,
  vulnerabilityCategoryCatalog,
  vulnerabilityCategorySchema,
} from '../src/investigation/category-contracts.js';
import {
  bolaRestReadChecker,
  checkerSchema,
  requireExecutableChecker,
} from '../src/investigation/checker-contracts.js';
import type { Target } from '../src/core/contracts.js';

const limits = { maxRequests: 30, maxDurationSeconds: 30, maxResponseBytes: 8192, maxConcurrency: 1 };
const operatorRule = {
  version: 1,
  method: 'GET',
  pathTemplate: '/api/orders/{id}',
  audience: 'user',
  objectPolicy: 'owner',
  source: 'operator',
  operatorRevision: 1,
  expectedUnauthorizedStatus: [403, 404],
} as const;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('first-release assessment contracts', () => {
  it('rejects a shared collection as API-key access evidence before discovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scanner-shared-access-'));
    roots.push(root);
    const store = new DomainStore(`file:${join(root, 'scanner.db')}`);
    try {
      await store.initialize();
      const control = new ControlPlane(store, new CredentialVault('ab'.repeat(32)));
      const policy = await control.createPolicy('operator', {
        name: 'Read only',
        permittedMethods: ['GET'],
        scanLimits: limits,
        retention: { evidenceDays: 7, approvedBy: 'operator' },
      });
      const target = await control.createTarget('operator', {
        name: 'Order API',
        entryUrl: 'https://orders.example/api/orders',
        approvedOrigins: ['https://orders.example'],
        allowedPaths: ['/api'],
        excludedPaths: [],
        permittedMethods: ['GET'],
        environment: 'staging',
        authorizationEvidenceRef: 'approved:orders',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
        application: { kind: 'rest_api', version: 1, discoveryModes: ['observed_json'] },
      });
      const profile = await control.createProfile('operator', target.id, target.revision, {
        kind: 'api_key_header',
        name: 'Ordinary user',
        role: 'user',
        credential: { value: 'private-example-key' },
      });
      const current = await store.get<Target>('target', target.id, 'operator');
      const { id: _id, owner: _owner, revision: _revision, ...input } = current;
      const confirmed = await control.updateTarget('operator', target.id, current.revision, {
        ...input,
        authenticationDrivers: [
          {
            kind: 'api_key_header',
            version: 1,
            profileId: profile.id,
            secretRef: profile.id,
            credentialOrigins: ['https://orders.example'],
            headerName: 'x-api-key',
            accessCheckPath: '/api/orders',
            refresh: 'reregister',
          },
        ],
        routeAccessRules: [
          {
            version: 1,
            method: 'GET',
            pathTemplate: '/api/orders',
            source: 'operator',
            operatorRevision: current.revision + 1,
            audience: 'user',
            objectPolicy: 'shared',
            expectedUnauthorizedStatus: [401, 403],
          },
        ],
      });
      await expect(
        store.write(transaction =>
          control.scanContext(
            'operator',
            target.id,
            {
              targetRevision: confirmed.revision,
              policyRevision: policy.revision,
              profiles: [
                {
                  targetRevision: confirmed.revision,
                  policyRevision: policy.revision,
                  profileId: profile.id,
                  profileRevision: profile.revision,
                  credentialRevision: profile.credentialRevision,
                },
              ],
            },
            transaction,
          ),
        ),
      ).rejects.toMatchObject({ code: 'ACCESS_CHECK_RULE_REQUIRED' });
    } finally {
      store.close();
    }
  });
  it('stores unsupported application and authentication metadata while preventing discovery before credential use', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scanner-assessment-'));
    roots.push(root);
    const store = new DomainStore(`file:${join(root, 'scanner.db')}`);
    try {
      await store.initialize();
      const control = new ControlPlane(store, new CredentialVault('ab'.repeat(32)));
      const policy = await control.createPolicy('operator', {
        name: 'Read only',
        permittedMethods: ['GET'],
        scanLimits: limits,
        retention: { evidenceDays: 7, approvedBy: 'operator' },
      });
      const original = await control.createTarget('operator', {
        name: 'Order API',
        entryUrl: 'https://orders.example/api/orders',
        approvedOrigins: ['https://orders.example'],
        allowedPaths: ['/api'],
        excludedPaths: [],
        permittedMethods: ['GET'],
        environment: 'staging',
        authorizationEvidenceRef: 'approved:orders',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
      });
      expect(original.application).toBeUndefined();
      const legacyContext = await store.write(transaction =>
        control.scanContext(
          'operator',
          original.id,
          {
            targetRevision: original.revision,
            policyRevision: policy.revision,
            profiles: [],
          },
          transaction,
        ),
      );
      expect(legacyContext.target.id).toBe(original.id);
      const { id: _id, owner: _owner, revision: _revision, ...targetInput } = original;
      const updated = await control.updateTarget('operator', original.id, original.revision, {
        ...targetInput,
        application: { kind: 'graphql', version: 1, execution: 'unsupported' },
        authenticationDrivers: [
          {
            kind: 'login_password',
            version: 1,
            execution: 'unsupported',
            profileId: randomUUID(),
            secretRef: randomUUID(),
            credentialOrigins: ['https://orders.example'],
          },
        ],
        routeAccessRules: [{ ...operatorRule, operatorRevision: 2 }],
      });
      const persisted = await store.get<Target>('target', updated.id, 'operator');
      expect(persisted.application?.kind).toBe('graphql');
      expect(persisted.routeAccessRules?.[0]).toMatchObject({ audience: 'user', objectPolicy: 'owner' });
      expect(await store.revisions('target', updated.id, 'operator', 10, 0)).toHaveLength(2);
      await expect(
        store.write(transaction =>
          control.scanContext(
            'operator',
            updated.id,
            {
              targetRevision: updated.revision,
              policyRevision: policy.revision,
              profiles: [],
            },
            transaction,
          ),
        ),
      ).rejects.toMatchObject({ code: 'APPLICATION_DRIVER_UNSUPPORTED' });
      expect((await store.get<Target>('target', original.id, 'operator')).revision).toBe(2);
    } finally {
      store.close();
    }
  });

  it('keeps owner-only operator intent distinct from public, shared and OpenAPI suggestions', () => {
    const owner = routeAccessRuleSchema.parse(operatorRule);
    expect(ownerOnlyReadRule(owner)).toBe(true);
    const { objectPolicy: _policy, ...nonUserRule } = operatorRule;
    for (const candidate of [
      { ...operatorRule, source: 'openapi_suggestion', operatorRevision: undefined },
      { ...operatorRule, objectPolicy: 'shared' },
      { ...nonUserRule, audience: 'admin' },
      { ...nonUserRule, audience: 'public', expectedUnauthorizedStatus: [] },
    ]) {
      const parsed = routeAccessRuleSchema.parse(candidate);
      expect(ownerOnlyReadRule(parsed)).toBe(false);
    }
    expect(
      routeAccessRuleSchema.safeParse({ ...operatorRule, pathTemplate: '/api/orders/{id}/../private' }).success,
    ).toBe(false);
    expect(routeAccessRuleSchema.safeParse({ ...operatorRule, pathTemplate: '/api/orders/.' }).success).toBe(false);
    expect(routeAccessRuleSchema.safeParse({ ...operatorRule, source: 'openapi_suggestion' }).success).toBe(false);
  });

  it.each(['authenticationDrivers', 'routeAccessRules'] as const)(
    'blocks even empty %s metadata on a legacy target before execution',
    async field => {
      const root = await mkdtemp(join(tmpdir(), 'scanner-empty-metadata-'));
      roots.push(root);
      const store = new DomainStore(`file:${join(root, 'scanner.db')}`);
      try {
        await store.initialize();
        const control = new ControlPlane(store, new CredentialVault('ab'.repeat(32)));
        const policy = await control.createPolicy('operator', {
          name: 'Read only',
          permittedMethods: ['GET'],
          scanLimits: limits,
          retention: { evidenceDays: 7, approvedBy: 'operator' },
        });
        const target = await control.createTarget('operator', {
          name: 'Order API',
          entryUrl: 'https://orders.example/api/orders',
          approvedOrigins: ['https://orders.example'],
          allowedPaths: ['/api'],
          excludedPaths: [],
          permittedMethods: ['GET'],
          environment: 'staging',
          authorizationEvidenceRef: 'approved:orders',
          authorizationConfirmed: true,
          policyId: policy.id,
          policyRevision: policy.revision,
          schedule: { enabled: false, timezone: 'UTC' },
          scanLimits: limits,
          [field]: [],
        });
        await expect(
          store.write(transaction =>
            control.scanContext(
              'operator',
              target.id,
              {
                targetRevision: target.revision,
                policyRevision: policy.revision,
                profiles: [],
              },
              transaction,
            ),
          ),
        ).rejects.toMatchObject({ code: 'APPLICATION_DRIVER_UNSUPPORTED' });
      } finally {
        store.close();
      }
    },
  );

  it('validates future driver and checker shapes without enabling their execution', () => {
    expect(applicationDriverSchema.parse({ kind: 'spa', version: 1, execution: 'unsupported' }).kind).toBe('spa');
    expect(
      authenticationDriverSchema.parse({
        kind: 'api_key_header',
        version: 1,
        profileId: randomUUID(),
        secretRef: randomUUID(),
        credentialOrigins: ['https://orders.example'],
        headerName: 'X-API-Key',
        accessCheckPath: '/api/orders',
        refresh: 'reregister',
      }).kind,
    ).toBe('api_key_header');
    expect(
      authenticationDriverSchema.safeParse({
        kind: 'api_key_header',
        version: 1,
        profileId: randomUUID(),
        secretRef: randomUUID(),
        credentialOrigins: ['https://orders.example'],
        headerName: 'Host',
        accessCheckPath: '/api/orders',
        refresh: 'reregister',
      }).success,
    ).toBe(false);
    expect(
      authenticationDriverSchema.safeParse({
        kind: 'api_key_header',
        version: 1,
        profileId: randomUUID(),
        secretRef: randomUUID(),
        credentialOrigins: ['https://orders.example'],
        headerName: 'X-API-Key',
        accessCheckPath: '/api/../private',
        refresh: 'reregister',
      }).success,
    ).toBe(false);
    const script = checkerSchema.parse({ ...bolaRestReadChecker, kind: 'external_script', execution: 'unsupported' });
    expect(() => requireExecutableChecker(script, 'rest_api')).toThrow('CHECKER_UNSUPPORTED');
    expect(requireExecutableChecker(bolaRestReadChecker, 'rest_api')).toEqual(bolaRestReadChecker);
    expect(() =>
      requireExecutableChecker(checkerSchema.parse({ ...bolaRestReadChecker, execution: 'planned' }), 'rest_api'),
    ).toThrow('CHECKER_UNSUPPORTED');
    expect(() =>
      requireExecutableChecker(checkerSchema.parse({ ...bolaRestReadChecker, execution: 'legacy_lab' }), 'owned_lab'),
    ).toThrow('CHECKER_UNSUPPORTED');
  });

  it('retains historical IDOR proof identity while cataloging BOLA separately', () => {
    expect(categoryCompatibility('idor')).toEqual({
      storedId: 'idor',
      family: 'BOLA_IDOR',
      proofSemantics: 'legacy_owned_lab',
    });
    expect(categoryCompatibility('bola')).toEqual({
      storedId: 'bola',
      family: 'BOLA_IDOR',
      proofSemantics: 'rest_owner_comparison',
    });
    expect(vulnerabilityCategoryCatalog.map(category => category.id)).toContain('idor');
    expect(
      vulnerabilityCategoryCatalog.every(category => vulnerabilityCategorySchema.safeParse(category).success),
    ).toBe(true);
    expect(vulnerabilityCategorySchema.parse(vulnerabilityCategoryCatalog[0]).execution).toBe('available');
    expect(vulnerabilityCategoryCatalog.find(category => category.id === 'idor')?.execution).toBe('legacy_lab');
  });
});
