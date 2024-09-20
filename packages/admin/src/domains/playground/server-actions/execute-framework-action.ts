'use server';

import type { IntegrationApiExcutorParams } from '@kpl/core';

import { getErrorMessage } from '@/lib/error';
import { framework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  api: string;
  payload: IntegrationApiExcutorParams<any>;
}

export async function executeFrameworkApi(props: Props) {
  if (!framework) {
    throw new Error('Framework not found');
  }

  try {
    const res = await framework.executeApi(props);

    if (res instanceof Response) {
      return { ok: true, data: await res.json() };
    }

    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
