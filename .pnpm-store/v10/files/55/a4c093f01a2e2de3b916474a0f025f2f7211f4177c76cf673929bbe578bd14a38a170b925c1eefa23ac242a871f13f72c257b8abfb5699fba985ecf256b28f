"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentialsPath = getCredentialsPath;
exports.readCredentialsFile = readCredentialsFile;
exports.validateCredentials = validateCredentials;
const conUtils_1 = require("./conUtils");
const errors_1 = require("./errors");
async function getCredentialsPath(instanceName, serverUtils) {
    return serverUtils.searchConfigDir("credentials", instanceName + ".json");
}
async function readCredentialsFile(file, serverUtils) {
    try {
        const data = await serverUtils.readFileUtf8(file);
        return validateCredentials(JSON.parse(data));
    }
    catch (e) {
        throw new errors_1.InterfaceError(`cannot read credentials file ${file}: ${e}`);
    }
}
function validateCredentials(data) {
    const port = data.port;
    if (port != null && (typeof port !== "number" || port < 1 || port > 65535)) {
        throw new errors_1.InterfaceError("invalid `port` value");
    }
    const user = data.user;
    if (user == null) {
        throw new errors_1.InterfaceError("`user` key is required");
    }
    if (typeof user !== "string") {
        throw new errors_1.InterfaceError("`user` must be string");
    }
    const result = { user, port };
    const host = data.host;
    if (host != null) {
        if (typeof host !== "string") {
            throw new errors_1.InterfaceError("`host` must be string");
        }
        result.host = host;
    }
    const database = data.database;
    if (database != null) {
        if (typeof database !== "string") {
            throw new errors_1.InterfaceError("`database` must be string");
        }
        result.database = database;
    }
    const branch = data.branch;
    if (branch != null) {
        if (typeof branch !== "string") {
            throw new errors_1.InterfaceError("`branch` must be string");
        }
        if (database != null && branch !== database) {
            throw new errors_1.InterfaceError("`database` and `branch` cannot both be set");
        }
        result.branch = branch;
    }
    const password = data.password;
    if (password != null) {
        if (typeof password !== "string") {
            throw new errors_1.InterfaceError("`password` must be string");
        }
        result.password = password;
    }
    const caData = data.tls_ca;
    if (caData != null) {
        if (typeof caData !== "string") {
            throw new errors_1.InterfaceError("`tls_ca` must be string");
        }
        result.tlsCAData = caData;
    }
    const certData = data.tls_cert_data;
    if (certData != null) {
        if (typeof certData !== "string") {
            throw new errors_1.InterfaceError("`tls_cert_data` must be string");
        }
        if (caData != null && certData !== caData) {
            throw new errors_1.InterfaceError(`both 'tls_ca' and 'tls_cert_data' are defined, ` +
                `and are not in agreement`);
        }
        result.tlsCAData = certData;
    }
    let verifyHostname = data.tls_verify_hostname;
    const tlsSecurity = data.tls_security;
    if (verifyHostname != null) {
        if (typeof verifyHostname === "boolean") {
            verifyHostname = verifyHostname ? "strict" : "no_host_verification";
        }
        else {
            throw new errors_1.InterfaceError("`tls_verify_hostname` must be boolean");
        }
    }
    if (tlsSecurity != null &&
        (typeof tlsSecurity !== "string" ||
            !conUtils_1.validTlsSecurityValues.includes(tlsSecurity))) {
        throw new errors_1.InterfaceError(`\`tls_security\` must be one of ${conUtils_1.validTlsSecurityValues
            .map((val) => `"${val}"`)
            .join(", ")}`);
    }
    if (verifyHostname &&
        tlsSecurity &&
        verifyHostname !== tlsSecurity &&
        !(verifyHostname === "no_host_verification" && tlsSecurity === "insecure")) {
        throw new errors_1.InterfaceError(`both 'tls_security' and 'tls_verify_hostname' are defined, ` +
            `and are not in agreement`);
    }
    if (tlsSecurity || verifyHostname) {
        result.tlsSecurity = tlsSecurity ?? verifyHostname;
    }
    return result;
}
