const ENV_ENDPOINT_DISCOVERY = ["AWS_ENABLE_ENDPOINT_DISCOVERY", "AWS_ENDPOINT_DISCOVERY_ENABLED"];
const CONFIG_ENDPOINT_DISCOVERY = "endpoint_discovery_enabled";
const isFalsy = (value) => ["false", "0"].indexOf(value) >= 0;
export const NODE_ENDPOINT_DISCOVERY_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => {
        for (let i = 0; i < ENV_ENDPOINT_DISCOVERY.length; i++) {
            const envKey = ENV_ENDPOINT_DISCOVERY[i];
            if (envKey in env) {
                const value = env[envKey];
                if (value === "") {
                    throw Error(`Environment variable ${envKey} can't be empty of undefined, got "${value}"`);
                }
                return !isFalsy(value);
            }
        }
    },
    configFileSelector: (profile) => {
        if (CONFIG_ENDPOINT_DISCOVERY in profile) {
            const value = profile[CONFIG_ENDPOINT_DISCOVERY];
            if (value === undefined) {
                throw Error(`Shared config entry ${CONFIG_ENDPOINT_DISCOVERY} can't be undefined, got "${value}"`);
            }
            return !isFalsy(value);
        }
    },
    default: undefined,
};
