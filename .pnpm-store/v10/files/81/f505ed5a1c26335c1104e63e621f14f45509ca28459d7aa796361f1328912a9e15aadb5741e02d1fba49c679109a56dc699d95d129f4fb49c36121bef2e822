import type { Node } from "acorn";
import { SourceMap } from "magic-string";
declare module "estree" {
    interface BaseNodeWithoutComments {
        start: number;
        end: number;
    }
}
export type UNCHANGED = null;
export declare const UNCHANGED: null;
export interface CodeWithSourcemap {
    code: string;
    map: SourceMap;
}
export type ParseFunction = (code: string) => Node;
export type WarnFunction = (message: string) => void;
export declare function transform({ code, id, parse, warn, useLodashEs, appendDotJs, }: {
    code: string;
    id: string;
    parse: ParseFunction;
    warn?: WarnFunction;
    useLodashEs?: true;
    appendDotJs?: boolean;
}): CodeWithSourcemap | UNCHANGED;
//# sourceMappingURL=index.d.ts.map