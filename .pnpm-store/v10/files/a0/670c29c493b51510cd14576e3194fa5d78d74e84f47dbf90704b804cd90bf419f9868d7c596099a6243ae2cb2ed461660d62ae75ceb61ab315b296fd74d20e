export const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "s3vectors",
    });
};
export const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
};
