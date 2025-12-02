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
exports.Events = void 0;
const serializers_1 = require("../common/serializers");
const serializers_2 = require("./serializers");
class Events {
    constructor(workos) {
        this.workos = workos;
    }
    listEvents(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/events`, {
                query: options ? (0, serializers_2.serializeListEventOptions)(options) : undefined,
            });
            return (0, serializers_1.deserializeList)(data, serializers_1.deserializeEvent);
        });
    }
}
exports.Events = Events;
