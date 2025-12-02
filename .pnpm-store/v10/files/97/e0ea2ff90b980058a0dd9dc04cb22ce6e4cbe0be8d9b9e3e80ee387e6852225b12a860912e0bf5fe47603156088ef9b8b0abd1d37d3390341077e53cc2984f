import { Endpoint } from "./Endpoint";
export interface EndpointWithExpiry extends Pick<Endpoint, "Address"> {
  Expires: number;
}
export declare class EndpointCache {
  private readonly cache;
  constructor(capacity: number);
  getEndpoint(key: string): string | undefined;
  get(key: string): EndpointWithExpiry[] | undefined;
  set(key: string, endpoints: Endpoint[]): void;
  delete(key: string): void;
  has(key: string): boolean;
  clear(): void;
}
