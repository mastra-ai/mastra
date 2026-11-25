import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useStudioConfig, useStudioConnection } from '../context/studio-config-state';
import type { StudioConnection } from '../context/studio-config-state';
import type { WaitCause } from '../hooks/use-mastra-instance-status';

// What a proxy answers for a server that isn't up.
const GATEWAY_ERRORS = [502, 503, 504];

const getWaitMessage = (cause: WaitCause, baseUrl: string) => {
  if (cause.reason === 'blocked') {
    return (
      <>
        {baseUrl} answers, but not to requests from {window.location.origin}. Add that origin to{' '}
        <InlineCode>server.cors</InlineCode> in your Mastra config, with{' '}
        <InlineCode className="whitespace-nowrap">credentials: true</InlineCode>.
      </>
    );
  }
  if (cause.reason === 'no-answer') return `Nothing answers at ${baseUrl} yet.`;
  if (GATEWAY_ERRORS.includes(cause.httpStatus)) {
    return `The server at ${baseUrl} isn't up yet (error ${cause.httpStatus}).`;
  }
  return `${baseUrl} answers with error ${cause.httpStatus}.`;
};

const getWaitText = (connection: StudioConnection, baseUrl: string) => {
  if (connection.status !== 'waiting') return { title: 'Connecting to your Mastra server', message: baseUrl };

  const { cause } = connection;
  return {
    title: cause.reason === 'blocked' ? 'The server blocks this Studio' : 'Waiting for your Mastra server',
    message: <>{getWaitMessage(cause, baseUrl)} Studio connects on its own once it's ready.</>,
  };
};

/** Studio knows its server, which isn't up yet (or is just being asked). */
export const ServerWait = () => {
  const { baseUrl } = useStudioConfig();
  const { connection, setIsEditing, resetConfig } = useStudioConnection();
  const { title, message } = getWaitText(connection, baseUrl);

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
