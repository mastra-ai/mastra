import type {
  DeleteTaskPushNotificationConfigParams,
  GetTaskPushNotificationConfigParams,
  ListTaskPushNotificationConfigParams,
  TaskPushNotificationConfig,
} from '@mastra/core/a2a';

function normalizeConfigId(taskId: string, configId?: string) {
  return configId || taskId;
}

export class InMemoryPushNotificationStore {
  private store = new Map<string, Map<string, TaskPushNotificationConfig>>();

  private getKey(agentId: string, taskId: string) {
    return JSON.stringify([agentId, taskId]);
  }

  set({ agentId, config }: { agentId: string; config: TaskPushNotificationConfig }): TaskPushNotificationConfig {
    const key = this.getKey(agentId, config.taskId);
    const configs = this.store.get(key) ?? new Map<string, TaskPushNotificationConfig>();
    const normalizedConfig: TaskPushNotificationConfig = {
      taskId: config.taskId,
      pushNotificationConfig: {
        ...config.pushNotificationConfig,
        id: normalizeConfigId(config.taskId, config.pushNotificationConfig.id),
      },
    };

    configs.set(normalizedConfig.pushNotificationConfig.id!, structuredClone(normalizedConfig));
    this.store.set(key, configs);

    return structuredClone(normalizedConfig);
  }

  get({
    agentId,
    params,
  }: {
    agentId: string;
    params: GetTaskPushNotificationConfigParams;
  }): TaskPushNotificationConfig | null {
    const key = this.getKey(agentId, params.id);
    const configId = normalizeConfigId(params.id, params.pushNotificationConfigId);
    const config = this.store.get(key)?.get(configId);
    return config ? structuredClone(config) : null;
  }

  list({
    agentId,
    params,
  }: {
    agentId: string;
    params: ListTaskPushNotificationConfigParams;
  }): TaskPushNotificationConfig[] {
    const key = this.getKey(agentId, params.id);
    return Array.from(this.store.get(key)?.values() ?? []).map(config => structuredClone(config));
  }

  delete({ agentId, params }: { agentId: string; params: DeleteTaskPushNotificationConfigParams }): boolean {
    const key = this.getKey(agentId, params.id);
    const configs = this.store.get(key);

    if (!configs) {
      return false;
    }

    const deleted = configs.delete(params.pushNotificationConfigId);
    if (configs.size === 0) {
      this.store.delete(key);
    }

    return deleted;
  }
}
