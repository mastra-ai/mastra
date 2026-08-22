export interface FactoryAnalytics {
  trackCommandExecution<T>(input: {
    command: string;
    args?: Record<string, unknown>;
    execution: () => Promise<T>;
    origin?: 'mastra-cloud' | 'oss';
  }): Promise<T>;
  trackEvent(eventName: string, properties?: Record<string, unknown>): void;
  shutdown?(timeoutMs?: number): Promise<void>;
}

export const noopFactoryAnalytics: FactoryAnalytics = {
  async trackCommandExecution({ execution }) {
    return execution();
  },
  trackEvent() {},
};
