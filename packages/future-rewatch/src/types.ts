import { IntegrationContext } from "core";



import { RewatchClient } from './client';


type WebhookPayload = {
  hookId: string;
  nonce: string;
  at: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
  };
  channel: {
    url: string;
    name: string;
    subdomain: string;
    description: string;
    createdAt: string;
  };
};

type VideoPayload = WebhookPayload & {
  video: {
    id: string;
    url: string;
    title: string;
    summary: string;
    visibility: string;
    presentedAt: string;
    duration: number;
    collections: [
      {
        id: string;
        url: string;
        name: string;
        description: string;
        createdAt: string;
        secret: boolean;
        children: unknown[];
        admins: unknown[];
        members: unknown[];
      },
    ];
    taggedUsers: unknown[];
    createdAt: string;
  };
};

export type VideoAddedToChannelPayload = VideoPayload & {
  event: 'video.addedToChannel';
};

export type VideoDeletedPayload = VideoPayload & {
  event: 'video.deleted';
};

export type RewatchWebhookPayload = VideoAddedToChannelPayload | VideoDeletedPayload;

export type MakeClient = (context: IntegrationContext) => Promise<RewatchClient>;
