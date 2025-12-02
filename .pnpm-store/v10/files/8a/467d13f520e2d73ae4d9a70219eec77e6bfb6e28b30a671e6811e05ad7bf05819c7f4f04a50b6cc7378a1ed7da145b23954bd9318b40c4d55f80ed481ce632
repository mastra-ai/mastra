export interface ApiLfsBatchRequest {
    operation: "download" | "upload";
    transfers?: string[];
    /**
     * Optional object describing the server ref that the objects belong to. Note: Added in v2.4.
     *
     * We use this object for QOL and to fail early for users when they're tring to push to the wrong reference.
     * But it does nothing for security.
     */
    ref?: {
        name: string;
    } | null;
    objects: {
        oid: string;
        /**
         * Integer byte size of the LFS object. Must be at least zero.
         */
        size: number;
    }[];
    /**
     * The hash algorithm used to name Git LFS objects. Optional; defaults to sha256 if not specified.
     * */
    hash_algo?: string;
}
export interface ApiLfsBatchResponse {
    transfer?: ApiLfsResponseTransfer;
    objects: ApiLfsResponseObject[];
}
export type ApiLfsResponseTransfer = "basic" | "multipart";
export interface ApiLfsCompleteMultipartRequest {
    oid: string;
    parts: {
        etag: string;
        partNumber: number;
    }[];
}
export interface ApiLfsResponseObject {
    /**
     * Optional boolean specifying whether the request
     * for this specific object is authenticated.
     * If omitted or false, Git LFS will attempt to find credentials for this URL.
     */
    authenticated?: boolean;
    oid: string;
    /**
     * Integer byte size of the LFS object. Must be at least zero.
     */
    size: number;
    /**
     * Applicable actions depend on which `operation` is specified in the request.
     * How these properties are interpreted depends on which transfer adapter
     * the client will be using.
     */
    actions?: {
        /**
         * Download operations MUST specify a download action,
         * or an object error if the object cannot be downloaded for some reason
         */
        download?: ApiLfsAction;
        /**
         * Upload operations can specify an upload and a verify action.
         * The upload action describes how to upload the object.
         */
        upload?: ApiLfsAction;
        /**
         * The LFS client will hit this URL after a successful upload.
         * Servers can use this for extra verification, if needed.
         */
        verify?: ApiLfsAction;
    };
    /**
     * If there are problems accessing individual objects, servers should continue
     * to return a 200 status code, and provide per-object errors
     */
    error?: {
        code: number;
        message: string;
    };
}
export interface ApiLfsAction {
    href: string;
    /**
     * Optional hash of String HTTP header key/value pairs to apply to the request
     */
    header?: {
        [key: string]: string;
    } & {
        chunk_size?: string;
    };
    /**
     * Whole number of seconds after local client time when transfer will expire.
     * Preferred over `expires_at` if both are provided.
     * Maximum of 2147483647, minimum of -2147483647.
     */
    expires_in?: number;
    /**
     * String uppercase RFC 3339-formatted timestamp with second precision
     * for when the given action expires (usually due to a temporary token).
     */
    expires_at?: string;
}
export interface ApiPreuploadRequest {
    /**
     * Optional, otherwise takes the existing content of `.gitattributes` for the revision.
     *
     * Provide this parameter if you plan to modify `.gitattributes` yourself at the same
     * time as uploading LFS files.
     *
     * Note that this is not needed if you solely rely on automatic LFS detection from HF: the commit endpoint
     * will automatically edit the `.gitattributes` file to track the files passed to its `lfsFiles` param.
     */
    gitAttributes?: string;
    files: Array<{
        /**
         * Path of the LFS file
         */
        path: string;
        /**
         * Full size of the LFS file
         */
        size: number;
        /**
         * Base64-encoded sample of the first 512 bytes of the file
         */
        sample: string;
    }>;
}
export interface ApiPreuploadResponse {
    files: Array<{
        path: string;
        uploadMode: "lfs" | "regular";
    }>;
}
export interface ApiCommitHeader {
    summary: string;
    description?: string;
    /**
     * Parent commit. Optional
     *
     * - When opening a PR: will use parentCommit as the parent commit
     * - When committing on a branch: Will make sure that there were no intermediate commits
     */
    parentCommit?: string;
}
export interface ApiCommitDeletedEntry {
    path: string;
}
export interface ApiCommitLfsFile {
    path: string;
    oldPath?: string;
    /** Required if {@link oldPath} is not set */
    algo?: "sha256";
    /** Required if {@link oldPath} is not set */
    oid?: string;
    size?: number;
}
export interface ApiCommitFile {
    /** Required if {@link oldPath} is not set */
    content?: string;
    path: string;
    oldPath?: string;
    encoding?: "utf-8" | "base64";
}
export type ApiCommitOperation = {
    key: "file";
    value: ApiCommitFile;
} | {
    key: "lfsFile";
    value: ApiCommitLfsFile;
} | {
    key: "deletedFile";
    value: ApiCommitDeletedEntry;
};
export interface ApiCommitData {
    id: string;
    title: string;
    message: string;
    authors: Array<{
        user: string;
        avatar: string;
    }>;
    date: string;
    formatted?: string;
}
//# sourceMappingURL=api-commit.d.ts.map