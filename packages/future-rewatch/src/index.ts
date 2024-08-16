import {
  DataIntegration,
  IntegrationAction,
  IntegrationAuth,
  IntegrationCredentialType,
  IntegrationPlugin,
  MakeWebhookURL,
} from 'core';
import { z } from 'zod';

import { ATTACH_RECORDING } from './actions/attach-recording';
import { RewatchClient } from './client';
import { REWATCH_INTEGRATION_NAME } from './constants';
import { subscribe } from './events/subscribe';
import { rewatchConnectionOptions, blankSchema, videoUploadedPayload } from './schemas';
import { RewatchWebhookPayload } from './types';

export class RewatchIntegration extends IntegrationPlugin {
  constructor() {
    super({
      name: REWATCH_INTEGRATION_NAME,
      logoUrl: '/images/integrations/rewatch.svg',
      authType: IntegrationCredentialType.API_KEY,
      authConnectionOptions: rewatchConnectionOptions,
    });
  }

  defineEvents() {
    this.events = {
      SUBSCRIBE: {
        key: 'rewatch/subscribe',
        schema: z.object({
          connectionId: z.string(),
        }),
      },
      VIDEO_UPLOADED: {
        key: 'rewatch/video.uploaded',
        schema: videoUploadedPayload,
        triggerProperties: {
          type: 'VIDEO_UPLOADED',
          label: 'Video Uploaded',
          description: 'Triggered whenever Rewatch signals a "video.addedToChannel" webhook event.',
          icon: {
            alt: 'Rewatch Logo',
            icon: '',
          },
          schema: blankSchema,
          outputSchema: videoUploadedPayload,
        },
      },
    };

    return this.events;
  }

  getEventHandlers({ makeWebhookUrl }: { makeWebhookUrl: MakeWebhookURL }) {
    return [
      subscribe({
        name: this.name,
        event: this.getEventKey('SUBSCRIBE'),
        sendEvent: this.sendEvent,
        makeClient: this.makeClient,
        makeWebhookUrl,
        dataAccess: this.dataLayer!,
      }),
    ];
  }

  getActions(): Record<string, IntegrationAction<any>> {
    return {
      ATTACH_RECORDING: ATTACH_RECORDING({
        makeClient: this.makeClient,
        dataAccess: this?.dataLayer!,
        name: this.name,
      }),
    };
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onDataIntegrationCreated: integration => {
        return this.onDataIntegrationCreated({ integration });
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        SCOPES: ['ADMIN'],
      },
    });
  }

  makeClient = async ({ connectionId }: { connectionId: string }) => {
    const authenticator = this.getAuthenticator();

    const integration = await this.dataLayer?.getDataIntegrationByConnectionId({ connectionId, name: this.name });

    if (!integration) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ integrationId: integration?.id });

    return new RewatchClient({
      apiKey: token.apiKey,
      channel: token.channel,
    });
  };

  async onDataIntegrationCreated({ integration }: { integration: DataIntegration }) {
    await this.sendEvent({
      name: this.getEventKey('SUBSCRIBE'),
      data: {
        dataIntegrationId: integration.id,
      },
      user: {
        connectionId: integration.connectionId,
      },
    });
  }

  async onDisconnect({ connectionId }: { connectionId: string }) {
    const client = await this.makeClient({ connectionId });
    const integration = await this.dataLayer?.getDataIntegrationByConnectionId({ connectionId, name: this.name });

    if (!integration) {
      return;
    }

    if (integration.subscriptionId) {
      try {
        await client.unsubscribe(integration.subscriptionId);
      } catch (err) {
        // Silently ignore stale webhooks
        if ((err as Error).message.includes('No object found')) {
          return;
        }

        throw err;
      }
    }
  }

  // async test({connectionId}: {connectionId: string}): Promise<string | null> {
  //   const client = await this.makeClient({connectionId})

  //   let channel;
  //   try {
  //     channel = await client.channel();
  //   } catch (err) {
  //     throw new PluginError('Invalid credential. Cannot resolve user from API Key.');
  //   }

  //   if (channel.subdomain !== credential.channel) {
  //     throw new PluginError(`Invalid credential. Supplied API Key does not belong to channel "${credential.channel}".`);
  //   }

  //   if (channel.user?.channelRole !== 'ADMIN') {
  //     throw new PluginError('Invalid credential. User must be an admin.');
  //   }
  // }

  processWebhookRequest = async ({
    event,
    reqBody,
    dataIntegrationsBySubscriptionId,
  }: {
    event: string;
    reqBody: RewatchWebhookPayload;
    dataIntegrationsBySubscriptionId: (subscriptionId: string) => Promise<DataIntegration[]>;
  }) => {
    const payload = reqBody;
    const dataIntegrations = await dataIntegrationsBySubscriptionId(payload.hookId);

    if (!dataIntegrations?.length) {
      return; // TODO: Consider unsubscribing if no connected integrations match the webhookId
    }

    // 'subscriptionId' will always be unique for Rewatch connections
    const dataIntegration = dataIntegrations[0];

    if (payload.event === 'video.addedToChannel') {
      await this.sendEvent({
        name: this.getEventKey('VIDEO_UPLOADED'),
        data: {
          videoId: payload.video.id,
        },
        user: {
          connectionId: dataIntegration?.connectionId,
        },
      });
    }
  };
}
