import { IntegrationError } from '@kpl/core';
// @ts-ignore
import { GraphQLClient } from 'graphql-request';

import { Sdk, getSdk, WebhookEvent } from './sdk';

type RewatchClientConfig = {
  apiKey: string;
  channel: string;
  host?: string;
};

export class RewatchClient {
  static readonly host = (channel: string) => `https://${channel}.rewatch.com/api/graphql`;

  private readonly config: RewatchClientConfig;
  private readonly client: Sdk;

  constructor(config: RewatchClientConfig) {
    this.config = config;
    this.client = getSdk(
      new GraphQLClient(RewatchClient.host(this.config.channel), {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }),
    );
  }

  /**
   * Describes the currently authenticated viewer
   */
  async viewer() {
    const { viewer } = await this.client.CurrentViewer();

    return viewer;
  }

  /**
   * Describes the channel for the currently authenticated viewer
   */
  async channel() {
    const viewer = await this.viewer();

    const { channel } = await this.client.CurrentChannel({
      id: viewer.id,
    });

    return channel;
  }

  /**
   * Fetches a webhook by its ID
   * @param webhookId
   */
  async getWebhook(webhookId: string) {
    const { node } = await this.client.Webhook({ id: webhookId });

    if (!node || node.__typename !== 'Webhook') {
      return null;
    }

    const { __typename, ...webhook } = node;

    return webhook;
  }

  /**
   * Fetches a video by its ID
   * @param videoId - The ID of the video
   */
  async getVideo(videoId: string) {
    const { node } = await this.client.Video({ id: videoId });

    if (!node || node.__typename !== 'Video') {
      return null;
    }

    const { __typename, ...video } = node;

    return video;
  }

  /**
   * Initializes a webhook for the given channel
   * @param webhookUrl - The URL to receive the webhook events
   */
  async subscribe(webhookUrl: string) {
    const { createWebhook } = await this.client.Subscribe({
      input: {
        url: `${webhookUrl}`,
        events: [WebhookEvent.Video],
        secrets: [process.env.SUPABASE_JWT_SECRET!],
        enabled: true,
      },
    });

    if (!createWebhook) {
      throw new IntegrationError('Failed to create webhook');
    }

    if (createWebhook.errors.length) {
      throw new IntegrationError(createWebhook.errors[0].message);
    }

    return createWebhook.webhook!;
  }

  /**
   * Deletes a webhook by its ID
   * @param webhookId - The ID of the webhook to delete
   */
  async unsubscribe(webhookId: string) {
    const { deleteWebhook } = await this.client.Unsubscribe({
      input: {
        webhookId,
      },
    });

    if (deleteWebhook?.errors.length) {
      throw new IntegrationError(deleteWebhook.errors[0].message);
    }
  }
}
