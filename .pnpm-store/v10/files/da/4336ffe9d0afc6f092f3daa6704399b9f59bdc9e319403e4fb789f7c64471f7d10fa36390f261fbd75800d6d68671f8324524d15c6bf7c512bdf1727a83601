'use strict';

const path = require('node:path');
const ts = require('typescript');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const ts__default = /*#__PURE__*/_interopDefaultCompat(ts);

function getTSConfigFile(tsconfigPath) {
  try {
    const basePath = path.dirname(tsconfigPath);
    const configFile = ts__default.readConfigFile(tsconfigPath, ts__default.sys.readFile);
    return ts__default.parseJsonConfigFileContent(
      configFile.config,
      ts__default.sys,
      basePath,
      {},
      tsconfigPath
    );
  } catch (error) {
    return {};
  }
}

exports.getTSConfigFile = getTSConfigFile;
