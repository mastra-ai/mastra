import { LocalCloudEvidenceProvider } from '../../providers/cloud-evidence-provider.js';
import type { CloudEvidenceProvider } from '../../providers/evidence-provider.js';
import { invokeCloudInvestigator } from '../agents/cloud-investigator.js';
import { createEvidenceReadTool } from '../tools/evidence-read-tool.js';
import { createGatherEvidenceStep, type GatherDependencies } from './gather-evidence.js';

export function createGatherCloudEvidenceStep(
  dependencies: Omit<GatherDependencies<'cloud'>, 'tool' | 'investigator'> & {
    provider?: CloudEvidenceProvider;
    tool?: GatherDependencies<'cloud'>['tool'];
    investigator?: GatherDependencies<'cloud'>['investigator'];
  } = {},
) {
  const provider = dependencies.provider ?? new LocalCloudEvidenceProvider();
  return createGatherEvidenceStep('cloud', {
    ...dependencies,
    tool:
      dependencies.tool ??
      createEvidenceReadTool({
        id: 'cloud-read-tool',
        source: 'cloud',
        description: 'Read cloud evidence within the trusted scope.',
        provider,
        timeoutMs: dependencies.timeoutMs ?? 1_500,
      }),
    investigator: dependencies.investigator ?? invokeCloudInvestigator,
  });
}
