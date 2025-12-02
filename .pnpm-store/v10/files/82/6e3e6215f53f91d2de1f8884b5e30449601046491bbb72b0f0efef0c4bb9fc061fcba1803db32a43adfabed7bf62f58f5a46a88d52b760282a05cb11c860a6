"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTestingLibraryModule = exports.isCustomTestingLibraryModule = exports.isOfficialTestingLibraryModule = void 0;
const _1 = require(".");
const isOfficialTestingLibraryModule = (importSourceName) => [..._1.OLD_LIBRARY_MODULES, ..._1.LIBRARY_MODULES, _1.USER_EVENT_MODULE].includes(importSourceName);
exports.isOfficialTestingLibraryModule = isOfficialTestingLibraryModule;
const isCustomTestingLibraryModule = (importSourceName, customModuleSetting) => typeof customModuleSetting === 'string' &&
    importSourceName.endsWith(customModuleSetting);
exports.isCustomTestingLibraryModule = isCustomTestingLibraryModule;
const isTestingLibraryModule = (importSourceName, customModuleSetting) => (0, exports.isOfficialTestingLibraryModule)(importSourceName) ||
    (0, exports.isCustomTestingLibraryModule)(importSourceName, customModuleSetting);
exports.isTestingLibraryModule = isTestingLibraryModule;
