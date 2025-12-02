"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeFGAList = void 0;
const deserializeFGAList = (response, deserializeFn) => ({
    object: 'list',
    data: response.data.map(deserializeFn),
    listMetadata: response.list_metadata,
    warnings: response.warnings,
});
exports.deserializeFGAList = deserializeFGAList;
