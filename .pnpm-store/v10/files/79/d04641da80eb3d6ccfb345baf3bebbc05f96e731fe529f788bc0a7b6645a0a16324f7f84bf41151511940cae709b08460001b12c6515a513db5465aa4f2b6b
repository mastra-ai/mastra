import type { Executor } from "../../ifaces";
import { StrictMap } from "../strictMap";
import type { typeutil } from "../typeutil";
export type ScalarTypes = typeutil.depromisify<ReturnType<typeof _scalars>>;
declare const _scalars: (cxn: Executor) => Promise<StrictMap<string, {
    id: string;
    name: string;
    is_abstract: boolean;
    bases: {
        id: string;
        name: string;
    }[];
    ancestors: {
        id: string;
        name: string;
    }[];
    children: {
        id: string;
        name: string;
    }[];
    descendants: {
        id: string;
        name: string;
    }[];
}>>;
export { _scalars as scalars };
