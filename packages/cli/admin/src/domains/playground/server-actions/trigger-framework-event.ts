'use server';

import { stringify } from 'superjson';

import { getErrorMessage } from '@/lib/error';
import { framework } from '@/lib/framework-utils';

interface Props {
  eventKey: string;
  connectionId: string;
  payload: unknown;
  integrationName: string;
}

export async function triggerFrameworkEvent({ eventKey, payload, connectionId, integrationName }: Props): Promise<
  | {
      ok: true;
      data: string;
    }
  | {
      ok: false;
      error: unknown;
    }
> {
  if (!framework) {
    throw new Error('Framework not found');
  }

  try {
    const res = await framework.triggerEvent({
      integrationName,
      key: eventKey,
      data: payload,
      user: {
        connectionId,
      },
    });

    return { ok: true, data: stringify(res) };
  } catch (e) {
    //TODO: resend proper event errors
    return { ok: false, error: getErrorMessage(e) };
  }
}
