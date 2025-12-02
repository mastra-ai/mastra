import type { Executor } from "../../ifaces";
import type { typeutil } from "../typeutil";
type Cast = {
    id: string;
    source: {
        id: string;
        name: string;
    };
    target: {
        id: string;
        name: string;
    };
    allow_assignment: boolean;
    allow_implicit: boolean;
};
export type Casts = typeutil.depromisify<ReturnType<typeof casts>>;
export declare const casts: (cxn: Executor, params?: {
    debug?: boolean;
}) => Promise<{
    castsById: Record<string, Cast>;
    typesById: Record<string, {
        name: string;
        id: string;
    }>;
    castMap: {
        [k: string]: string[];
    };
    implicitCastMap: {
        [k: string]: string[];
    };
    implicitCastFromMap: {
        [k: string]: string[];
    };
    assignmentCastMap: {
        [k: string]: string[];
    };
    assignableByMap: {
        [k: string]: string[];
    };
}>;
export {};
