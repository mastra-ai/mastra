import { IntegrationMap } from '@arkw/core';

import { redirect } from 'next/navigation';

import { framework } from '@/lib/framework-utils';

export default async function Integration({ params }: { params: { integration: string } }) {
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
  //   referenceId: `1`,
  //   entityType: 'CONTACTS',
  //   filters: {
  //     'data.email': {
  //       contains: 'mail',
  //     },
  //   },
  //   sort: ['asc(createdAt)', 'desc(updatedAt)'],
  // });

  return null;
}
