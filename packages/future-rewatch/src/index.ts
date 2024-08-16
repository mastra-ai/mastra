import { z } from 'zod';

import { IntegrationAPI } from '@/lib/integrations-framework/api';
import { IntegrationAuth } from '@/lib/integrations-framework/authenticator';
import { PluginError } from '@/lib/integrations-framework/errors';
import { IntegrationPlugin } from '@/lib/integrations-framework/plugin';
import { Connection, ConnectionWithWorkspaceUser } from '@/lib/integrations-framework/plugin.types';
import {
  IntegrationCredentialType,
  MakeAPI,
  MakeWebhookURL,
  APIKey,
  IntegrationAction,
} from '@/lib/integrations-framework/types';

import { ATTACH_RECORDING } from './actions/attach-recording';
// import { default as RewatchIcon } from './assets/rewatch.svg';
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
            type: 'plugin',
            icon: "",
          },
          schema: blankSchema,
          outputSchema: videoUploadedPayload,
        },
      },
    };

    return this.events;
  }

  getEventHandlers({ makeAPI, makeWebhookURL }: { makeAPI: MakeAPI; makeWebhookURL: MakeWebhookURL }) {
    return [
      subscribe({
        name: this.name,
        event: this.getEventKey('SUBSCRIBE'),
        sendEvent: this.sendEvent,
        makeClient: this.makeClient,
        makeAPI,
        makeWebhookURL,
      }),
    ];
  }

  getActions({ makeAPI }: { makeAPI: MakeAPI }): Record<string, IntegrationAction<any>> {
    return {
      ATTACH_RECORDING: ATTACH_RECORDING({ makeAPI, makeClient: this.makeClient }),
    };
  }

  getAuthenticator({ api }: { api: IntegrationAPI }) {
    return new IntegrationAuth({
      api,
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ api, connection });
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        SCOPES: ['ADMIN'],
      },
    });
  }

  makeClient = async ({ api }: { api: IntegrationAPI }) => {
    const authenticator = this.getAuthenticator({ api });

    const connection = await api.getConnectionByName(this.name);

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new RewatchClient({
      apiKey: token.apiKey,
      channel: token.channel,
    });
  };

  async onConnectionCreated({ api, connection }: { api: IntegrationAPI; connection: Connection }) {
    await this.sendEvent({
      name: this.getEventKey('SUBSCRIBE'),
      data: {
        connectionId: connection.id,
      },
      user: {
        workspaceId: api.context?.workspaceId,
        userId: api.context?.userId,
      },
    });
  }

  async onDisconnect({ api, connectionId }: { api: IntegrationAPI; connectionId: string }) {
    const client = await this.makeClient({ api });
    const connection = await api.getConnectionById(connectionId);

    if (connection.subscriptionId) {
      try {
        await client.unsubscribe(connection.subscriptionId);
      } catch (err) {
        // Silently ignore stale webhooks
        if ((err as Error).message.includes('No object found')) {
          return;
        }

        throw err;
      }
    }
  }

  async test(credential: APIKey) {
    const client = new RewatchClient({
      apiKey: credential.apiKey,
      channel: credential.channel,
    });

    let channel;
    try {
      channel = await client.channel();
    } catch (err) {
      throw new PluginError('Invalid credential. Cannot resolve user from API Key.');
    }

    if (channel.subdomain !== credential.channel) {
      throw new PluginError(`Invalid credential. Supplied API Key does not belong to channel "${credential.channel}".`);
    }

    if (channel.user?.channelRole !== 'ADMIN') {
      throw new PluginError('Invalid credential. User must be an admin.');
    }
  }

  processWebhookRequest = async ({
    event,
    reqBody,
    connectionsBySubscriptionId,
  }: {
    event: string;
    reqBody: RewatchWebhookPayload;
    connectionsBySubscriptionId: (subscriptionId: string) => Promise<ConnectionWithWorkspaceUser[]>;
  }) => {
    const payload = reqBody;
    const connections = await connectionsBySubscriptionId(payload.hookId);

    if (!connections?.length) {
      return; // TODO: Consider unsubscribing if no connected integrations match the webhookId
    }

    // 'subscriptionId' will always be unique for Rewatch connections
    const connection = connections[0];

    if (payload.event === 'video.addedToChannel') {
      await this.sendEvent({
        name: this.getEventKey('VIDEO_UPLOADED'),
        data: {
          videoId: payload.video.id,
        },
        user: {
          workspaceId: connection.workspaceUser.workspaceId,
          userId: connection.workspaceUser.userId,
        },
      });
    }
  };
}
