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
exports.ScriptAndVersionSettings = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
class ScriptAndVersionSettings extends resource_1.APIResource {
    /**
     * Patch metadata or config, such as bindings or usage model.
     *
     * @example
     * ```ts
     * const response =
     *   await client.workers.scripts.scriptAndVersionSettings.edit(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    edit(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/workers/scripts/${scriptName}/settings`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get metadata and config, such as bindings or usage model.
     *
     * @example
     * ```ts
     * const scriptAndVersionSetting =
     *   await client.workers.scripts.scriptAndVersionSettings.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ScriptAndVersionSettings = ScriptAndVersionSettings;
//# sourceMappingURL=script-and-version-settings.js.map