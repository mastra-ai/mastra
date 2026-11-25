import { Notice } from '@mastra/playground-ui/components/Notice';
import {
  AddSandboxEnvButton as AddSandboxEnvButtonView,
  SandboxEnvList,
} from '@mastra/playground-ui/components/SandboxEnvList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useSandboxEnvMutations, useSandboxEnvsQuery } from '../../../../../hooks/useSandboxEnvs';
import { relativeTime } from '../../../../../lib/date/relativeTime';

/** Opens the add dialog; rendered as the Environment variables subsection action. */
export function AddSandboxEnvButton({ factoryId }: { factoryId: string }) {
  const envsQuery = useSandboxEnvsQuery(factoryId);
  const mutations = useSandboxEnvMutations(factoryId);
  return (
    <AddSandboxEnvButtonView
      envs={envsQuery.data?.envs}
      writable={Boolean(envsQuery.data?.writable)}
      mutations={mutations}
    />
  );
}

/** The Factory's sandbox environment variables. */
export function SandboxEnvsBlock({ factoryId }: { factoryId: string }) {
  const envsQuery = useSandboxEnvsQuery(factoryId);
  const mutations = useSandboxEnvMutations(factoryId);

  if (envsQuery.isError) {
    const message = envsQuery.error instanceof Error ? envsQuery.error.message : 'Failed to load environment variables';
    return <Notice variant="destructive">{message}</Notice>;
  }
  if (!envsQuery.data) return <Skeleton className="h-16 w-full" />;

  return (
    <SandboxEnvList
      envs={envsQuery.data.envs}
      writable={envsQuery.data.writable}
      mutations={mutations}
      formatUpdatedAt={iso => relativeTime(iso)}
    />
  );
}
