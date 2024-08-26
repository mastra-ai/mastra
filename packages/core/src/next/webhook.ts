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
    const { data, error, success } = params;

    if (error) {
      return NextResponse.json({ error, status: 400 });
    }

    const decodedEvent = decodeURI(data?.event);

    console.log(`webhook event: ${decodedEvent} from ${data?.name}`);

    const body = req.body;

    const integration = framework.getIntegration(data?.name);

    const dataLayer = integration?.dataLayer;

    const connectionsBySubscriptionId = async (subscriptionId: string) => {
      const subscriptions = await dataLayer?.getConnectionsBySubscriptionId({
        subscriptionId,
      });
      return subscriptions ?? [];
    };

    void integration?.processWebhookRequest({
      reqBody: body,
      event: decodedEvent,
      connectionsBySubscriptionId,
    });

    return NextResponse.json({ message: 'acknowledged' });
  };
};
