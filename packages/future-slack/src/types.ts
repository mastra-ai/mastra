import { IntegrationContext } from 'core';

import { SlackClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<SlackClient>;
