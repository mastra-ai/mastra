import { Options } from '../index';


export interface Platform {
   addToTrustStores(certificatePath: string, options?: Options): Promise<void>;
   removeFromTrustStores(certificatePath: string): void;
   addDomainToHostFileIfMissing(domain: string): Promise<void>;
   deleteProtectedFiles(filepath: string): void;
   readProtectedFile(filepath: string): Promise<string>;
   writeProtectedFile(filepath: string, contents: string): Promise<void>;
}

const PlatformClass = require(`./${ process.platform }`).default;
export default new PlatformClass() as Platform;
