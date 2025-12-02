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
exports.fetchAndDeserialize = void 0;
const serializers_1 = require("../serializers");
const setDefaultOptions = (options) => {
    return Object.assign(Object.assign({}, options), { order: (options === null || options === void 0 ? void 0 : options.order) || 'desc' });
};
const fetchAndDeserialize = (workos, endpoint, deserializeFn, options, requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield workos.get(endpoint, Object.assign({ query: setDefaultOptions(options) }, requestOptions));
    return (0, serializers_1.deserializeList)(data, deserializeFn);
});
exports.fetchAndDeserialize = fetchAndDeserialize;
