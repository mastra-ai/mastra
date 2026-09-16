import { z } from "zod";
import { type SupportCase } from "../domain/support-case";
import { caseStore } from "../lib/case-store";

export const resolveSupportCaseInputSchema = z.object({
  caseId: z.string(),
  turnId: z.string(),
});

export type ResolveSupportCaseInput = z.infer<
  typeof resolveSupportCaseInputSchema
>;

/** Reads the current durable turn and verified owner once per stage. */
export async function getActiveCaseOrThrow(caseId: string, turnId: string) {
  const supportCase = await caseStore.get(caseId);
  if (!supportCase) throw new Error(`Support case not found: ${caseId}`);
  if (supportCase.metadata.activeTurnId !== turnId)
    throw new Error(
      "Workflow turn is no longer the active durable projection.",
    );
  const turn = await caseStore.turn(caseId, turnId);
  if (!turn?.message)
    throw new Error("Workflow turn is missing its immutable customer message.");
  const ownerId = supportCase.metadata.ownerId;
  if (typeof ownerId !== "string" || !ownerId)
    throw new Error("Workflow case has no verified owner binding.");
  return { supportCase: supportCase as SupportCase, turn, ownerId };
}
