import { IntegrationContext } from '@arkw/core';

import { SlackClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<SlackClient>;
