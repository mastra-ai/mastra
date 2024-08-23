import { NextRequest, NextResponse } from 'next/server';
import { Framework } from '../framework';
import { parseQueryParams } from './utils';
import { webhookQueryParams } from '../schemas';
import { z } from 'zod';

export const makeWebhook = (framework: Framework) => {
  return (req: NextRequest) => {
    const params = parseQueryParams<z.infer<typeof webhookQueryParams>>(
      req,
      webhookQueryParams
    );
    const {
      data: { event, name },
      error,
      success,
    } = params;

    const body = req.body;

    const integration = framework.getIntegration({ name });

    if (!success) {
      return NextResponse.json({ error, status: 400 });
    }

    const dataLayer = integration?.dataLayer;

    const connectionsBySubscriptionId = async (subscriptionId: string) => {
      const subscriptions = await dataLayer?.getConnectionsBySubscriptionId({
        subscriptionId,
      });
      return subscriptions ?? [];
    };

    void integration?.processWebhookRequest({
      reqBody: body,
      event: decodeURI(event),
      connectionsBySubscriptionId,
    });

    return NextResponse.json({ message: 'acknowledged' });
  };
};
