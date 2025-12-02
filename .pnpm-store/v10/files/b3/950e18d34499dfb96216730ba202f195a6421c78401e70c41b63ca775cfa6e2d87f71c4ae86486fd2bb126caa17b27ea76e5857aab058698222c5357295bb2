'use strict';

const getAwsRegionExtensionConfiguration = (runtimeConfig) => {
    return {
        setRegion(region) {
            runtimeConfig.region = region;
        },
        region() {
            return runtimeConfig.region;
        },
    };
};
const resolveAwsRegionExtensionConfiguration = (awsRegionExtensionConfiguration) => {
    return {
        region: awsRegionExtensionConfiguration.region(),
    };
};

const REGION_ENV_NAME = "AWS_REGION";
const REGION_INI_NAME = "region";
const NODE_REGION_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => env[REGION_ENV_NAME],
    configFileSelector: (profile) => profile[REGION_INI_NAME],
    default: () => {
        throw new Error("Region is missing");
    },
};
const NODE_REGION_CONFIG_FILE_OPTIONS = {
    preferredFile: "credentials",
};

const isFipsRegion = (region) => typeof region === "string" && (region.startsWith("fips-") || region.endsWith("-fips"));

const getRealRegion = (region) => isFipsRegion(region)
    ? ["fips-aws-global", "aws-fips"].includes(region)
        ? "us-east-1"
        : region.replace(/fips-(dkr-|prod-)?|-fips/, "")
    : region;

const resolveRegionConfig = (input) => {
    const { region, useFipsEndpoint } = input;
    if (!region) {
        throw new Error("Region is missing");
    }
    return Object.assign(input, {
        region: async () => {
            if (typeof region === "string") {
                return getRealRegion(region);
            }
            const providedRegion = await region();
            return getRealRegion(providedRegion);
        },
        useFipsEndpoint: async () => {
            const providedRegion = typeof region === "string" ? region : await region();
            if (isFipsRegion(providedRegion)) {
                return true;
            }
            return typeof useFipsEndpoint !== "function" ? Promise.resolve(!!useFipsEndpoint) : useFipsEndpoint();
        },
    });
};

exports.NODE_REGION_CONFIG_FILE_OPTIONS = NODE_REGION_CONFIG_FILE_OPTIONS;
exports.NODE_REGION_CONFIG_OPTIONS = NODE_REGION_CONFIG_OPTIONS;
exports.REGION_ENV_NAME = REGION_ENV_NAME;
exports.REGION_INI_NAME = REGION_INI_NAME;
exports.getAwsRegionExtensionConfiguration = getAwsRegionExtensionConfiguration;
exports.resolveAwsRegionExtensionConfiguration = resolveAwsRegionExtensionConfiguration;
exports.resolveRegionConfig = resolveRegionConfig;
