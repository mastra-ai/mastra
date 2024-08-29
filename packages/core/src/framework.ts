import { omitBy } from 'lodash';
import { z } from 'zod';
import { DataLayer } from './data-access';
import { Integration } from './integration';
import {
  FrameWorkConfig,
  IntegrationApi,
  IntegrationApiExcutorParams,
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

export class Framework {
  //global events grouped by Integration
  globalEvents: Map<string, Record<string, IntegrationEvent<any>>> = new Map();
  // global event handlers
  globalEventHandlers: any[] = [];
  // global apis grouped by Integration
  globalApis: Map<string, Record<string, IntegrationApi<any>>> =
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

    definition.registerApis();

    definition._convertApiClientToSystemApis()
    
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
      ...apis.reduce(
        (acc, api) => ({ ...acc, [api.type]: api }),
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

  async connectIntegration({
    name,
    referenceId,
    authenticator,
    credential,
  }: {
    name: string;
    referenceId: string;
    authenticator: IntegrationAuth;
    credential: Credential;
  }) {
    const integration = await authenticator.dataAccess.createConnection({
      connection: {
        name,
        referenceId,
      },
      credential: credential as any,
    });

    if (authenticator.onConnectionCreated) {
      await authenticator.onConnectionCreated(integration, credential);
    }
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
    const systemApis = this.getSystemApis();
    const systemEvents = this.getSystemEvents();

    const connectedIntegrations = await this.connectedIntegrations({
      context: { referenceId: ctx.referenceId },
    });

    const connectedIntegrationApis: Record<
      string,
      IntegrationApi<any>
    > = connectedIntegrations.reduce((acc, { name }) => {
      const apis = this.getApisByIntegration(name);
      return { ...acc, ...apis };
    }, {});

    const connectedIntegrationEvents: Record<
      string,
      IntegrationEvent<any>
    > = connectedIntegrations.reduce((acc, { name }) => {
      const events = this.getEventsByIntegration(name);
      return { ...acc, ...events };
    }, {});

    const frameworkApis = {
      ...systemApis,
      ...connectedIntegrationApis,
    };
    const frameworkEvents = { ...systemEvents, ...connectedIntegrationEvents };

    await blueprintRunner({
      dataCtx,
      blueprint,
      frameworkApis,
      frameworkEvents,
      ctx,
    });
  };
}
