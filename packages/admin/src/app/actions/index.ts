'use server';

import { framework } from '@/lib/framework-utils';

export async function getReferenceIds() {
  const uniqueReferenceId = await framework?.dataLayer.db.connection.findMany({
    distinct: ['referenceId'],
    select: {
      referenceId: true,
    },
  });

  return uniqueReferenceId;
}
