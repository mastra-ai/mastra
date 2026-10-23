import { resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import * as registrations from '../../../providers.js';
import { inputLimits, inputLimitsSchema } from '../../../config/limits.js';
import { defaultInsuranceProfile, insuranceProfiles, insuranceProfileSchema } from '../../../config/insurance.js';
import { createRegistry } from './registry.js';
import { CaseRepository } from '../storage/cases.js';
import { createIntakeService } from './intake.js';
import { createPolicyCheckingAgent } from '../agents/policy-checking.js';
import { createLocalServer } from './server.js';
import { workingMemorySchema } from '../processors/intake.js';
import { IntakeError } from './errors.js';
import { projectRoot, ensurePrivateDirectory } from './paths.js';

export async function createApplication() {
  const limits = inputLimitsSchema.parse(inputLimits);
  const profiles = z.array(insuranceProfileSchema).parse(insuranceProfiles);
  if (!profiles.some(profile => profile.id === defaultInsuranceProfile))
    throw new IntakeError(
      'PROFILE_CONFIGURATION',
      'The configured insurance profile does not exist.',
      'Choose a registered profile in config/insurance.ts.',
    );
  const port = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .parse(process.env.PORT ?? 4111);
  const operatorId = z
    .string()
    .min(1)
    .max(200)
    .parse(process.env.POLICY_OPERATOR_ID ?? 'local-broker');
  const root = resolve(projectRoot(), process.env.POLICY_DATA_DIR ?? '.runtime');
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
  const service = createIntakeService(repository, registry.resolve('input', undefined, 'pdf-attachments'), limits);
  const testEndpoint = process.env.POLICY_TEST_PROVIDER_URL;
  if (testEndpoint && (process.env.NODE_ENV !== 'test' || !/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(testEndpoint)))
    throw new IntakeError(
      'MODEL_CONFIGURATION',
      'A controlled test provider must run on loopback in test mode.',
      'Remove POLICY_TEST_PROVIDER_URL outside deterministic local tests.',
    );
  return {
    storage,
    agents: { policyCheckingAgent: createPolicyCheckingAgent(service, memory, operatorId, testEndpoint) },
    server: createLocalServer(port, limits),
  };
}
