import { __require } from './chunk-MXFP7CYD.mjs';
import { createUnplugin } from 'unplugin';
import { readFile } from 'node:fs/promises';
import { loadCsf, enrichCsf, formatCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

var STORIES_REGEX=/(?<!node_modules.*)\.(story|stories)\.[tj]sx?$/;function rollupBasedPlugin(options){return {name:"plugin-csf",async transform(code,id){if(!STORIES_REGEX.test(id))return;let sourceCode=await readFile(id,"utf-8");try{let makeTitle=userTitle=>userTitle||"default",csf=loadCsf(code,{makeTitle}).parse(),csfSource=loadCsf(sourceCode,{makeTitle}).parse();enrichCsf(csf,csfSource,options);let inputSourceMap=this.getCombinedSourcemap();return formatCsf(csf,{sourceMaps:!0,inputSourceMap},code)}catch(err){return err.message?.startsWith("CSF:")||logger.warn(err.message),code}}}}var unplugin=createUnplugin(options=>({name:"unplugin-csf",rollup:{...rollupBasedPlugin(options)},vite:{enforce:"pre",...rollupBasedPlugin(options)},webpack(compiler){compiler.options.module.rules.unshift({test:STORIES_REGEX,enforce:"post",use:{options,loader:__require.resolve("@storybook/csf-plugin/dist/webpack-loader")}});},rspack(compiler){compiler.options.module.rules.unshift({test:STORIES_REGEX,enforce:"post",use:{options,loader:__require.resolve("@storybook/csf-plugin/dist/webpack-loader")}});}})),{esbuild}=unplugin,{webpack}=unplugin,{rollup}=unplugin,{vite}=unplugin;

export { esbuild, rollup, unplugin, vite, webpack };
