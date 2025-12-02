import type { Executor } from "../../ifaces";
import { StrictMap } from "../strictMap";
import type { typeutil } from "../typeutil";
export type FuncopTypemod = "SetOfType" | "OptionalType" | "SingletonType";
export type FunctionParamKind = "VariadicParam" | "NamedOnlyParam" | "PositionalParam";
export interface FuncopParam {
    name: string;
    type: {
        id: string;
        name: string;
    };
    kind: FunctionParamKind;
    typemod: FuncopTypemod;
    hasDefault?: boolean;
}
export interface FunctionDef {
    id: string;
    name: string;
    description?: string;
    return_type: {
        id: string;
        name: string;
    };
    return_typemod: FuncopTypemod;
    params: FuncopParam[];
    preserves_optionality: boolean;
}
export type FunctionTypes = typeutil.depromisify<ReturnType<typeof functions>>;
export declare const functions: (cxn: Executor) => Promise<StrictMap<string, [FunctionDef, ...FunctionDef[]]>>;
export declare function replaceNumberTypes(def: {
    return_type: FunctionDef["return_type"];
    params: FuncopParam[];
}): void;
