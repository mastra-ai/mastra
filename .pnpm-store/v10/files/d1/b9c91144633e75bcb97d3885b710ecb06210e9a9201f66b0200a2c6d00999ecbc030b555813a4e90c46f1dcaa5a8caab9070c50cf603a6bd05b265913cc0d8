/** Common stream deletion policies
 *
 *  Added in Redis 8.2
 */
export declare const STREAM_DELETION_POLICY: {
    /** Preserve references (default) */
    readonly KEEPREF: "KEEPREF";
    /** Delete all references */
    readonly DELREF: "DELREF";
    /** Only acknowledged entries */
    readonly ACKED: "ACKED";
};
export type StreamDeletionPolicy = (typeof STREAM_DELETION_POLICY)[keyof typeof STREAM_DELETION_POLICY];
/** Common reply codes for stream deletion operations */
export declare const STREAM_DELETION_REPLY_CODES: {
    /** ID not found */
    readonly NOT_FOUND: -1;
    /** Entry deleted */
    readonly DELETED: 1;
    /** Dangling references */
    readonly DANGLING_REFS: 2;
};
export type StreamDeletionReplyCode = (typeof STREAM_DELETION_REPLY_CODES)[keyof typeof STREAM_DELETION_REPLY_CODES];
//# sourceMappingURL=common-stream.types.d.ts.map