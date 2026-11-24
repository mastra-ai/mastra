import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { useState } from 'react';
import { z } from 'zod';

/** The app-only tool the app calls, on the server that opened it, to fetch the greeting. */
export const GET_GREETING_TOOL = 'getGreeting';

const greetingOutput = z.object({ greeting: z.string() });

type State =
  | { status: 'waiting' }
  | { status: 'loading'; name: string }
  | { status: 'ready'; name: string; greeting: string }
  | { status: 'error'; message: string };

async function fetchGreeting(app: App, name: string): Promise<State> {
  const result = await app.callServerTool({ name: GET_GREETING_TOOL, arguments: { name } });
  const output = greetingOutput.safeParse(result.structuredContent);
  if (result.isError || !output.success) {
    const text = result.content.find(block => block.type === 'text');
    return { status: 'error', message: text?.text ?? `${GET_GREETING_TOOL} returned no greeting.` };
  }
  return { status: 'ready', name, greeting: output.data.greeting };
}

/**
 * Greets the name the model passed to the tool that opened the app. The host sends that tool's
 * arguments (`ui/notifications/tool-input`); the app then fetches the greeting from the server's
 * app-only `getGreeting` tool and can post a message back to the conversation (`ui/message`).
 */
export function Greeting() {
  const [state, setState] = useState<State>({ status: 'waiting' });
  const { app, error } = useApp({
    appInfo: { name: 'Mastra greeting', version: '1.0.0' },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolinput = ({ arguments: args }) => {
        const name = typeof args?.name === 'string' && args.name.trim() ? args.name : 'there';
        setState({ status: 'loading', name });
        fetchGreeting(app, name).then(setState, (cause: unknown) =>
          setState({ status: 'error', message: cause instanceof Error ? cause.message : String(cause) }),
        );
      };
    },
  });

  if (error) return <p role="alert">Couldn't connect to the host: {error.message}</p>;
  if (state.status === 'waiting') return <p>Waiting for a name…</p>;
  if (state.status === 'loading') return <p>Greeting {state.name}…</p>;
  if (state.status === 'error') return <p role="alert">{state.message}</p>;

  const { name, greeting } = state;
  return (
    <div>
      <p>{greeting}</p>
      <button
        type="button"
        disabled={!app}
        onClick={() => app?.sendMessage({ role: 'user', content: [{ type: 'text', text: `${name} says hi back!` }] })}
      >
        Say hi back
      </button>
    </div>
  );
}
