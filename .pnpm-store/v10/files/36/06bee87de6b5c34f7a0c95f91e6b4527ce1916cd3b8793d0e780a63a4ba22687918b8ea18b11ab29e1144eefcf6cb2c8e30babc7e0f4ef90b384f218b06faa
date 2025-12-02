"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAzureFunction = exports.getAzureResourceUri = void 0;
const types_1 = require("./types");
function getAzureResourceUri(websiteSiteName) {
    const websiteResourceGroup = process.env[types_1.WEBSITE_RESOURCE_GROUP];
    const websiteOwnerName = process.env[types_1.WEBSITE_OWNER_NAME];
    let subscriptionId = websiteOwnerName;
    if (websiteOwnerName && websiteOwnerName.indexOf('+') !== -1) {
        subscriptionId = websiteOwnerName.split('+')[0];
    }
    if (!subscriptionId && !websiteOwnerName) {
        return undefined;
    }
    return `/subscriptions/${subscriptionId}/resourceGroups/${websiteResourceGroup}/providers/Microsoft.Web/sites/${websiteSiteName}`;
}
exports.getAzureResourceUri = getAzureResourceUri;
function isAzureFunction() {
    return !!(process.env[types_1.FUNCTIONS_VERSION] ||
        process.env[types_1.WEBSITE_SKU] === 'FlexConsumption');
}
exports.isAzureFunction = isAzureFunction;
//# sourceMappingURL=utils.js.map