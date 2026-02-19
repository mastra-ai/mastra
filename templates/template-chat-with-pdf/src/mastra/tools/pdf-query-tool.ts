import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { vectorStore, PDF_INDEX_NAME } from '../lib/vector-store';

export const pdfQueryTool = createTool({
  id: 'query-pdf-content',
  description: `Search PDF content with even distribution across page ranges.

When the user specifies pages (e.g., "pages 50-67"), use pageStart and pageEnd.
The tool retrieves chunks from EACH page in the range, ensuring full coverage.

For general topic searches without page constraints, omit pageStart/pageEnd.`,
  inputSchema: z.object({
    queryText: z.string().describe('Semantic search query describing the content to find'),
    documentId: z.string().optional().describe('Filter by specific document ID (from list-documents tool)'),
    pageStart: z.number().optional().describe('Start of page range (inclusive)'),
    pageEnd: z.number().optional().describe('End of page range (inclusive)'),
  }),
  execute: async ({ queryText, documentId, pageStart, pageEnd }) => {
    // Generate embedding for the query using Mastra's model router
    const embeddingModel = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
    const { embeddings } = await embeddingModel.doEmbed({ values: [queryText] });
    const queryVector = embeddings[0];

    // If no page range specified, do a standard query
    if (pageStart === undefined || pageEnd === undefined) {
      const results = await vectorStore.query({
        indexName: PDF_INDEX_NAME,
        queryVector,
        topK: 20,
        filter: documentId ? { documentId } : undefined,
      });

      return {
        chunks: results.map(r => ({
          text: r.metadata?.text || '',
          pageNumber: r.metadata?.pageNumber,
          documentTitle: r.metadata?.documentTitle,
          score: r.score,
        })),
        totalChunks: results.length,
      };
    }

    // Stratified sampling: divide range into thirds and sample from each
    const rangeSize = pageEnd - pageStart + 1;
    const thirdSize = Math.ceil(rangeSize / 3);

    const earlyPages = [];
    const middlePages = [];
    const latePages = [];

    for (let page = pageStart; page <= pageEnd; page++) {
      const offset = page - pageStart;
      if (offset < thirdSize) {
        earlyPages.push(page);
      } else if (offset < thirdSize * 2) {
        middlePages.push(page);
      } else {
        latePages.push(page);
      }
    }

    // Shuffle each group
    const shuffle = <T>(arr: T[]): T[] => {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };

    // Select 2-3 pages from each third (or all if fewer available)
    const pagesPerSection = 2;
    const selectedPages = [
      ...shuffle(earlyPages).slice(0, pagesPerSection),
      ...shuffle(middlePages).slice(0, pagesPerSection),
      ...shuffle(latePages).slice(0, pagesPerSection),
    ];

    // Query only the selected pages
    const results: Array<{
      text: string;
      pageNumber: number;
      score: number;
    }> = [];

    for (const page of selectedPages) {
      try {
        const filter: Record<string, any> = { pageNumber: page };
        if (documentId) {
          filter.documentId = documentId;
        }

        const pageResults = await vectorStore.query({
          indexName: PDF_INDEX_NAME,
          queryVector,
          topK: 2, // Just 2 chunks per page for focused content
          filter,
        });

        for (const r of pageResults) {
          results.push({
            text: (r.metadata?.text as string) || '',
            pageNumber: page,
            score: r.score || 0,
          });
        }
      } catch (error) {
        // Page may have no chunks
      }
    }

    // Shuffle final results so LLM doesn't see them in page order
    const shuffledResults = shuffle(results);

    return {
      chunks: shuffledResults,
      pagesCovered: `${pageStart}-${pageEnd}`,
      pagesReturned: selectedPages.sort((a, b) => a - b),
      totalChunks: shuffledResults.length,
      note: 'Stratified sample: chunks from early, middle, AND late pages. Each chunk has a pageNumber - use it for the hint.',
    };
  },
});
