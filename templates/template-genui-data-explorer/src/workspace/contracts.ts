import { z } from "zod";
import { sourceDescriptorSchema } from "../../data-sources/source.ts";
import { verifiedResultSchema } from "../analysis/contracts.ts";
import { componentSchema } from "../ui/catalog.ts";

export const workspaceSchema = z.strictObject({
  id: z.string().min(1).max(128),
  threadId: z.string().min(1).max(128),
  revision: z.number().int().nonnegative(),
  source: sourceDescriptorSchema,
  results: z.array(verifiedResultSchema),
  components: z.array(componentSchema),
  cardTurns: z.record(z.string(), z.string()).optional(),
  drillBack: z
    .record(
      z.string(),
      z.strictObject({
        binding: componentSchema,
        result: verifiedResultSchema,
        filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      }),
    )
    .optional(),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  drill: z.string().optional(),
  corrections: z
    .array(
      z.strictObject({
        componentId: z.string(),
        requestId: z.string(),
        reason: z.string().min(1).max(300),
      }),
    )
    .optional(),
  messages: z.array(
    z.strictObject({ id: z.string(), role: z.enum(["user", "assistant"]), content: z.string() }),
  ),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export function overviewFor(workspace: Workspace, componentId: string) {
  const entries = workspace.drillBack;
  return entries && Object.hasOwn(entries, componentId) ? entries[componentId] : undefined;
}
export function savedCardTurn(workspace: Workspace, componentId: string) {
  const turns = workspace.cardTurns;
  if (turns && Object.hasOwn(turns, componentId)) return turns[componentId];
  const binding = workspace.components.find((item) => item.id === componentId);
  return workspace.results.find((item) => item.resultId === binding?.resultId)?.requestId;
}
export const workspaceId = "local-workspace";
export const threadId = "local-thread";
export const actionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("dismiss"), componentId: z.string().min(1).max(128) }),
  z.strictObject({ type: z.literal("back"), componentId: z.string().min(1).max(128) }),
  z.strictObject({
    type: z.literal("filter"),
    componentId: z.string(),
    field: z.enum(["segment", "region", "ownerId", "stage"]),
    value: z.union([z.string(), z.number()]).optional(),
  }),
  z.strictObject({ type: z.literal("drill"), componentId: z.string(), label: z.string() }),
  z.strictObject({
    type: z.literal("compare"),
    componentId: z.string(),
    segment: z.enum(["SMB", "Mid-market", "Enterprise"]),
  }),
]);
export type WorkspaceAction = z.infer<typeof actionSchema>;
export const correctionSchema = z.strictObject({
  componentId: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(300),
});
export type Correction = z.infer<typeof correctionSchema>;
export const renderAckSchema = z.strictObject({
  revision: z.number().int().positive(),
  resultId: z.string().min(1).max(128),
  componentId: z.string().min(1).max(128),
});
export const requestProperties = z.strictObject({
  baseRevision: z.number().int().nonnegative(),
  action: actionSchema.optional(),
  correction: correctionSchema.optional(),
});
export interface WorkspaceSnapshot {
  lastRequest?: { question: string; requestId: string } | undefined;
  catalog?: { id: string; version: string; defaults: { pageSize: number } }[] | undefined;
  workspace: Workspace;
  status: "saved" | "working" | "incomplete" | "recovery-required";
  message: string;
}
