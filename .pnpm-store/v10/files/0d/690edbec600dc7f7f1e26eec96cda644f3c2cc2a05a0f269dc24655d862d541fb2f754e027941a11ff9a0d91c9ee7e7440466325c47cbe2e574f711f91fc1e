import { IronSessionProvider, SealDataOptions, UnsealedDataType } from './iron-session-provider';
/**
 * EdgeIronSessionProvider which uses the base iron-session seal/unseal methods.
 */
export declare class EdgeIronSessionProvider extends IronSessionProvider {
    /** @override */
    sealData(data: unknown, options: SealDataOptions): Promise<string>;
    /** @override */
    unsealData<T = UnsealedDataType>(seal: string, options: SealDataOptions): Promise<T>;
}
