import 'dotenv/config';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mastra } from '@mastra/core';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { invoiceExtractionAgent } from './agents/invoice-extraction.ts';
import { invoiceChatIntakeAgent } from './agents/invoice-chat-intake.ts';
import {
  apAuth,
  authConfigurationError,
  getCurrentApUser,
  isLocalFixtureDemo,
  serverHost,
  setAuthenticatedReviewer,
} from './auth.ts';
import { apExecutionWorkflow } from './phase3/workflow.ts';
import { extractionFidelityScorer } from './scorers/extraction-fidelity.ts';
import { invoiceReaderWorkflow } from './workflows/invoice-reader.ts';
import { apInvoiceWorkflow } from './workflows/ap-invoice.ts';

export const defaultStoragePath = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'data/mastra.db');
const configuredStorageUrl = process.env.MASTRA_DB_URL?.trim() || undefined;
if (!configuredStorageUrl) {
  mkdirSync(dirname(defaultStoragePath), { recursive: true, mode: 0o700 });
  chmodSync(dirname(defaultStoragePath), 0o700);
  closeSync(openSync(defaultStoragePath, 'a', 0o600));
  chmodSync(defaultStoragePath, 0o600);
}
const applicationStorage = new LibSQLStore({
  id: 'ap-invoice-storage',
  url: configuredStorageUrl ?? `file:${defaultStoragePath}`,
});
const observabilityPath =
  process.env.MASTRA_OBSERVABILITY_DB_PATH?.trim() ||
  resolve(fileURLToPath(new URL('../../', import.meta.url)), 'data/observability.duckdb');
const observabilityStorage = new DuckDBStore({
  id: 'ap-invoice-observability',
  path: observabilityPath,
  memoryLimit: '512MB',
});
const storage = new MastraCompositeStore({
  id: 'ap-invoice-composite-storage',
  default: applicationStorage,
  domains: { observability: observabilityStorage.observability },
});
export const mastra = new Mastra({
  agents: { invoiceChatIntakeAgent },
  workflows: { apInvoiceWorkflow, invoiceReaderWorkflow, apExecutionWorkflow },
  scorers: { extractionFidelityScorer },
  storage,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'accounts-payable-invoice-processing',
        exporters: [new MastraStorageExporter()],
        logging: { enabled: true, level: 'info' },
      },
    },
  }),
  server: {
    host: serverHost,
    ...(apAuth ? { auth: apAuth } : {}),
    middleware: [
      {
        path: '/api/*',
        handler: async (context, next) => {
          const user = await getCurrentApUser(context.req.raw);
          if (!user && !isLocalFixtureDemo())
            return context.json(
              {
                error:
                  authConfigurationError ||
                  'Configure MASTRA_AUTH_TOKEN and MASTRA_AUTH_USER_ID to use the API outside the local fixture demo',
              },
              401,
            );
          setAuthenticatedReviewer(context.get('requestContext'), user);
          await next();
        },
      },
    ],
  },
});
