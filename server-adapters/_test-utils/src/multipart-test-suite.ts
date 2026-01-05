import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { AdapterTestContext, createDefaultTestContext } from './test-helpers';

/**
 * Configuration for multipart FormData test suite
 */
export interface MultipartTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Setup adapter and app for testing
   */
  setupAdapter: (
    context: AdapterTestContext,
    options?: { bodyLimitOptions?: { maxSize: number; onError: (err: any) => any } },
  ) => { adapter: any; app: any } | Promise<{ adapter: any; app: any }>;

  /**
   * Start a test server and return its base URL
   * The returned cleanup function should close the server
   */
  startServer: (app: any) => Promise<{ baseUrl: string; cleanup: () => Promise<void> }>;

  /**
   * Register a route with the adapter
   */
  registerRoute: (adapter: any, app: any, route: ServerRoute, options?: { prefix?: string }) => Promise<void>;

  /**
   * Get the context middleware to use
   */
  getContextMiddleware: (adapter: any) => any;

  /**
   * Apply middleware to app
   */
  applyMiddleware: (app: any, middleware: any) => void;
}

/**
 * Creates a standardized test suite for multipart/form-data handling in server adapters.
 *
 * Tests:
 * - File uploads are correctly parsed to Buffers
 * - JSON fields in FormData are parsed
 * - File size limits are enforced
 * - Error handling for malformed requests
 */
export function createMultipartTestSuite(config: MultipartTestSuiteConfig) {
  const {
    suiteName = 'Multipart FormData Tests',
    setupAdapter,
    startServer,
    registerRoute,
    getContextMiddleware,
    applyMiddleware,
  } = config;

  describe(suiteName, () => {
    let context: AdapterTestContext;
    let serverInfo: { baseUrl: string; cleanup: () => Promise<void> } | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (serverInfo) {
        await serverInfo.cleanup();
        serverInfo = null;
      }
    });

    it('should parse file uploads as Buffers', async () => {
      const { adapter, app } = await setupAdapter(context);

      // Track received body
      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return { success: true, hasAudio: !!params.audio };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create FormData with a file
      const formData = new FormData();
      const audioContent = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF header bytes
      const audioBlob = new Blob([audioContent], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'test.wav');

      const response = await fetch(`${serverInfo.baseUrl}/test/upload`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.hasAudio).toBe(true);

      // Verify the audio was parsed as a Buffer
      expect(receivedBody.audio).toBeDefined();
      expect(Buffer.isBuffer(receivedBody.audio)).toBe(true);
      expect(receivedBody.audio.length).toBe(4);
    });

    it('should parse JSON string fields in FormData', async () => {
      const { adapter, app } = await setupAdapter(context);

      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-with-options',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return { success: true };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create FormData with file and JSON options
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'test.wav');
      formData.append('options', JSON.stringify({ language: 'en', format: 'mp3' }));

      const response = await fetch(`${serverInfo.baseUrl}/test/upload-with-options`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);

      // Verify options was parsed as object, not string
      expect(receivedBody.options).toBeDefined();
      expect(typeof receivedBody.options).toBe('object');
      expect(receivedBody.options.language).toBe('en');
      expect(receivedBody.options.format).toBe('mp3');
    });

    it('should handle plain string fields in FormData', async () => {
      const { adapter, app } = await setupAdapter(context);

      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-with-string',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return { success: true };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create FormData with file and plain string field
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'test.wav');
      formData.append('name', 'test-recording');

      const response = await fetch(`${serverInfo.baseUrl}/test/upload-with-string`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);

      // Verify name remains a string (not parsed as JSON)
      expect(receivedBody.name).toBe('test-recording');
    });

    it('should reject files exceeding size limit', async () => {
      const maxSize = 100; // 100 bytes limit
      const { adapter, app } = await setupAdapter(context, {
        bodyLimitOptions: {
          maxSize,
          onError: (err: any) => ({ error: 'File too large' }),
        },
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-limited',
        responseType: 'json',
        handler: async () => {
          return { success: true };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create FormData with a file larger than the limit
      const formData = new FormData();
      const largeContent = new Uint8Array(200); // 200 bytes, exceeds 100 byte limit
      const largeBlob = new Blob([largeContent], { type: 'audio/wav' });
      formData.append('audio', largeBlob, 'large.wav');

      const response = await fetch(`${serverInfo.baseUrl}/test/upload-limited`, {
        method: 'POST',
        body: formData,
      });

      // Should return error status (413 or 500 depending on implementation)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle empty FormData gracefully', async () => {
      const { adapter, app } = await setupAdapter(context);

      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-empty',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return {
            success: true,
            bodyKeys: Object.keys(params).filter(
              k => !['mastra', 'requestContext', 'tools', 'taskStore', 'abortSignal'].includes(k),
            ),
          };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create empty FormData
      const formData = new FormData();

      const response = await fetch(`${serverInfo.baseUrl}/test/upload-empty`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.bodyKeys).toEqual([]);
    });

    it('should handle multiple files', async () => {
      const { adapter, app } = await setupAdapter(context);

      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-multiple',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return {
            success: true,
            hasFile1: !!params.file1,
            hasFile2: !!params.file2,
          };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      // Create FormData with multiple files
      const formData = new FormData();
      const file1 = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
      const file2 = new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/wav' });
      formData.append('file1', file1, 'file1.wav');
      formData.append('file2', file2, 'file2.wav');

      const response = await fetch(`${serverInfo.baseUrl}/test/upload-multiple`, {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.hasFile1).toBe(true);
      expect(result.hasFile2).toBe(true);

      // Verify both files were parsed
      expect(Buffer.isBuffer(receivedBody.file1)).toBe(true);
      expect(Buffer.isBuffer(receivedBody.file2)).toBe(true);
    });

    it('should still handle JSON requests normally', async () => {
      const { adapter, app } = await setupAdapter(context);

      let receivedBody: any;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/json',
        responseType: 'json',
        handler: async (params: any) => {
          receivedBody = params;
          return { success: true, message: params.message };
        },
      };

      applyMiddleware(app, getContextMiddleware(adapter));
      await registerRoute(adapter, app, testRoute, { prefix: '' });

      serverInfo = await startServer(app);

      const response = await fetch(`${serverInfo.baseUrl}/test/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello, World!' }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello, World!');
    });
  });
}
