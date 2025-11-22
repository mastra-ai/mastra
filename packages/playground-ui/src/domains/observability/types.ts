export type UISpan = {
  id: string;
  name: string;
  type: string;
  latency: number;
  startTime: string;
  endTime?: string;
  spans?: UISpan[];
};

export type UISpanState = {
  spanId: string;
  expanded: boolean;
};

export type UISpanType = 'agent' | 'workflow' | 'tool' | 'model' | 'other';
