"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRESP2LabelsWithSources = exports.transformRESP2Labels = exports.parseSelectedLabelsArguments = exports.resp3MapToValue = exports.resp2MapToValue = exports.transformSamplesReply = exports.transformSampleReply = exports.parseLabelsArgument = exports.transformTimestampArgument = exports.parseDuplicatePolicy = exports.TIME_SERIES_DUPLICATE_POLICIES = exports.parseChunkSizeArgument = exports.parseEncodingArgument = exports.TIME_SERIES_ENCODING = exports.parseRetentionArgument = exports.parseIgnoreArgument = void 0;
const client_1 = require("@redis/client");
function parseIgnoreArgument(parser, ignore) {
    if (ignore !== undefined) {
        parser.push('IGNORE', ignore.maxTimeDiff.toString(), ignore.maxValDiff.toString());
    }
}
exports.parseIgnoreArgument = parseIgnoreArgument;
function parseRetentionArgument(parser, retention) {
    if (retention !== undefined) {
        parser.push('RETENTION', retention.toString());
    }
}
exports.parseRetentionArgument = parseRetentionArgument;
exports.TIME_SERIES_ENCODING = {
    COMPRESSED: 'COMPRESSED',
    UNCOMPRESSED: 'UNCOMPRESSED'
};
function parseEncodingArgument(parser, encoding) {
    if (encoding !== undefined) {
        parser.push('ENCODING', encoding);
    }
}
exports.parseEncodingArgument = parseEncodingArgument;
function parseChunkSizeArgument(parser, chunkSize) {
    if (chunkSize !== undefined) {
        parser.push('CHUNK_SIZE', chunkSize.toString());
    }
}
exports.parseChunkSizeArgument = parseChunkSizeArgument;
exports.TIME_SERIES_DUPLICATE_POLICIES = {
    BLOCK: 'BLOCK',
    FIRST: 'FIRST',
    LAST: 'LAST',
    MIN: 'MIN',
    MAX: 'MAX',
    SUM: 'SUM'
};
function parseDuplicatePolicy(parser, duplicatePolicy) {
    if (duplicatePolicy !== undefined) {
        parser.push('DUPLICATE_POLICY', duplicatePolicy);
    }
}
exports.parseDuplicatePolicy = parseDuplicatePolicy;
function transformTimestampArgument(timestamp) {
    if (typeof timestamp === 'string')
        return timestamp;
    return (typeof timestamp === 'number' ?
        timestamp :
        timestamp.getTime()).toString();
}
exports.transformTimestampArgument = transformTimestampArgument;
function parseLabelsArgument(parser, labels) {
    if (labels) {
        parser.push('LABELS');
        for (const [label, value] of Object.entries(labels)) {
            parser.push(label, value);
        }
    }
}
exports.parseLabelsArgument = parseLabelsArgument;
exports.transformSampleReply = {
    2(reply) {
        const [timestamp, value] = reply;
        return {
            timestamp,
            value: Number(value) // TODO: use double type mapping instead
        };
    },
    3(reply) {
        const [timestamp, value] = reply;
        return {
            timestamp,
            value
        };
    }
};
exports.transformSamplesReply = {
    2(reply) {
        return reply
            .map(sample => exports.transformSampleReply[2](sample));
    },
    3(reply) {
        return reply
            .map(sample => exports.transformSampleReply[3](sample));
    }
};
// TODO: move to @redis/client?
function resp2MapToValue(wrappedReply, parseFunc, typeMapping) {
    const reply = wrappedReply;
    switch (typeMapping?.[client_1.RESP_TYPES.MAP]) {
        case Map: {
            const ret = new Map();
            for (const wrappedTuple of reply) {
                const tuple = wrappedTuple;
                const key = tuple[0];
                ret.set(key.toString(), parseFunc(tuple));
            }
            return ret;
        }
        case Array: {
            for (const wrappedTuple of reply) {
                const tuple = wrappedTuple;
                tuple[1] = parseFunc(tuple);
            }
            return reply;
        }
        default: {
            const ret = Object.create(null);
            for (const wrappedTuple of reply) {
                const tuple = wrappedTuple;
                const key = tuple[0];
                ret[key.toString()] = parseFunc(tuple);
            }
            return ret;
        }
    }
}
exports.resp2MapToValue = resp2MapToValue;
function resp3MapToValue(wrappedReply, parseFunc) {
    const reply = wrappedReply;
    if (reply instanceof Array) {
        for (let i = 1; i < reply.length; i += 2) {
            reply[i] = parseFunc(reply[i]);
        }
    }
    else if (reply instanceof Map) {
        for (const [key, value] of reply.entries()) {
            reply.set(key, parseFunc(value));
        }
    }
    else {
        for (const [key, value] of Object.entries(reply)) {
            reply[key] = parseFunc(value);
        }
    }
    return reply;
}
exports.resp3MapToValue = resp3MapToValue;
function parseSelectedLabelsArguments(parser, selectedLabels) {
    parser.push('SELECTED_LABELS');
    parser.pushVariadic(selectedLabels);
}
exports.parseSelectedLabelsArguments = parseSelectedLabelsArguments;
function transformRESP2Labels(labels, typeMapping) {
    const unwrappedLabels = labels;
    switch (typeMapping?.[client_1.RESP_TYPES.MAP]) {
        case Map:
            const map = new Map();
            for (const tuple of unwrappedLabels) {
                const [key, value] = tuple;
                const unwrappedKey = key;
                map.set(unwrappedKey.toString(), value);
            }
            return map;
        case Array:
            return unwrappedLabels.flat();
        case Object:
        default:
            const labelsObject = Object.create(null);
            for (const tuple of unwrappedLabels) {
                const [key, value] = tuple;
                const unwrappedKey = key;
                labelsObject[unwrappedKey.toString()] = value;
            }
            return labelsObject;
    }
}
exports.transformRESP2Labels = transformRESP2Labels;
function transformRESP2LabelsWithSources(labels, typeMapping) {
    const unwrappedLabels = labels;
    const to = unwrappedLabels.length - 2; // ignore __reducer__ and __source__
    let transformedLabels;
    switch (typeMapping?.[client_1.RESP_TYPES.MAP]) {
        case Map:
            const map = new Map();
            for (let i = 0; i < to; i++) {
                const [key, value] = unwrappedLabels[i];
                const unwrappedKey = key;
                map.set(unwrappedKey.toString(), value);
            }
            transformedLabels = map;
            break;
        case Array:
            transformedLabels = unwrappedLabels.slice(0, to).flat();
            break;
        case Object:
        default:
            const labelsObject = Object.create(null);
            for (let i = 0; i < to; i++) {
                const [key, value] = unwrappedLabels[i];
                const unwrappedKey = key;
                labelsObject[unwrappedKey.toString()] = value;
            }
            transformedLabels = labelsObject;
            break;
    }
    const sourcesTuple = unwrappedLabels[unwrappedLabels.length - 1];
    const unwrappedSourcesTuple = sourcesTuple;
    // the __source__ label will never be null
    const transformedSources = transformRESP2Sources(unwrappedSourcesTuple[1]);
    return {
        labels: transformedLabels,
        sources: transformedSources
    };
}
exports.transformRESP2LabelsWithSources = transformRESP2LabelsWithSources;
function transformRESP2Sources(sourcesRaw) {
    // if a label contains "," this function will produce incorrcet results..
    // there is not much we can do about it, and we assume most users won't be using "," in their labels..
    const unwrappedSources = sourcesRaw;
    if (typeof unwrappedSources === 'string') {
        return unwrappedSources.split(',');
    }
    const indexOfComma = unwrappedSources.indexOf(',');
    if (indexOfComma === -1) {
        return [unwrappedSources];
    }
    const sourcesArray = [
        unwrappedSources.subarray(0, indexOfComma)
    ];
    let previousComma = indexOfComma + 1;
    while (true) {
        const indexOf = unwrappedSources.indexOf(',', previousComma);
        if (indexOf === -1) {
            sourcesArray.push(unwrappedSources.subarray(previousComma));
            break;
        }
        const source = unwrappedSources.subarray(previousComma, indexOf);
        sourcesArray.push(source);
        previousComma = indexOf + 1;
    }
    return sourcesArray;
}
//# sourceMappingURL=helpers.js.map