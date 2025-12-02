/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export interface HistogramOptions {
    min?: number;
    max?: number;
}
/*!
 * The Histogram class is used to capture the lifespan of messages within the
 * the client. These durations are then used to calculate the 99th percentile
 * of ack deadlines for future messages.
 *
 * @private
 * @class
 */
export declare class Histogram {
    options: HistogramOptions;
    data: Map<number, number>;
    length: number;
    constructor(options?: HistogramOptions);
    /*!
     * Adds a value to the histogram.
     *
     * @private
     * @param {numnber} value - The value in milliseconds.
     */
    add(value: number): void;
    /*!
     * Retrieves the nth percentile of recorded values.
     *
     * @private
     * @param {number} percent The requested percentage.
     * @return {number}
     */
    percentile(percent: number): number;
}
