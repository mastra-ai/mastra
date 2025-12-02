"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const VLINKS_1 = __importDefault(require("./VLINKS"));
function transformVLinksWithScoresReply(reply) {
    const layers = [];
    for (const layer of reply) {
        const obj = Object.create(null);
        // Each layer contains alternating element names and scores
        for (let i = 0; i < layer.length; i += 2) {
            const element = layer[i];
            const score = generic_transformers_1.transformDoubleReply[2](layer[i + 1]);
            obj[element.toString()] = score;
        }
        layers.push(obj);
    }
    return layers;
}
exports.default = {
    IS_READ_ONLY: VLINKS_1.default.IS_READ_ONLY,
    /**
     * Get the connections for each layer of the HNSW graph with similarity scores
     * @param args - Same parameters as the VLINKS command
     * @see https://redis.io/commands/vlinks/
     */
    parseCommand(...args) {
        const parser = args[0];
        VLINKS_1.default.parseCommand(...args);
        parser.push('WITHSCORES');
    },
    transformReply: {
        2: transformVLinksWithScoresReply,
        3: undefined
    }
};
//# sourceMappingURL=VLINKS_WITHSCORES.js.map