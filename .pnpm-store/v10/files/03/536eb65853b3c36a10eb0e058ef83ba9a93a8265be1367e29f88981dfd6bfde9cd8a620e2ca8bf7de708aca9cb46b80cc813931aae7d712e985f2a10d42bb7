export const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "dynamodb",
    });
};
export const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    AccountId: { type: "builtInParams", name: "accountId" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
    AccountIdEndpointMode: { type: "builtInParams", name: "accountIdEndpointMode" },
};
