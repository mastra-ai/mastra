import type { FactoryEnvironmentPatch } from '../../../workspaces/services/environment';

export { CommittedInput } from '@mastra/playground-ui/components/CommittedInput';

/** Persists one environment change; resolves to whether it saved (failures are toasted by the caller). */
export type SaveEnvironment = (input: FactoryEnvironmentPatch) => Promise<boolean>;
