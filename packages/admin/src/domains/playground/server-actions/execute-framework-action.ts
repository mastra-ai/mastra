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
    const apiRes = await framework.callApi(props);

    if (!apiRes?.response?.ok) {
      return { ok: true, data: apiRes };
    }

    const {
      data,
      error,
      response: { ok, ...res },
      request,
    } = apiRes;

    if (ok) {
      return { ok: true, data };
    } else {
      return { ok: false, error };
    }
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
