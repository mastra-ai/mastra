import { Plugin } from 'vite';
import { ParserOptions } from 'react-docgen-typescript';
import { CompilerOptions } from 'typescript';

interface LoaderOptions {
    /**
     * Automatically set the component's display name. If you want to set display
     * names yourself or are using another plugin to do this, you should disable
     * this option.
     *
     * ```
     * class MyComponent extends React.Component {
     * ...
     * }
     *
     * MyComponent.displayName = "MyComponent";
     * ```
     *
     * @default true
     */
    setDisplayName?: boolean;
    /**
     * Specify the name of the property for docgen info prop type.
     *
     * @default "type"
     */
    typePropName?: string;
}
interface TypescriptOptions {
    /**
     * Specify the location of the tsconfig.json to use. Can not be used with
     * compilerOptions.
     **/
    tsconfigPath?: string;
    /** Specify TypeScript compiler options. Can not be used with tsconfigPath. */
    compilerOptions?: CompilerOptions;
}
type DocGenOptions = ParserOptions & {
    /** Glob patterns to ignore */
    exclude?: string[];
    /** Glob patterns to include. defaults to ts|tsx */
    include?: string[];
    /** experimental watch mode */
    EXPERIMENTAL_useWatchProgram?: boolean;
    /** experimental project service */
    EXPERIMENTAL_useProjectService?: boolean;
};
type Options = LoaderOptions & TypescriptOptions & DocGenOptions;

declare function reactDocgenTypescript(config?: Options): Plugin;

export { reactDocgenTypescript as default };
