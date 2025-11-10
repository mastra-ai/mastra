// @ts-nocheck

import { Mastra } from '@mastra/core';

/* FIXME(mastra): `memory` property has been removed. Memory is configured at the agent level. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#memory-property-from-mastra-class */
const mastra = new Mastra({
  memory: new Memory(),
});

const mastra2 = new Mastra({});
