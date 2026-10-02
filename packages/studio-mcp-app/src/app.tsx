import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { TraceList } from './trace-list';

export interface StudioConfiguration {
  baseUrl: string;
  apiPrefix: string;
  /** Set only by a local development host, never by the deployed MCP resource. */
  localPreview?: boolean;
}

function isLoopback(url: URL) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function ConnectionForm({
  configuration,
  onConnect,
}: {
  configuration: StudioConfiguration;
  onConnect: (configuration: StudioConfiguration) => void;
}) {
  const [error, setError] = useState<string>();
  const localPreview = configuration.localPreview === true && isLoopback(new URL(configuration.baseUrl));

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get('url');
    try {
      const url = new URL(typeof input === 'string' ? input.trim() : '');
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error(
          'Enter a public HTTP or HTTPS server URL without credentials, query parameters, or a fragment.',
        );
      }
      if (url.origin !== new URL(configuration.baseUrl).origin && !(localPreview && isLoopback(url))) {
        throw new Error(
          `This connection allows ${new URL(configuration.baseUrl).origin}${localPreview ? ' and local servers' : ''}. To use a different server, connect its MCP endpoint in ChatGPT and open Studio from that connection.`,
        );
      }
      onConnect({ ...configuration, baseUrl: url.href.replace(/\/$/, '') });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enter a valid server URL.');
    }
  }

  return (
    <div className="bg-sidebar flex min-h-screen w-full items-center justify-center">
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="flex justify-center pb-4">
          <LogoWithoutText className="size-32" />
        </div>
        <Form onSubmit={connect} className="gap-6">
          <Field>
            <FieldLabel required>Mastra instance URL</FieldLabel>
            <Input
              name="url"
              type="url"
              required
              defaultValue={configuration.baseUrl}
              placeholder="https://your-mastra-server.com"
            />
          </Field>
          <Txt tone="muted">
            {localPreview
              ? 'Enter your local server’s base URL, such as http://localhost:4112, without /api or /api/studio/mcp.'
              : 'Enter this MCP connection’s public server base URL, without the API prefix or /studio/mcp.'}
          </Txt>
          {error && <Txt role="alert">{error}</Txt>}
          <Button type="submit" className="ml-auto">
            Connect
          </Button>
        </Form>
      </div>
    </div>
  );
}

function ConnectedStudio({
  configuration,
  onDisconnect,
}: {
  configuration: StudioConfiguration;
  onDisconnect: () => void;
}) {
  // Each connection owns its cache: trace keys in playground-ui are server-independent.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  useEffect(() => () => queryClient.clear(), [queryClient]);
  // ngrok's free development tunnels otherwise return an interstitial instead of API JSON.
  const headers = new URL(configuration.baseUrl).hostname.endsWith('.ngrok-free.app')
    ? { 'ngrok-skip-browser-warning': '1' }
    : undefined;

  return (
    <QueryClientProvider client={queryClient}>
      <MastraReactProvider
        baseUrl={configuration.baseUrl}
        apiPrefix={configuration.apiPrefix}
        credentials="omit"
        headers={headers}
      >
        <div className="bg-background flex h-screen min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2">
            <Txt as="h1" variant="heading">
              Traces
            </Txt>
            <Button variant="ghost" onClick={onDisconnect}>
              Change server
            </Button>
          </header>
          <TraceList />
        </div>
      </MastraReactProvider>
    </QueryClientProvider>
  );
}

export function StudioApp({ configuration }: { configuration: StudioConfiguration }) {
  const [connection, setConnection] = useState<StudioConfiguration>();
  return (
    <TooltipProvider delayDuration={0}>
      {connection ? (
        <ConnectedStudio configuration={connection} onDisconnect={() => setConnection(undefined)} />
      ) : (
        <ConnectionForm configuration={configuration} onConnect={setConnection} />
      )}
    </TooltipProvider>
  );
}
