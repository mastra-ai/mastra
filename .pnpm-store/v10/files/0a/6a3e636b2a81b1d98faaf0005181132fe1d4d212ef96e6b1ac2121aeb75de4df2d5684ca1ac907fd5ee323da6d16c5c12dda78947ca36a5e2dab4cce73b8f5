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
exports.Content = void 0;
const resource_1 = require("../../../../../resource.js");
const Core = __importStar(require("../../../../../core.js"));
class Content extends resource_1.APIResource {
    /**
     * Put script content for a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.update(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: {},
     *     },
     *   );
     * ```
     */
    update(dispatchNamespace, scriptName, params, options) {
        const { account_id, 'CF-WORKER-BODY-PART': cfWorkerBodyPart, 'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`, Core.multipartFormRequestOptions({
            body,
            ...options,
            headers: {
                ...(cfWorkerBodyPart != null ? { 'CF-WORKER-BODY-PART': cfWorkerBodyPart } : undefined),
                ...(cfWorkerMainModulePart != null ?
                    { 'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart }
                    : undefined),
                ...options?.headers,
            },
        }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch script content from a script uploaded to a Workers for Platforms
     * namespace.
     *
     * @example
     * ```ts
     * const content =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     *
     * const data = await content.blob();
     * console.log(data);
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`, { ...options, headers: { Accept: 'string', ...options?.headers }, __binaryResponse: true });
    }
}
exports.Content = Content;
//# sourceMappingURL=content.js.map