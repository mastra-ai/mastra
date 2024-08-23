import type { Integration } from '../integration';

export type IntegrationFormat = { name: string };

export type IntegrationReturnType<
  TIntegrationFormat extends IntegrationFormat
> = TIntegrationFormat extends IntegrationFormat ? Integration : never;
