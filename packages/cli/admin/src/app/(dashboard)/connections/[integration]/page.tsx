import ConnectionsTable from '@/domains/connections/components/connections-table';
import { IndividualIntegrationHeader } from '@/domains/integrations/components/individual-integration-header';

export default async function Page(props: { params: Promise<{ integration: string }> }) {
  const params = await props.params;
  const integrationName = params.integration.toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <IndividualIntegrationHeader name={integrationName} />
      </div>
      <ConnectionsTable integrationName={integrationName} />
    </div>
  );
}
