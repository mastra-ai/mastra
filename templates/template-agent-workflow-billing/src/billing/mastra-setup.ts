import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { BillingError, parseInput } from './contracts.js';
import { initializeBilling } from './setup.js';
import { MastraBilling } from './mastra.js';
import type { AgentResource, WorkflowResource } from './mastra-resources.js';
import type { OrganizationService } from './organizations.js';
import { AccountingStorage } from './storage/accounting.js';
import { WorkflowStorage } from './storage/workflows.js';
import { privateWorkflowFiles } from './storage/private-files.js';

const localFile = z.string().refine(value => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'file:' &&
      !url.host &&
      url.pathname.startsWith('/') &&
      url.pathname !== '/' &&
      !url.search &&
      !url.hash &&
      !url.pathname.includes(':memory:')
    );
  } catch {
    return false;
  }
});
export async function initializeMastraBilling<
  Agents extends Record<string, AgentResource<any>>,
  Workflows extends Record<string, WorkflowResource<any>>,
>(options: {
  organizations: OrganizationService;
  configuration: unknown;
  agents: Agents;
  workflows: Workflows;
  databaseUrl: string;
  workflowDatabaseUrl?: string;
}) {
  const files = parseInput(z.strictObject({ databaseUrl: localFile, workflowDatabaseUrl: localFile.optional() }), {
    databaseUrl: options.databaseUrl,
    workflowDatabaseUrl: options.workflowDatabaseUrl,
  });
  const workflowUrl =
    files.workflowDatabaseUrl ?? pathToFileURL(resolve(dirname(fileURLToPath(files.databaseUrl)), 'workflow.db')).href;
  if (fileURLToPath(workflowUrl) === fileURLToPath(files.databaseUrl)) throw new BillingError('invalid_configuration');
  const commercial = await initializeBilling({
    storage: { url: files.databaseUrl },
    configuration: options.configuration,
  });
  let accounting: AccountingStorage | undefined;
  let workflowStorage: WorkflowStorage | undefined;
  let snapshots: LibSQLStore | undefined;
  try {
    await privateWorkflowFiles(fileURLToPath(workflowUrl));
    accounting = await AccountingStorage.open({ url: files.databaseUrl }, options.organizations.storage);
    workflowStorage = await WorkflowStorage.open({ url: files.databaseUrl }, options.organizations.storage);
    snapshots = new LibSQLStore({ id: 'billing-workflow-snapshots', url: workflowUrl });
    await snapshots.init();
    await privateWorkflowFiles(fileURLToPath(workflowUrl));
    const billing = new MastraBilling({
      organizations: options.organizations,
      accounting,
      workflowStorage,
      provider: commercial.provider,
      configuration: commercial.configuration,
      agents: options.agents,
      workflows: options.workflows,
    });
    const storage = snapshots;
    const ledger = accounting;
    const runs = workflowStorage;
    let closed = false;
    return {
      billing,
      storage,
      configuration: commercial.configuration,
      close: async () => {
        if (closed) return;
        closed = true;
        ledger.close();
        runs.close();
        commercial.close();
        await storage.close();
      },
    };
  } catch (error) {
    accounting?.close();
    workflowStorage?.close();
    commercial.close();
    await snapshots?.close();
    throw error;
  }
}
