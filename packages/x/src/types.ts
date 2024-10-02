import { IntegrationContext } from '@mastra/core';

import { XClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<XClient>;
