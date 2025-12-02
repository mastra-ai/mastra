import { Endpoint, EndpointParameters as __EndpointParameters, EndpointV2, Provider } from "@smithy/types";
/**
 * @public
 */
export interface ClientInputEndpointParameters {
    region?: string | undefined | Provider<string | undefined>;
    useDualstackEndpoint?: boolean | undefined | Provider<boolean | undefined>;
    useFipsEndpoint?: boolean | undefined | Provider<boolean | undefined>;
    endpoint?: string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;
    accountId?: string | undefined | Provider<string | undefined>;
    accountIdEndpointMode?: string | undefined | Provider<string | undefined>;
}
export type ClientResolvedEndpointParameters = Omit<ClientInputEndpointParameters, "endpoint"> & {
    defaultSigningName: string;
};
export declare const resolveClientEndpointParameters: <T>(options: T & ClientInputEndpointParameters) => T & ClientResolvedEndpointParameters;
export declare const commonParams: {
    readonly UseFIPS: {
        readonly type: "builtInParams";
        readonly name: "useFipsEndpoint";
    };
    readonly AccountId: {
        readonly type: "builtInParams";
        readonly name: "accountId";
    };
    readonly Endpoint: {
        readonly type: "builtInParams";
        readonly name: "endpoint";
    };
    readonly Region: {
        readonly type: "builtInParams";
        readonly name: "region";
    };
    readonly UseDualStack: {
        readonly type: "builtInParams";
        readonly name: "useDualstackEndpoint";
    };
    readonly AccountIdEndpointMode: {
        readonly type: "builtInParams";
        readonly name: "accountIdEndpointMode";
    };
};
export interface EndpointParameters extends __EndpointParameters {
    Region?: string | undefined;
    UseDualStack?: boolean | undefined;
    UseFIPS?: boolean | undefined;
    Endpoint?: string | undefined;
    AccountId?: string | undefined;
    AccountIdEndpointMode?: string | undefined;
    ResourceArn?: string | undefined;
    ResourceArnList?: string[] | undefined;
}
