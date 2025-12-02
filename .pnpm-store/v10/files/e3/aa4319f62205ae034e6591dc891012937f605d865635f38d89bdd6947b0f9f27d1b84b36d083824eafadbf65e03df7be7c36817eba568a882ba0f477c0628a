import { RenderedChunk, Plugin } from 'rollup';

interface PluginOptions {
    warn?: (message: string) => void;
    matcher?: (info: RenderedChunk) => boolean;
}
declare function cjsExportsDtsMatcher(info: RenderedChunk): boolean;
declare function defaultCjsExportsDtsMatcher(info: RenderedChunk): boolean;
declare function FixDtsDefaultCjsExportsPlugin(options?: PluginOptions): Plugin;

export { FixDtsDefaultCjsExportsPlugin, type PluginOptions, cjsExportsDtsMatcher, defaultCjsExportsDtsMatcher };
