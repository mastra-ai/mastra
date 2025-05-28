export type SpanStatus = {
  code: number;
};

export type SpanOther = {
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
};

export type SpanEventAttributes = {
  key: string;
  value: { [key: string]: string | number | boolean | null };
};

export type SpanEvent = {
  attributes: SpanEventAttributes[];
  name: string;
  timeUnixNano: string;
  droppedAttributesCount: number;
};

export type Span = {
  id: string;
  parentSpanId: string | null;
  traceId: string;
  name: string;
  scope: string;
  kind: number;
  status: SpanStatus;
  events: SpanEvent[];
  links: any[];
  attributes: Record<string, string | number | boolean | null>;
  startTime: number;
  endTime: number;
  duration: number;
  other: SpanOther;
  createdAt: string;
};

export type RefinedTrace = {
  traceId: string;
  serviceName: string;
  duration: number;
  started: number;
  status: SpanStatus;
  trace: Span[];
  runId?: string;
};

export type EnhancedSpan = Span & {
  offset: number;
  totalDurationMs: number;
};

export type SpanNode = Span & {
  children: SpanNode[];
  totalDurationMs: number;
  offset: number;
};
