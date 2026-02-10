import type { Server } from 'node:http';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { describe } from 'vitest';

import { MastraModule } from '../index';

/**
 * NestJS Integration Tests for MCP Transport Routes
 *
 * These verify MCP transport endpoints are exposed via the NestJS adapter.
 */
describe('NestJS MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'NestJS Adapter',

    createServer: async (mastra: Mastra) => {
      // Create NestJS app using MastraModule
      const moduleRef = await Test.createTestingModule({
        imports: [
          MastraModule.register({
            mastra,
          }),
        ],
      }).compile();

      const nestApp: INestApplication = moduleRef.createNestApplication();

      // Get underlying Express app and add JSON parsing
      const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
      expressApp.use(express.json());

      await nestApp.init();

      // Start server on random port
      const server: Server = await new Promise(resolve => {
        const s = expressApp.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      // Wrap server.close to also shut down the NestJS app
      const originalClose = server.close.bind(server);
      server.close = ((cb?: (err?: Error) => void) => {
        nestApp.close().finally(() => originalClose(cb));
        return server;
      }) as typeof server.close;

      return {
        server,
        port: address.port,
      };
    },
  });
});
