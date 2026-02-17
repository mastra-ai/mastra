import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { vectorStore, PDF_INDEX_NAME } from "../lib/vector-store";

export const listDocumentsTool = createTool({
  id: "list-documents",
  description: `List all indexed PDF documents available for quizzing.
Use this tool when:
- The user asks what documents/books are available
- You need to know which documents exist before quizzing
- The user wants to quiz but hasn't specified which document`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      // Query vectors to find unique documents
      const embeddingModel = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");
      const { embeddings } = await embeddingModel.doEmbed({ values: ["document"] });

      const results = await vectorStore.query({
        indexName: PDF_INDEX_NAME,
        queryVector: embeddings[0],
        topK: 1000,
      });

      // Extract unique documents from metadata
      const documentsMap = new Map<string, {
        documentId: string;
        title: string;
        totalPages: number;
      }>();

      for (const result of results) {
        const docId = result.metadata?.documentId as string;
        if (docId && !documentsMap.has(docId)) {
          documentsMap.set(docId, {
            documentId: docId,
            title: (result.metadata?.documentTitle as string) || "Untitled",
            totalPages: (result.metadata?.totalPages as number) || 0,
          });
        }
      }

      const documents = Array.from(documentsMap.values());

      if (documents.length === 0) {
        return {
          documents: [],
          message: "No documents have been indexed yet. Use the index-pdf workflow to add a PDF.",
        };
      }

      return {
        documents,
        count: documents.length,
      };
    } catch {
      return {
        documents: [],
        message: "Could not retrieve documents. The vector index may not exist yet.",
      };
    }
  },
});
