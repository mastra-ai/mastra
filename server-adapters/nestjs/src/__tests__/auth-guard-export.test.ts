import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraAuthGuard, MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

@Controller('api/things')
@UseGuards(MastraAuthGuard)
class ThingsController {
  @Get()
  list() {
    return { ok: true };
  }
}

/**
 * Regression tests for #25211: MastraAuthGuard must resolve on an app's own
 * controllers in a module that imports MastraModule.
 */
describe('NestJS Adapter - MastraAuthGuard on app controllers', () => {
  let context: AdapterTestContext;
  let app: INestApplication;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    vi.spyOn(context.mastra, 'getServer').mockReturnValue({
      auth: {
        authenticateToken: async (token: string) => (token === 'good-token' ? { id: 'u1' } : null),
      },
    } as any);
  });

  afterEach(async () => {
    if (app) await app.close();
    vi.restoreAllMocks();
  });

  async function start(mastraModule: DynamicModule): Promise<Application> {
    @Module({ imports: [mastraModule], controllers: [ThingsController] })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    return app.getHttpAdapter().getInstance() as Application;
  }

  async function expectGuarded(expressApp: Application) {
    const anonymous = await executeExpressRequest(expressApp, { method: 'GET', path: '/api/things' });
    expect(anonymous.status).toBe(401);

    const authed = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/things',
      headers: { authorization: 'Bearer good-token' },
    });
    expect(authed.status).toBe(200);
  }

  it('works with MastraModule.register()', async () => {
    await expectGuarded(await start(MastraModule.register({ mastra: context.mastra })));
  });

  it('works with MastraModule.registerAsync()', async () => {
    await expectGuarded(await start(MastraModule.registerAsync({ useFactory: () => ({ mastra: context.mastra }) })));
  });
});
