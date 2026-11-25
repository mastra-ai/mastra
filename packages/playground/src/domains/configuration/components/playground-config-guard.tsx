import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useStudioConfig, useStudioConnection } from '../context/studio-config-state';
import { ConnectionFailureNotice } from './connection-failure-notice';
import { ServerWait } from './server-wait';
import { StudioConfigForm } from './studio-config-form';

/** Shown instead of Studio while it has no connection. */
export const PlaygroundConfigGuard = () => (
  <div className="flex h-dvh w-full overflow-y-auto bg-sidebar">
    <div className="m-auto flex w-full max-w-md flex-col items-center px-4 py-8">
      <PlaygroundConfigGuardBody />
    </div>
  </div>
);

const PlaygroundConfigGuardBody = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { connection, isEditing, setIsEditing, resetConfig } = useStudioConnection();
  const failed = connection.status === 'failed';

  if (!isEditing && !failed) return <ServerWait />;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <LogoWithoutText className="h-auto w-10" />
        <div className="flex flex-col gap-1.5">
          <Txt as="h1" variant="heading" tone="ink">
            Connect to your Mastra server
          </Txt>
          <Txt tone="muted">Studio shows the agents, workflows and tools it serves.</Txt>
        </div>
      </div>
      {failed && <ConnectionFailureNotice failure={connection.failure} />}
      <StudioConfigForm
        initialConfig={{ baseUrl, headers, apiPrefix }}
        onCancel={isEditing ? () => setIsEditing(false) : undefined}
        onReset={resetConfig}
      />
    </div>
  );
};
