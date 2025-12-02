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
exports.AuthRestClient = void 0;
const errors_1 = require("../lib/errors");
const AbstractRestClient_1 = require("./AbstractRestClient");
class AuthRestClient extends AbstractRestClient_1.AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "auth";
    }
    /**
     * Generates a new temporary token for the Deepgram API.
     * @param endpoint Optional custom endpoint to use for the request. Defaults to ":version/auth/grant".
     * @returns Object containing the result of the request or an error if one occurred. Result will contain access_token and expires_in properties.
     */
    grantToken(endpoint = ":version/auth/grant") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint);
                const result = yield this.post(requestUrl, "").then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
}
exports.AuthRestClient = AuthRestClient;
//# sourceMappingURL=AuthRestClient.js.map