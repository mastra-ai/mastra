'use server';

import { SlackClient } from '@kpl/slack/dist/client';

import { framework } from './framework-utils';

export const getConnection = async ({ name, connectionId }: { name: string; connectionId: string }) => {
  return framework?.dataLayer.getConnection({ name, connectionId });
};

export const getOAuthConnectionRoute = ({ name, connectionId }: { name: string; connectionId: string }) => {
  const router = framework?.createRouter();
  return router?.makeConnectURI({
    clientRedirectPath: '/',
    name,
    connectionId,
  });
};

export const executeFrameworkApi = async ({
  name,
  connectionId,
  payload,
  apiType,
}: {
  name: string;
  connectionId: string;
  payload: unknown;
  apiType: string;
}) => {
  return framework?.executeApi({
    integrationName: name,
    api: apiType,
    payload: {
      data: payload,
      ctx: {
        connectionId,
      },
    },
  });
};

export const triggerSystemEvent = async ({
  connectionId,
  payload,
  eventKey,
}: {
  connectionId: string;
  payload?: unknown;
  eventKey: string;
}) => {
  return framework?.triggerSystemEvent({
    key: eventKey,
    data: payload,
    user: {
      connectionId,
    },
  });
};

export const getEvents = async () => {
  return framework.getGlobalEvents();
};

export const getAllSlackchannels = async ({ connectionId }: { connectionId: string }) => {
  const int = framework.getIntegration('SLACK');
  const client = (await int.makeClient({ connectionId })) as SlackClient;
  const channels = await client.getAllChannels();
  return channels;
};
