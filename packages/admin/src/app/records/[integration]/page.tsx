import { getConfig } from '@/lib/get-configuration';

import { ClientLayout } from './client-layout';

export default async function Integration({ params }: { params: { integration: string } }) {
  const config = await getConfig();
  const integrationConfig = config.integrations.find(config => config.name.toLowerCase() === params.integration);
  const fields = integrationConfig?.displayConfig.gridView.fields;
  const data = integrationConfig?.displayConfig.gridView.data;

  return <ClientLayout integration={params.integration} fields={fields!} data={data!} />;
}
