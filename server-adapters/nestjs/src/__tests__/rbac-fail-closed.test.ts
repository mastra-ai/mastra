import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

// Simulate @mastra/core/auth/ee failing to provide the permission checker.
vi.mock('@mastra/core/auth/ee', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const module = { ...actual };
  Object.defineProperty(module, 'hasPermission', {
    get() {
      throw new Error('simulated: @mastra/core/auth/ee could not be loaded');
    },
  });
  return module;
});

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  viewer: ['agents:read'],
  _default: [],
};

const auth = {
  authenticateToken: async (token: string) => (token in ROLE_PERMISSIONS ? { id: `user_${token}`, role: token } : null),
  authorize: async () => true,
};

const rbac = {
  getPermissions: async (user: { role: string }) => ROLE_PERMISSIONS[user.role] ?? [],
  getRoles: async (user: { role: string }) => [user.role],
};

describe('NestJS Adapter - RBAC when the permission checker cannot load', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) await app.close();
    vi.restoreAllMocks();
  });

  async function start(server: Record<string, unknown>) {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue(server as any);
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();
    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
  }

  const get = (path: string, role: string) =>
    executeExpressRequest(expressApp, { method: 'GET', path, headers: { authorization: `Bearer ${role}` } });

  it('denies a protected route when RBAC is configured', async () => {
    await start({ auth, rbac });
    const response = await get('/api/agents', 'admin');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Missing required permission: agents:read',
      code: 'FORBIDDEN',
      timestamp: expect.any(String),
    });
  });

  it('leaves routes alone when RBAC is not configured', async () => {
    await start({ auth });
    expect((await get('/api/agents', 'admin')).status).toBe(200);
  });
});
