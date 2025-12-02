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
import { FUNCTIONS_VERSION, WEBSITE_OWNER_NAME, WEBSITE_RESOURCE_GROUP, WEBSITE_SKU, } from './types';
export function getAzureResourceUri(websiteSiteName) {
    var websiteResourceGroup = process.env[WEBSITE_RESOURCE_GROUP];
    var websiteOwnerName = process.env[WEBSITE_OWNER_NAME];
    var subscriptionId = websiteOwnerName;
    if (websiteOwnerName && websiteOwnerName.indexOf('+') !== -1) {
        subscriptionId = websiteOwnerName.split('+')[0];
    }
    if (!subscriptionId && !websiteOwnerName) {
        return undefined;
    }
    return "/subscriptions/" + subscriptionId + "/resourceGroups/" + websiteResourceGroup + "/providers/Microsoft.Web/sites/" + websiteSiteName;
}
export function isAzureFunction() {
    return !!(process.env[FUNCTIONS_VERSION] ||
        process.env[WEBSITE_SKU] === 'FlexConsumption');
}
//# sourceMappingURL=utils.js.map