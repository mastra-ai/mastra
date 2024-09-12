import { omitBy } from 'lodash';
import { DataLayer } from './data-access';
import { Integration } from './integration';
import {
  Config,
  IntegrationApi,
  IntegrationApiExcutorParams,
  IntegrationContext,
  IntegrationCredentialType,
  IntegrationEvent,
  Routes,
  ZodeSchemaGenerator,
} from './types';
import { blueprintRunner } from './workflows/runner';
import { Blueprint } from './workflows/types';
import { NextRequest, NextResponse } from 'next/server';
import { makeConnect, makeCallback, makeInngest, makeWebhook } from './next';
import { client } from './utils/inngest';
import { IntegrationMap } from './generated-types';
import { Prisma } from '@prisma-app/client';
import { z, ZodSchema } from 'zod';

export class Framework<C extends Config = Config> {
  //global events grouped by Integration
  globalEvents: Map<string, Record<string, IntegrationEvent<any>>> = new Map();
  // global event handlers
  globalEventHandlers: any[] = [];
  // global apis grouped by Integration
  globalApis: Map<string, Record<string, IntegrationApi<any>>> = new Map();
  integrations: Map<string, Integration> = new Map();

  dataLayer: DataLayer;

  config: C;

  constructor({ dataLayer, config }: { dataLayer: DataLayer; config: C }) {
    this.dataLayer = dataLayer;
    this.config = config;
  }

  async connectedIntegrations({
    context,
  }: {
    context: { referenceId: string };
  }) {
    const ints = this.availableIntegrations();
    const connectionChecks = await Promise.all(
      ints.map(async ({ integration }) => {
        const connection = await this.dataLayer.getConnectionByReferenceId({
          referenceId: context.referenceId,
          name: integration.name,
        });

        return { integration, connected: !!connection };
      })
    );
    return connectionChecks
      .filter(({ connected }) => connected)
      .map(({ integration }) => integration);
  }

  get routes(): Record<Routes, string> {
    const registry = {
      connect: '/connect',
      callback: '/connect/callback',
      inngest: '/inngest',
      webhook: '/webhook',
    };

    return Object.entries(registry).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: `${this.config.routeRegistrationPath}${value}`,
      }),
      {} as Record<string, string>
    );
  }

  registerRoutes() {
    const registry: Record<
      string,
      (req: NextRequest) => NextResponse | Promise<Response>
    > = {
      [this.routes.connect]: makeConnect(this),
      [this.routes.callback]: makeCallback(this),
      [this.routes.inngest]: makeInngest(this),
      [this.routes.webhook]: makeWebhook(this),
    };

    return (req: NextRequest) => {
      const route = req.nextUrl.pathname;
      if (req.nextUrl.pathname in registry) {
        return registry[route](req);
      }

      return NextResponse.json(null, { status: 404 });
    };
  }

  registerIntgeration(definition: Integration) {
    const { name } = definition;
    definition.attachDataLayer({ dataLayer: this.dataLayer });

    definition.corePresets = {
      redirectURI: this.makeRedirectURI(),
    };

    this.integrations.set(name, definition);

    definition.registerEvents();

    this.registerEvents({
      events: definition.getEvents(),
      integrationName: name,
    });

    definition.registerApis();

    definition._convertApiClientToSystemApis();

    this.registerApis({
      apis: Object.values(definition.getApis()),
      integrationName: name,
    });

    this.globalEventHandlers.push(
      ...definition.getEventHandlers({
        makeWebhookUrl: this.makeWebhookUrl,
      })
    );
  }

  registerEvents({
    events,
    integrationName = this.config.name,
  }: {
    events: Record<string, IntegrationEvent<any>>;
    integrationName?: string;
  }) {
    const integrationEvents = this.globalEvents.get(integrationName) || {};

    this.globalEvents.set(integrationName, {
      ...integrationEvents,
      ...events,
    });
  }

  registerApis({
    apis,
    integrationName = this.config.name,
  }: {
    apis: IntegrationApi[];
    integrationName?: string;
  }) {
    const integrationApis = this.globalApis.get(integrationName) || {};

    this.globalApis.set(integrationName, {
      ...integrationApis,
      ...apis.reduce((acc, api) => ({ ...acc, [api.type]: api }), {}),
    });
  }

  availableIntegrations() {
    return Array.from(this.integrations.entries()).map(
      ([name, integration]) => {
        return {
          name,
          integration,
        };
      }
    );
  }

  getIntegration<T extends keyof IntegrationMap>(name: T): IntegrationMap[T] {
    return this.integrations.get(name as string) as IntegrationMap[T];
  }

  getGlobalEvents() {
    return this.globalEvents;
  }

  getSystemEvents() {
    const events = this.globalEvents.get(this.config.name);
    return events || {};
  }

  getEventsByIntegration(name: string) {
    return this.globalEvents.get(name);
  }

  getGlobalEventHandlers() {
    return this.globalEventHandlers;
  }

  getApis() {
    return this.globalApis;
  }

  getSystemApis() {
    return this.globalApis.get(this.config.name);
  }

  getApisByIntegration(name: string, includeHidden?: boolean) {
    const integrationApis = this.globalApis.get(name);

    if (includeHidden) {
      return integrationApis;
    }
    return omitBy(integrationApis, (value) => value.isHidden);
  }

  authenticatableIntegrations() {
    return this.availableIntegrations().filter(({ integration }) => {
      try {
        integration.getAuthenticator();
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  authenticator(name: string) {
    const int = this.getIntegration(name);

    if (!int) {
      throw new Error(`No integration exists for ${name}`);
    }

    return int.getAuthenticator();
  }

  async connectIntegrationByCredential({
    name,
    referenceId,
    credential,
  }: {
    name: string;
    referenceId: string;
    credential: Omit<Prisma.CredentialUncheckedCreateInput, 'connectionId'>;
  }) {
    const authenticator = this.authenticator(name);

    if (!authenticator) {
      throw new Error(`Authenticator for ${name} not found`);
    }

    const integration = await authenticator.dataAccess.createConnection({
      connection: {
        name,
        referenceId,
      },
      credential: credential,
    });

    if (authenticator.onConnectionCreated) {
      await authenticator.onConnectionCreated(integration, credential);
    }
  }

  async disconnectIntegration({
    name,
    referenceId,
  }: {
    name: string;
    referenceId: string;
  }) {
    const integration = this.getIntegration(name);
    const connectionId = (
      await this.dataLayer.getConnectionByReferenceId({
        name,
        referenceId,
      })
    )?.id;

    if (!connectionId) {
      throw new Error(`No connection found for ${name}`);
    }

    if (integration?.dataLayer) {
      await integration.onDisconnect({ referenceId });
    }

    if (integration?.config.authType === IntegrationCredentialType.OAUTH) {
      const authenticator = this.authenticator(name);
      await authenticator.revokeAuth({ connectionId });
    }

    await this.dataLayer.deleteConnection({
      connectionId,
    });
  }

  async executeApi({
    integrationName = this.config.name,
    api,
    payload,
  }: {
    integrationName?: string;
    api: string;
    payload: IntegrationApiExcutorParams<any>;
  }) {
    if (integrationName === this.config.name) {
      const apiExecutor = this.globalApis.get(this.config.name)?.[api];

      if (!apiExecutor) {
        throw new Error(`No global api exists for ${api}`);
      }

      return apiExecutor.executor(payload);
    }

    const int = this.getIntegration(integrationName);
    if (!int) {
      throw new Error(`No Integration exists for ${integrationName}`);
    }

    const apiExecutor = int.getApis()?.[api];

    if (!apiExecutor) {
      throw new Error(`No api exists for ${api} in ${integrationName}`);
    }

    return apiExecutor.executor(payload);
  }

  async watchEvent({
    id,
    interval = 5000,
    timeout = 60000,
  }: {
    id: string;
    interval?: number;
    timeout?: number;
  }) {
    const inngestApiUrl = process.env.INNGEST_API_URL!;
    const inngestApiToken = process.env.INNGEST_SIGNING_KEY ?? '123';

    const startTime = Date.now();

    const poll = async (): Promise<{
      status: string;
      startedAt: string;
      endedAt: string;
    } | null> => {
      try {
        const response = await fetch(`${inngestApiUrl}/v1/events/${id}/runs`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${inngestApiToken}`,
          },
        });

        if (response.ok) {
          // Success! Return the response object.

          const { data, error } = await response.json();

          if (error) {
            return null;
          }

          const lastRun = data?.data?.at?.(0);

          if (!lastRun) {
            return null;
          }

          return {
            status: lastRun.status,
            startedAt: lastRun.run_started_at,
            endedAt: lastRun.ended_at,
          };
        }
      } catch (error) {
        console.error(`Request failed: ${error}`);
      }

      // Check if timeout has been reached
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= timeout) {
        console.log('Polling timeout reached.');
        return null;
      }

      // Wait for the specified interval before polling again
      await new Promise((resolve) => setTimeout(resolve, interval));
      return poll(); // Recursively call poll
    };

    return poll();
  }

  async sendEvent<
    KEY extends keyof C['systemEvents'],
    SYSTEM_EVENT_SCHEMA extends C['systemEvents'][KEY]['schema']
  >({
    key,
    data,
    user,
    integrationName = this.config.name,
  }: {
    integrationName?: string;
    key: KEY;
    data: SYSTEM_EVENT_SCHEMA extends ZodSchema
      ? z.infer<SYSTEM_EVENT_SCHEMA>
      : SYSTEM_EVENT_SCHEMA extends ZodeSchemaGenerator
      ? z.infer<Awaited<ReturnType<SYSTEM_EVENT_SCHEMA>>>
      : never;
    user?: {
      referenceId: string;
      [key: string]: any;
    };
  }) {
    const returnObj: { event: any; workflowEvent?: any } = {
      event: {},
    };

    const integrationEvents = this.globalEvents.get(integrationName);

    if (!integrationEvents) {
      throw new Error(`No events exists for ${integrationName}`);
    }

    const integrationEvent = integrationEvents[key as string];

    if (!integrationEvent) {
      throw new Error(
        `No event exists for ${key as string} in ${integrationName}`
      );
    }

    const event = await client.send({
      name: key as string,
      data: data,
      user: user,
    });

    returnObj['event'] = {
      ...event,
      watch: async ({
        interval,
        timeout,
      }: { interval?: number; timeout?: number } = {}) => {
        return this.watchEvent({ id: event.ids?.[0], interval, timeout });
      },
    };

    const workflowEvent = await client.send({
      name: 'workflow/run-automations',
      data: {
        trigger: key,
        payload: data,
      },
      user: user as any,
    });

    returnObj['workflowEvent'] = {
      ...workflowEvent,
      watch: async ({
        interval,
        timeout,
      }: { interval?: number; timeout?: number } = {}) => {
        return this.watchEvent({
          id: workflowEvent.ids?.[0],
          interval,
          timeout,
        });
      },
    };

    return returnObj;
  }

  //TODO: Rename to triggerWorkflowEvent maybe ?
  async triggerSystemEvent<T = Record<string, any>>({
    key,
    data,
    user,
  }: {
    key: string;
    data: T;
    user?: {
      referenceId: string;
      [key: string]: any;
    };
  }) {
    const event = await client.send({
      name: key as any,
      data: data as any,
      user: user as any,
    });

    const systemEvent = this.getSystemEvents()[key];

    if (systemEvent) {
      await client.send({
        name: 'workflow/run-automations',
        data: {
          trigger: key,
          payload: data,
        },
        user: user as any,
      });
    }

    return event;
  }

  makeWebhookUrl = ({ event, name }: { name: string; event: string }) => {
    return encodeURI(
      `${this?.config?.systemHostURL}${this.routes.webhook}?name=${name}&event=${event}`
    );
  };

  makeRedirectURI = () => {
    return new URL(this.routes.callback, this.config.systemHostURL).toString();
  };

  makeConnectURI = (props: {
    name: string;
    referenceId: string;
    clientRedirectPath: string;
  }) => {
    const params = new URLSearchParams(props);

    return new URL(
      `${this.routes.connect}?${params.toString()}`,
      this.config.systemHostURL
    ).toString();
  };

  runBlueprint = async ({
    blueprint,
    dataCtx = {},
    ctx,
  }: {
    blueprint: Blueprint;
    dataCtx?: any;
    ctx: IntegrationContext;
  }) => {
    const systemApis = this.getSystemApis();
    const systemEvents = this.getSystemEvents();

    const availableIntegrations = this.availableIntegrations()?.map(
      ({ integration }) => integration
    );

    const availableIntegrationApis: Record<
      string,
      IntegrationApi<any>
    > = availableIntegrations.reduce((acc, { name }) => {
      const apis = this.getApisByIntegration(name);
      return { ...acc, ...apis };
    }, {});

    const availableIntegrationEvents: Record<
      string,
      IntegrationEvent<any>
    > = availableIntegrations.reduce((acc, { name }) => {
      const events = this.getEventsByIntegration(name);
      return { ...acc, ...events };
    }, {});

    const frameworkApis = {
      ...systemApis,
      ...availableIntegrationApis,
    };
    const frameworkEvents = { ...systemEvents, ...availableIntegrationEvents };

    await blueprintRunner({
      dataCtx,
      blueprint,
      frameworkApis,
      frameworkEvents,
      ctx,
    });
  };
}
