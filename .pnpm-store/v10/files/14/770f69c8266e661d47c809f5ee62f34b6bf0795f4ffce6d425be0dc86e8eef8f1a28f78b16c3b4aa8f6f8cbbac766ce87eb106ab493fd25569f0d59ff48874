"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Histogram = void 0;
/*!
 * The Histogram class is used to capture the lifespan of messages within the
 * the client. These durations are then used to calculate the 99th percentile
 * of ack deadlines for future messages.
 *
 * @private
 * @class
 */
class Histogram {
    options;
    data;
    length;
    constructor(options) {
        this.options = Object.assign({ min: 0, max: Number.MAX_SAFE_INTEGER }, options);
        this.data = new Map();
        this.length = 0;
    }
    /*!
     * Adds a value to the histogram.
     *
     * @private
     * @param {numnber} value - The value in milliseconds.
     */
    add(value) {
        value = Math.ceil(value);
        value = Math.max(value, this.options.min);
        value = Math.min(value, this.options.max);
        if (!this.data.has(value)) {
            this.data.set(value, 0);
        }
        const count = this.data.get(value);
        this.data.set(value, count + 1);
        this.length += 1;
    }
    /*!
     * Retrieves the nth percentile of recorded values.
     *
     * @private
     * @param {number} percent The requested percentage.
     * @return {number}
     */
    percentile(percent) {
        percent = Math.min(percent, 100);
        let target = this.length - this.length * (percent / 100);
        const keys = Array.from(this.data.keys());
        let key;
        for (let i = keys.length - 1; i > -1; i--) {
            key = keys[i];
            target -= this.data.get(key);
            if (target <= 0) {
                return key;
            }
        }
        return this.options.min;
    }
}
exports.Histogram = Histogram;
//# sourceMappingURL=histogram.js.map