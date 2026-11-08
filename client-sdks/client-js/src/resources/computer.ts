import type {
  GetComputersComputerIdControl_QueryParams,
  GetComputersComputerIdControl_Response,
  PostComputersComputerIdControl_Body,
  PostComputersComputerIdControl_Response,
  PostComputersComputerIdSession_Body,
  PostComputersComputerIdSession_Response,
} from '../route-types.generated';
import type { ClientOptions, RequestOptions } from '../types';
import { BaseResource } from './base';

function queryString(input: GetComputersComputerIdControl_QueryParams): string {
  const query = new URLSearchParams();
  if (input.threadId) query.set('threadId', input.threadId);
  if (input.resourceId) query.set('resourceId', input.resourceId);
  const value = query.toString();
  return value ? `?${value}` : '';
}

/** Provider-neutral client for one attached computer. */
export class Computer extends BaseResource {
  readonly #basePath: string;

  constructor(options: ClientOptions, computerId: string) {
    super(options);
    this.#basePath = `/computers/${encodeURIComponent(computerId)}`;
  }

  createSession(
    input: PostComputersComputerIdSession_Body,
    options: RequestOptions = {},
  ): Promise<PostComputersComputerIdSession_Response> {
    return this.request(`${this.#basePath}/session`, { ...options, method: 'POST', body: input });
  }

  getControl(
    input: GetComputersComputerIdControl_QueryParams = {},
    options: RequestOptions = {},
  ): Promise<GetComputersComputerIdControl_Response> {
    return this.request(`${this.#basePath}/control${queryString(input)}`, options);
  }

  changeControl(
    input: PostComputersComputerIdControl_Body,
    options: RequestOptions = {},
  ): Promise<PostComputersComputerIdControl_Response> {
    return this.request(`${this.#basePath}/control`, { ...options, method: 'POST', body: input });
  }
}
