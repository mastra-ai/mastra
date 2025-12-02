import type { Executor } from "../../ifaces";
import type { Cardinality } from "../enums";
import type { UUID } from "./queryTypes";
import type { StrictMap } from "../strictMap";
export type Global = {
    id: UUID;
    name: string;
    has_default: boolean;
    target_id: UUID;
    card: Cardinality;
};
export type Globals = StrictMap<UUID, Global>;
export declare function globals(cxn: Executor): Promise<Globals>;
