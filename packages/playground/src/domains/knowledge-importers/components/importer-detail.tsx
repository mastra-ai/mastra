import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { ImporterWorkspace } from './importer-workspace';

export function ImporterDetail({ summary }: { summary: KnowledgeImporterSummary }) {
  return (
    <section aria-labelledby="importer-detail-title" className="flex flex-col gap-6">
      <ImporterWorkspace summary={summary} />
    </section>
  );
}
