import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { isConnected } from '../status';
import { ImporterHeader } from './importer-header';
import { ImporterWorkspace } from './importer-workspace';
import { RunHistory } from './run-history';

export function ImporterDetail({ summary }: { summary: KnowledgeImporterSummary }) {
  return (
    <section aria-labelledby="importer-detail-title" className="flex flex-col gap-6">
      {isConnected(summary) ? <ImporterWorkspace summary={summary} /> : <NotConnected summary={summary} />}
    </section>
  );
}

function NotConnected({ summary }: { summary: KnowledgeImporterSummary }) {
  return (
    <>
      <ImporterHeader summary={summary} />
      <Notice variant="info" title="Not connected to this project">
        <Notice.Message>
          Connect {summary.label} on the Mastra Platform, then link that connection to this project. Settings and
          imports unlock once it's linked.
        </Notice.Message>
      </Notice>
      {summary.lastRun ? (
        <SectionCard title="Activity">
          <RunHistory importerId={summary.importerId} />
        </SectionCard>
      ) : null}
    </>
  );
}
