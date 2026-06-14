import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import { createBuilderAgent } from '@mastra/editor/ee';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import {
  sentinelCheckbookSpending,
  sentinelCheckbookVendorSummary,
  sentinelCheckbookSpendingTrend,
  sentinelFederalRecipientProfile,
  sentinelSamEntitySearch,
  sentinelSamExclusionCheck,
  sentinelZscoreOutliers,
  sentinelPatternFlags,
} from './tools';

const libsqlStore = new LibSQLStore({
  id: 'mastra-storage',
  url: process.env.DB_URL ?? 'file:local.db',
});

const duckdbStore = new DuckDBStore({ path: ':memory:' });

const storage = new MastraCompositeStore({
  id: 'composite-storage',
  default: libsqlStore,
  domains: {
    observability: duckdbStore.observability,
  },
});

export const mastra = new Mastra({
  storage,
  agents: {
    builderAgent: createBuilderAgent(),
  },
  tools: {
    sentinelCheckbookSpending,
    sentinelCheckbookVendorSummary,
    sentinelCheckbookSpendingTrend,
    sentinelFederalRecipientProfile,
    sentinelSamEntitySearch,
    sentinelSamExclusionCheck,
    sentinelZscoreOutliers,
    sentinelPatternFlags,
  },
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  server: {
    build: {
      swaggerUI: true,
    },
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'sentinel',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  editor: new MastraEditor({
    builder: {
      enabled: true,
      configuration: {
        agent: {
          models: {
            allowed: [
              { provider: 'openai', modelId: 'gpt-5.4' },
              { provider: 'openai', modelId: 'gpt-5.4-mini' },
              { provider: 'openai', modelId: 'gpt-5.4-pro' },
              { provider: 'openai', modelId: 'gpt-5.4-nano' },
              { provider: 'openai', modelId: 'gpt-4.1' },
              { provider: 'openai', modelId: 'gpt-4.1-mini' },
              { provider: 'openai', modelId: 'gpt-4.1-nano' },
            ],
          },
        },
      },
    },
  }),
});
