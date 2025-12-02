"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformMGetLabelsReply = void 0;
const MGET_1 = require("./MGET");
const helpers_1 = require("./helpers");
function createTransformMGetLabelsReply() {
    return {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([, labels, sample]) => {
                return {
                    labels: (0, helpers_1.transformRESP2Labels)(labels),
                    sample: helpers_1.transformSampleReply[2](sample)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([labels, sample]) => {
                return {
                    labels,
                    sample: helpers_1.transformSampleReply[3](sample)
                };
            });
        }
    };
}
exports.createTransformMGetLabelsReply = createTransformMGetLabelsReply;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets the last samples matching a specific filter with labels
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    parseCommand(parser, filter, options) {
        parser.push('TS.MGET');
        (0, MGET_1.parseLatestArgument)(parser, options?.LATEST);
        parser.push('WITHLABELS');
        (0, MGET_1.parseFilterArgument)(parser, filter);
    },
    transformReply: createTransformMGetLabelsReply(),
};
//# sourceMappingURL=MGET_WITHLABELS.js.map