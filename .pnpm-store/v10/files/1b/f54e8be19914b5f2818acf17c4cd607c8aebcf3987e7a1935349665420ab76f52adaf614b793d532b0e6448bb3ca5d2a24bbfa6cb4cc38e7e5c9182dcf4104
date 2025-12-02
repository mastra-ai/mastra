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
import { getHttpConfigurationDefaults, mergeOtlpHttpConfigurationWithDefaults, } from './otlp-http-configuration';
export function httpAgentFactoryFromOptions(options) {
    return async (protocol) => {
        const isInsecure = protocol === 'http:';
        const module = isInsecure ? import('http') : import('https');
        const { Agent } = await module;
        if (isInsecure) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- these props should not be used in agent options
            const { ca, cert, key, ...insecureOptions } = options;
            return new Agent(insecureOptions);
        }
        return new Agent(options);
    };
}
/**
 * @param userProvidedConfiguration  Configuration options provided by the user in code.
 * @param fallbackConfiguration Fallback to use when the {@link userProvidedConfiguration} does not specify an option.
 * @param defaultConfiguration The defaults as defined by the exporter specification
 */
export function mergeOtlpNodeHttpConfigurationWithDefaults(userProvidedConfiguration, fallbackConfiguration, defaultConfiguration) {
    return {
        ...mergeOtlpHttpConfigurationWithDefaults(userProvidedConfiguration, fallbackConfiguration, defaultConfiguration),
        agentFactory: userProvidedConfiguration.agentFactory ??
            fallbackConfiguration.agentFactory ??
            defaultConfiguration.agentFactory,
        userAgent: userProvidedConfiguration.userAgent,
    };
}
export function getNodeHttpConfigurationDefaults(requiredHeaders, signalResourcePath) {
    return {
        ...getHttpConfigurationDefaults(requiredHeaders, signalResourcePath),
        agentFactory: httpAgentFactoryFromOptions({ keepAlive: true }),
    };
}
//# sourceMappingURL=otlp-node-http-configuration.js.map