'use server';

import { SlackClient } from '@kpl/slack/dist/client';

import { framework } from './framework-utils';

export const getConnectionByReferenceId = async ({ name, referenceId }: { name: string; referenceId: string }) => {
  return framework?.dataLayer.getConnectionByReferenceId({ name, referenceId });
};

export const getOAuthConnectionRoute = async ({ name, referenceId }: { name: string; referenceId: string }) => {
  return framework?.makeConnectURI({
    clientRedirectPath: '/',
    name,
    referenceId,
  });
};

export const executeFrameworkApi = async ({
  name,
  referenceId,
  payload,
  apiType,
}: {
  name: string;
  referenceId: string;
  payload: unknown;
  apiType: string;
}) => {
  return framework?.executeApi({
    integrationName: name,
    api: apiType,
    payload: {
      data: payload,
      ctx: {
        referenceId,
      },
    },
  });
};

export const triggerSystemEvent = async ({
  referenceId,
  payload,
  eventKey,
}: {
  referenceId: string;
  payload?: unknown;
  eventKey: string;
}) => {
  return framework?.triggerSystemEvent({
    key: eventKey,
    data: payload,
    user: {
      referenceId,
    },
  });
};

export const getEvents = async () => {
  return framework.getGlobalEvents();
};

export const getAllSlackchannels = async ({ referenceId }: { referenceId: string }) => {
  const int = framework.getIntegration('SLACK');
  const client = (await int.makeClient({ referenceId })) as SlackClient;
  const channels = await client.getAllChannels();
  return channels;
};
