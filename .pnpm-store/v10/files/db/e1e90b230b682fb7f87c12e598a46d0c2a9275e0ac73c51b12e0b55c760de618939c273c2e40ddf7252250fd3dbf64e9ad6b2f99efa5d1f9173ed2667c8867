import { MastraBase } from '../base.js';
export interface IBundler {
    loadEnvVars(): Promise<Map<string, string>>;
    getEnvFiles(): Promise<string[]>;
    getAllToolPaths(mastraDir: string, toolsPaths: (string | string[])[]): (string | string[])[];
    bundle(entryFile: string, outputDirectory: string, options: {
        toolsPaths: (string | string[])[];
        projectRoot: string;
    }): Promise<void>;
    prepare(outputDirectory: string): Promise<void>;
    writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
    lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
}
export declare abstract class MastraBundler extends MastraBase implements IBundler {
    constructor({ name, component }: {
        name: string;
        component?: 'BUNDLER' | 'DEPLOYER';
    });
    loadEnvVars(): Promise<Map<string, string>>;
    abstract getAllToolPaths(mastraDir: string, toolsPaths: (string | string[])[]): (string | string[])[];
    abstract prepare(outputDirectory: string): Promise<void>;
    abstract writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
    abstract getEnvFiles(): Promise<string[]>;
    abstract bundle(entryFile: string, outputDirectory: string, { toolsPaths, projectRoot }: {
        toolsPaths: (string | string[])[];
        projectRoot: string;
    }): Promise<void>;
    abstract lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map