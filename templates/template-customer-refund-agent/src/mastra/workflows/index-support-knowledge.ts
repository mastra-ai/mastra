import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { publishKnowledge } from "../lib/publish-knowledge";
import { createValidationBudgetExecution } from "../lib/eval-budget";

const validationSchema = z.object({ mode: z.literal("sandbox") });

const chunkAndEmbedStep = createStep({
  id: "chunk-and-embed-docs",
  description:
    "Chunk each policy document and embed the chunks with the Gateway embedding model.",
  inputSchema: z.object({
    binding: z.object({
      tenantId: z.string().min(1),
      providerKind: z.enum(["local", "intercom", "stripe"]),
      providerAccountId: z.string().min(1),
      externalConversationId: z.string().min(1),
    }),
    validation: validationSchema.optional(),
  }),
  outputSchema: z.object({ indexed: z.number(), generationId: z.string() }),
  execute: async ({ inputData, mastra, tracingContext }) => {
    if (!mastra)
      throw new Error(
        "Knowledge indexing must run through a registered Mastra instance.",
      );
    const candidate = await publishKnowledge(inputData.binding, {
      mastra,
      tracingContext,
      validationExecution: inputData.validation
        ? createValidationBudgetExecution(inputData.validation.mode)
        : undefined,
    });
    return candidate;
  },
});

export const indexSupportKnowledgeWorkflow = createWorkflow({
  id: "index-support-knowledge",
  description:
    "Chunks and embeds the refund/shipping/subscription/escalation policy docs into the vector store.",
  inputSchema: z.object({
    binding: z.object({
      tenantId: z.string().min(1),
      providerKind: z.enum(["local", "intercom", "stripe"]),
      providerAccountId: z.string().min(1),
      externalConversationId: z.string().min(1),
    }),
    validation: validationSchema.optional(),
  }),
  outputSchema: z.object({ indexed: z.number(), generationId: z.string() }),
})
  .then(chunkAndEmbedStep)
  .commit();
