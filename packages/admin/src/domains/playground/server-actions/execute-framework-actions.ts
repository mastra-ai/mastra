'use server';

import { IntegrationActionExcutorParams } from 'core';

import { future } from '../../../../example.future.config';

interface Props {
  pluginName?: string;
  action: string;
  payload: IntegrationActionExcutorParams<any>;
}

export async function executeFrameworkAction(props: Props): Promise<void> {
  await future.executeAction(props);
}
