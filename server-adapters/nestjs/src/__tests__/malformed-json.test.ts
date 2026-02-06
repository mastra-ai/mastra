/**
 * Test suite for malformed JSON body handling in NestJS
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12310
 *
 * Verifies that express.json() middleware correctly returns 400 for malformed JSON
 * when used with the NestJS adapter.
 */
import { Controller, Post, Body, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeExpressRequest } from './test-helpers';

// Simple test controller
@Controller()
class TestController {
  @Post('/test')
  test(@Body() body: any) {
    return { received: body };
  }
}

// Simple test module
@Module({
  controllers: [TestController],
})
class TestModule {}

describe('Malformed JSON Body Handling', () => {
  let app: INestApplication;
  let expressApp: Application;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    expressApp.use(express.json());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('express.json() middleware behavior with NestJS', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await executeExpressRequest(expressApp, {
        method: 'POST',
        path: '/test',
        headers: { 'Content-Type': 'application/json' },
        rawBody: '{"invalid": "json"',
      });

      expect(response.status).toBe(400);
    });

    it('should return 201 for valid JSON', async () => {
      const response = await executeExpressRequest(expressApp, {
        method: 'POST',
        path: '/test',
        body: { valid: 'json' },
      });

      expect(response.status).toBe(201);
    });

    it('should handle empty body gracefully', async () => {
      const response = await executeExpressRequest(expressApp, {
        method: 'POST',
        path: '/test',
        body: {},
      });

      // Express returns 400 for empty body with application/json
      expect(response.status).toBeLessThan(500);
    });

    it('should handle null body', async () => {
      const response = await executeExpressRequest(expressApp, {
        method: 'POST',
        path: '/test',
        headers: { 'Content-Type': 'application/json' },
        rawBody: 'null',
      });

      // null is valid JSON but Express body-parser may reject it as empty body
      // The key is it doesn't crash the server (< 500)
      expect(response.status).toBeLessThan(500);
    });

    it('should handle array body', async () => {
      const response = await executeExpressRequest(expressApp, {
        method: 'POST',
        path: '/test',
        body: [1, 2, 3],
      });

      expect(response.status).toBe(201);
      const data = response.body as any;
      expect(data.received).toEqual([1, 2, 3]);
    });
  });
});
