import type { Executor } from "../../ifaces";
import { StrictMap } from "../strictMap";
import type { FuncopParam, FuncopTypemod } from "./functions";
import type { typeutil } from "../typeutil";
import type { OperatorKind } from "../enums";
export type { FuncopTypemod };
export interface OperatorDef {
    id: string;
    name: string;
    originalName: string;
    operator_kind: OperatorKind;
    description?: string;
    return_type: {
        id: string;
        name: string;
    };
    return_typemod: FuncopTypemod;
    params: FuncopParam[];
}
export type OperatorTypes = typeutil.depromisify<ReturnType<typeof _operators>>;
declare const _operators: (cxn: Executor) => Promise<StrictMap<string, [OperatorDef, ...OperatorDef[]]>>;
export { _operators as operators };
