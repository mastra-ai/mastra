import { omitBy } from 'lodash';
import { CORE_INTEGRATION_NAME } from './constants';
import { DataLayer } from './data-access';
import { Integration } from './integration';
import {
  FrameWorkConfig,
  IntegrationAction,
  IntegrationActionExcutorParams,
  IntegrationContext,
  IntegrationEvent,
} from './types';
import { IntegrationAuth } from './authenticator';
import { blueprintRunner } from './workflows/runner';
import { Blueprint } from './workflows/types';

export class Framework {
  //global events grouped by Integration
  globalEvents: Map<string, Record<string, IntegrationEvent>> = new Map();
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

  registerIntgeration(definition: Integration) {
    const { name } = definition;
    definition.attachDataLayer({ dataLayer: this.dataLayer });

    this.integrations.set(name, definition);

    definition.defineEvents();

    this.registerEvents({
      events: Object.values(definition.getEvents()),
      integrationName: name,
    });

    definition.defineActions();

    this.registerActions({
      actions: Object.values(definition.getActions()),
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
    integrationName = CORE_INTEGRATION_NAME,
  }: {
    events: IntegrationEvent[];
    integrationName?: string;
  }) {
    const integrationEvents = this.globalEvents.get(integrationName) || {};
    this.globalEvents.set(integrationName, {
      ...integrationEvents,
      ...events.reduce((acc, event) => ({ ...acc, [event.key]: event }), {}),
    });
  }

  registerActions({
    actions,
    integrationName = CORE_INTEGRATION_NAME,
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

  getIntegration(name: string) {
    return this.integrations.get(name);
  }

  getGlobalEvents() {
    return this.globalEvents;
  }

  getSystemEvents() {
    const events = this.globalEvents.get(CORE_INTEGRATION_NAME);
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
    return this.globalActions.get(CORE_INTEGRATION_NAME);
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

  async executeAction({
    integrationName = CORE_INTEGRATION_NAME,
    action,
    payload,
  }: {
    integrationName?: string;
    action: string;
    payload: IntegrationActionExcutorParams<any>;
  }) {
    if (integrationName === CORE_INTEGRATION_NAME) {
      const actionExecutor = this.globalActions.get(CORE_INTEGRATION_NAME)?.[
        action
      ];

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

  makeWebhookUrl({ event, name }: { name: string; event: string }) {
    return `${this?.config?.systemHostURL}/${this?.config?.routeRegistrationPath}/webhook?name=${name}&event=${event}`;
  }

  async runBlueprint({
    blueprint,
    dataCtx = {},
    ctx,
  }: {
    blueprint: Blueprint;
    dataCtx?: any;
    ctx: IntegrationContext;
  }) {
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

    const connectedIntegrationEvents: Record<string, IntegrationEvent> =
      connectedIntegrations.reduce((acc, { name }) => {
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
  }
}
