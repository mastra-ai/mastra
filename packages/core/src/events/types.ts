export type Event = {
  type: string;
  id: string;
  // TODO: we'll want to type this better
  data: any;
  runId: string;
  createdAt: Date;
};
