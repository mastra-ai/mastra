'use server';

import type { IntegrationActionExcutorParams } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  action: string;
  payload: IntegrationActionExcutorParams<any>;
}

export async function triggerFrameworkEvent(props: Props): Promise<void> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  // await framework.sendEvent(props);
}
