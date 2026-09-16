import type { CaseStore } from "../lib/case-store";
import { providerRegistry } from "../providers/registry";

/** Reconciles signed close hints with a fresh provider GET. It never sends a
 * note, reply, or close: the only provider call in this worker is read-only. */
export async function recoverIntercomCloseIntents(
  store: CaseStore,
  limit = 10,
) {
  const intents = await store.claimIntercomCloseIntents(limit);
  for (const intent of intents) {
    try {
      const snapshot = await store.conversationSnapshot(
        intent.tenantId,
        intent.externalConversationId,
        "intercom",
        intent.providerAccountId,
      );
      if (!snapshot) {
        await store.completeIntercomCloseIntent(
          intent.id,
          intent.leaseToken,
          "superseded",
        );
        continue;
      }
      const { supportCase, version } = snapshot;
      const binding = supportCase.metadata.providerBindings?.support;
      if (
        !binding ||
        binding.providerKind !== "intercom" ||
        binding.tenantId !== intent.tenantId ||
        binding.providerAccountId !== intent.providerAccountId ||
        binding.externalConversationId !== intent.externalConversationId
      ) {
        await store.completeIntercomCloseIntent(
          intent.id,
          intent.leaseToken,
          "superseded",
        );
        continue;
      }
      // Capture the exact local revision before the remote read. A customer
      // follow-up during that GET increments it and makes the later CAS lose.
      const support = providerRegistry(binding).support(binding);
      if (!support.currentConversationState)
        throw new Error(
          "Configured support provider cannot verify conversation state.",
        );
      const current = await support.currentConversationState(binding);
      if (
        current.id !== binding.externalConversationId ||
        current.state !== "closed"
      ) {
        await store.completeIntercomCloseIntent(
          intent.id,
          intent.leaseToken,
          "superseded",
        );
        continue;
      }
      const outcome = await store.applyIntercomClose({
        intentId: intent.id,
        leaseToken: intent.leaseToken,
        tenantId: intent.tenantId,
        providerAccountId: intent.providerAccountId,
        externalConversationId: intent.externalConversationId,
        expectedVersion: version,
      });
      if (outcome === "retry")
        await store.deferIntercomCloseIntent(
          intent.id,
          intent.leaseToken,
          "The case changed while the provider conversation was read.",
        );
    } catch (error) {
      await store.deferIntercomCloseIntent(
        intent.id,
        intent.leaseToken,
        error instanceof Error
          ? error.message
          : "Provider close recovery failed.",
      );
    }
  }
  return intents.length;
}
