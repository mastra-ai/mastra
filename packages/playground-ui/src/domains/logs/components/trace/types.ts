export type UISpan = {
  id: string;
  name: string;
  type: string;
  latency: number;
  startTime: string;
  endTime?: string;
  spans?: UISpan[];
  parentSpanId?: string | null;
};

export type UISpanStyle = {
  icon?: React.ReactNode;
  color?: string;
  label?: string;
  bgColor?: string;
  typePrefix: string;
};
