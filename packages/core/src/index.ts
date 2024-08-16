import { IntegrationPlugin } from './plugin';
import {
  APIKey,
  IntegrationAction,
  IntegrationActionExcutorParams,
  IntegrationContext,
  IntegrationEvent,
} from './types';
import { omitBy } from 'lodash';
import { DataLayer } from './data-access';
import { AutomationBlueprint } from './workflows/types';
import { blueprintRunner } from './workflows/runner';
import { IntegrationAuth } from './authenticator';
import { DataIntegrationCredential } from '@prisma/client';

export interface Config {
  name: string;
  systemHostURL: string;
  routeRegistrationPath: string;
  db: {
    provider: string;
    uri: string;
  };
  plugins: IntegrationPlugin[];
  systemActions: IntegrationAction[];
  systemEvents: IntegrationEvent[];
}

export const CORE_PLUGIN_NAME = 'SYSTEM';

export { PluginError } from './utils/errors';
export { DataLayer } from './data-access';
export { registerRoutes } from './next';
export * from './types';
export { IntegrationPlugin } from './plugin';
export { IntegrationCredentialType } from './types';
export {
  FieldTypes,
  DataIntegration,
  DataIntegrationCredential,
  SyncTable,
  Field,
  Record,
} from '@prisma-app/client';
export { IntegrationAuth } from './authenticator';
export * from './utils';
export * from './next/utils';

export type FrameWorkConfig = {
  routeRegistrationPath: string;
  systemHostURL: string;
};
export class IntegrationFramework {
  //global events grouped by plugin
  globalEvents: Map<string, Record<string, IntegrationEvent>> = new Map();
  // global event handlers
  globalEventHandlers: any[] = [];
  // global actions grouped by plugin
  globalActions: Map<string, Record<string, IntegrationAction<any>>> =
    new Map();
  plugins: Map<string, IntegrationPlugin> = new Map();

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

  async connectedPlugins({ context }: { context: { connectionId: string } }) {
    const plugins = this.availablePlugins();
    const connectionChecks = await Promise.all(
      plugins.map(async ({ plugin }) => {
        const connection =
          await this.dataLayer.getDataIntegrationByConnectionId({
            connectionId: context.connectionId,
            name: plugin.name,
          });
        return { plugin, connected: !!connection };
      })
    );
    return connectionChecks
      .filter(({ connected }) => connected)
      .map(({ plugin }) => plugin);
  }

  registerPlugin(pluginDefinition: IntegrationPlugin) {
    const { name } = pluginDefinition;
    pluginDefinition.attachDataLayer({ dataLayer: this.dataLayer });

    this.plugins.set(name, pluginDefinition);

    pluginDefinition.defineEvents();

    this.registerEvents({
      events: Object.values(pluginDefinition.getEvents()),
      pluginName: name,
    });

    pluginDefinition.defineActions();

    this.registerActions({
      actions: Object.values(pluginDefinition.getActions()),
      pluginName: name,
    });

    this.globalEventHandlers.push(
      ...pluginDefinition.getEventHandlers({
        makeWebhookUrl: this.makeWebhookUrl,
      })
    );
  }

  registerEvents({
    events,
    pluginName = CORE_PLUGIN_NAME,
  }: {
    events: IntegrationEvent[];
    pluginName?: string;
  }) {
    const pluginEvents = this.globalEvents.get(pluginName) || {};
    this.globalEvents.set(pluginName, {
      ...pluginEvents,
      ...events.reduce((acc, event) => ({ ...acc, [event.key]: event }), {}),
    });
  }

  registerActions({
    actions,
    pluginName = CORE_PLUGIN_NAME,
  }: {
    actions: IntegrationAction[];
    pluginName?: string;
  }) {
    const pluginActions = this.globalActions.get(pluginName) || {};

    this.globalActions.set(pluginName, {
      ...pluginActions,
      ...actions.reduce(
        (acc, action) => ({ ...acc, [action.type]: action }),
        {}
      ),
    });
  }

  availablePlugins() {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => {
      return {
        name,
        plugin,
      };
    });
  }

  getPlugin(name: string) {
    return this.plugins.get(name);
  }

  getGlobalEvents() {
    return this.globalEvents;
  }

  getSystemEvents() {
    const events = this.globalEvents.get(CORE_PLUGIN_NAME);
    return omitBy(events, (value) => value.triggerProperties?.isHidden);
  }

  getEventsByPlugin(name: string) {
    return this.globalEvents.get(name);
  }

  getGlobalEventHandlers() {
    return this.globalEventHandlers;
  }

  getActions() {
    return this.globalActions;
  }

  getSystemActions() {
    return this.globalActions.get(CORE_PLUGIN_NAME);
  }

  getActionsByPlugin(name: string, includeHidden?: boolean) {
    const pluginActions = this.globalActions.get(name);

    if (includeHidden) {
      return pluginActions;
    }
    return omitBy(pluginActions, (value) => value.isHidden);
  }

  authenticatablePlugins() {
    return this.availablePlugins().filter(({ plugin }) => {
      try {
        plugin.getAuthenticator();
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  authenticator(name: string) {
    const plugin = this.getPlugin(name);

    if (!plugin) {
      throw new Error(`No plugin exists for ${name}`);
    }

    return plugin.getAuthenticator();
  }

  async connectPlugin({
    name,
    connectionId,
    authenticator,
    credential,
  }: {
    name: string;
    connectionId: string;
    authenticator: IntegrationAuth;
    credential: DataIntegrationCredential;
  }) {
    const integration = await authenticator.dataAccess.createDataIntegration({
      dataIntegration: {
        name,
        connectionId,
      },
      credential: credential as any,
    });

    if (authenticator.onDataIntegrationCreated) {
      await authenticator.onDataIntegrationCreated(integration, credential);
    }
  }

  async executeAction({
    pluginName = CORE_PLUGIN_NAME,
    action,
    payload,
  }: {
    pluginName?: string;
    action: string;
    payload: IntegrationActionExcutorParams<any>;
  }) {
    if (pluginName === CORE_PLUGIN_NAME) {
      const actionExecutor = this.globalActions.get(CORE_PLUGIN_NAME)?.[action];

      if (!actionExecutor) {
        throw new Error(`No global action exists for ${action}`);
      }

      return actionExecutor.executor(payload);
    }

    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`No plugin exists for ${pluginName}`);
    }

    const actionExecutor = plugin.getActions()?.[action];

    if (!actionExecutor) {
      throw new Error(`No action exists for ${action} in ${pluginName}`);
    }

    return actionExecutor.executor(payload);
  }

  makeWebhookUrl({ event, name }: { name: string; event: string }) {
    return `${this?.config?.systemHostURL}/${this?.config?.routeRegistrationPath}/webhook?name=${name}&event=${event}`;
  }

  async runBlueprint({
    blueprint,
    dataCtx = {},
    ctx,
  }: {
    blueprint: AutomationBlueprint;
    dataCtx?: any;
    ctx: IntegrationContext;
  }) {
    const systemActions = this.getSystemActions();
    const systemEvents = this.getSystemEvents();
    const connectedPlugins = await this.connectedPlugins({
      context: { connectionId: ctx.connectionId },
    });

    const connectedPluginsActions: Record<
      string,
      IntegrationAction<any>
    > = connectedPlugins.reduce((acc, { name }) => {
      const actions = this.getActionsByPlugin(name);
      return { ...acc, ...actions };
    }, {});
    const connectedPluginsEvents: Record<string, IntegrationEvent> =
      connectedPlugins.reduce((acc, { name }) => {
        const events = this.getEventsByPlugin(name);
        return { ...acc, ...events };
      }, {});

    const frameworkActions = { ...systemActions, ...connectedPluginsActions };
    const frameworkEvents = { ...systemEvents, ...connectedPluginsEvents };

    await blueprintRunner({
      dataCtx,
      blueprint,
      frameworkActions,
      frameworkEvents,
      ctx,
    });
  }
}

export function createFramework(config: Config) {
  // let db;

  // if (config.db.provider === 'postgres') {
  //   db = new PrismaClient({ datasources: { db: { url: config.db.uri } } });
  // }

  // if (!db) {
  //   throw new Error('No database config/provider found');
  // }

  const dataLayer = new DataLayer({
    url: config.db.uri,
    provider: config.db.provider,
  });
  const framework = new IntegrationFramework({
    dataLayer,
    config: {
      routeRegistrationPath: config?.routeRegistrationPath,
      systemHostURL: config?.systemHostURL,
    },
  });

  // Register plugins
  config.plugins.forEach((plugin) => {
    framework.registerPlugin(plugin);
  });

  // Register System actions
  framework.registerActions({
    actions: config.systemActions,
  });

  // Register System events
  framework.registerEvents({
    events: config.systemEvents,
  });

  return framework;
}
