"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScriptCommand = exports.createModuleCommand = exports.createFunctionCommand = exports.createCommand = exports.clientSocketToNode = exports.createNodeList = exports.parseNode = void 0;
const parser_1 = require("../client/parser");
const commander_1 = require("../commander");
/* TODO: should use map interface, would need a transform reply probably? as resp2 is list form, which this depends on */
function parseNode(node) {
    if (node.flags.includes("s_down") || node.flags.includes("disconnected") || node.flags.includes("failover_in_progress")) {
        return undefined;
    }
    return { host: node.ip, port: Number(node.port) };
}
exports.parseNode = parseNode;
function createNodeList(nodes) {
    var nodeList = [];
    for (const nodeData of nodes) {
        const node = parseNode(nodeData);
        if (node === undefined) {
            continue;
        }
        nodeList.push(node);
    }
    return nodeList;
}
exports.createNodeList = createNodeList;
function clientSocketToNode(socket) {
    const s = socket;
    return {
        host: s.host,
        port: s.port
    };
}
exports.clientSocketToNode = clientSocketToNode;
function createCommand(command, resp) {
    const transformReply = (0, commander_1.getTransformReply)(command, resp);
    return async function (...args) {
        const parser = new parser_1.BasicCommandParser();
        command.parseCommand(parser, ...args);
        return this._self._execute(command.IS_READ_ONLY, client => client._executeCommand(command, parser, this.commandOptions, transformReply));
    };
}
exports.createCommand = createCommand;
function createFunctionCommand(name, fn, resp) {
    const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
    const transformReply = (0, commander_1.getTransformReply)(fn, resp);
    return async function (...args) {
        const parser = new parser_1.BasicCommandParser();
        parser.push(...prefix);
        fn.parseCommand(parser, ...args);
        return this._self._execute(fn.IS_READ_ONLY, client => client._executeCommand(fn, parser, this._self.commandOptions, transformReply));
    };
}
exports.createFunctionCommand = createFunctionCommand;
;
function createModuleCommand(command, resp) {
    const transformReply = (0, commander_1.getTransformReply)(command, resp);
    return async function (...args) {
        const parser = new parser_1.BasicCommandParser();
        command.parseCommand(parser, ...args);
        return this._self._execute(command.IS_READ_ONLY, client => client._executeCommand(command, parser, this._self.commandOptions, transformReply));
    };
}
exports.createModuleCommand = createModuleCommand;
;
function createScriptCommand(script, resp) {
    const prefix = (0, commander_1.scriptArgumentsPrefix)(script);
    const transformReply = (0, commander_1.getTransformReply)(script, resp);
    return async function (...args) {
        const parser = new parser_1.BasicCommandParser();
        parser.push(...prefix);
        script.parseCommand(parser, ...args);
        return this._self._execute(script.IS_READ_ONLY, client => client._executeScript(script, parser, this.commandOptions, transformReply));
    };
}
exports.createScriptCommand = createScriptCommand;
//# sourceMappingURL=utils.js.map