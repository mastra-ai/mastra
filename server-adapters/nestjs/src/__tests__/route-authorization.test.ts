import type { IFGAProvider } from '@mastra/core/auth/ee';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

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

describe('NestJS Adapter - route permission and FGA checks', () => {
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

  describe('route permissions', () => {
    it('allows a user holding the derived permission', async () => {
      await start({ auth, rbac });
      expect((await get('/api/agents', 'viewer')).status).toBe(200);
    });

    it('rejects a user missing the derived permission with 403', async () => {
      await start({ auth, rbac });
      const response = await get('/api/agents', '_default');
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Missing required permission: agents:read',
        code: 'FORBIDDEN',
        timestamp: expect.any(String),
      });
    });

    it('skips permission checks when no RBAC provider is configured', async () => {
      await start({ auth });
      expect((await get('/api/agents', '_default')).status).toBe(200);
    });
  });

  describe('route FGA', () => {
    function fgaProvider(allowed: boolean) {
      const check = vi.fn().mockResolvedValue(allowed);
      const provider: IFGAProvider = {
        check,
        require: vi.fn(),
        filterAccessible: vi.fn(),
        resolveRouteFGA: () => ({ resourceType: 'agent', resourceIdParam: 'agentId' }),
      };
      return { check, provider };
    }

    it('rejects a request the FGA provider denies with 403', async () => {
      const { check, provider } = fgaProvider(false);
      await start({ auth, fga: provider });
      const response = await get('/api/agents/test-agent', 'admin');
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN',
        error: expect.stringContaining('FGA authorization denied'),
      });
      expect(check).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user_admin' }),
        expect.objectContaining({ resource: { type: 'agent', id: 'test-agent' } }),
      );
    });

    it('serves a request the FGA provider allows', async () => {
      const { check, provider } = fgaProvider(true);
      await start({ auth, fga: provider });
      expect((await get('/api/agents/test-agent', 'admin')).status).toBe(200);
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
});
