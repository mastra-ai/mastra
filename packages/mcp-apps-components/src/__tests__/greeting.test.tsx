/**
 * @vitest-environment jsdom
 */
import type { Client, Transport } from '@modelcontextprotocol/client';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { Greeting } from '../apps/greeting/greeting';
import { greetingServer, serveAndConnect } from './greeting-server';

let host: Awaited<ReturnType<typeof serveAndConnect>>;
beforeAll(async () => {
  host = await serveAndConnect(greetingServer());
});
afterAll(() => host.close());
// The app reports its size to the host on the next animation frame; let that land before the
// app unmounts and closes its connection, as it would in an iframe that stays open.
afterEach(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));

/**
 * Renders the app as an iframe would run it, with `window.parent` played by an `AppBridge`: the
 * host side MCP Apps hosts embed, forwarding the app's tool calls to the real MCP server through
 * `client`. Only the `postMessage` wire is stubbed; messages are cloned as `postMessage` does.
 */
async function openApp(client: Client, toolArguments: Record<string, unknown>) {
  const parent = { postMessage: (message: unknown) => hostTransport.onmessage?.(structuredClone(message) as never) };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });

  const hostTransport: Transport = {
    start: async () => {},
    close: async () => {},
    send: async message => {
      const event = new MessageEvent('message', { data: structuredClone(message) });
      Object.defineProperty(event, 'source', { value: parent });
      window.dispatchEvent(event);
    },
  };
  const bridge = new AppBridge(client, { name: 'test-host', version: '1.0.0' }, { serverTools: {}, message: {} });
  const messages: string[] = [];
  bridge.onmessage = async ({ content }) => {
    messages.push(content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('\n'));
    return {};
  };
  // The host sends the arguments the model called the opening tool with, once the app is ready.
  bridge.oninitialized = () => void bridge.sendToolInput({ arguments: toolArguments });
  await bridge.connect(hostTransport);

  render(<Greeting />);
  return { messages };
}

it('greets the name the model asked for, with the greeting the server returns', async () => {
  await openApp(host.client, { name: 'Ada' });

  expect(await screen.findByText('Hello, Ada, from the server!')).toBeTruthy();
});

it('posts the reply to the conversation', async () => {
  const { messages } = await openApp(host.client, { name: 'Ada' });

  fireEvent.click(await screen.findByRole('button', { name: 'Say hi back' }));

  await expect.poll(() => messages).toEqual(['Ada says hi back!']);
});

it("shows the server's error when it has no greeting", async () => {
  await openApp(host.client, { name: 'Mallory' });

  expect((await screen.findByRole('alert')).textContent).toContain('No greeting for Mallory');
});
