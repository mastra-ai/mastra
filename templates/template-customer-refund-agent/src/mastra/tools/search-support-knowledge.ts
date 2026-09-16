import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveConfiguredBinding } from "../providers/registry";
import { knowledgePublicationStore } from "../lib/knowledge-publications";
import { searchPublishedVector } from "../lib/vector-store";
import { caseStore } from "../lib/case-store";
import { bindingsForCase } from "../providers/contracts";
import { requireTrustedCaseReadScope } from "../lib/trusted-run-scope";
import { traceOperationalPort } from "../lib/operational-spans";
import { validationExecutionFromRequestContext } from "../lib/eval-budget";

const bindingSchema = z.object({
  tenantId: z.string(),
  providerKind: z.literal("local"),
  providerAccountId: z.string(),
  externalConversationId: z.string(),
});

/** Provider-backed lookup keeps case knowledge binding independent of vectors. */
export const searchSupportKnowledgeTool = createTool({
  id: "search_support_knowledge",
  description:
    "Search policy evidence through the case-persisted knowledge port.",
  inputSchema: z.object({
    queryText: z.string().min(1),
    topK: z.number().int().min(1).max(20).default(5),
    binding: bindingSchema.optional(),
  }),
  outputSchema: z.object({
    sources: z.array(
      z.object({
        document: z.string(),
        score: z.number(),
        metadata: z.object({
          title: z.string(),
          source: z.string(),
          text: z.string(),
          version: z.string(),
          documentHash: z.string(),
          generationId: z.string(),
          effectiveAt: z.string(),
          indexedAt: z.string(),
          expiresAt: z.string().optional(),
          providerKind: z.string(),
          providerAccountId: z.string(),
        }),
      }),
    ),
  }),
  execute: async ({ queryText, topK, binding }, context) => {
    const scope = requireTrustedCaseReadScope();
    const supportCase = await caseStore.get(scope.caseId);
    if (!supportCase)
      throw new Error(
        "Knowledge read scope references a missing support case.",
      );
    const ownerId = supportCase.metadata.ownerId;
    const configured = resolveConfiguredBinding(
      bindingsForCase(supportCase).knowledge,
    );
    if (ownerId !== scope.ownerId || configured.tenantId !== scope.tenantId)
      throw new Error("Knowledge read scope does not match the durable case.");
    if (
      binding &&
      (binding.tenantId !== configured.tenantId ||
        binding.providerKind !== configured.providerKind ||
        binding.providerAccountId !== configured.providerAccountId ||
        binding.externalConversationId !== configured.externalConversationId)
    )
      throw new Error(
        "Knowledge lookup binding does not match the durable case.",
      );
    // Search is never an initialization path. Publication/fixture changes are
    // explicit trusted operations, and an unpublished account is insufficient
    // evidence rather than a reason for an ordinary read to mutate state.
    const lexicalEvidence = await traceOperationalPort({
      mastra: context?.mastra,
      tracingContext: context?.tracingContext,
      kind: "provider",
      operation: "knowledge.search",
      run: () => knowledgePublicationStore.search(configured, queryText, topK),
    });
    const generationId =
      await knowledgePublicationStore.activeGeneration(configured);
    const evidence =
      process.env.SUPPORT_KNOWLEDGE_RETRIEVAL === "vector" && generationId
        ? await traceOperationalPort({
            mastra: context?.mastra,
            tracingContext: context?.tracingContext,
            kind: "provider",
            operation: "knowledge.vector_search",
            run: () =>
              searchPublishedVector(
                configured,
                generationId,
                queryText,
                topK,
                validationExecutionFromRequestContext(context?.requestContext),
              ),
          })
        : lexicalEvidence;
    return {
      sources: evidence.map((entry) => ({
        document: entry.text,
        score: entry.score,
        metadata: {
          title: entry.title,
          source: entry.source,
          text: entry.text,
          version: entry.version,
          documentHash: entry.documentHash,
          generationId: entry.generationId,
          effectiveAt: entry.effectiveAt,
          indexedAt: entry.indexedAt,
          expiresAt: entry.expiresAt,
          providerKind: entry.providerKind,
          providerAccountId: entry.providerAccountId,
        },
      })),
    };
  },
});
