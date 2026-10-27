import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { registerApiRoute } from '../server';
import type { ApiRoute } from '../server/types';
import { SignalProvider } from '../signals/signal-provider';
import { Mastra } from './index';

class RoutedSignalProvider extends SignalProvider<'routed-signals'> {
  readonly id = 'routed-signals' as const;

  constructor(private readonly routes: ApiRoute[]) {
    super();
  }

  getRoutes() {
    return this.routes;
  }
}

const webhookRoute = registerApiRoute('/routed/webhook', {
  method: 'POST',
  requiresAuth: false,
  handler: c => c.json({ ok: true }),
});

const createAgent = (id: string, signals: SignalProvider[]) =>
  new Agent({ id, name: id, instructions: 'test', model: 'openai/gpt-5-mini', signals });

describe('signal provider routes', () => {
  it('adds routes from an agent signal provider to server.apiRoutes', () => {
    const userRoute = registerApiRoute('/custom', { method: 'GET', handler: c => c.text('ok') });
    const agent = createAgent('agent', [new RoutedSignalProvider([webhookRoute])]);

    const mastra = new Mastra({ logger: false, agents: { agent }, server: { apiRoutes: [userRoute] } });

    expect(mastra.getServer()?.apiRoutes).toEqual([userRoute, webhookRoute]);
  });

  it('adds routes for agents registered after construction', () => {
    const mastra = new Mastra({ logger: false });

    mastra.addAgent(createAgent('agent', [new RoutedSignalProvider([webhookRoute])]));

    expect(mastra.getServer()?.apiRoutes).toEqual([webhookRoute]);
  });

  it('mounts a provider shared by several agents once', () => {
    const provider = new RoutedSignalProvider([webhookRoute]);

    const mastra = new Mastra({
      logger: false,
      agents: { first: createAgent('first', [provider]), second: createAgent('second', [provider]) },
    });

    expect(mastra.getServer()?.apiRoutes).toEqual([webhookRoute]);
  });

  it('keeps provider routes when a file-system server config is registered', () => {
    const fsRoute = registerApiRoute('/fs', { method: 'GET', handler: c => c.text('ok') });
    const mastra = new Mastra({
      logger: false,
      agents: { agent: createAgent('agent', [new RoutedSignalProvider([webhookRoute])]) },
    });

    mastra.__registerFsServer({ port: 4111, apiRoutes: [fsRoute] });

    expect(mastra.getServer()?.apiRoutes).toEqual([webhookRoute, fsRoute]);
  });

  it('leaves server config untouched when providers have no routes', () => {
    const mastra = new Mastra({
      logger: false,
      agents: { agent: createAgent('agent', [new RoutedSignalProvider([])]) },
    });

    expect(mastra.getServer()).toBeUndefined();
  });
});
