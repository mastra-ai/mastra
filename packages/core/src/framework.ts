import { omitBy } from 'lodash';
import { DataLayer } from './data-access';
import { Integration } from './integration';
import {
  Config,
  EventHandler,
  EventHandlerReturnType,
  IntegrationApi,
  IntegrationApiExcutorParams,
  IntegrationContext,
  IntegrationCredentialType,
  IntegrationEvent,
  Routes,
  SystemEventHandler,
  VectorProvider,
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
import {
  getVectorQueryApis,
  genericVectorySyncEvent,
  agentVectorSyncEvent,
} from './agents/vector-sync';
import { getAgentSystemApis } from './agents/agent-apis';
import { getAgent, getAgentBlueprint } from './agents';
import { VectorLayer } from './vector-access';

export class Mastra<C extends Config = Config> {
  //global events grouped by Integration
  globalEvents: Map<string, Record<string, IntegrationEvent<any>>> = new Map();

  // global apis grouped by Integration
  globalApis: Map<string, Record<string, IntegrationApi<any>>> = new Map();

  integrations: Map<string, Integration> = new Map();
  dataLayer: DataLayer;
  vectorLayer: VectorLayer;
  agentsConfig: Config['agents'] = {
    agentDirPath: '',
    vectorProvider: [],
  };

  config: C;

  static init<C extends Config = Config>(config: C) {
    if (!config.db.uri) {
      throw new Error('No database config/provider found');
    }

    const dataLayer = new DataLayer({
      url: config.db.uri,
      provider: config.db.provider,
    });

    const vectorLayer = new VectorLayer();

    const framework = new Mastra<typeof config>({
      config,
      dataLayer,
      vectorLayer,
    });

    // Register integrations
    config.integrations.forEach((integration) => {
      framework.__registerIntgeration(integration);
    });

    // Register system apis
    framework.__registerApis({
      apis: [
        ...getAgentSystemApis({ mastra: framework }),
        ...config.workflows.systemApis?.map((api) => {
          return {
            ...api,
            integrationName: config.name,
          };
        }),
        ...getVectorQueryApis({ mastra: framework }),
        {
          integrationName: config.name,
          type: 'trigger_event',
          label: 'Trigger event',
          // getSchemaOptions({ ctx }) {
          //   const options = Promise.resolve({
          //     event: {
          //       options: Array.from(framework.globalEvents.values()).flatMap(
          //         (eventRecord) =>
          //           Object.values(eventRecord).map((event) => ({
          //             value: event.key || event.label || '',
          //             label: event.key || event.label || '',
          //           })).filter((event) => event.value !== '')
          //       ),
          //     },
          //   });
          //   return options;
          // },
          description: 'Trigger event',
          schema: z.object({
            event: z.string(),
            data: z.record(z.any()),
          }),
          executor: async ({ data, ctx }) => {
            const { event } = data;
            return await framework.triggerEvent({
              key: event,
              data: data.data,
              user: {
                connectionId: ctx.connectionId,
              },
            });
          },
        },
      ],
    });

    // Register System events
    framework.__registerEvents({
      events: config.workflows.systemEvents,
    });

    // Register vector sync event
    framework.__registerEvents({
      events: {
        AGENT_VECTOR_SYNC: {
          label: 'Sync vector data for an agent',
          description: 'Sync vector data for an agent',
          schema: z.object({
            agentId: z.string(),
          }),
          handler: agentVectorSyncEvent,
        },
        VECTOR_SYNC: {
          label: 'Sync vector data',
          description: 'Sync vector data',
          schema: z.object({
            vector_provider: z.string(),
            entities: z.array(
              z.object({
                integration: z.string(),
                data: z.array(
                  z.object({
                    name: z.string(),
                    fields: z.array(z.string()),
                    syncEvent: z.string(),
                    index: z.string(),
                  })
                ),
              })
            ),
          }),
          handler: genericVectorySyncEvent,
        },
      },
      integrationName: config.name,
    });

    // Register agent config
    framework.agentsConfig = config.agents;

    return framework as Mastra<C>;
  }

  constructor({
    dataLayer,
    vectorLayer,
    config,
  }: {
    dataLayer: DataLayer;
    vectorLayer: VectorLayer;
    config: C;
  }) {
    this.dataLayer = dataLayer;
    this.vectorLayer = vectorLayer;
    this.config = config;
  }

  public async connectedIntegrations({
    context,
  }: {
    context: { connectionId: string };
  }) {
    const ints = this.availableIntegrations();
    const connectionChecks = await Promise.all(
      ints.map(async ({ integration }) => {
        const connection = await this.dataLayer.getConnection({
          connectionId: context.connectionId,
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

  __registerIntgeration(definition: Integration) {
    const { name } = definition;
    definition.attachDataLayer({ dataLayer: this.dataLayer });

    const router = this.createRouter();

    definition.corePresets = {
      redirectURI: router.makeRedirectURI(),
    };

    this.integrations.set(name, definition);

    definition.registerEvents();

    this.__registerEvents({
      events: definition.getEvents(),
      integrationName: name,
    });

    definition.registerApis();

    definition._convertApiClientToSystemApis();

    this.__registerApis({
      apis: Object.values(definition.getApis()),
      integrationName: name,
    });
  }

  registerApi(name: string, api: Omit<IntegrationApi<any>, 'integrationName'>) {
    const integrationApis = this.globalApis.get(this.config.name) || {};

    this.globalApis.set(this.config.name, {
      ...integrationApis,
      [name]: { ...api, integrationName: this.config.name },
    });
  }

  registerEvent(
    name: string,
    event: Omit<IntegrationEvent<any>, 'integrationName'>
  ) {
    const integrationEvents = this.globalEvents.get('SYSTEM') || {};

    this.globalEvents.set('SYSTEM', {
      ...integrationEvents,
      [name]: event,
    });
  }

  __registerEvents({
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

  __registerApis({
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

  public availableIntegrations() {
    return Array.from(this.integrations.entries()).map(
      ([name, integration]) => {
        return {
          name,
          integration,
        };
      }
    );
  }

  public getIntegration<T extends keyof IntegrationMap>(
    name: T
  ): IntegrationMap[T] {
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
    return Array.from(this.globalEvents.entries()).flatMap(
      ([integrationName, events]) => {
        const groupedHandlers = Object.keys(events)
          .map((eventKey) => {
            const eventHandler = events[eventKey]?.handler;
            if (!eventHandler) return null;

            const isSystemEvent = integrationName === this.config.name;
            const { makeWebhookUrl } = this.createRouter();

            if (isSystemEvent) {
              return (eventHandler as SystemEventHandler)({
                getIntegration: <T>(name: string) =>
                  this.getIntegration<typeof name>(name) as T,
                eventKey,
                getVectorProvider: <P>(name: string) => {
                  return this.agentsConfig.vectorProvider.find(
                    (provider) => provider.provider === name
                  ) as VectorProvider;
                },
                makeWebhookUrl,
              });
            } else {
              const integration = this.getIntegration(integrationName);
              return (eventHandler as EventHandler)({
                integrationInstance: integration,
                eventKey,
                makeWebhookUrl: makeWebhookUrl,
              });
            }
          })
          .filter(Boolean) as EventHandlerReturnType[];

        return groupedHandlers;
      }
    );
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
    connectionId,
    credential,
  }: {
    name: string;
    connectionId: string;
    credential: Omit<Prisma.CredentialUncheckedCreateInput, 'k_id'>;
  }) {
    const authenticator = this.authenticator(name);

    if (!authenticator) {
      throw new Error(`Authenticator for ${name} not found`);
    }

    const integration = await authenticator.dataAccess.createConnection({
      connection: {
        name,
        connectionId,
      },
      credential: credential,
    });

    if (authenticator.onConnectionCreated) {
      await authenticator.onConnectionCreated(integration, credential);
    }
  }

  async disconnectIntegration({
    name,
    connectionId,
  }: {
    name: string;
    connectionId: string;
  }) {
    const integration = this.getIntegration(name);
    const k_id = (
      await this.dataLayer.getConnection({
        name,
        connectionId,
      })
    )?.id;

    if (!k_id) {
      throw new Error(`No connection found for ${name}`);
    }

    if (integration?.dataLayer) {
      await integration.onDisconnect({ connectionId });
    }

    if (integration?.config.authType === IntegrationCredentialType.OAUTH) {
      const authenticator = this.authenticator(name);
      await authenticator.revokeAuth({ k_id });
    }

    await this.dataLayer.deleteConnection({
      connectionId,
    });
  }

  public async callApi({
    integrationName = this.config.name,
    api,
    payload,
  }: {
    integrationName?: string;
    api: string;
    payload: IntegrationApiExcutorParams;
  }) {
    if (integrationName === this.config.name || integrationName === 'SYSTEM') {
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

  public async subscribeEvent({
    id,
    interval = 5000,
    timeout = 60000,
  }: {
    id: string;
    interval?: number;
    timeout?: number;
  }) {
    const inngestApiUrl = this.config.runner?.uri ?? process.env.INNGEST_URL!;
    const inngestApiToken =
      this.config.runner?.signingKey ??
      process.env.INNGEST_SIGNING_KEY ??
      '123';

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

        console.log(`Polling for event ${id}...`, response.ok);

        if (response.ok) {
          // Success! Return the response object.

          const obj = await response.json();

          console.log({ obj });

          const { data, error } = obj;

          console.log(`Got data for event ${id}...`, data, error);

          if (error) {
            console.error(error);
            return null;
          }

          if (data?.length === 0) {
            // Wait for the specified interval before polling again
            await new Promise((resolve) => setTimeout(resolve, interval));
            return poll();
          }

          const lastRun = data?.[0];

          console.log(lastRun);

          if (!lastRun) {
            return null;
          }

          if (lastRun.status === 'Running') {
            // Wait for the specified interval before polling again
            await new Promise((resolve) => setTimeout(resolve, interval));
            return poll();
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

  public async triggerEvent<
    KEY extends keyof C['workflows']['systemEvents'],
    SYSTEM_EVENT_SCHEMA extends C['workflows']['systemEvents'][KEY]['schema']
  >({
    key,
    data,
    user,
    integrationName,
  }: {
    integrationName?: string;
    key: KEY;
    data: SYSTEM_EVENT_SCHEMA extends ZodSchema
      ? z.infer<SYSTEM_EVENT_SCHEMA>
      : SYSTEM_EVENT_SCHEMA extends ZodeSchemaGenerator
      ? z.infer<Awaited<ReturnType<SYSTEM_EVENT_SCHEMA>>>
      : never;
    user?: {
      connectionId: string;
      [key: string]: any;
    };
  }) {
    try {
      const returnObj: { event: any; workflowEvent?: any } = {
        event: {},
      };

      let integrationEvents: Record<string, IntegrationEvent<any>> | undefined;

      if (integrationName) {
        integrationEvents = this.getEventsByIntegration(integrationName);
      } else {
        integrationEvents = Array.from(this.globalEvents.values()).reduce(
          (acc, curr) => ({ ...acc, ...curr }),
          {}
        );
      }

      if (!integrationEvents) {
        throw new Error(`No integration events found`);
      }

      const integrationEvent = integrationEvents[key as string];

      if (!integrationEvent) {
        throw new Error(
          `No event exists for ${key as string} in ${
            integrationName || 'system'
          }`
        );
      }

      const event = await client.send({
        name: key as string,
        data: data,
        user: user,
      });

      returnObj['event'] = {
        ...event,
        subscribe: async ({
          interval,
          timeout,
        }: { interval?: number; timeout?: number } = {}) => {
          return this.subscribeEvent({ id: event.ids?.[0], interval, timeout });
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
        subscribe: async ({
          interval,
          timeout,
        }: { interval?: number; timeout?: number } = {}) => {
          return this.subscribeEvent({
            id: workflowEvent.ids?.[0],
            interval,
            timeout,
          });
        },
      };

      return returnObj;
    } catch (e) {
      throw new Error(`Error triggering event: ${e}`);
    }
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
      connectionId: string;
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

  public createRouter() {
    const self = this;
    const makeWebhookUrl = ({
      event,
      name,
    }: {
      name: string;
      event: string;
    }) => {
      return encodeURI(
        `${self?.config?.systemHostURL}${self.routes.webhook}?name=${name}&event=${event}`
      );
    };

    const makeRedirectURI = () => {
      return new URL(
        self.routes.callback,
        self.config.systemHostURL
      ).toString();
    };

    const makeConnectURI = (props: {
      name: string;
      connectionId: string;
      clientRedirectPath: string;
    }) => {
      const params = new URLSearchParams(props);

      return new URL(
        `${self.routes.connect}?${params.toString()}`,
        self.config.systemHostURL
      ).toString();
    };

    const registerRoutes = () => {
      const registry: Record<
        string,
        (req: NextRequest) => NextResponse | Promise<Response>
      > = {
        [self.routes.connect]: makeConnect(self),
        [self.routes.callback]: makeCallback(self),
        [self.routes.inngest]: makeInngest(self),
        [self.routes.webhook]: makeWebhook(self),
      };

      return (req: NextRequest) => {
        const route = req.nextUrl.pathname;
        if (req.nextUrl.pathname in registry) {
          return registry[route](req);
        }

        return NextResponse.json(null, { status: 404 });
      };
    };

    return {
      makeWebhookUrl,
      makeRedirectURI,
      makeConnectURI,
      registerRoutes,
    };
  }

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

  async getAgent({
    connectionId,
    agentId,
  }: {
    agentId: string;
    connectionId: string;
  }) {
    const agentBlueprint = await getAgentBlueprint({
      agentDir: this.config.agents.agentDirPath,
      agentId,
    });

    const arrMap = Array.from(this.getApis());

    const finalApis = arrMap.reduce((acc, [_k, v]) => {
      return { ...acc, ...v };
    }, {});

    return getAgent({
      connectionId,
      agent: agentBlueprint,
      apis: finalApis,
    });
  }
}
