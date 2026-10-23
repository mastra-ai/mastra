import { resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import * as registrations from '../providers.js';
import { inputLimits, inputLimitsSchema } from '../config/limits.js';
import { insuranceConfiguration, insuranceConfigurationSchema } from '../config/insurance.js';
import { createRegistry } from './providers/provider-registry.js';
import { CaseRepository } from './storage/cases.js';
import { createCaseService } from './domain/case-service.js';
import { createPolicyCheckingAgent } from './agents/policy-checking.js';
import { createLocalServer, resolveControlledProviderEndpoint } from './runtime/server.js';
import { workingMemorySchema } from './processors/document-intake-processor.js';
import { applicationConfigurationSchema } from './domain/contracts.js';
import { projectRoot, ensurePrivateDirectory } from './runtime/paths.js';

export async function createApplication() {
  const limits = inputLimitsSchema.parse(inputLimits);
  insuranceConfigurationSchema.parse(insuranceConfiguration);
  const { port, operatorId, dataDirectory } = applicationConfigurationSchema.parse({
    port: process.env.PORT,
    operatorId: process.env.POLICY_OPERATOR_ID,
    dataDirectory: process.env.POLICY_DATA_DIR,
  });
  const testEndpoint = resolveControlledProviderEndpoint();
  const root = resolve(projectRoot(), dataDirectory);
  await ensurePrivateDirectory(root);
  const repository = new CaseRepository(root);
  await repository.initialize();
  const storage = new LibSQLStore({ id: 'insurance-history', url: `file:${resolve(root, 'history.db')}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 20,
      semanticRecall: false,
      generateTitle: false,
      workingMemory: { enabled: true, scope: 'thread', schema: workingMemorySchema, agentManaged: false },
    },
  });
  const registry = createRegistry(registrations, registrations.providerDefaults);
  const caseService = createCaseService(repository, registry.resolve('input', undefined, 'pdf-attachments'), limits);
  return {
    storage,
    agents: { policyCheckingAgent: createPolicyCheckingAgent(caseService, memory, operatorId, testEndpoint) },
    server: createLocalServer(port, limits),
  };
}
