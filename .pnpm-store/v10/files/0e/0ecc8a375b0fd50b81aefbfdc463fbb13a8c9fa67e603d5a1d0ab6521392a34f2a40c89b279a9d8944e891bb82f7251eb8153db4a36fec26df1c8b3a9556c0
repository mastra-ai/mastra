import { Binary } from './binary.js';
import { Bool } from './bool.js';
import { Date } from './date.js';
import { Decimal } from './decimal.js';
import { Duration } from './duration.js';
import { FixedSizeBinary } from './fixed-size-binary.js';
import { FixedSizeList } from './fixed-size-list.js';
import { FloatingPoint } from './floating-point.js';
import { Int } from './int.js';
import { Interval } from './interval.js';
import { LargeBinary } from './large-binary.js';
import { LargeList } from './large-list.js';
import { LargeUtf8 } from './large-utf8.js';
import { List } from './list.js';
import { Map } from './map.js';
import { Null } from './null.js';
import { RunEndEncoded } from './run-end-encoded.js';
import { Struct_ } from './struct-.js';
import { Time } from './time.js';
import { Timestamp } from './timestamp.js';
import { Union } from './union.js';
import { Utf8 } from './utf8.js';
/**
 * ----------------------------------------------------------------------
 * Top-level Type value, enabling extensible type-specific metadata. We can
 * add new logical types to Type without breaking backwards compatibility
 */
export declare enum Type {
    NONE = 0,
    Null = 1,
    Int = 2,
    FloatingPoint = 3,
    Binary = 4,
    Utf8 = 5,
    Bool = 6,
    Decimal = 7,
    Date = 8,
    Time = 9,
    Timestamp = 10,
    Interval = 11,
    List = 12,
    Struct_ = 13,
    Union = 14,
    FixedSizeBinary = 15,
    FixedSizeList = 16,
    Map = 17,
    Duration = 18,
    LargeBinary = 19,
    LargeUtf8 = 20,
    LargeList = 21,
    RunEndEncoded = 22
}
export declare function unionToType(type: Type, accessor: (obj: Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8) => Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8 | null): Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8 | null;
export declare function unionListToType(type: Type, accessor: (index: number, obj: Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8) => Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8 | null, index: number): Binary | Bool | Date | Decimal | Duration | FixedSizeBinary | FixedSizeList | FloatingPoint | Int | Interval | LargeBinary | LargeList | LargeUtf8 | List | Map | Null | RunEndEncoded | Struct_ | Time | Timestamp | Union | Utf8 | null;
