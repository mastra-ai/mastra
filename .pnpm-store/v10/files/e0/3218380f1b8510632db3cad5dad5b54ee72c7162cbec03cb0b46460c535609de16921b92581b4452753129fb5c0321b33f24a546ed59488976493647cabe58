import { Cardinality as RawCardinality } from "../ifaces";
import { Cardinality } from "./enums";
export declare namespace util {
    export function assertNever(arg: never, error?: Error): never;
    export function splitName(name: string): {
        mod: string;
        name: string;
    };
    export function toIdent(name: string): string;
    export const deduplicate: (args: string[]) => string[];
    export const getFromArrayMap: <T>(map: Record<string, T[]>, id: string) => T[];
    type PropertyDef = {
        configurable?: boolean;
        enumerable?: boolean;
        writable?: boolean;
        value?: any;
        set?: (v: any) => any;
        get?: () => any;
    };
    export const defineProperty: <T>(obj: T, name: string, def: PropertyDef & ThisType<T>) => T;
    export const defineGetter: <T>(obj: T, name: string, getter: (this: T) => any) => T;
    export const defineMethod: <T>(obj: T, name: string, method: (this: T) => any) => T;
    export function flatMap<T, U>(array: T[], callbackfn: (value: T, index: number, array: T[]) => U[]): U[];
    type ExcludeDollarPrefixed<S> = S extends `$${string}` ? never : S;
    export type OmitDollarPrefixed<O> = {
        [K in ExcludeDollarPrefixed<keyof O>]: O[K];
    };
    export function omitDollarPrefixed<O extends {
        [k: string]: any;
    }>(object: O): OmitDollarPrefixed<O>;
    export const parseCardinality: (cardinality: RawCardinality) => Cardinality;
    export {};
}
