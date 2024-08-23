'use server';

import { framework } from '@/lib/framework-utils';

interface Props {
  eventKey: string;
  referenceId: string;
  payload: unknown;
}

export async function triggerFrameworkEvent({ eventKey, payload, referenceId }: Props): Promise<void> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  await framework.triggerSystemEvent({
    key: eventKey,
    data: payload,
    user: {
      referenceId,
    },
  });
}
