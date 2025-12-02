/**
 * Logical types, vector layouts, and schemas
 * Format Version History.
 * Version 1.0 - Forward and backwards compatibility guaranteed.
 * Version 1.1 - Add Decimal256.
 * Version 1.2 - Add Interval MONTH_DAY_NANO.
 * Version 1.3 - Add Run-End Encoded.
 */
export declare enum MetadataVersion {
    /**
     * 0.1.0 (October 2016).
     */
    V1 = 0,
    /**
     * 0.2.0 (February 2017). Non-backwards compatible with V1.
     */
    V2 = 1,
    /**
     * 0.3.0 -> 0.7.1 (May - December 2017). Non-backwards compatible with V2.
     */
    V3 = 2,
    /**
     * >= 0.8.0 (December 2017). Non-backwards compatible with V3.
     */
    V4 = 3,
    /**
     * >= 1.0.0 (July 2020. Backwards compatible with V4 (V5 readers can read V4
     * metadata and IPC messages). Implementations are recommended to provide a
     * V4 compatibility mode with V5 format changes disabled.
     *
     * Incompatible changes between V4 and V5:
     * - Union buffer layout has changed. In V5, Unions don't have a validity
     *   bitmap buffer.
     */
    V5 = 4
}
