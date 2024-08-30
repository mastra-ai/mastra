'use server';

import { SlackClient } from '@arkw/slack/dist/client';
import { XClient } from '@arkw/x/dist/client';

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

export const executeAction = async ({
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
  return framework?.executeAction({
    integrationName: name,
    action: apiType,
    payload: {
      data: payload,
      ctx: {
        referenceId,
      },
    },
  });
};

export const getAllSlackchannels = async ({ referenceId }: { referenceId: string }) => {
  const int = framework.getIntegration('SLACK');
  const client = (await int.makeClient({ referenceId })) as SlackClient;
  const channels = await client.getAllChannels();
  return channels;
};
