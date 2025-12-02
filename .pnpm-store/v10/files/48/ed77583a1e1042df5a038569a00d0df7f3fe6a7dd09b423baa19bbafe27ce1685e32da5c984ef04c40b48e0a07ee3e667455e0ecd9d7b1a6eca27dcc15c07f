import {
  Endpoint,
  EndpointParameters as __EndpointParameters,
  EndpointV2,
  Provider,
} from "@smithy/types";
export interface ClientInputEndpointParameters {
  useFipsEndpoint?: boolean | undefined | Provider<boolean | undefined>;
  endpoint?:
    | string
    | Provider<string>
    | Endpoint
    | Provider<Endpoint>
    | EndpointV2
    | Provider<EndpointV2>;
  region?: string | undefined | Provider<string | undefined>;
}
export type ClientResolvedEndpointParameters = Pick<
  ClientInputEndpointParameters,
  Exclude<keyof ClientInputEndpointParameters, "endpoint">
> & {
  defaultSigningName: string;
};
export declare const resolveClientEndpointParameters: <T>(
  options: T & ClientInputEndpointParameters
) => T & ClientResolvedEndpointParameters;
export declare const commonParams: {
  readonly UseFIPS: {
    readonly type: "builtInParams";
    readonly name: "useFipsEndpoint";
  };
  readonly Endpoint: {
    readonly type: "builtInParams";
    readonly name: "endpoint";
  };
  readonly Region: {
    readonly type: "builtInParams";
    readonly name: "region";
  };
};
export interface EndpointParameters extends __EndpointParameters {
  UseFIPS?: boolean | undefined;
  Endpoint?: string | undefined;
  Region?: string | undefined;
}
