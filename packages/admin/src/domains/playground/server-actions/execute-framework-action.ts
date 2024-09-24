'use server';

import type { IntegrationApiExcutorParams } from '@kpl/core';

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
    console.log(JSON.stringify(props, null, 2));
    const res = await framework.callApi(props);
    console.log({
      res,
    });
    const data = await res?.json();

    if (res instanceof Response) {
      if (res.ok) {
        return { ok: true, data };
      } else {
        return { ok: false, error: data };
      }
    }

    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
