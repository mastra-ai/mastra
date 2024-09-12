import { IntegrationContext } from '@kepler/core';

import { XClient } from './client';

export type MakeClient = (context: IntegrationContext) => Promise<XClient>;
