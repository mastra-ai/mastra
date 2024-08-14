import { getConfig } from '@/lib/get-configuration';

import { createColumnDef } from '@/domains/records/columns/column-def';
import { RecordTable } from '@/domains/records/record-table';

export default async function Integration({ params }: { params: { integration: string } }) {
  const config = await getConfig();
  const integrationConfig = config.integrations.find(config => config.name.toLowerCase() === params.integration);
  const fields = integrationConfig?.displayConfig.gridView.fields;

  let cols = {};

  if (fields) {
    cols = createColumnDef({ fields });
  }

  return (
    <section>
      <h1 className="text-sm gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {params.integration}
      </h1>
      <RecordTable columns={fields!} data={[]} />
    </section>
  );
}
