"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptArgumentsPrefix = exports.functionArgumentsPrefix = exports.getTransformReply = exports.attachConfig = void 0;
/* FIXME: better error message / link */
function throwResp3SearchModuleUnstableError() {
    throw new Error('Some RESP3 results for Redis Query Engine responses may change. Refer to the readme for guidance');
}
function attachConfig({ BaseClass, commands, createCommand, createModuleCommand, createFunctionCommand, createScriptCommand, config }) {
    const RESP = config?.RESP ?? 2, Class = class extends BaseClass {
    };
    for (const [name, command] of Object.entries(commands)) {
        if (config?.RESP == 3 && command.unstableResp3 && !config.unstableResp3) {
            Class.prototype[name] = throwResp3SearchModuleUnstableError;
        }
        else {
            Class.prototype[name] = createCommand(command, RESP);
        }
    }
    if (config?.modules) {
        for (const [moduleName, module] of Object.entries(config.modules)) {
            const fns = Object.create(null);
            for (const [name, command] of Object.entries(module)) {
                if (config.RESP == 3 && command.unstableResp3 && !config.unstableResp3) {
                    fns[name] = throwResp3SearchModuleUnstableError;
                }
                else {
                    fns[name] = createModuleCommand(command, RESP);
                }
            }
            attachNamespace(Class.prototype, moduleName, fns);
        }
    }
    if (config?.functions) {
        for (const [library, commands] of Object.entries(config.functions)) {
            const fns = Object.create(null);
            for (const [name, command] of Object.entries(commands)) {
                fns[name] = createFunctionCommand(name, command, RESP);
            }
            attachNamespace(Class.prototype, library, fns);
        }
    }
    if (config?.scripts) {
        for (const [name, script] of Object.entries(config.scripts)) {
            Class.prototype[name] = createScriptCommand(script, RESP);
        }
    }
    return Class;
}
exports.attachConfig = attachConfig;
function attachNamespace(prototype, name, fns) {
    Object.defineProperty(prototype, name, {
        get() {
            const value = Object.create(fns);
            value._self = this;
            Object.defineProperty(this, name, { value });
            return value;
        }
    });
}
function getTransformReply(command, resp) {
    switch (typeof command.transformReply) {
        case 'function':
            return command.transformReply;
        case 'object':
            return command.transformReply[resp];
    }
}
exports.getTransformReply = getTransformReply;
function functionArgumentsPrefix(name, fn) {
    const prefix = [
        fn.IS_READ_ONLY ? 'FCALL_RO' : 'FCALL',
        name
    ];
    if (fn.NUMBER_OF_KEYS !== undefined) {
        prefix.push(fn.NUMBER_OF_KEYS.toString());
    }
    return prefix;
}
exports.functionArgumentsPrefix = functionArgumentsPrefix;
function scriptArgumentsPrefix(script) {
    const prefix = [
        script.IS_READ_ONLY ? 'EVALSHA_RO' : 'EVALSHA',
        script.SHA1
    ];
    if (script.NUMBER_OF_KEYS !== undefined) {
        prefix.push(script.NUMBER_OF_KEYS.toString());
    }
    return prefix;
}
exports.scriptArgumentsPrefix = scriptArgumentsPrefix;
//# sourceMappingURL=commander.js.map