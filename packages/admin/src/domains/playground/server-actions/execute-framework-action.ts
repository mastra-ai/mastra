'use server';

import type { IntegrationApiExcutorParams } from '@kpl/core';

import { framework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  api: string;
  payload: IntegrationApiExcutorParams;
}

export async function executeFrameworkApi(props: Props): Promise<any> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  try {
    const res = await framework.executeApi(props);
    return res;
  } catch (e) {
    //TODO: resend proper api errors
    throw new Error(`Could not execute api: ${(e as any).message}`);
  }
}
