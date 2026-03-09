import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vectorQuerySearch } from '../utils';
import type { DatabaseConfig } from './types';
import { createVectorQueryTool } from './vector-query';

vi.mock('../utils', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    vectorQuerySearch: vi.fn().mockResolvedValue({
      results: [{ metadata: { text: 'test result' }, vector: [1, 2, 3] }],
    }),
  };
});

describe('createVectorQueryTool with database-specific configurations', () => {
  const mockModel = { name: 'test-model' } as any;
  const mockMastra = {
    getVector: vi.fn(() => ({})),
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass Pinecone configuration to vectorQuerySearch', async () => {
    const databaseConfig: DatabaseConfig = {
      pinecone: {
        namespace: 'test-namespace',
        sparseVector: {
          indices: [0, 1, 2],
          values: [0.1, 0.2, 0.3],
        },
      },
    };

    const tool = createVectorQueryTool({
      vectorStoreName: 'pinecone',
      indexName: 'testIndex',
      model: mockModel,
      databaseConfig,
    });

    const requestContext = new RequestContext();

    await tool.execute(
      {
        queryText: 'test query',
        topK: 5,
      },
      {
        mastra: mockMastra as any,
        requestContext,
      },
    );

    expect(vectorQuerySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseConfig,
      }),
    );
  });

  it('should pass pgVector configuration to vectorQuerySearch', async () => {
    const databaseConfig: DatabaseConfig = {
      pgvector: {
        minScore: 0.7,
        ef: 200,
        probes: 10,
      },
    };

    const tool = createVectorQueryTool({
      vectorStoreName: 'postgres',
      indexName: 'testIndex',
      model: mockModel,
      databaseConfig,
    });

    const requestContext = new RequestContext();

    await tool.execute(
      {
        queryText: 'test query',
        topK: 5,
      },
      {
        mastra: mockMastra as any,
        requestContext,
      },
    );

    expect(vectorQuerySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseConfig,
      }),
    );
  });

  it('should allow request context to override database configuration', async () => {
    const initialConfig: DatabaseConfig = {
      pinecone: {
        namespace: 'initial-namespace',
      },
    };

    const runtimeConfig: DatabaseConfig = {
      pinecone: {
        namespace: 'runtime-namespace',
      },
    };

    const tool = createVectorQueryTool({
      vectorStoreName: 'pinecone',
      indexName: 'testIndex',
      model: mockModel,
      databaseConfig: initialConfig,
    });

    const requestContext = new RequestContext();
    requestContext.set('databaseConfig', runtimeConfig);

    await tool.execute(
      {
        queryText: 'test query',
        topK: 5,
      },
      {
        mastra: mockMastra as any,
        requestContext,
      },
    );

    expect(vectorQuerySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseConfig: runtimeConfig, // Should use runtime config, not initial
      }),
    );
  });

  it('should work without database configuration (backward compatibility)', async () => {
    const tool = createVectorQueryTool({
      vectorStoreName: 'testStore',
      indexName: 'testIndex',
      model: mockModel,
      // No databaseConfig provided
    });

    const requestContext = new RequestContext();

    await tool.execute(
      {
        queryText: 'test query',
        topK: 5,
      },
      {
        mastra: mockMastra as any,
        requestContext,
      },
    );

    expect(vectorQuerySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseConfig: undefined,
      }),
    );
  });

  it('should handle multiple database configurations', async () => {
    const databaseConfig: DatabaseConfig = {
      pinecone: {
        namespace: 'test-namespace',
      },
      pgvector: {
        minScore: 0.8,
        ef: 100,
      },
      chroma: {
        where: { category: 'documents' },
      },
    };

    const tool = createVectorQueryTool({
      vectorStoreName: 'multidb',
      indexName: 'testIndex',
      model: mockModel,
      databaseConfig,
    });

    const requestContext = new RequestContext();

    await tool.execute(
      {
        queryText: 'test query',
        topK: 5,
      },
      {
        mastra: mockMastra as any,
        requestContext,
      },
    );

    expect(vectorQuerySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseConfig,
      }),
    );
  });
});
