import { redirect } from 'next/navigation';

import { framework } from '@/lib/framework-utils';

export default async function Integration({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase();
  const integration = framework?.getIntegration(integrationName);

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  const indexEntityType = Object.values(integration.entityTypes)[0];

  if (indexEntityType) {
    redirect(`/records/${integrationName.toLowerCase()}/${indexEntityType.toLowerCase()}`);
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

  // console.log({ recordData });

  return null;
}
