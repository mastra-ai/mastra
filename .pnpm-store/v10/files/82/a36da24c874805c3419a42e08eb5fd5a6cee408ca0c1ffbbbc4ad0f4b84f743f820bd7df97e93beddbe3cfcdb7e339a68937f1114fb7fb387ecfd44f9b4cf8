import type { Executor } from "../../ifaces";
import type { Cardinality } from "../enums";
import type { UUID } from "./queryTypes";
import { StrictMap } from "../strictMap";
export { UUID };
export type Pointer = {
    card: Cardinality;
    kind: "link" | "property";
    name: string;
    target_id: UUID;
    is_exclusive: boolean;
    is_computed: boolean;
    is_readonly: boolean;
    has_default: boolean;
    pointers: readonly Pointer[] | null;
};
export type Backlink = Pointer & {
    kind: "link";
    pointers: null;
    stub: string;
};
export type TypeKind = "object" | "scalar" | "array" | "tuple" | "range" | "multirange" | "unknown";
export interface TypeProperties<T extends TypeKind> {
    id: UUID;
    kind: T;
    name: string;
}
export interface ScalarType extends TypeProperties<"scalar"> {
    is_abstract: boolean;
    is_seq: boolean;
    bases: readonly {
        id: UUID;
    }[];
    enum_values: readonly string[] | null;
    material_id: UUID | null;
    cast_type?: UUID;
}
export interface ObjectType extends TypeProperties<"object"> {
    is_abstract: boolean;
    bases: readonly {
        id: UUID;
    }[];
    union_of: readonly {
        id: UUID;
    }[];
    intersection_of: readonly {
        id: UUID;
    }[];
    pointers: readonly Pointer[];
    backlinks: readonly Backlink[];
    backlink_stubs: readonly Backlink[];
    exclusives: {
        [k: string]: Pointer;
    }[];
}
export interface ArrayType extends TypeProperties<"array"> {
    array_element_id: UUID;
    is_abstract: boolean;
}
export interface TupleType extends TypeProperties<"tuple"> {
    tuple_elements: readonly {
        name: string;
        target_id: UUID;
    }[];
    is_abstract: boolean;
}
export interface RangeType extends TypeProperties<"range"> {
    range_element_id: UUID;
    is_abstract: boolean;
}
export interface MultiRangeType extends TypeProperties<"multirange"> {
    multirange_element_id: UUID;
    is_abstract: boolean;
}
export interface BaseType extends TypeProperties<"unknown"> {
    is_abstract: false;
}
export type PrimitiveType = ScalarType | ArrayType | TupleType | RangeType | MultiRangeType;
export type Type = BaseType | PrimitiveType | ObjectType;
export type Types = StrictMap<UUID, Type>;
export declare const typeMapping: Map<string, ScalarType>;
export declare function getTypes(cxn: Executor, params?: {
    debug?: boolean;
}): Promise<Types>;
export declare function topoSort(types: Type[]): StrictMap<string, Type>;
export { getTypes as types };
