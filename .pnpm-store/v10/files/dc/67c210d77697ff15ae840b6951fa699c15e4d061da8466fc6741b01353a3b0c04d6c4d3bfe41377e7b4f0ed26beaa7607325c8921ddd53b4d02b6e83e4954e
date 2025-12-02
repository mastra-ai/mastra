"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeList = void 0;
const deserializeList = (list, deserializer) => ({
    object: 'list',
    data: list.data.map(deserializer),
    listMetadata: list.list_metadata,
});
exports.deserializeList = deserializeList;
