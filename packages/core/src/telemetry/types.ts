export type OtelConfig = {
  serviceName?: string;
  enabled?: boolean;
  export?:
    | {
        type: 'otlp';
        endpoint?: string;
        headers?: Record<string, string>;
      }
    | {
        type: 'console';
      };
};
