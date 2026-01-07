// @ts-nocheck

import { Mastra, Memory } from '@mastra/core';

/* FIXME(mastra): `memory` property has been removed. Memory is configured at the agent level. See: https://mastra.ai/guides/migrations/upgrade-to-v1/mastra#memory-property-from-mastra-class */
const mastra = new Mastra({
  memory: new Memory(),
});

/* FIXME(mastra): `memory` property has been removed. Memory is configured at the agent level. See: https://mastra.ai/guides/migrations/upgrade-to-v1/mastra#memory-property-from-mastra-class */
export const mastra2 = new Mastra({
  memory: new Memory(),
});

const mastra3 = new Mastra({});
