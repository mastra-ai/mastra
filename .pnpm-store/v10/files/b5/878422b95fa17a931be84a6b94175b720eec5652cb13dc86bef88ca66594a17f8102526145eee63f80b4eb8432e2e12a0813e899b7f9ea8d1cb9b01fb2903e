import { ConnectOptions } from './cluster';
/**
 * IConfigProfile specifies a ConfigProfile which applies
 * specified option values to ConnectionOptions.
 *
 * Volatile: This API is subject to change at any time.
 */
export interface IConfigProfile {
    /**
     * Applies the ConfigProfile options to the provided ConnectOptions.
     *
     * Volatile: This API is subject to change at any time.
     *
     * @param options The Connect options the ConfigProfile should be applied toward.
     */
    apply(options: ConnectOptions): void;
}
/**
 * The WAN Development profile sets various timeout options that are useful
 * when working in a WAN environment.
 *
 * Volatile: This API is subject to change at any time.
 */
export declare class WanDevelopmentProfile implements IConfigProfile {
    /**
     * Applies the ConfigProfile options to the provided ConnectOptions.
     *
     * Volatile: This API is subject to change at any time.
     *
     * @param options The Connect options the ConfigProfile should be applied toward.
     */
    apply(options: ConnectOptions): void;
}
/**
 * The ConfigProfiles class keeps track of registered/known Configuration Profiles.
 *
 * Volatile: This API is subject to change at any time.
 */
export declare class ConfigProfiles {
    private _profiles;
    constructor();
    /**
     * Applies the specified registered ConfigProfile to the provided ConnectOptions.
     *
     * Volatile: This API is subject to change at any time.
     *
     *  @param profileName The name of the ConfigProfile to apply.
     *  @param options The Connect options the ConfigProfile should be applied toward.
     */
    applyProfile(profileName: string, options: ConnectOptions): void;
    /**
     * Registers a ConfigProfile under the specified name.
     *
     * Volatile: This API is subject to change at any time.
     *
     *  @param profileName The name the ConfigProfile should be registered under.
     *  @param profile The ConfigProfile to register.
     */
    registerProfile(profileName: string, profile: IConfigProfile): void;
    /**
     * Unregisters the specified ConfigProfile.
     *
     * Volatile: This API is subject to change at any time.
     *
     *  @param profileName The name of the ConfigProfile to unregister.
     */
    unregisterProfile(profileName: string): void;
}
export declare const knownProfiles: ConfigProfiles;
