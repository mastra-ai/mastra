"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const configs_1 = __importDefault(require("./configs"));
const rules_1 = __importDefault(require("./rules"));
const { name: packageName, version: packageVersion, } = require('../package.json');
const plugin = {
    meta: {
        name: packageName,
        version: packageVersion,
    },
    configs: {},
    rules: rules_1.default,
};
plugin.configs = {
    ...configs_1.default,
    ...Object.fromEntries(Object.entries(configs_1.default).map(([framework, config]) => [
        `flat/${framework}`,
        {
            plugins: { 'testing-library': plugin },
            rules: config.rules,
        },
    ])),
};
module.exports = plugin;
