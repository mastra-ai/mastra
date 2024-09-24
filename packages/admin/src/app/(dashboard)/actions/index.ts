'use server';

import { framework } from '@/lib/framework-utils';

export async function getConnectionIds(
  { integrationName }: { integrationName: string } | undefined = { integrationName: '' },
) {
  const uniqueConnectionId = await framework?.dataLayer.db.connection.findMany({
    distinct: ['connectionId'],
    where: {
      ...(integrationName ? { name: integrationName.toUpperCase() } : {}),
    },
    select: {
      connectionId: true,
    },
  });

  return uniqueConnectionId;
}

export async function getFrameworkConfigName() {
  return framework?.config?.name;
}
