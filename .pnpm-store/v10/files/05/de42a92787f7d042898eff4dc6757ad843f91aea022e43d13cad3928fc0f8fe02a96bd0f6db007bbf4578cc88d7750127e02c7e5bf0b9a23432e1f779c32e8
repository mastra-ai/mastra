"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndDeserializeFGAList = void 0;
const list_serializer_1 = require("../serializers/list.serializer");
const fetchAndDeserializeFGAList = (workos, endpoint, deserializeFn, options, requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const { data: response } = yield workos.get(endpoint, Object.assign({ query: options }, requestOptions));
    return (0, list_serializer_1.deserializeFGAList)(response, deserializeFn);
});
exports.fetchAndDeserializeFGAList = fetchAndDeserializeFGAList;
