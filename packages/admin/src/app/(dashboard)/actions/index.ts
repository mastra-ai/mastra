'use server';

import { framework } from '@/lib/framework-utils';

export async function getReferenceIds(
  { integrationName }: { integrationName: string } | undefined = { integrationName: '' },
) {
  const uniqueReferenceId = await framework?.dataLayer.db.connection.findMany({
    distinct: ['referenceId'],
    where: {
      ...(integrationName ? { name: integrationName.toUpperCase() } : {}),
    },
    select: {
      referenceId: true,
    },
  });

  return uniqueReferenceId;
}

export async function getFrameworkConfigName() {
  return framework?.config?.name;
}
