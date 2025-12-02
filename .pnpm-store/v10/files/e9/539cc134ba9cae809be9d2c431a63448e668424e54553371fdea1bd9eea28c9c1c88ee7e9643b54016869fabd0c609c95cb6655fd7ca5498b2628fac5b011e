export interface ApiIndexTreeEntry {
    type: "file" | "directory" | "unknown";
    size: number;
    path: string;
    oid: string;
    lfs?: {
        oid: string;
        size: number;
        /** Size of the raw pointer file, 100~200 bytes */
        pointerSize: number;
    };
    lastCommit?: {
        date: string;
        id: string;
        title: string;
    };
    security?: ApiFileScanResult;
}
export interface ApiFileScanResult {
    /** namespaced by repo type (models/, datasets/, spaces/) */
    repositoryId: string;
    blobId: string;
    name: string;
    safe: boolean;
    avScan?: ApiAVScan;
    pickleImportScan?: ApiPickleImportScan;
}
interface ApiAVScan {
    virusFound: boolean;
    virusNames?: string[];
}
type ApiSafetyLevel = "innocuous" | "suspicious" | "dangerous";
interface ApiPickleImport {
    module: string;
    name: string;
    safety: ApiSafetyLevel;
}
interface ApiPickleImportScan {
    highestSafetyLevel: ApiSafetyLevel;
    imports: ApiPickleImport[];
}
export {};
//# sourceMappingURL=api-index-tree.d.ts.map