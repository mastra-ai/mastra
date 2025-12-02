import { DeveloperIndexConfig } from "./deployApi/finishPush.js";
export type IndexMetadata = {
    table: string;
    name: string;
    fields: string[] | {
        searchField: string;
        filterFields: string[];
    } | {
        dimensions: number;
        vectorField: string;
        filterFields: string[];
    };
    backfill: {
        state: "in_progress" | "done";
    };
    staged: boolean;
};
export type LargeIndexDeletionCheck = "no verification" | "ask for confirmation" | "has confirmation";
export declare function addProgressLinkIfSlow(msg: string, deploymentName: string | null, start: number): string;
export declare function formatIndex(index: DeveloperIndexConfig): string;
//# sourceMappingURL=indexes.d.ts.map