'use server';

import type { IntegrationActionExcutorParams } from '@arkw/core';

import { getFramework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  action: string;
  payload: IntegrationActionExcutorParams<any>;
}

export async function executeFrameworkAction(props: Props): Promise<void> {
  const framework = await getFramework();

  if (!framework) {
    throw new Error('Framework not found');
  }

  await framework.executeAction(props);
}
