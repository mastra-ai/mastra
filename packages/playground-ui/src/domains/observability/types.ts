export type UISpan = {
  id: string;
  name: string;
  type: string;
  latency: number;
  startTime: string;
  endTime?: string;
  spans?: UISpan[];
};
