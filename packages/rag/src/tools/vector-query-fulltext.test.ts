/**
 * Unit tests for Issue #10453: Full-text and hybrid search support in RAG vector query tool
 *
 * Tests that createVectorQueryTool correctly passes searchMode, hybridConfig,
 * and queryText through to vectorQuerySearch.
 */
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { vectorQuerySearch } from '../utils';
import { createVectorQueryTool } from './vector-query';

vi.mock('../utils', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    vectorQuerySearch: vi.fn().mockResolvedValue({
      results: [
        { id: '1', metadata: { text: 'PostgreSQL database' }, score: 0.95 },
        { id: '2', metadata: { text: 'MongoDB database' }, score: 0.8 },
      ],
    }),
  };
});

describe('createVectorQueryTool — Full-Text & Hybrid Search (Issue #10453)', () => {
  const mockModel = { name: 'test-model', specificationVersion: 'v2' } as any;
  const mockMastra = {
    getVector: vi.fn(() => ({ id: 'mockStore' })),
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchMode option on tool creation', () => {
    it('should accept searchMode option in tool configuration', () => {
      // The tool should accept a searchMode option that determines the search strategy
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        searchMode: 'hybrid',
      });

      expect(tool).toBeDefined();
      expect(tool.id).toBeDefined();
    });

    it('should pass searchMode to vectorQuerySearch', async () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        searchMode: 'hybrid',
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'PostgreSQL database', topK: 5 }, { mastra: mockMastra as any, requestContext });

      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchMode: 'hybrid',
          queryText: 'PostgreSQL database',
        }),
      );
    });

    it('should pass searchMode: fulltext to vectorQuerySearch', async () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        searchMode: 'fulltext',
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'PostgreSQL', topK: 10 }, { mastra: mockMastra as any, requestContext });

      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchMode: 'fulltext',
          queryText: 'PostgreSQL',
        }),
      );
    });

    it('should default to vector search mode when not specified', async () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'test query', topK: 5 }, { mastra: mockMastra as any, requestContext });

      // searchMode should either be undefined (backward compat) or 'vector'
      const call = vi.mocked(vectorQuerySearch).mock.calls[0]?.[0];
      expect(call?.searchMode === undefined || call?.searchMode === 'vector').toBe(true);
    });
  });

  describe('hybridConfig option', () => {
    it('should pass hybridConfig to vectorQuerySearch', async () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        searchMode: 'hybrid',
        hybridConfig: { semanticWeight: 0.7, keywordWeight: 0.3 },
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'database', topK: 5 }, { mastra: mockMastra as any, requestContext });

      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchMode: 'hybrid',
          hybridConfig: { semanticWeight: 0.7, keywordWeight: 0.3 },
        }),
      );
    });
  });

  describe('requestContext override for searchMode', () => {
    it('should allow requestContext to override searchMode', async () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        searchMode: 'vector',
      });

      const requestContext = new RequestContext();
      requestContext.set('searchMode', 'hybrid');
      requestContext.set('hybridConfig', { semanticWeight: 0.5, keywordWeight: 0.5 });

      await tool.execute({ queryText: 'test query', topK: 5 }, { mastra: mockMastra as any, requestContext });

      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchMode: 'hybrid',
          hybridConfig: { semanticWeight: 0.5, keywordWeight: 0.5 },
        }),
      );
    });
  });
});
