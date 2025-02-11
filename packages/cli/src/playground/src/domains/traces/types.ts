export type SpanAttributes = {
  'http.request.method': string;
  'http.request.method_original': string;
  'url.full': string;
  'url.path': string;
  'url.query': string;
  'url.scheme': string;
  'server.address': string;
  'server.port': number;
  'user_agent.original': string;
  'network.peer.address': string;
  'network.peer.port': number;
  'http.response.status_code': number;
};

export type SpanStatus = {
  code: number;
};

export type SpanOther = {
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
};

export type SpanEvent = {
  attributes: Record<string, string | number | boolean | null>[];
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
  links: any[]; // You might want to type this more specifically if you have link structure
  attributes: Record<string, string | number | boolean | null>;
  startTime: number;
  endTime: number;
  duration: number;
  other: SpanOther;
  createdAt: string;
};

export type SpanNode = Span & {
  children: SpanNode[];
  relativePercentage?: number;
};

export type RefinedTrace = {
  traceId: string;
  serviceName: string;
  duration: number;
  started: number;
  status: SpanStatus;
  trace: Span[];
};
