'use server';

import { DataIntegrationCredential } from 'core';

import { future } from '../../../../example.future.config';

export async function connectIntegration({
  name,
  credential,
  connectionId,
}: {
  name: string;
  connectionId: string;
  credential: DataIntegrationCredential;
}) {
  const authenticator = future.authenticator(name);

  await future.connectPlugin({ name, connectionId, authenticator, credential });
}
