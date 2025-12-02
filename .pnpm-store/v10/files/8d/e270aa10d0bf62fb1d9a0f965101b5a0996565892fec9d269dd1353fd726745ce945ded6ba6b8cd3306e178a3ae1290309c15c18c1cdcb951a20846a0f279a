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
exports.EdgeIronSessionProvider = void 0;
const edge_1 = require("iron-session/edge");
const iron_session_provider_1 = require("./iron-session-provider");
/**
 * EdgeIronSessionProvider which uses the base iron-session seal/unseal methods.
 */
class EdgeIronSessionProvider extends iron_session_provider_1.IronSessionProvider {
    /** @override */
    sealData(data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // The iron-session default ttl is 14 days, which can be problematic if the WorkOS session is configured to be > 14 days.
            // In that case the session expires and can't be refreshed, so we set the ttl to 0 to set it to the max possible value.
            const sealOptions = Object.assign(Object.assign({}, options), { ttl: 0 });
            return (0, edge_1.sealData)(data, sealOptions);
        });
    }
    /** @override */
    unsealData(seal, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, edge_1.unsealData)(seal, options);
        });
    }
}
exports.EdgeIronSessionProvider = EdgeIronSessionProvider;
