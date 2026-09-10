export interface DataMessagePart {
  type: string;
  name?: string;
  data?: Record<string, unknown>;
}
