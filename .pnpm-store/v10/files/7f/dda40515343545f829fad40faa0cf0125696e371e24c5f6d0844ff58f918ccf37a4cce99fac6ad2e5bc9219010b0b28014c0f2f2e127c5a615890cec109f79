/**
 * @license
 * Copyright 2021 Google LLC
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
import { Database, DatabaseReference } from '../../src';
import { Path } from '../../src/core/util/Path';
import { EventAccumulator } from './EventAccumulator';
export declare const TEST_PROJECT: any;
export declare const EMULATOR_PORT: string;
export declare const USE_EMULATOR: boolean;
export declare function getFreshRepo(path: Path): DatabaseReference;
export declare const DATABASE_ADDRESS: any;
export declare const DATABASE_URL: any;
export declare function testRepoInfo(url: any): import("../../src/core/RepoInfo").RepoInfo;
export declare function repoInfoForConnectionTest(): import("../../src/core/RepoInfo").RepoInfo;
export declare function shuffle(arr: any, randFn?: () => number): void;
export declare function waitFor(waitTimeInMS: number): Promise<unknown>;
export declare function getUniqueRef(db: Database): DatabaseReference;
export declare function getRWRefs(db: Database): {
    readerRef: DatabaseReference;
    writerRef: DatabaseReference;
};
export declare function writeAndValidate(writerRef: DatabaseReference, readerRef: DatabaseReference, toWrite: unknown, ec: EventAccumulator): Promise<void>;
export declare function waitUntil(cb: () => boolean, maxRetries?: number): Promise<unknown>;
