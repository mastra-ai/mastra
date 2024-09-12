import { IntegrationContext } from '@kpl/core';

import { SlackClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<SlackClient>;
