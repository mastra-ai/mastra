import { ComponentDirectory, ComponentDefinitionPath } from "./directoryStructure.js";
import { Context } from "../../../../bundler/context.js";
import { AppDefinitionSpecWithoutImpls, ComponentDefinitionSpecWithoutImpls } from "../../config.js";
import { Bundle } from "../../../../bundler/index.js";
import { NodeDependency } from "../../deployApi/modules.js";
export declare function componentGraph(ctx: Context, absWorkingDir: string, rootComponentDirectory: ComponentDirectory, liveComponentSources: boolean, verbose?: boolean): Promise<{
    components: Map<string, ComponentDirectory>;
    dependencyGraph: [ComponentDirectory, ComponentDirectory][];
}>;
/**
 * Get dependencies of a ComponenDirectory as ComponentPaths.
 *
 * Component paths are paths relative to the root component.
 */
export declare function getDeps(rootComponent: ComponentDirectory, dependencyGraph: [ComponentDirectory, ComponentDirectory][], definitionPath: string): ComponentDefinitionPath[];
/** Bundle the component definitions listed. */
export declare function bundleDefinitions(ctx: Context, absWorkingDir: string, dependencyGraph: [ComponentDirectory, ComponentDirectory][], rootComponentDirectory: ComponentDirectory, componentDirectories: ComponentDirectory[], liveComponentSources: boolean, verbose?: boolean): Promise<{
    appDefinitionSpecWithoutImpls: AppDefinitionSpecWithoutImpls;
    componentDefinitionSpecsWithoutImpls: ComponentDefinitionSpecWithoutImpls[];
}>;
export declare function bundleImplementations(ctx: Context, rootComponentDirectory: ComponentDirectory, componentDirectories: ComponentDirectory[], nodeExternalPackages: string[], extraConditions: string[], verbose?: boolean): Promise<{
    appImplementation: {
        schema: Bundle | null;
        functions: Bundle[];
        externalNodeDependencies: NodeDependency[];
    };
    componentImplementations: {
        schema: Bundle | null;
        functions: Bundle[];
        definitionPath: ComponentDefinitionPath;
    }[];
}>;
//# sourceMappingURL=bundle.d.ts.map