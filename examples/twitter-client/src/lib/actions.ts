'use server';

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
