import { PrismaClient } from '@prisma/client';
import { IntegrationPlugin } from './plugin';
import {
  IntegrationAction,
  IntegrationActionExcutorParams,
  IntegrationEvent,
} from './types';
import { omitBy } from 'lodash';

export interface Config {
  name: string;
  db: {
    provider: string,
    uri: string
  },
  plugins: IntegrationPlugin[];
  systemActions: IntegrationAction[];
  systemEvents: IntegrationEvent[];
}

export const CORE_PLUGIN_NAME = 'SYSTEM';

export * from './types'

class IntegrationFramework {
  //global events grouped by plugin
  globalEvents: Map<string, Record<string, IntegrationEvent>> = new Map();
  // global event handlers
  globalEventHandlers: any[] = [];
  // global actions grouped by plugin
  globalActions: Map<string, Record<string, IntegrationAction<any>>> =
    new Map();
  plugins: Map<string, IntegrationPlugin> = new Map();

  registerPlugin(pluginDefinition: IntegrationPlugin) {
    const { name } = pluginDefinition;
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

    this.globalEventHandlers.push(...pluginDefinition.getEventHandlers());
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
}

export function createFramework(config: Config) {
  console.log(JSON.stringify(config, null, 2));
  let db

  if (config.db.provider === 'postgres') {
    db = new PrismaClient({ datasources: { db: { url: config.db.uri }} })
  }
  
  if (!db) {
    throw new Error('No database config/provider found')
  }

  console.log(db.field)
  
  const framework = new IntegrationFramework();

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
