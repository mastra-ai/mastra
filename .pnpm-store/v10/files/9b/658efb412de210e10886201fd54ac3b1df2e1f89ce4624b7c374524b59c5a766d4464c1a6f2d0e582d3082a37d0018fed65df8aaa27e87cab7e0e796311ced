"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
const resource_1 = require("../../../../../resource.js");
const Core = __importStar(require("../../../../../core.js"));
class Settings extends resource_1.APIResource {
    /**
     * Patch script metadata, such as bindings.
     *
     * @example
     * ```ts
     * const response =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.settings.edit(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(dispatchNamespace, scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/settings`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get script settings from a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const setting =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.settings.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Settings = Settings;
//# sourceMappingURL=settings.js.map