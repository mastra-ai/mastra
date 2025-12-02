import type * as Hapi from '@hapi/hapi';
export declare const HapiComponentName = "@hapi/hapi";
/**
 * This symbol is used to mark a Hapi route handler or server extension handler as
 * already patched, since its possible to use these handlers multiple times
 * i.e. when allowing multiple versions of one plugin, or when registering a plugin
 * multiple times on different servers.
 */
export declare const handlerPatched: unique symbol;
export declare type HapiServerRouteInputMethod = (route: HapiServerRouteInput) => void;
export declare type HapiServerRouteInput = PatchableServerRoute | PatchableServerRoute[];
export declare type PatchableServerRoute = Hapi.ServerRoute<any> & {
    [handlerPatched]?: boolean;
};
export declare type HapiPluginObject<T> = Hapi.ServerRegisterPluginObject<T>;
export declare type HapiPluginInput<T> = HapiPluginObject<T> | Array<HapiPluginObject<T>>;
export declare type RegisterFunction<T> = (plugin: HapiPluginInput<T>, options?: Hapi.ServerRegisterOptions) => Promise<void>;
export declare type PatchableExtMethod = Hapi.Lifecycle.Method & {
    [handlerPatched]?: boolean;
};
export declare type ServerExtDirectInput = [
    Hapi.ServerRequestExtType,
    Hapi.Lifecycle.Method,
    (Hapi.ServerExtOptions | undefined)?
];
export declare const HapiLayerType: {
    ROUTER: string;
    PLUGIN: string;
    EXT: string;
};
export declare const HapiLifecycleMethodNames: Set<string>;
//# sourceMappingURL=internal-types.d.ts.map