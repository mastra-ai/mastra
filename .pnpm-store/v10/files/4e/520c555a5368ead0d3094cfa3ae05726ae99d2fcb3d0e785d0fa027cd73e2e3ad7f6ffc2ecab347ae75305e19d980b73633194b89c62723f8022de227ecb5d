import { dirname } from 'node:path';
import ts from 'typescript';

function getTSConfigFile(tsconfigPath) {
  try {
    const basePath = dirname(tsconfigPath);
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    return ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      basePath,
      {},
      tsconfigPath
    );
  } catch (error) {
    return {};
  }
}

export { getTSConfigFile };
