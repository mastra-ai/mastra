import { IntegrationContext } from '@kpl/core';

import { XClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<XClient>;
