import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  bundledTypes: [
    'ai',
    '@ai-sdk/provider-utils',
    '@ai-sdk/ui-utils',
    '@standard-schema/spec',
    'eventsource-parser',
    'json-schema',
    '@opentelemetry/api',
  ],
});
