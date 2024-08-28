import { omitBy } from 'lodash';
import { z } from 'zod';
import { DataLayer } from './data-access';
import { Integration } from './integration';
import {
  FrameWorkConfig,
  IntegrationAction,
  IntegrationActionExcutorParams,
  IntegrationContext,
  IntegrationEvent,
  Routes,
} from './types';
import { IntegrationAuth } from './authenticator';
import { blueprintRunner } from './workflows/runner';
import { Blueprint } from './workflows/types';
import { NextRequest, NextResponse } from 'next/server';
import { makeConnect, makeCallback, makeInngest, makeWebhook } from './next';
import { client } from './utils/inngest';
import { IntegrationMap } from './generated-types';
import { Prisma } from '@prisma-app/client';

export class Framework {
  //global events grouped by Integration
  globalEvents: Map<string, Record<string, IntegrationEvent<any>>> = new Map();
  // global event handlers
  globalEventHandlers: any[] = [];
  // global actions grouped by Integration
  globalActions: Map<string, Record<string, IntegrationAction<any>>> =
    new Map();
  integrations: Map<string, Integration> = new Map();

  dataLayer: DataLayer;

  config: FrameWorkConfig;

  constructor({
    dataLayer,
    config,
  }: {
    dataLayer: DataLayer;
    config: FrameWorkConfig;
  }) {
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

    definition.registerActions();

    const definitionOpenApiSpec = definition.getOpenApiSpec()

    let proxyActions = {}

    if (definitionOpenApiSpec) {

      const proxyGets = Object.entries(definitionOpenApiSpec?.paths).reduce((memo, [path, methods]) => {
        const get = (methods as any).get
        if (get) {
          const getOperationId = get.operationId
          memo[getOperationId] = {
            integrationName: definition.name,
            type: getOperationId,
            icon: {
              alt: definition.name,
              icon: definition.logoUrl,
            },
            displayName: getOperationId,
            label: getOperationId,
            description: "Suh",
            executor: async () => { },
            schema: z.object({}),
          } as IntegrationAction
        }

        return memo
      }, {} as Record<string, IntegrationAction>)


      const proxyPosts = Object.entries(definitionOpenApiSpec?.paths).reduce((memo, [path, methods]) => {
        const post = (methods as any).post;

        if (post) {
          const operationId = post.operationId
          memo[operationId] = {
            integrationName: definition.name,
            type: operationId,
            displayName: operationId,
            label: operationId,
            icon: {
              alt: definition.name,
              icon: definition.logoUrl,
            },
            description: "Suh",
            executor: async () => { },
            schema: z.object({}),
          } as IntegrationAction
        }

        return memo
      }, {} as Record<string, IntegrationAction>)

      proxyActions = {
        ...proxyGets,
        ...proxyPosts
      }
    }

    const totalActions = {
      ...proxyActions,
      ...definition.getActions()
    }

    this.registerActions({
      actions: Object.values(totalActions),
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

  registerActions({
    actions,
    integrationName = this.config.name,
  }: {
    actions: IntegrationAction[];
    integrationName?: string;
  }) {
    const integrationActions = this.globalActions.get(integrationName) || {};

    this.globalActions.set(integrationName, {
      ...integrationActions,
      ...actions.reduce(
        (acc, action) => ({ ...acc, [action.type]: action }),
        {}
      ),
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
    return omitBy(events, (value) => value.triggerProperties?.isHidden);
  }

  getEventsByIntegration(name: string) {
    return this.globalEvents.get(name);
  }

  getGlobalEventHandlers() {
    return this.globalEventHandlers;
  }

  getActions() {
    return this.globalActions;
  }

  getSystemActions() {
    return this.globalActions.get(this.config.name);
  }

  getActionsByIntegration(name: string, includeHidden?: boolean) {
    const integrationActions = this.globalActions.get(name);

    if (includeHidden) {
      return integrationActions;
    }
    return omitBy(integrationActions, (value) => value.isHidden);
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

  async executeAction({
    integrationName = this.config.name,
    action,
    payload,
  }: {
    integrationName?: string;
    action: string;
    payload: IntegrationActionExcutorParams<any>;
  }) {
    if (integrationName === this.config.name) {
      const actionExecutor = this.globalActions.get(this.config.name)?.[action];

      if (!actionExecutor) {
        throw new Error(`No global action exists for ${action}`);
      }

      return actionExecutor.executor(payload);
    }

    const int = this.getIntegration(integrationName);
    if (!int) {
      throw new Error(`No Integration exists for ${integrationName}`);
    }

    const actionExecutor = int.getActions()?.[action];

    if (!actionExecutor) {
      throw new Error(`No action exists for ${action} in ${integrationName}`);
    }

    return actionExecutor.executor(payload);
  }

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

    if (systemEvent?.triggerProperties) {
      await client.send({
        name: 'workflow/run-automations',
        data: {
          trigger: systemEvent.triggerProperties.type,
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
    const systemActions = this.getSystemActions();
    const systemEvents = this.getSystemEvents();

    const connectedIntegrations = await this.connectedIntegrations({
      context: { referenceId: ctx.referenceId },
    });

    const connectedIntegrationActions: Record<
      string,
      IntegrationAction<any>
    > = connectedIntegrations.reduce((acc, { name }) => {
      const actions = this.getActionsByIntegration(name);
      return { ...acc, ...actions };
    }, {});

    const connectedIntegrationEvents: Record<
      string,
      IntegrationEvent<any>
    > = connectedIntegrations.reduce((acc, { name }) => {
      const events = this.getEventsByIntegration(name);
      return { ...acc, ...events };
    }, {});

    const frameworkActions = {
      ...systemActions,
      ...connectedIntegrationActions,
    };
    const frameworkEvents = { ...systemEvents, ...connectedIntegrationEvents };

    await blueprintRunner({
      dataCtx,
      blueprint,
      frameworkActions,
      frameworkEvents,
      ctx,
    });
  };
}
