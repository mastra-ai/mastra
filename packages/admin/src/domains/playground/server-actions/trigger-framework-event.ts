'use server';

import { getErrorMessage } from '@/lib/error';
import { framework } from '@/lib/framework-utils';

interface Props {
  eventKey: string;
  referenceId: string;
  payload: unknown;
  integrationName: string;
}

export async function triggerFrameworkEvent({ eventKey, payload, referenceId, integrationName }: Props): Promise<
  | {
      ok: true;
      data: { event: any; workflowEvent?: any };
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
    const res = await framework.sendEvent({
      integrationName,
      key: eventKey,
      data: payload,
      user: {
        referenceId,
      },
    });
    return { ok: true, data: res };
  } catch (e) {
    //TODO: resend proper event errors
    return { ok: false, error: getErrorMessage(e) };
  }
}
