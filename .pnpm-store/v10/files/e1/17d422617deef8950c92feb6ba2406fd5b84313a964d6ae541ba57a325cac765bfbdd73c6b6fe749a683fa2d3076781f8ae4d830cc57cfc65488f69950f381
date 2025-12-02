import { Octokit as Core } from "@octokit/core";
import { type PaginateInterface } from "@octokit/plugin-paginate-rest";
import { legacyRestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
export type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
type Constructor<T> = new (...args: any[]) => T;
export declare const Octokit: typeof Core & Constructor<ReturnType<typeof legacyRestEndpointMethods> & {
    paginate: PaginateInterface;
}>;
export type Octokit = InstanceType<typeof Octokit>;
