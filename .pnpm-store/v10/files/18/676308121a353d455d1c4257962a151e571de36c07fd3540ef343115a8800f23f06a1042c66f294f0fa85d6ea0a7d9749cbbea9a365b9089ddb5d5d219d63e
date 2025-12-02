"use strict";
// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.atMost = exports.atLeast = exports.Duration = void 0;
exports.isDurationObject = isDurationObject;
/**
 * Is it a Duration or a DurationLike?
 *
 * @private
 */
function isDurationObject(value) {
    return typeof value === 'object' && !!value.total;
}
/**
 * Duration class with an interface similar to the tc39 Temporal
 * proposal. Since it's not fully finalized, and polyfills have
 * inconsistent compatibility, for now this shim class will be
 * used to set durations in Pub/Sub.
 *
 * This class will remain here for at least the next major version,
 * eventually to be replaced by the tc39 Temporal.Duration built-in.
 *
 * https://tc39.es/proposal-temporal/docs/duration.html
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration
 */
class Duration {
    millis;
    static secondInMillis = 1000;
    static minuteInMillis = Duration.secondInMillis * 60;
    static hourInMillis = Duration.minuteInMillis * 60;
    constructor(millis) {
        this.millis = millis;
    }
    /**
     * Calculates the total number of units of type 'totalOf' that would
     * fit inside this duration.
     *
     * No longer part of the tc39 spec, superseded by total().
     *
     * @deprecated
     */
    totalOf(totalOf) {
        return this.total(totalOf);
    }
    /**
     * Calculates the total number of units of type 'totalOf' that would
     * fit inside this duration. The tc39 `options` parameter is not supported.
     */
    total(totalOf) {
        switch (totalOf) {
            case 'hour':
            case 'hours':
                return this.millis / Duration.hourInMillis;
            case 'minute':
            case 'minutes':
                return this.millis / Duration.minuteInMillis;
            case 'second':
            case 'seconds':
                return this.millis / Duration.secondInMillis;
            case 'millisecond':
            case 'milliseconds':
                return this.millis;
            default:
                throw new Error(`Invalid unit in call to total(): ${totalOf}`);
        }
    }
    /**
     * Equivalent to `total('hour')`.
     */
    get hours() {
        return this.total('hour');
    }
    /**
     * Equivalent to `total('minute')`.
     */
    get minutes() {
        return this.total('minute');
    }
    /**
     * Equivalent to `total('second')`.
     */
    get seconds() {
        return this.total('second');
    }
    /**
     * Equivalent to `total('millisecond')`.
     */
    get milliseconds() {
        return this.total('millisecond');
    }
    /**
     * Adds another Duration to this one and returns a new Duration.
     *
     * @param other A Duration or Duration-like object, like from() takes.
     * @returns A new Duration.
     */
    add(other) {
        const otherDuration = Duration.from(other);
        return Duration.from({
            millis: this.milliseconds + otherDuration.milliseconds,
        });
    }
    /**
     * Subtracts another Duration from this one and returns a new Duration.
     *
     * @param other A Duration or Duration-like object, like from() takes.
     * @returns A new Duration.
     */
    subtract(other) {
        const otherDuration = Duration.from(other);
        return Duration.from({
            millis: this.milliseconds - otherDuration.milliseconds,
        });
    }
    /**
     * Creates a Duration from a DurationLike, which is an object
     * containing zero or more of the following: hours, seconds,
     * minutes, millis.
     */
    static from(durationLike) {
        if (isDurationObject(durationLike)) {
            const d = durationLike;
            return new Duration(d.milliseconds);
        }
        let millis = durationLike.milliseconds ?? durationLike.millis ?? 0;
        millis += (durationLike.seconds ?? 0) * Duration.secondInMillis;
        millis += (durationLike.minutes ?? 0) * Duration.minuteInMillis;
        millis += (durationLike.hours ?? 0) * Duration.hourInMillis;
        return new Duration(millis);
    }
    /**
     * Compare two Duration objects. Returns -1 if the first is less than the
     * second, zero if they are equal, 1 if the first is greater than the second.
     *
     * Unlike tc39, this version does not accept options for relativeTo.
     */
    static compare(first, second) {
        const diffMs = first.total('millisecond') - second.total('millisecond');
        if (diffMs < 0) {
            return -1;
        }
        if (diffMs > 0) {
            return 1;
        }
        return 0;
    }
}
exports.Duration = Duration;
// Simple accessors that can be used independent of the class. These are
// functions and not methods because we don't want to add to what's in
// the tc39 spec.
const atLeast = (d, min) => Duration.compare(d, min) < 0 ? min : d;
exports.atLeast = atLeast;
const atMost = (d, max) => Duration.compare(d, max) > 0 ? max : d;
exports.atMost = atMost;
//# sourceMappingURL=temporal.js.map