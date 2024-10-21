import { IntegrationMap } from '@mastra/core';

import { redirect } from 'next/navigation';

import { framework } from '@/lib/framework-utils';

export default async function Integration(props: { params: Promise<{ integration: string }> }) {
  const params = await props.params;
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const integration = framework?.getIntegration(String(integrationName));

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  const indexEntityType = Object.values(integration.entityTypes)[0];

  if (indexEntityType) {
    redirect(`/records/${String(integrationName).toLowerCase()}/${indexEntityType.toLowerCase()}`);
  }

  // usage
  // const recordData = await future.getIntegration(params.integration.toUpperCase())?.query({
  //   connectionId: `1`,
  //   entityType: 'CONTACTS',
  //   filters: {
  //     'data.email': {
  //       contains: 'mail',
  //     },
  //   },
  //   sort: ['asc(createdAt)', 'desc(updatedAt)'],
  // });

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {params.integration}
      </h1>
    </section>
  );
}
