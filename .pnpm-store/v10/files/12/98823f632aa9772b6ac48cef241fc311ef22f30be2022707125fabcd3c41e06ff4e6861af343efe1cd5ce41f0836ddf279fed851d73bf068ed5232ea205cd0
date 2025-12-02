import { MutationToken } from './mutationstate';
import { Cas } from './utilities';
/**
 * Contains the results of a Get operation.
 *
 * @category Key-Value
 */
export declare class GetResult {
    /**
     * The content of the document.
     */
    content: any;
    /**
     * The CAS of the document.
     */
    cas: Cas;
    /**
     * The expiry of the document, if it was requested.
     *
     * @see {@link GetOptions.withExpiry}
     */
    expiryTime?: number;
    /**
     * @internal
     */
    constructor(data: {
        content: any;
        cas: Cas;
        expiryTime?: number;
    });
    /**
     * BUG(JSCBC-784): This previously held the content of the document.
     *
     * @deprecated Use {@link GetResult.content} instead.
     */
    get value(): any;
    set value(v: any);
    /**
     * BUG(JSCBC-873): This was incorrectly named at release.
     *
     * @deprecated Use {@link GetResult.expiryTime} instead.
     */
    get expiry(): number | undefined;
}
/**
 * Contains the results of a Range or Sampling Scan operation.
 *
 * @category Key-Value
 */
export declare class ScanResult {
    /**
     * The content of the document.
     */
    id: string;
    /**
     * The content of the document.
     */
    content?: any;
    /**
     * The CAS of the document.
     */
    cas?: Cas;
    /**
     * The expiry of the document, if it was requested.
     *
     * @see {@link GetOptions.withExpiry}
     */
    expiryTime?: number;
    /**
     * @internal
     */
    constructor(data: {
        id: string;
        content?: any;
        cas?: Cas;
        expiryTime?: number;
    });
}
/**
 * Contains the results of an exists operation.
 *
 * @category Key-Value
 */
export declare class ExistsResult {
    /**
     * Indicates whether the document existed or not.
     */
    exists: boolean;
    /**
     * The CAS of the document.
     */
    cas: Cas | undefined;
    /**
     * @internal
     */
    constructor(data: ExistsResult);
}
/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
export declare class MutationResult {
    /**
     * The updated CAS for the document.
     */
    cas: Cas;
    /**
     * The token representing the mutation performed.
     */
    token?: MutationToken;
    /**
     * @internal
     */
    constructor(data: MutationResult);
}
/**
 * Contains the results of a get from replica operation.
 *
 * @category Key-Value
 */
export declare class GetReplicaResult {
    /**
     * The content of the document, as it existed on the replica.
     */
    content: any;
    /**
     * The cas of the document, as it is known by the replica.
     */
    cas: Cas;
    /**
     * Indicates whether this result came from a replica or the primary.
     */
    isReplica: boolean;
    /**
     * @internal
     */
    constructor(data: {
        content: any;
        cas: Cas;
        isReplica: boolean;
    });
}
/**
 * Contains the results of a specific sub-operation within a lookup-in operation.
 *
 * @category Key-Value
 */
export declare class LookupInResultEntry {
    /**
     * The error, if any, which occured when attempting to perform this sub-operation.
     */
    error: Error | null;
    /**
     * The value returned by the sub-operation.
     */
    value?: any;
    /**
     * @internal
     */
    constructor(data: LookupInResultEntry);
}
/**
 * Contains the results of a lookup-in operation.
 *
 * @category Key-Value
 */
export declare class LookupInResult {
    /**
     * A list of result entries for each sub-operation performed.
     */
    content: LookupInResultEntry[];
    /**
     * The cas of the document.
     */
    cas: Cas;
    /**
     * @internal
     */
    constructor(data: {
        content: LookupInResultEntry[];
        cas: Cas;
    });
    /**
     * BUG(JSCBC-730): Previously held the content of the document.
     *
     * @deprecated Use {@link LookupInResult.content} instead.
     */
    get results(): LookupInResultEntry[];
    set results(v: LookupInResultEntry[]);
}
/**
 * Contains the results of a lookup-in replica operation.
 *
 * @category Key-Value
 */
export declare class LookupInReplicaResult {
    /**
     * A list of result entries for each sub-operation performed.
     */
    content: LookupInResultEntry[];
    /**
     * The cas of the document.
     */
    cas: Cas;
    /**
     * Indicates whether this result came from a replica or the primary.
     */
    isReplica: boolean;
    constructor(data: {
        content: LookupInResultEntry[];
        cas: Cas;
        isReplica: boolean;
    });
}
/**
 * Contains the results of a specific sub-operation within a mutate-in operation.
 *
 * @category Key-Value
 */
export declare class MutateInResultEntry {
    /**
     * The resulting value after the completion of the sub-operation.  This namely
     * returned in the case of a counter operation (increment/decrement) and is not
     * included for general operations.
     */
    value: any | undefined;
    /**
     * @internal
     */
    constructor(data: MutateInResultEntry);
}
/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
export declare class MutateInResult {
    /**
     * A list of result entries for each sub-operation performed.
     */
    content: MutateInResultEntry[];
    /**
     * The updated CAS for the document.
     */
    cas: Cas;
    /**
     * The token representing the mutation performed.
     */
    token?: MutationToken;
    /**
     * @internal
     */
    constructor(data: MutateInResult);
}
/**
 * Contains the results of a counter operation (binary increment/decrement).
 *
 * @category Key-Value
 */
export declare class CounterResult {
    /**
     * The new value of the document after the operation completed.
     */
    value: number;
    /**
     * The updated CAS for the document.
     */
    cas: Cas;
    /**
     * The token representing the mutation performed.
     */
    token?: MutationToken;
    /**
     * @internal
     */
    constructor(data: CounterResult);
}
