'use server';

import type { IntegrationApiExcutorParams } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  api: string;
  payload: IntegrationApiExcutorParams<any>;
}

export async function executeFrameworkApi(props: Props): Promise<void> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  await framework.executeApi(props);
}
