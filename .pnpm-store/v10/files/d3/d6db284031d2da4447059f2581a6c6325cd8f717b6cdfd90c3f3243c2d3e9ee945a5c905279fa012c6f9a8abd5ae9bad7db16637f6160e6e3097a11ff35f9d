import { Options } from '../index';
export interface Platform {
    addToTrustStores(certificatePath: string, options?: Options): Promise<void>;
    removeFromTrustStores(certificatePath: string): void;
    addDomainToHostFileIfMissing(domain: string): Promise<void>;
    deleteProtectedFiles(filepath: string): void;
    readProtectedFile(filepath: string): Promise<string>;
    writeProtectedFile(filepath: string, contents: string): Promise<void>;
}
declare const _default: Platform;
export default _default;
