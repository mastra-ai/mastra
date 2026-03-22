export type Event = {
  type: string;
  id: string;
  // TODO: we'll want to type this better
  data: any;
  runId: string;
  createdAt: Date;
};

export interface SubscribeOptions {
  /**
   * When set, subscribers with the same group compete for messages.
   * Each message is delivered to exactly one subscriber in the group.
   * When not set, behaves as fan-out (all subscribers get every message).
   */
  group?: string;
}
