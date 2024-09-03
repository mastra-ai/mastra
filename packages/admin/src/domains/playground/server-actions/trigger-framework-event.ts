'use server';

import { framework } from '@/lib/framework-utils';

interface Props {
  eventKey: string;
  referenceId: string;
  payload: unknown;
  integrationName: string;
}

export async function triggerFrameworkEvent({ eventKey, payload, referenceId, integrationName }: Props): Promise<void> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  await framework.sendEvent({
    integrationName,
    key: eventKey,
    data: payload,
    user: {
      referenceId,
    },
  });
}
