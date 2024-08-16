import { NextRequest, NextResponse } from 'next/server';
import { IntegrationFramework } from '..';
import { parseQueryParams } from './utils';
import { webhookQueryParams } from '../schemas';
import { z } from 'zod';

export const makeWebhook = (framework: IntegrationFramework) => {
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

    const pluginInstance = framework.getPlugin(name);

    if (!success) {
      return NextResponse.json({ error, status: 400 });
    }

    const dataLayer = pluginInstance?.dataLayer;

    const dataIntegrationsBySubscriptionId = async (subscriptionId: string) => {
      const subscriptions =
        await dataLayer?.getDataIntegrationsBySubscriptionId({
          subscriptionId,
        });
      return subscriptions ?? [];
    };

    void pluginInstance?.processWebhookRequest({
      reqBody: body,
      event,
      dataIntegrationsBySubscriptionId,
    });

    return NextResponse.json({ message: 'acknowledged' });
  };
};
