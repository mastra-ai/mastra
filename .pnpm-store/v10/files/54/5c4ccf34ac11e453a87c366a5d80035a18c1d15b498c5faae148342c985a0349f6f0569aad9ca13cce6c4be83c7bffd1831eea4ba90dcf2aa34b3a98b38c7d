export type SealDataOptions = {
    password: string | {
        [id: string]: string;
    };
    ttl?: number | undefined;
};
export type UnsealedDataType = Record<string, unknown>;
/**
 * Interface encapsulating the sealData/unsealData methods for separate iron-session implementations.
 *
 * This allows for different implementations of the iron-session library to be used in
 * worker/edge vs. regular web environments, which is required because of the different crypto APIs available.
 * Once we drop support for Node 16 and upgrade to iron-session 8+, we can remove this abstraction as iron-session 8+
 * handles this on its own.
 */
export declare abstract class IronSessionProvider {
    abstract sealData(data: unknown, options: SealDataOptions): Promise<string>;
    abstract unsealData<T = UnsealedDataType>(seal: string, options: SealDataOptions): Promise<T>;
}
