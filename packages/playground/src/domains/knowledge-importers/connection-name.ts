import type { KnowledgeImporterSummary } from '@mastra/client-js';

const tail = (connectionId: string) => `…${connectionId.slice(-6)}`;

/** True when another entry of the same provider shows the same account name. */
function sharesAccountName(summary: KnowledgeImporterSummary, summaries: readonly KnowledgeImporterSummary[]) {
  return summaries.some(
    other =>
      other.key !== summary.key &&
      other.importerId === summary.importerId &&
      other.connection.accountName === summary.connection.accountName,
  );
}

/** "Mastra", or "Mastra · …948KS" when another connection of the provider has the same account name. */
export function accountLabel(summary: KnowledgeImporterSummary, summaries: readonly KnowledgeImporterSummary[]) {
  const { id, accountName } = summary.connection;
  if (!accountName) return tail(id);
  return sharesAccountName(summary, summaries) ? `${accountName} · ${tail(id)}` : accountName;
}

/** The account half of a detail title: "Mastra (…948KS)", or "Acme workspace" when the name is unique. */
export function entryAccount(summary: KnowledgeImporterSummary, summaries: readonly KnowledgeImporterSummary[]) {
  const { id, accountName } = summary.connection;
  if (!accountName) return tail(id);
  return sharesAccountName(summary, summaries) ? `${accountName} (${tail(id)})` : accountName;
}
