'use server';

import type { IntegrationApiExcutorParams } from '@mastra/core';

import { getErrorMessage } from '@/lib/error';
import { framework } from '@/lib/framework-utils';

interface Props {
  integrationName?: string;
  api: string;
  payload: IntegrationApiExcutorParams<any>;
}

export async function callFrameworkApi(props: Props) {
  if (!framework) {
    throw new Error('Framework not found');
  }

  try {
    const {
      data,
      error,
      response: { ok, ...res },
      request,
    } = await framework.callApi(props);

    console.log({
      data,
      error,
      res,
      request,
    });

    if (ok) {
      return { ok: true, data };
    } else {
      return { ok: false, error };
    }
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
