import { DataType, Map_, Struct } from '../type.js';
import { Builder, VariableWidthBuilder } from '../builder.js';
/** @ignore */ type MapValue<K extends DataType = any, V extends DataType = any> = Map_<K, V>['TValue'];
/** @ignore */ type MapValues<K extends DataType = any, V extends DataType = any> = Map<number, MapValue<K, V> | undefined>;
/** @ignore */ type MapValueExt<K extends DataType = any, V extends DataType = any> = MapValue<K, V> | {
    [key: string]: V;
} | {
    [key: number]: V;
};
/** @ignore */
export declare class MapBuilder<K extends DataType = any, V extends DataType = any, TNull = any> extends VariableWidthBuilder<Map_<K, V>, TNull> {
    protected _pending: MapValues<K, V> | undefined;
    set(index: number, value: MapValueExt<K, V> | TNull): this;
    setValue(index: number, value: MapValueExt<K, V>): void;
    addChild(child: Builder<Struct<{
        key: K;
        value: V;
    }>>, name?: string): number;
    protected _flushPending(pending: MapValues<K, V>): void;
}
export {};
