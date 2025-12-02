import './chunk-MXFP7CYD.mjs';
import { readFile } from 'node:fs/promises';
import { loadCsf, enrichCsf, formatCsf } from 'storybook/internal/csf-tools';

async function loader(content,map){let callback=this.async(),options=this.getOptions(),id=this.resourcePath,sourceCode=await readFile(id,"utf-8");try{let makeTitle=userTitle=>userTitle||"default",csf=loadCsf(content,{makeTitle}).parse(),csfSource=loadCsf(sourceCode,{makeTitle}).parse();enrichCsf(csf,csfSource,options);let formattedCsf=formatCsf(csf,{sourceMaps:!0,inputSourceMap:map,sourceFileName:id},content);if(typeof formattedCsf=="string")return callback(null,formattedCsf,map);callback(null,formattedCsf.code,formattedCsf.map);}catch(err){err.message?.startsWith("CSF:")||console.warn(err.message),callback(null,content,map);}}var webpack_loader_default=loader;

export { webpack_loader_default as default };
