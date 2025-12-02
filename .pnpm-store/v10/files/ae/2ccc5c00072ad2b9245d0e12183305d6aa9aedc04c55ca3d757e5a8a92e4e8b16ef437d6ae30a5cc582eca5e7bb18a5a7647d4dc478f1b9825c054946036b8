/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export declare const DATE_PRIVATE: unique symbol;
export declare const localTimeInstances: WeakMap<object, LocalTime>;
export declare class LocalTime {
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly millisecond: number;
    readonly microsecond: number;
    readonly nanosecond: number;
    constructor(isoHour?: number, isoMinute?: number, isoSecond?: number, isoMillisecond?: number, isoMicrosecond?: number, isoNanosecond?: number);
    toString(): string;
}
export declare const localDateInstances: WeakMap<object, Date>;
export declare class LocalDate {
    constructor(isoYear: number, isoMonth: number, isoDay: number);
    get year(): number;
    get month(): number;
    get day(): number;
    get dayOfWeek(): number;
    get dayOfYear(): number;
    get daysInWeek(): number;
    get daysInMonth(): number;
    get daysInYear(): number;
    get monthsInYear(): number;
    get inLeapYear(): boolean;
    toString(): string;
}
export declare function LocalDateToOrdinal(localdate: LocalDate): number;
export declare function LocalDateFromOrdinal(ordinal: number): LocalDate;
export declare class LocalDateTime extends LocalDate {
    constructor(isoYear: number, isoMonth: number, isoDay: number, isoHour?: number, isoMinute?: number, isoSecond?: number, isoMillisecond?: number, isoMicrosecond?: number, isoNanosecond?: number);
    get hour(): number;
    get minute(): number;
    get second(): number;
    get millisecond(): number;
    get microsecond(): number;
    get nanosecond(): number;
    toString(): string;
}
interface DurationLike {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    nanoseconds?: number;
}
export declare class Duration {
    readonly years: number;
    readonly months: number;
    readonly weeks: number;
    readonly days: number;
    readonly hours: number;
    readonly minutes: number;
    readonly seconds: number;
    readonly milliseconds: number;
    readonly microseconds: number;
    readonly nanoseconds: number;
    readonly sign: number;
    constructor(years?: number, months?: number, weeks?: number, days?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number, microseconds?: number, nanoseconds?: number);
    get blank(): boolean;
    toString(): string;
    static from(item: string | Duration | DurationLike): Duration;
}
export declare class RelativeDuration {
    readonly years: number;
    readonly months: number;
    readonly weeks: number;
    readonly days: number;
    readonly hours: number;
    readonly minutes: number;
    readonly seconds: number;
    readonly milliseconds: number;
    readonly microseconds: number;
    constructor(years?: number, months?: number, weeks?: number, days?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number, microseconds?: number);
    toString(): string;
}
export declare class DateDuration {
    readonly years: number;
    readonly months: number;
    readonly weeks: number;
    readonly days: number;
    constructor(years?: number, months?: number, weeks?: number, days?: number);
    toString(): string;
}
export declare function parseHumanDurationString(durationStr: string): number;
export {};
