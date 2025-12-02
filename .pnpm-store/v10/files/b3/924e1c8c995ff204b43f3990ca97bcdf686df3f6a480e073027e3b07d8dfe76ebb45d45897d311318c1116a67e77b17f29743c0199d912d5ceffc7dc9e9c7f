"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoApiKeyProvidedException = void 0;
class NoApiKeyProvidedException extends Error {
    constructor() {
        super(...arguments);
        this.status = 500;
        this.name = 'NoApiKeyProvidedException';
        this.message = `Missing API key. Pass it to the constructor (new WorkOS("sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU")) ` +
            `or define it in the WORKOS_API_KEY environment variable.`;
    }
}
exports.NoApiKeyProvidedException = NoApiKeyProvidedException;
