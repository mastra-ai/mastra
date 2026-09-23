import { LocalIdentityEvidenceProvider } from '../../providers/identity-evidence-provider.js';
import type { IdentityEvidenceProvider } from '../../providers/evidence-provider.js';
import { invokeIdentityInvestigator } from '../agents/identity-investigator.js';
import { createEvidenceReadTool } from '../tools/evidence-read-tool.js';
import { createGatherEvidenceStep, type GatherDependencies } from './gather-evidence.js';

export function createGatherIdentityEvidenceStep(
  dependencies: Omit<GatherDependencies<'identity'>, 'tool' | 'investigator'> & {
    provider?: IdentityEvidenceProvider;
    tool?: GatherDependencies<'identity'>['tool'];
    investigator?: GatherDependencies<'identity'>['investigator'];
  } = {},
) {
  const provider = dependencies.provider ?? new LocalIdentityEvidenceProvider();
  return createGatherEvidenceStep('identity', {
    ...dependencies,
    tool:
      dependencies.tool ??
      createEvidenceReadTool({
        id: 'identity-read-tool',
        source: 'identity',
        description: 'Read identity evidence within the trusted scope.',
        provider,
        timeoutMs: dependencies.timeoutMs ?? 1_500,
      }),
    investigator: dependencies.investigator ?? invokeIdentityInvestigator,
  });
}
