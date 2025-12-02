/// <reference types="node" />
import { Readable } from 'stream';
import { Submittable, Connection } from 'pg';
interface QueryStreamConfig {
    batchSize?: number;
    highWaterMark?: number;
    rowMode?: 'array';
    types?: any;
}
declare class QueryStream extends Readable implements Submittable {
    cursor: any;
    _result: any;
    handleRowDescription: Function;
    handleDataRow: Function;
    handlePortalSuspended: Function;
    handleCommandComplete: Function;
    handleReadyForQuery: Function;
    handleError: Function;
    handleEmptyQuery: Function;
    constructor(text: string, values?: any[], config?: QueryStreamConfig);
    submit(connection: Connection): void;
    _destroy(_err: Error, cb: Function): void;
    _read(size: number): void;
}
export = QueryStream;
