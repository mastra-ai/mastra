export type Diff = Pick<[number, string], 0|1|'length'|'toString'|typeof Symbol.iterator>;

export type patch_obj = {
    diffs: Diff[];
    start1: number | null;
    start2: number | null;
    length1: number;
    length2: number;
    toString: () => string;
}

export declare class diff_match_patch {
    Diff_Timeout: number;
    Diff_EditCost: number;
    Match_Threshold: number;
    Match_Distance: number;
    Patch_DeleteThreshold: number;
    Patch_Margin: number;
    Match_MaxBits: number;

    diff_main(text1: string, text2: string, opt_checklines?: boolean, opt_deadline?: number): Diff[];
    diff_commonPrefix(text1: string, text2: string): number;
    diff_commonSuffix(text1: string, text2: string): number;
    diff_cleanupSemantic(diffs: Diff[]): void;
    diff_cleanupSemanticLossless(diffs: Diff[]): void;
    diff_cleanupEfficiency(diffs: Diff[]): void;
    diff_cleanupMerge(diffs: Diff[]): void;
    diff_cleanupSplitSurrogates(diffs: Diff[]): void;
    diff_xIndex(diffs: Diff[], loc: number): number;
    diff_prettyHtml(diffs: Diff[]): string;
    diff_text1(diffs: Diff[]): string;
    diff_text2(diffs: Diff[]): string;
    diff_levenshtein(diffs: Diff[]): number;
    diff_toDelta(diffs: Diff[]): string;
    diff_fromDelta(text1: string, delta: string): Diff[];

    match_main(text: string, pattern: string, loc: number): number;

    patch_make(a: string, opt_b: string | Diff[]): Array<patch_obj>;
    patch_make(a: Diff[]): Array<patch_obj>;
    /** @deprecated use patch_make(a: string, opt_b: Diff[]) */
    patch_make(a: string, opt_b: string, opt_c: Diff[]): Array<patch_obj>;
    patch_deepCopy(patches: Array<patch_obj>): Array<patch_obj>;
    patch_apply(patches: Array<patch_obj>, text: string): [string, boolean[]];
    patch_addPadding(patches: Array<patch_obj>): string;
    patch_splitMax(patches: Array<patch_obj>): void;
    patch_toText(patches: Array<patch_obj>): string;
    patch_fromText(text: string): Array<patch_obj>;

    static patch_obj: {
        new(): patch_obj;
    };

    static Diff: {
        new(op: number, text: string): Diff;
    }

    new(): diff_match_patch;
    static DIFF_DELETE: -1;
    static DIFF_INSERT: 1;
    static DIFF_EQUAL: 0;
}

export const DIFF_DELETE: typeof diff_match_patch.DIFF_DELETE;
export const DIFF_INSERT: typeof diff_match_patch.DIFF_INSERT;
export const DIFF_EQUAL: typeof diff_match_patch.DIFF_EQUAL;
