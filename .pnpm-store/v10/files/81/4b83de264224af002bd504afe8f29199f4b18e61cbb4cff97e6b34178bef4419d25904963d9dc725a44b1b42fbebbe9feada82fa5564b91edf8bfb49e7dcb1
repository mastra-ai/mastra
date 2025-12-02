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
import type { Duration, LocalDate, LocalDateTime } from "./datetime";
export declare class Range<T extends number | Date | LocalDate | LocalDateTime | Duration> {
    private readonly _lower;
    private readonly _upper;
    private readonly _incLower;
    private readonly _incUpper;
    private _isEmpty;
    constructor(_lower: T | null, _upper: T | null, _incLower?: boolean, _incUpper?: boolean);
    get lower(): T | null;
    get upper(): T | null;
    get incLower(): boolean;
    get incUpper(): boolean;
    get isEmpty(): boolean;
    static empty(): Range<number | Date | LocalDate | LocalDateTime | Duration>;
    toJSON(): {
        empty: boolean;
        lower?: undefined;
        upper?: undefined;
        inc_lower?: undefined;
        inc_upper?: undefined;
    } | {
        lower: T | null;
        upper: T | null;
        inc_lower: boolean;
        inc_upper: boolean;
        empty?: undefined;
    };
}
export declare class MultiRange<T extends number | Date | LocalDate | LocalDateTime | Duration> {
    private readonly _ranges;
    constructor(ranges?: Range<T>[]);
    get length(): number;
    [Symbol.iterator](): Generator<Range<T>, void, unknown>;
    toJSON(): Range<T>[];
}
