import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useStudioConfig, useStudioConnection } from '../context/studio-config-state';
import type { StudioConnection } from '../context/studio-config-state';

// What a proxy answers for a server that isn't up.
const GATEWAY_ERRORS = [502, 503, 504];

const getWaitCause = (baseUrl: string, httpStatus?: number) => {
  if (!httpStatus) return `Nothing answers at ${baseUrl} yet.`;
  if (GATEWAY_ERRORS.includes(httpStatus)) return `The server at ${baseUrl} isn't up yet (error ${httpStatus}).`;
  return `${baseUrl} answers with error ${httpStatus}.`;
};

const getWaitMessage = (connection: StudioConnection, baseUrl: string) => {
  if (connection.status !== 'waiting') return { title: 'Connecting to your Mastra server', message: baseUrl };

  return {
    title: 'Waiting for your Mastra server',
    message: `${getWaitCause(baseUrl, connection.httpStatus)} Studio connects on its own once it's ready.`,
  };
};

/** Studio knows its server, which isn't up yet (or is just being asked). */
export const ServerWait = () => {
  const { baseUrl } = useStudioConfig();
  const { connection, setIsEditing, resetConfig } = useStudioConnection();
  const { title, message } = getWaitMessage(connection, baseUrl);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <BrandLoader size="lg" aria-label="Connecting" />
      <div className="flex flex-col gap-1.5">
        <Txt as="h1" variant="heading" tone="ink">
          {title}
        </Txt>
        <Txt as="p" tone="muted" className="text-balance wrap-anywhere">
          {message}
        </Txt>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => setIsEditing(true)}>Edit connection</Button>
        {resetConfig && (
          <Button variant="ghost" onClick={resetConfig}>
            Reset to default
          </Button>
        )}
      </div>
    </div>
  );
};
