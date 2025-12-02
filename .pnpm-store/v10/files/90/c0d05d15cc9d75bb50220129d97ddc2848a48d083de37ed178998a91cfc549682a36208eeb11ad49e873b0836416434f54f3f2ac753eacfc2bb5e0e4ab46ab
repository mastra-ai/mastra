import * as type from '../type.js';
import { Visitor } from '../visitor.js';
/** @ignore */
export interface JSONTypeAssembler extends Visitor {
    visit<T extends type.DataType>(node: T): Record<string, unknown> | undefined;
}
/** @ignore */
export declare class JSONTypeAssembler extends Visitor {
    visitNull<T extends type.Null>({ typeId }: T): {
        name: string;
    };
    visitInt<T extends type.Int>({ typeId, bitWidth, isSigned }: T): {
        name: string;
        bitWidth: type.IntBitWidth;
        isSigned: boolean;
    };
    visitFloat<T extends type.Float>({ typeId, precision }: T): {
        name: string;
        precision: string;
    };
    visitBinary<T extends type.Binary>({ typeId }: T): {
        name: string;
    };
    visitLargeBinary<T extends type.LargeBinary>({ typeId }: T): {
        name: string;
    };
    visitBool<T extends type.Bool>({ typeId }: T): {
        name: string;
    };
    visitUtf8<T extends type.Utf8>({ typeId }: T): {
        name: string;
    };
    visitLargeUtf8<T extends type.LargeUtf8>({ typeId }: T): {
        name: string;
    };
    visitDecimal<T extends type.Decimal>({ typeId, scale, precision, bitWidth }: T): {
        name: string;
        scale: number;
        precision: number;
        bitWidth: number;
    };
    visitDate<T extends type.Date_>({ typeId, unit }: T): {
        name: string;
        unit: string;
    };
    visitTime<T extends type.Time>({ typeId, unit, bitWidth }: T): {
        name: string;
        unit: string;
        bitWidth: type.TimeBitWidth;
    };
    visitTimestamp<T extends type.Timestamp>({ typeId, timezone, unit }: T): {
        name: string;
        unit: string;
        timezone: string | null | undefined;
    };
    visitInterval<T extends type.Interval>({ typeId, unit }: T): {
        name: string;
        unit: string;
    };
    visitDuration<T extends type.Duration>({ typeId, unit }: T): {
        name: string;
        unit: string;
    };
    visitList<T extends type.List>({ typeId }: T): {
        name: string;
    };
    visitStruct<T extends type.Struct>({ typeId }: T): {
        name: string;
    };
    visitUnion<T extends type.Union>({ typeId, mode, typeIds }: T): {
        name: string;
        mode: string;
        typeIds: number[];
    };
    visitDictionary<T extends type.Dictionary>(node: T): Record<string, unknown> | undefined;
    visitFixedSizeBinary<T extends type.FixedSizeBinary>({ typeId, byteWidth }: T): {
        name: string;
        byteWidth: number;
    };
    visitFixedSizeList<T extends type.FixedSizeList>({ typeId, listSize }: T): {
        name: string;
        listSize: number;
    };
    visitMap<T extends type.Map_>({ typeId, keysSorted }: T): {
        name: string;
        keysSorted: boolean;
    };
}
