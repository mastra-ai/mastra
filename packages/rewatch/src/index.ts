import { Connection, IntegrationAuth, IntegrationCredentialType, Integration } from '@arkw/core';
import { z } from 'zod';

import { ATTACH_RECORDING } from './actions/attach-recording';
// @ts-ignore
import rewatchIcon from './assets/rewatch.svg';
import { RewatchClient } from './client';
import { REWATCH_FIELDS, REWATCH_INTEGRATION_NAME } from './constants';
import { subscribe } from './events/subscribe';
import { rewatchConnectionOptions, blankSchema, videoUploadedPayload } from './schemas';
import { RewatchWebhookPayload } from './types';

export class RewatchIntegration extends Integration<RewatchClient> {
  entityTypes = { MEETING_RECORDINGS: 'MEETING_RECORDINGS' };

  constructor() {
    super({
      name: REWATCH_INTEGRATION_NAME,
      logoUrl: rewatchIcon,
      authType: IntegrationCredentialType.API_KEY,
      authConnectionOptions: rewatchConnectionOptions,
    });
  }

  registerEvents() {
    this.events = {
      'rewatch/subscribe': {
        schema: z.object({
          connectionId: z.string(),
        }),
        handler: subscribe,
      },
      'rewatch/video.uploaded': {
        schema: videoUploadedPayload,
        triggerProperties: {
          type: 'VIDEO_UPLOADED',
          label: 'Video Uploaded',
          description: 'Triggered whenever Rewatch signals a "video.addedToChannel" webhook event.',
          icon: {
            alt: 'Rewatch Logo',
            icon: rewatchIcon,
          },
          schema: blankSchema,
          outputSchema: videoUploadedPayload,
        },
      },
    };
    return this.events;
  }

  registerActions() {
    this.actions = {
      ATTACH_RECORDING: ATTACH_RECORDING({
        makeClient: this.makeClient,
        dataAccess: this?.dataLayer!,
        name: this.name,
        entityType: this.entityTypes.MEETING_RECORDINGS,
      }),
    };
    return this.actions;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ connection });
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        SCOPES: ['ADMIN'],
      },
    });
  }

  makeClient = async ({ referenceId }: { referenceId: string }) => {
    const authenticator = this.getAuthenticator();

    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new RewatchClient({
      apiKey: token.apiKey,
      channel: token.channel,
    });
  };

  async onConnectionCreated({ connection }: { connection: Connection }) {
    await this.sendEvent({
      key: 'rewatch/subscribe',
      data: {
        connectionId: connection.id,
      },
      user: {
        referenceId: connection.referenceId,
      },
    });
  }

  async onDisconnect({ referenceId }: { referenceId: string }) {
    const client = await this.makeClient({ referenceId });
    const integration = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

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

  createEntity = async ({
    referenceId,
    connectionId,
    shouldSync = false,
  }: {
    connectionId: string;
    referenceId: string;
    shouldSync?: boolean;
  }) => {
    const existingTable = await this.dataLayer?.getEntityRecordsByConnectionAndType({
      type: this.entityTypes.MEETING_RECORDINGS,
      connectionId,
    });

    let tempTable;
    if (existingTable) {
      tempTable = existingTable;
    } else {
      tempTable = await this.dataLayer?.createEntity({
        connectionId,
        type: this.entityTypes.MEETING_RECORDINGS,
        referenceId,
      });

      await this.dataLayer?.addPropertiesToEntity({
        entityId: tempTable?.id!,
        properties: REWATCH_FIELDS,
      });
    }
    return tempTable;
  };

  processWebhookRequest = async ({
    event,
    reqBody,
    connectionsBySubscriptionId,
  }: {
    event: string;
    reqBody: RewatchWebhookPayload;
    connectionsBySubscriptionId: (subscriptionId: string) => Promise<Connection[]>;
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
        key: 'rewatch/video.uploaded',
        data: {
          videoId: payload.video.id,
        },
        user: {
          referenceId: connection?.referenceId,
        },
      });
    }
  };
}
