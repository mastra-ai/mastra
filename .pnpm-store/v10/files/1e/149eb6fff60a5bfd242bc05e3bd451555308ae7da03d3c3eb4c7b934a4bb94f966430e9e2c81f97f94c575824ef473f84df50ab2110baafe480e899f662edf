"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MGET_1 = require("./MGET");
const helpers_1 = require("./helpers");
const MGET_WITHLABELS_1 = require("./MGET_WITHLABELS");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets the last samples matching a specific filter with selected labels
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param selectedLabels - Labels to include in the output
     * @param options - Optional parameters for the command
     */
    parseCommand(parser, filter, selectedLabels, options) {
        parser.push('TS.MGET');
        (0, MGET_1.parseLatestArgument)(parser, options?.LATEST);
        (0, helpers_1.parseSelectedLabelsArguments)(parser, selectedLabels);
        (0, MGET_1.parseFilterArgument)(parser, filter);
    },
    transformReply: (0, MGET_WITHLABELS_1.createTransformMGetLabelsReply)(),
};
//# sourceMappingURL=MGET_SELECTED_LABELS.js.map