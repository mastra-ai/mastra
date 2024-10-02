import { IntegrationContext } from '@mastra/core';

import { SlackClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<SlackClient>;
