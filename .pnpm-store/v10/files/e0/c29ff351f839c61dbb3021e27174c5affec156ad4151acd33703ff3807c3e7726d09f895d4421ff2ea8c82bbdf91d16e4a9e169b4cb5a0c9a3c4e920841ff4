import { MastraBundler } from '../bundler/index.js';
import type { IBundler } from '../bundler/index.js';
export interface IDeployer extends IBundler {
    deploy(outputDirectory: string): Promise<void>;
}
export declare abstract class MastraDeployer extends MastraBundler implements IDeployer {
    constructor({ name }: {
        name: string;
    });
    abstract deploy(outputDirectory: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map