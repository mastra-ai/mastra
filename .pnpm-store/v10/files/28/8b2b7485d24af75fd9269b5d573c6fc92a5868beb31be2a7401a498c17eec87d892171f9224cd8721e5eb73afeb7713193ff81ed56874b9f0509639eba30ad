"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Lists ACL categories or commands in a category
     * @param parser - The Redis command parser
     * @param categoryName - Optional category name to filter commands
     */
    parseCommand(parser, categoryName) {
        parser.push('ACL', 'CAT');
        if (categoryName) {
            parser.push(categoryName);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_CAT.js.map