import type { MastraCompositeStore } from '@mastra/core/storage';
import type { BillingProvider } from './contracts/provider.js';
import { Lifecycle } from './lifecycle.js';
import { BillingRecovery } from './runtime/recovery.js';
import { RecoveryStorage } from './storage/recovery.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { BillingError, parseInput } from './contracts/core.js';
import { CommercialStorage } from './storage/commercial.js';
import { CommercialService } from './runtime/commercial.js';
import { initializeBilling } from './configuration/providers.js';
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
  /** Application-owned workflow snapshot storage; omitted to use the private local store. */
  storage?: MastraCompositeStore;
  /** Driver implementation; otherwise resolved from BILLING_PROVIDER and driver environment variables. */
  billingProvider?: BillingProvider;
  /** Server-owned environment passed to the selected driver. */
  environment?: NodeJS.ProcessEnv;
}) {
  const files = parseInput(z.strictObject({ databaseUrl: localFile, workflowDatabaseUrl: localFile.optional() }), {
    databaseUrl: options.databaseUrl,
    workflowDatabaseUrl: options.storage ? undefined : options.workflowDatabaseUrl,
  });
  const workflowUrl = options.storage
    ? undefined
    : (files.workflowDatabaseUrl ??
      pathToFileURL(resolve(dirname(fileURLToPath(files.databaseUrl)), 'workflow.db')).href);
  if (workflowUrl && fileURLToPath(workflowUrl) === fileURLToPath(files.databaseUrl))
    throw new BillingError('invalid_configuration');
  const commercial = await initializeBilling({
    storage: { url: files.databaseUrl },
    configuration: options.configuration,
    billingProvider: options.billingProvider,
    environment: options.environment,
  });
  const lifecycle = new Lifecycle();
  lifecycle.own(commercial.close);
  try {
    if (workflowUrl) await privateWorkflowFiles(fileURLToPath(workflowUrl));
    const accounting = await AccountingStorage.open({ url: files.databaseUrl }, options.organizations.storage);
    lifecycle.own(() => accounting.close());
    const workflowStorage = await WorkflowStorage.open({ url: files.databaseUrl }, options.organizations.storage);
    lifecycle.own(() => workflowStorage.close());
    const snapshots = options.storage ?? new LibSQLStore({ id: 'billing-workflow-snapshots', url: workflowUrl! });
    if (!options.storage) lifecycle.own(() => snapshots.close());
    await snapshots.init();
    if (workflowUrl) await privateWorkflowFiles(fileURLToPath(workflowUrl));
    const billing = new MastraBilling({
      organizations: options.organizations,
      accounting,
      workflowStorage,
      provider: commercial.provider,
      configuration: commercial.configuration,
      agents: options.agents,
      workflows: options.workflows,
    });
    const commercialStorage = await CommercialStorage.open({ url: files.databaseUrl }, options.organizations.storage);
    lifecycle.own(() => commercialStorage.close());
    const commercialService = new CommercialService(
      options.organizations,
      commercialStorage,
      commercial.provider,
      commercial.configuration,
    );

    const recoveryStorage = await RecoveryStorage.open({ url: files.databaseUrl });
    lifecycle.own(() => recoveryStorage.close());
    const recovery = new BillingRecovery(recoveryStorage, commercial.provider, async () => {
      await billing.expireSuspensions();
      await accounting.recoverFinancial();
    });
    lifecycle.own(() => recovery.stop());

    return {
      billing,
      recovery,
      // Call after attaching agents/workflows and persistent storage to Mastra.
      startRecovery: () => recovery.start(),
      commercial: commercialService,
      storage: snapshots,
      configuration: commercial.configuration,
      close: () => lifecycle.close(),
    };
  } catch (error) {
    return lifecycle.fail(error);
  }
}
