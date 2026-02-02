export type Event = {
  type: string;
  id: string;
  // TODO: we'll want to type this better
  data: any;
  runId: string;
  createdAt: Date;
  /**
   * Sequential index for position tracking.
   * Enables efficient resume from a specific position.
   */
  index?: number;
};
