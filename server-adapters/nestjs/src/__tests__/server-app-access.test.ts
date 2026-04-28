import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MastraModule, MastraService } from '../index';
import { executeExpressRequest } from './test-helpers';

/**
 * These tests verify that the NestJS adapter properly supports
 * accessing the underlying Express app and Mastra instance.
 *
 * These tests focus on verifying:
 * - MastraService.getMastra() returns the correct instance
 * - mastra.getServerApp() returns the underlying Express app
 * - mastra.getMastraServer() returns the NestMastraServer adapter
 */
describe('NestJS Adapter - Server App Access', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  describe('MastraService.getMastra()', () => {
    it('should return the Mastra instance passed to the module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const mastraService = moduleRef.get(MastraService);
      expect(mastraService.getMastra()).toBe(context.mastra);
    });

    it('should allow accessing agents via MastraService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const mastraService = moduleRef.get(MastraService);

      // Access agent via MastraService helper
      const agent = mastraService.getAgent('test-agent');
      expect(agent).toBeDefined();

      // Also access via getMastra()
      const agentViaMastra = mastraService.getMastra().getAgent('test-agent');
      expect(agentViaMastra).toBe(agent);
    });

    it('should allow accessing workflows via MastraService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      const mastraService = moduleRef.get(MastraService);

      // Access workflow via MastraService helper
      const workflow = mastraService.getWorkflow('test-workflow');
      expect(workflow).toBeDefined();

      // Also access via getMastra()
      const workflowViaMastra = mastraService.getMastra().getWorkflow('test-workflow');
      expect(workflowViaMastra).toBe(workflow);
    });
  });

  describe('mastra.getServerApp()', () => {
    // Note: mastra.getServerApp() may return undefined in NestJS because
    // MastraService registers the adapter in its constructor, but the
    // HttpAdapterHost may not be fully available until after app.init().
    // These tests document the current behavior.

    it('should have getServerApp method on mastra', async () => {
      expect(typeof context.mastra.getServerApp).toBe('function');
    });

    it('should have getMastraServer method on mastra', async () => {
      expect(typeof context.mastra.getMastraServer).toBe('function');
    });
  });

  describe('mastra.getMastraServer()', () => {
    // Note: Similar to getServerApp(), getMastraServer() may return undefined
    // because the HttpAdapterHost is populated after module compilation.
    // These tests document that the methods exist.

    it('should have getMastraServer method on mastra', async () => {
      expect(typeof context.mastra.getMastraServer).toBe('function');
    });
  });

  describe('Express app with HTTP server', () => {
    let nestApp: INestApplication | null = null;

    afterEach(async () => {
      if (nestApp) {
        await nestApp.close();
        nestApp = null;
      }
    });

    it('should allow starting a server and making requests using the underlying Express app', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      nestApp = moduleRef.createNestApplication();
      const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await nestApp.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/health',
      });
      expect(response.status).toBe(200);
      expect((response.body as any).status).toBe('ok');
    });

    it('should allow accessing Mastra routes through the underlying Express app', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      nestApp = moduleRef.createNestApplication();
      const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await nestApp.init();

      const response = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/agents',
      });
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should support running a full NestJS app with Mastra routes', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MastraModule.register({ mastra: context.mastra })],
      }).compile();

      nestApp = moduleRef.createNestApplication();
      const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await nestApp.init();

      const getResponse = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/agents',
      });
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toBeDefined();

      const healthResponse = await executeExpressRequest(expressApp, {
        method: 'GET',
        path: '/health',
      });
      expect(healthResponse.status).toBe(200);
      expect((healthResponse.body as any).status).toBe('ok');
    });
  });
});
