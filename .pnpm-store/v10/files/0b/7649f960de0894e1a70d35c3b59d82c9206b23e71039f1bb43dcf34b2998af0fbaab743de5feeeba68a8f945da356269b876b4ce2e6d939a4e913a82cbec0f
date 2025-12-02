import type { Credentials, RepoDesignation } from "../types/public";
export interface FileDownloadInfoOutput {
    size: number;
    etag: string;
    /**
     * In case of LFS file, link to download directly from cloud provider
     */
    downloadLink: string | null;
}
/**
 * @returns null when the file doesn't exist
 */
export declare function fileDownloadInfo(params: {
    repo: RepoDesignation;
    path: string;
    revision?: string;
    credentials?: Credentials;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    /**
     * To get the raw pointer file behind a LFS file
     */
    raw?: boolean;
    /**
     * To avoid the content-disposition header in the `downloadLink` for LFS files
     *
     * So that on browsers you can use the URL in an iframe for example
     */
    noContentDisposition?: boolean;
}): Promise<FileDownloadInfoOutput | null>;
//# sourceMappingURL=file-download-info.d.ts.map