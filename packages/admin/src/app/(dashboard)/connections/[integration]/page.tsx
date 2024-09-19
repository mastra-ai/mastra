import { IndividualIntegrationHeader } from '@/domains/integrations/components/individual-integration-header';

export default function Page({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <IndividualIntegrationHeader name={integrationName} />
      </div>
    </div>
  );
}
