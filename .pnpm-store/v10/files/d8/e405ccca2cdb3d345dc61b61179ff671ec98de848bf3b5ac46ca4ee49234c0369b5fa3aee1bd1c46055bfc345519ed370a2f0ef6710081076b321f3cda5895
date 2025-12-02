"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const stream_1 = require("stream");
const pg_cursor_1 = __importDefault(require("pg-cursor"));
class QueryStream extends stream_1.Readable {
    constructor(text, values, config = {}) {
        const { batchSize, highWaterMark = 100 } = config;
        super({ objectMode: true, autoDestroy: true, highWaterMark: batchSize || highWaterMark });
        this.cursor = new pg_cursor_1.default(text, values, config);
        // delegate Submittable callbacks to cursor
        this.handleRowDescription = this.cursor.handleRowDescription.bind(this.cursor);
        this.handleDataRow = this.cursor.handleDataRow.bind(this.cursor);
        this.handlePortalSuspended = this.cursor.handlePortalSuspended.bind(this.cursor);
        this.handleCommandComplete = this.cursor.handleCommandComplete.bind(this.cursor);
        this.handleReadyForQuery = this.cursor.handleReadyForQuery.bind(this.cursor);
        this.handleError = this.cursor.handleError.bind(this.cursor);
        this.handleEmptyQuery = this.cursor.handleEmptyQuery.bind(this.cursor);
        // pg client sets types via _result property
        this._result = this.cursor._result;
    }
    submit(connection) {
        this.cursor.submit(connection);
    }
    _destroy(_err, cb) {
        this.cursor.close((err) => {
            cb(err || _err);
        });
    }
    // https://nodejs.org/api/stream.html#stream_readable_read_size_1
    _read(size) {
        this.cursor.read(size, (err, rows) => {
            if (err) {
                // https://nodejs.org/api/stream.html#stream_errors_while_reading
                this.destroy(err);
            }
            else {
                for (const row of rows)
                    this.push(row);
                if (rows.length < size)
                    this.push(null);
            }
        });
    }
}
module.exports = QueryStream;
//# sourceMappingURL=index.js.map