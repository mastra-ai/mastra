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
import { ServerActions } from '../ServerActions';
import { StatsCollection } from './StatsCollection';
export declare class StatsReporter {
    private server_;
    private statsListener_;
    statsToReport_: {
        [k: string]: boolean;
    };
    constructor(collection: StatsCollection, server_: ServerActions);
    private reportStats_;
}
export declare function statsReporterIncludeStat(reporter: StatsReporter, stat: string): void;
