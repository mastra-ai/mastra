import { IntegrationContext } from '@arkw/core';

import { XClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<XClient>;
