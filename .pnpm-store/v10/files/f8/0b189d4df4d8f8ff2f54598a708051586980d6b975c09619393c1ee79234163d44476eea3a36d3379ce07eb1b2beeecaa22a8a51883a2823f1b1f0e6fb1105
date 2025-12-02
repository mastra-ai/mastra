"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeValuesEncoder = void 0;
const client_common_1 = require("@clickhouse/client-common");
const stream_1 = __importDefault(require("stream"));
const stream_2 = require("./stream");
class NodeValuesEncoder {
    encodeValues(values, format) {
        if ((0, stream_2.isStream)(values)) {
            // TSV/CSV/CustomSeparated formats don't require additional serialization
            if (!values.readableObjectMode) {
                return values;
            }
            // JSON* formats streams
            return stream_1.default.pipeline(values, (0, stream_2.mapStream)((value) => (0, client_common_1.encodeJSON)(value, format)), pipelineCb);
        }
        // JSON* arrays
        if (Array.isArray(values)) {
            return values.map((value) => (0, client_common_1.encodeJSON)(value, format)).join('');
        }
        // JSON & JSONObjectEachRow format input
        if (typeof values === 'object') {
            return (0, client_common_1.encodeJSON)(values, format);
        }
        throw new Error(`Cannot encode values of type ${typeof values} with ${format} format`);
    }
    validateInsertValues(values, format) {
        if (!Array.isArray(values) &&
            !(0, stream_2.isStream)(values) &&
            typeof values !== 'object') {
            throw new Error('Insert expected "values" to be an array, a stream of values or a JSON object, ' +
                `got: ${typeof values}`);
        }
        if ((0, stream_2.isStream)(values)) {
            if ((0, client_common_1.isSupportedRawFormat)(format)) {
                if (values.readableObjectMode) {
                    throw new Error(`Insert for ${format} expected Readable Stream with disabled object mode.`);
                }
            }
            else if (!values.readableObjectMode) {
                throw new Error(`Insert for ${format} expected Readable Stream with enabled object mode.`);
            }
        }
    }
}
exports.NodeValuesEncoder = NodeValuesEncoder;
function pipelineCb(err) {
    if (err) {
        // FIXME: use logger instead
        // eslint-disable-next-line no-console
        console.error(err);
    }
}
//# sourceMappingURL=encoder.js.map