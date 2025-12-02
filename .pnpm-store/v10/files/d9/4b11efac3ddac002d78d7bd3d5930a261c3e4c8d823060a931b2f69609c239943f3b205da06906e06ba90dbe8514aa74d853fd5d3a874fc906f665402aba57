/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { AppCheckTokenProvider } from './AppCheckTokenProvider';
import { AuthTokenProvider } from './AuthTokenProvider';
import { RepoInfo } from './RepoInfo';
import { ServerActions } from './ServerActions';
import { QueryContext } from './view/EventRegistration';
/**
 * An implementation of ServerActions that communicates with the server via REST requests.
 * This is mostly useful for compatibility with crawlers, where we don't want to spin up a full
 * persistent connection (using WebSockets or long-polling)
 */
export declare class ReadonlyRestClient extends ServerActions {
    private repoInfo_;
    private onDataUpdate_;
    private authTokenProvider_;
    private appCheckTokenProvider_;
    reportStats(stats: {
        [k: string]: unknown;
    }): void;
    /** @private {function(...[*])} */
    private log_;
    /**
     * We don't actually need to track listens, except to prevent us calling an onComplete for a listen
     * that's been removed. :-/
     */
    private listens_;
    static getListenId_(query: QueryContext, tag?: number | null): string;
    /**
     * @param repoInfo_ - Data about the namespace we are connecting to
     * @param onDataUpdate_ - A callback for new data from the server
     */
    constructor(repoInfo_: RepoInfo, onDataUpdate_: (a: string, b: unknown, c: boolean, d: number | null) => void, authTokenProvider_: AuthTokenProvider, appCheckTokenProvider_: AppCheckTokenProvider);
    /** @inheritDoc */
    listen(query: QueryContext, currentHashFn: () => string, tag: number | null, onComplete: (a: string, b: unknown) => void): void;
    /** @inheritDoc */
    unlisten(query: QueryContext, tag: number | null): void;
    get(query: QueryContext): Promise<string>;
    /** @inheritDoc */
    refreshAuthToken(token: string): void;
    /**
     * Performs a REST request to the given path, with the provided query string parameters,
     * and any auth credentials we have.
     */
    private restRequest_;
}
