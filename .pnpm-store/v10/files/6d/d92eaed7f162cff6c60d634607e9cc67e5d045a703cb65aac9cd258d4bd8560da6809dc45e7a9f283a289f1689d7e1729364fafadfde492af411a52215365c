"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CounterResult = exports.MutateInResult = exports.MutateInResultEntry = exports.LookupInReplicaResult = exports.LookupInResult = exports.LookupInResultEntry = exports.GetReplicaResult = exports.MutationResult = exports.ExistsResult = exports.ScanResult = exports.GetResult = void 0;
/**
 * Contains the results of a Get operation.
 *
 * @category Key-Value
 */
class GetResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
        this.cas = data.cas;
        this.expiryTime = data.expiryTime;
    }
    /**
     * BUG(JSCBC-784): This previously held the content of the document.
     *
     * @deprecated Use {@link GetResult.content} instead.
     */
    get value() {
        return this.content;
    }
    set value(v) {
        this.content = v;
    }
    /**
     * BUG(JSCBC-873): This was incorrectly named at release.
     *
     * @deprecated Use {@link GetResult.expiryTime} instead.
     */
    get expiry() {
        return this.expiryTime;
    }
}
exports.GetResult = GetResult;
/**
 * Contains the results of a Range or Sampling Scan operation.
 *
 * @category Key-Value
 */
class ScanResult {
    /**
     * @internal
     */
    constructor(data) {
        this.id = data.id;
        this.content = data.content;
        this.cas = data.cas;
        this.expiryTime = data.expiryTime;
    }
}
exports.ScanResult = ScanResult;
/**
 * Contains the results of an exists operation.
 *
 * @category Key-Value
 */
class ExistsResult {
    /**
     * @internal
     */
    constructor(data) {
        this.exists = data.exists;
        this.cas = data.cas;
    }
}
exports.ExistsResult = ExistsResult;
/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
class MutationResult {
    /**
     * @internal
     */
    constructor(data) {
        this.cas = data.cas;
        this.token = data.token;
    }
}
exports.MutationResult = MutationResult;
/**
 * Contains the results of a get from replica operation.
 *
 * @category Key-Value
 */
class GetReplicaResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
        this.cas = data.cas;
        this.isReplica = data.isReplica;
    }
}
exports.GetReplicaResult = GetReplicaResult;
/**
 * Contains the results of a specific sub-operation within a lookup-in operation.
 *
 * @category Key-Value
 */
class LookupInResultEntry {
    /**
     * @internal
     */
    constructor(data) {
        this.error = data.error;
        this.value = data.value;
    }
}
exports.LookupInResultEntry = LookupInResultEntry;
/**
 * Contains the results of a lookup-in operation.
 *
 * @category Key-Value
 */
class LookupInResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
        this.cas = data.cas;
    }
    /**
     * BUG(JSCBC-730): Previously held the content of the document.
     *
     * @deprecated Use {@link LookupInResult.content} instead.
     */
    get results() {
        return this.content;
    }
    set results(v) {
        this.content = v;
    }
}
exports.LookupInResult = LookupInResult;
/**
 * Contains the results of a lookup-in replica operation.
 *
 * @category Key-Value
 */
class LookupInReplicaResult {
    constructor(data) {
        this.content = data.content;
        this.cas = data.cas;
        this.isReplica = data.isReplica;
    }
}
exports.LookupInReplicaResult = LookupInReplicaResult;
/**
 * Contains the results of a specific sub-operation within a mutate-in operation.
 *
 * @category Key-Value
 */
class MutateInResultEntry {
    /**
     * @internal
     */
    constructor(data) {
        this.value = data.value;
    }
}
exports.MutateInResultEntry = MutateInResultEntry;
/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
class MutateInResult {
    /**
     * @internal
     */
    constructor(data) {
        this.content = data.content;
        this.cas = data.cas;
        this.token = data.token;
    }
}
exports.MutateInResult = MutateInResult;
/**
 * Contains the results of a counter operation (binary increment/decrement).
 *
 * @category Key-Value
 */
class CounterResult {
    /**
     * @internal
     */
    constructor(data) {
        this.value = data.value;
        this.cas = data.cas;
        this.token = data.token;
    }
}
exports.CounterResult = CounterResult;
