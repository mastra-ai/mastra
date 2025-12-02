"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolvedConnectConfig = exports.validTlsSecurityValues = void 0;
exports.isValidTlsSecurityValue = isValidTlsSecurityValue;
exports.getConnectArgumentsParser = getConnectArgumentsParser;
exports.parseDuration = parseDuration;
const errors = __importStar(require("./errors"));
const credentials_1 = require("./credentials");
const datetime_1 = require("./datatypes/datetime");
const datetime_2 = require("./codecs/datetime");
const errors_1 = require("./errors");
const buffer_1 = require("./primitives/buffer");
const crcHqx_1 = require("./primitives/crcHqx");
const DOMAIN_NAME_MAX_LEN = 63;
exports.validTlsSecurityValues = [
    "insecure",
    "no_host_verification",
    "strict",
    "default",
];
function isValidTlsSecurityValue(candidate) {
    return (typeof candidate === "string" &&
        exports.validTlsSecurityValues.includes(candidate));
}
function getConnectArgumentsParser(utils) {
    return async (opts) => {
        return {
            ...(await parseConnectDsnAndArgs(opts, utils)),
            connectTimeout: opts.timeout,
            logging: opts.logging ?? true,
        };
    };
}
function getEnv(envName, _required = false) {
    const gelEnv = envName;
    const edgedbEnv = envName.replace(/^GEL_/, "EDGEDB_");
    const gelValue = process.env[gelEnv];
    const edgedbValue = process.env[edgedbEnv];
    if (gelValue !== undefined && edgedbValue !== undefined) {
        console.warn(`Both GEL_w+ and EDGEDB_w+ are set; EDGEDB_w+ will be ignored`);
    }
    return gelValue ?? edgedbValue;
}
class ResolvedConnectConfig {
    _host = null;
    _hostSource = null;
    _port = null;
    _portSource = null;
    _database = null;
    _databaseSource = null;
    _branch = null;
    _branchSource = null;
    _user = null;
    _userSource = null;
    _password = null;
    _passwordSource = null;
    _secretKey = null;
    _secretKeySource = null;
    _cloudProfile = null;
    _cloudProfileSource = null;
    _tlsCAData = null;
    _tlsCADataSource = null;
    _tlsSecurity = null;
    _tlsSecuritySource = null;
    _tlsServerName = null;
    _tlsServerNameSource = null;
    _waitUntilAvailable = null;
    _waitUntilAvailableSource = null;
    serverSettings = {};
    constructor() {
        this.setHost = this.setHost.bind(this);
        this.setPort = this.setPort.bind(this);
        this.setDatabase = this.setDatabase.bind(this);
        this.setBranch = this.setBranch.bind(this);
        this.setUser = this.setUser.bind(this);
        this.setPassword = this.setPassword.bind(this);
        this.setSecretKey = this.setSecretKey.bind(this);
        this.setTlsCAData = this.setTlsCAData.bind(this);
        this.setTlsCAFile = this.setTlsCAFile.bind(this);
        this.setTlsServerName = this.setTlsServerName.bind(this);
        this.setTlsSecurity = this.setTlsSecurity.bind(this);
        this.setWaitUntilAvailable = this.setWaitUntilAvailable.bind(this);
    }
    _setParam(param, value, source, validator) {
        if (this[`_${param}`] === null) {
            this[`_${param}Source`] = source;
            if (value !== null) {
                this[`_${param}`] = validator
                    ? validator(value)
                    : value;
                return true;
            }
        }
        return false;
    }
    async _setParamAsync(param, value, source, validator) {
        if (this[`_${param}`] === null) {
            this[`_${param}Source`] = source;
            if (value !== null) {
                this[`_${param}`] = validator
                    ? await validator(value)
                    : value;
                return true;
            }
        }
        return false;
    }
    setHost(host, source) {
        return this._setParam("host", host, source, validateHost);
    }
    setPort(port, source) {
        return this._setParam("port", port, source, parseValidatePort);
    }
    setDatabase(database, source) {
        return this._setParam("database", database, source, (db) => {
            if (db === "") {
                throw new errors_1.InterfaceError(`invalid database name: '${db}'`);
            }
            return db;
        });
    }
    setBranch(branch, source) {
        return this._setParam("branch", branch, source, (branchName) => {
            if (branchName === "") {
                throw new errors_1.InterfaceError(`invalid branch name: '${branchName}'`);
            }
            return branchName;
        });
    }
    setUser(user, source) {
        return this._setParam("user", user, source, (_user) => {
            if (_user === "") {
                throw new errors_1.InterfaceError(`invalid user name: '${_user}'`);
            }
            return _user;
        });
    }
    setPassword(password, source) {
        return this._setParam("password", password, source);
    }
    setSecretKey(secretKey, source) {
        return this._setParam("secretKey", secretKey, source);
    }
    setCloudProfile(cloudProfile, source) {
        return this._setParam("cloudProfile", cloudProfile, source);
    }
    setTlsCAData(caData, source) {
        return this._setParam("tlsCAData", caData, source);
    }
    setTlsCAFile(caFile, source, readFile) {
        return this._setParamAsync("tlsCAData", caFile, source, (caFilePath) => readFile(caFilePath));
    }
    setTlsServerName(serverName, source) {
        return this._setParam("tlsServerName", serverName, source, validateHost);
    }
    setTlsSecurity(tlsSecurity, source) {
        return this._setParam("tlsSecurity", tlsSecurity, source, (_tlsSecurity) => {
            if (!exports.validTlsSecurityValues.includes(_tlsSecurity)) {
                throw new errors_1.InterfaceError(`invalid 'tlsSecurity' value: '${_tlsSecurity}', ` +
                    `must be one of ${exports.validTlsSecurityValues
                        .map((val) => `'${val}'`)
                        .join(", ")}`);
            }
            const clientSecurity = getEnv("GEL_CLIENT_SECURITY");
            if (clientSecurity !== undefined) {
                if (!["default", "insecure_dev_mode", "strict"].includes(clientSecurity)) {
                    throw new errors_1.InterfaceError(`invalid GEL_CLIENT_SECURITY value: '${clientSecurity}', ` +
                        `must be one of 'default', 'insecure_dev_mode' or 'strict'`);
                }
                if (clientSecurity === "insecure_dev_mode") {
                    if (_tlsSecurity === "default") {
                        _tlsSecurity = "insecure";
                    }
                }
                else if (clientSecurity === "strict") {
                    if (_tlsSecurity === "insecure" ||
                        _tlsSecurity === "no_host_verification") {
                        throw new errors_1.InterfaceError(`'tlsSecurity' value (${_tlsSecurity}) conflicts with ` +
                            `GEL_CLIENT_SECURITY value (${clientSecurity}), ` +
                            `'tlsSecurity' value cannot be lower than security level ` +
                            `set by GEL_CLIENT_SECURITY`);
                    }
                    _tlsSecurity = "strict";
                }
            }
            return _tlsSecurity;
        });
    }
    setWaitUntilAvailable(duration, source) {
        return this._setParam("waitUntilAvailable", duration, source, parseDuration);
    }
    addServerSettings(settings) {
        this.serverSettings = {
            ...settings,
            ...this.serverSettings,
        };
    }
    get address() {
        return [this._host ?? "localhost", this._port ?? 5656];
    }
    get database() {
        return this._database ?? this._branch ?? "edgedb";
    }
    get branch() {
        return this._branch ?? this._database ?? "__default__";
    }
    get user() {
        return this._user ?? "edgedb";
    }
    get password() {
        return this._password ?? undefined;
    }
    get secretKey() {
        return this._secretKey ?? undefined;
    }
    get cloudProfile() {
        return this._cloudProfile ?? "default";
    }
    get tlsServerName() {
        return this._tlsServerName ?? undefined;
    }
    get tlsSecurity() {
        return this._tlsSecurity && this._tlsSecurity !== "default"
            ? this._tlsSecurity
            : this._tlsCAData !== null
                ? "no_host_verification"
                : "strict";
    }
    get waitUntilAvailable() {
        return this._waitUntilAvailable ?? 30_000;
    }
    explainConfig() {
        const output = [
            `Parameter          Value                                    Source`,
            `---------          -----                                    ------`,
        ];
        const outputLine = (param, val, rawVal, source) => {
            const isDefault = rawVal === null;
            const maxValLength = 40 - (isDefault ? 10 : 0);
            let value = String(val);
            if (value.length > maxValLength) {
                value = value.slice(0, maxValLength - 3) + "...";
            }
            output.push(param.padEnd(19, " ") +
                (value + (isDefault ? " (default)" : "")).padEnd(42, " ") +
                (source ?? "default"));
        };
        outputLine("host", this.address[0], this._host, this._hostSource);
        outputLine("port", this.address[1], this._port, this._portSource);
        outputLine("database", this.database, this._database, this._databaseSource);
        outputLine("branch", this.branch, this._branch, this._branchSource);
        outputLine("user", this.user, this._user, this._userSource);
        outputLine("password", this.password &&
            this.password.slice(0, 3).padEnd(this.password.length, "*"), this._password, this._passwordSource);
        outputLine("tlsCAData", this._tlsCAData && this._tlsCAData.replace(/\r\n?|\n/, ""), this._tlsCAData, this._tlsCADataSource);
        outputLine("tlsSecurity", this.tlsSecurity, this._tlsSecurity, this._tlsSecuritySource);
        outputLine("tlsServerName", this.tlsServerName, this._tlsServerName, this._tlsServerNameSource);
        outputLine("waitUntilAvailable", this.waitUntilAvailable, this._waitUntilAvailable, this._waitUntilAvailableSource);
        return output.join("\n");
    }
}
exports.ResolvedConnectConfig = ResolvedConnectConfig;
function parseValidatePort(port) {
    let parsedPort;
    if (typeof port === "string") {
        if (!/^\d*$/.test(port)) {
            throw new errors_1.InterfaceError(`invalid port: ${port}`);
        }
        parsedPort = parseInt(port, 10);
        if (Number.isNaN(parsedPort)) {
            throw new errors_1.InterfaceError(`invalid port: ${port}`);
        }
    }
    else {
        parsedPort = port;
    }
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        throw new errors_1.InterfaceError(`invalid port: ${port}`);
    }
    return parsedPort;
}
function validateHost(host) {
    if (host.includes("/")) {
        throw new errors_1.InterfaceError(`unix socket paths not supported`);
    }
    if (!host.length || host.includes(",")) {
        throw new errors_1.InterfaceError(`invalid host: '${host}'`);
    }
    return host;
}
function parseDuration(duration) {
    if (typeof duration === "number") {
        if (duration < 0) {
            throw new errors_1.InterfaceError("invalid waitUntilAvailable duration, must be >= 0");
        }
        return duration;
    }
    if (typeof duration === "string") {
        if (duration.startsWith("P")) {
            duration = datetime_1.Duration.from(duration);
        }
        else {
            return (0, datetime_1.parseHumanDurationString)(duration);
        }
    }
    if (duration instanceof datetime_1.Duration) {
        const invalidField = (0, datetime_2.checkValidGelDuration)(duration);
        if (invalidField) {
            throw new errors_1.InterfaceError(`invalid waitUntilAvailable duration, cannot have a '${invalidField}' value`);
        }
        if (duration.sign < 0) {
            throw new errors_1.InterfaceError("invalid waitUntilAvailable duration, must be >= 0");
        }
        return (duration.milliseconds +
            duration.seconds * 1000 +
            duration.minutes * 60_000 +
            duration.hours * 3_600_000);
    }
    throw new errors_1.InterfaceError(`invalid duration`);
}
async function parseConnectDsnAndArgs(config, serverUtils) {
    const resolvedConfig = new ResolvedConnectConfig();
    let fromEnv = false;
    let fromProject = false;
    const [dsn, instanceName] = config.instanceName == null &&
        config.dsn != null &&
        !/^[a-z]+:\/\//i.test(config.dsn)
        ? [undefined, config.dsn]
        : [config.dsn, config.instanceName];
    let { hasCompoundOptions } = await resolveConfigOptions(resolvedConfig, {
        dsn,
        instanceName,
        credentials: config.credentials,
        credentialsFile: config.credentialsFile,
        host: config.host,
        port: config.port,
        database: config.database,
        branch: config.branch,
        user: config.user,
        password: config.password,
        secretKey: config.secretKey,
        cloudProfile: getEnv("GEL_CLOUD_PROFILE"),
        tlsCA: config.tlsCA,
        tlsCAFile: config.tlsCAFile,
        tlsServerName: config.tlsServerName,
        tlsSecurity: config.tlsSecurity,
        serverSettings: config.serverSettings,
        waitUntilAvailable: config.waitUntilAvailable,
    }, {
        dsn: `'dsnOrInstanceName' option (parsed as dsn)`,
        instanceName: config.instanceName != null
            ? `'instanceName' option`
            : `'dsnOrInstanceName' option (parsed as instance name)`,
        credentials: `'credentials' option`,
        credentialsFile: `'credentialsFile' option`,
        host: `'host' option`,
        port: `'port' option`,
        database: `'database' option`,
        branch: `'branch' option`,
        user: `'user' option`,
        password: `'password' option`,
        secretKey: `'secretKey' option`,
        cloudProfile: `'GEL_CLOUD_PROFILE' environment variable`,
        tlsCA: `'tlsCA' option`,
        tlsCAFile: `'tlsCAFile' option`,
        tlsSecurity: `'tlsSecurity' option`,
        tlsServerName: `'tlsServerName' option`,
        serverSettings: `'serverSettings' option`,
        waitUntilAvailable: `'waitUntilAvailable' option`,
    }, `Cannot have more than one of the following connection options: ` +
        `'dsn', 'instanceName', 'credentials', 'credentialsFile' or 'host'/'port'`, serverUtils);
    if (!hasCompoundOptions) {
        let port = getEnv("GEL_PORT");
        if (resolvedConfig._port === null && port?.startsWith("tcp://")) {
            console.warn(`GEL_PORT in 'tcp://host:port' format, so will be ignored`);
            port = undefined;
        }
        ({ hasCompoundOptions, anyOptionsUsed: fromEnv } =
            await resolveConfigOptions(resolvedConfig, {
                dsn: getEnv("GEL_DSN"),
                instanceName: getEnv("GEL_INSTANCE"),
                credentials: getEnv("GEL_CREDENTIALS"),
                credentialsFile: getEnv("GEL_CREDENTIALS_FILE"),
                host: getEnv("GEL_HOST"),
                port,
                database: getEnv("GEL_DATABASE"),
                branch: getEnv("GEL_BRANCH"),
                user: getEnv("GEL_USER"),
                password: getEnv("GEL_PASSWORD"),
                secretKey: getEnv("GEL_SECRET_KEY"),
                tlsCA: getEnv("GEL_TLS_CA"),
                tlsCAFile: getEnv("GEL_TLS_CA_FILE"),
                tlsServerName: getEnv("GEL_TLS_SERVER_NAME"),
                tlsSecurity: getEnv("GEL_CLIENT_TLS_SECURITY"),
                waitUntilAvailable: getEnv("GEL_WAIT_UNTIL_AVAILABLE"),
            }, {
                dsn: `'GEL_DSN' environment variable`,
                instanceName: `'GEL_INSTANCE' environment variable`,
                credentials: `'GEL_CREDENTIALS' environment variable`,
                credentialsFile: `'GEL_CREDENTIALS_FILE' environment variable`,
                host: `'GEL_HOST' environment variable`,
                port: `'GEL_PORT' environment variable`,
                database: `'GEL_DATABASE' environment variable`,
                branch: `'GEL_BRANCH' environment variable`,
                user: `'GEL_USER' environment variable`,
                password: `'GEL_PASSWORD' environment variable`,
                secretKey: `'GEL_SECRET_KEY' environment variable`,
                tlsCA: `'GEL_TLS_CA' environment variable`,
                tlsCAFile: `'GEL_TLS_CA_FILE' environment variable`,
                tlsServerName: `'GEL_TLS_SERVER_NAME' environment variable`,
                tlsSecurity: `'GEL_CLIENT_TLS_SECURITY' environment variable`,
                waitUntilAvailable: `'GEL_WAIT_UNTIL_AVAILABLE' environment variable`,
            }, `Cannot have more than one of the following connection environment variables: ` +
                `'GEL_DSN', 'GEL_INSTANCE', 'GEL_CREDENTIALS', ` +
                `'GEL_CREDENTIALS_FILE' or 'GEL_HOST'`, serverUtils));
    }
    if (!hasCompoundOptions) {
        if (!serverUtils) {
            throw new errors.ClientConnectionError("no connection options specified either by arguments to `createClient` " +
                "API or environment variables; also cannot resolve from project config " +
                "file in browser (or edge runtime) environment");
        }
        const projectDir = await serverUtils?.findProjectDir();
        if (!projectDir) {
            throw new errors.ClientConnectionError("no project config file found and no connection options " +
                "specified either via arguments to `createClient()` API or via " +
                "environment variables GEL_HOST, GEL_INSTANCE, GEL_DSN, " +
                "GEL_CREDENTIALS or GEL_CREDENTIALS_FILE");
        }
        const stashDir = await serverUtils.findStashPath(projectDir);
        const instName = await serverUtils
            .readFileUtf8(stashDir, "instance-name")
            .then((name) => name.trim())
            .catch(() => null);
        if (instName !== null) {
            const [cloudProfile, _database, branch] = await Promise.all([
                serverUtils
                    .readFileUtf8(stashDir, "cloud-profile")
                    .then((name) => name.trim())
                    .catch(() => undefined),
                serverUtils
                    .readFileUtf8(stashDir, "database")
                    .then((name) => name.trim())
                    .catch(() => undefined),
                serverUtils
                    .readFileUtf8(stashDir, "branch")
                    .then((name) => name.trim())
                    .catch(() => undefined),
            ]);
            let database = _database;
            if (database !== undefined && branch !== undefined) {
                if (database !== branch) {
                    throw new errors_1.InterfaceError("Both database and branch exist in the config dir and don't match.");
                }
                else {
                    database = undefined;
                }
            }
            await resolveConfigOptions(resolvedConfig, { instanceName: instName, cloudProfile, database, branch }, {
                instanceName: `project linked instance ('${instName}')`,
                cloudProfile: `project defined cloud instance ('${cloudProfile}')`,
                database: `project default database`,
                branch: `project default branch`,
            }, "", serverUtils);
            fromProject = true;
        }
        else {
            throw new errors.ClientConnectionError("Found project config file but the project is not initialized. " +
                "Run 'gel project init'.");
        }
    }
    resolvedConfig.setTlsSecurity("default", "default");
    return {
        connectionParams: resolvedConfig,
        inProject: async () => (await serverUtils?.findProjectDir(false)) != null,
        fromEnv,
        fromProject,
    };
}
async function resolveConfigOptions(resolvedConfig, config, sources, compoundParamsError, serverUtils) {
    let anyOptionsUsed = false;
    const readFile = serverUtils?.readFileUtf8 ??
        ((fn) => {
            throw new errors_1.InterfaceError(`cannot read file "${fn}" in browser (or edge runtime) environment`);
        });
    if (config.tlsCA != null && config.tlsCAFile != null) {
        throw new errors_1.InterfaceError(`Cannot specify both ${sources.tlsCA} and ${sources.tlsCAFile}`);
    }
    if (config.database != null) {
        if (config.branch != null) {
            throw new errors_1.InterfaceError(`${sources.database} and ${sources.branch} are mutually exclusive`);
        }
        if (resolvedConfig._branch == null) {
            anyOptionsUsed =
                resolvedConfig.setDatabase(config.database ?? null, sources.database) || anyOptionsUsed;
        }
    }
    if (config.branch != null) {
        if (resolvedConfig._database == null) {
            anyOptionsUsed =
                resolvedConfig.setBranch(config.branch ?? null, sources.branch) ||
                    anyOptionsUsed;
        }
    }
    anyOptionsUsed =
        resolvedConfig.setUser(config.user ?? null, sources.user) ||
            anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setPassword(config.password ?? null, sources.password) ||
            anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setSecretKey(config.secretKey ?? null, sources.secretKey) ||
            anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setCloudProfile(config.cloudProfile ?? null, sources.cloudProfile) || anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setTlsCAData(config.tlsCA ?? null, sources.tlsCA) ||
            anyOptionsUsed;
    anyOptionsUsed =
        (await resolvedConfig.setTlsCAFile(config.tlsCAFile ?? null, sources.tlsCAFile, readFile)) || anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setTlsServerName(config.tlsServerName ?? null, sources.tlsServerName) || anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setTlsSecurity(config.tlsSecurity ?? null, sources.tlsSecurity) || anyOptionsUsed;
    anyOptionsUsed =
        resolvedConfig.setWaitUntilAvailable(config.waitUntilAvailable ?? null, sources.waitUntilAvailable) || anyOptionsUsed;
    resolvedConfig.addServerSettings(config.serverSettings ?? {});
    const compoundParamsCount = [
        config.dsn,
        config.instanceName,
        config.credentials,
        config.credentialsFile,
        config.host ?? config.port,
    ].filter((param) => param !== undefined).length;
    if (compoundParamsCount > 1) {
        throw new errors_1.InterfaceError(compoundParamsError);
    }
    if (compoundParamsCount === 1) {
        if (config.dsn !== undefined ||
            config.host !== undefined ||
            config.port !== undefined) {
            let dsn = config.dsn;
            if (dsn === undefined) {
                if (config.port !== undefined) {
                    resolvedConfig.setPort(config.port, sources.port);
                }
                const host = config.host != null ? validateHost(config.host) : "";
                dsn = `edgedb://${host.includes(":") ? `[${encodeURI(host)}]` : host}`;
            }
            await parseDSNIntoConfig(dsn, resolvedConfig, config.dsn
                ? sources.dsn
                : config.host !== undefined
                    ? sources.host
                    : sources.port, readFile);
        }
        else {
            let creds;
            let source;
            if (config.credentials != null) {
                creds = (0, credentials_1.validateCredentials)(JSON.parse(config.credentials));
                source = sources.credentials;
            }
            else {
                if (!serverUtils && !config.instanceName?.includes("/")) {
                    throw new errors_1.InterfaceError(`cannot ${config.credentialsFile
                        ? `read credentials file "${config.credentialsFile}"`
                        : `resolve instance name "${config.instanceName}"`} in browser (or edge runtime) environment`);
                }
                let credentialsFile = config.credentialsFile;
                if (credentialsFile === undefined) {
                    if (/^\w(-?\w)*$/.test(config.instanceName)) {
                        credentialsFile = await (0, credentials_1.getCredentialsPath)(config.instanceName, serverUtils);
                        source = sources.instanceName;
                    }
                    else {
                        if (!/^([A-Za-z0-9_-](-?[A-Za-z0-9_])*)\/([A-Za-z0-9](-?[A-Za-z0-9])*)$/.test(config.instanceName)) {
                            throw new errors_1.InterfaceError(`invalid DSN or instance name: '${config.instanceName}'`);
                        }
                        await parseCloudInstanceNameIntoConfig(resolvedConfig, config.instanceName, sources.instanceName, serverUtils);
                        return { hasCompoundOptions: true, anyOptionsUsed: true };
                    }
                }
                else {
                    source = sources.credentialsFile;
                }
                creds = await (0, credentials_1.readCredentialsFile)(credentialsFile, serverUtils);
            }
            resolvedConfig.setHost(creds.host ?? null, source);
            resolvedConfig.setPort(creds.port ?? null, source);
            if (creds.database != null) {
                if (resolvedConfig._branch == null) {
                    resolvedConfig.setDatabase(creds.database ?? null, source);
                }
            }
            else if (creds.branch != null) {
                if (resolvedConfig._database == null) {
                    resolvedConfig.setBranch(creds.branch ?? null, source);
                }
            }
            resolvedConfig.setUser(creds.user ?? null, source);
            resolvedConfig.setPassword(creds.password ?? null, source);
            resolvedConfig.setTlsCAData(creds.tlsCAData ?? null, source);
            resolvedConfig.setTlsSecurity(creds.tlsSecurity ?? null, source);
        }
        return { hasCompoundOptions: true, anyOptionsUsed: true };
    }
    return { hasCompoundOptions: false, anyOptionsUsed };
}
async function parseDSNIntoConfig(_dsnString, config, source, readFile) {
    let dsnString = _dsnString;
    let regexHostname = null;
    let zoneId = "";
    const regexResult = /\[(.*?)(%25.+?)\]/.exec(_dsnString);
    if (regexResult) {
        regexHostname = regexResult[1];
        zoneId = decodeURI(regexResult[2]);
        dsnString =
            dsnString.slice(0, regexResult.index + regexHostname.length + 1) +
                dsnString.slice(regexResult.index + regexHostname.length + regexResult[2].length + 1);
    }
    let parsed;
    try {
        parsed = new URL(dsnString);
        if (regexHostname !== null && parsed.hostname !== `[${regexHostname}]`) {
            throw new Error();
        }
    }
    catch (_) {
        throw new errors_1.InterfaceError(`invalid DSN or instance name: '${_dsnString}'`);
    }
    if (parsed.protocol !== "edgedb:" && parsed.protocol !== "gel:") {
        throw new errors_1.InterfaceError(`invalid DSN: scheme is expected to be ` +
            `'gel', got '${parsed.protocol.slice(0, -1)}'`);
    }
    const searchParams = new Map();
    for (const [key, value] of parsed.searchParams) {
        if (searchParams.has(key)) {
            throw new errors_1.InterfaceError(`invalid DSN: duplicate query parameter '${key}'`);
        }
        searchParams.set(key, value);
    }
    async function handleDSNPart(paramName, value, currentValue, setter, formatter = (val) => val) {
        if ([
            value || null,
            searchParams.get(paramName),
            searchParams.get(`${paramName}_env`),
            searchParams.get(`${paramName}_file`),
        ].filter((param) => param != null).length > 1) {
            throw new errors_1.InterfaceError(`invalid DSN: more than one of ${value !== null ? `'${paramName}', ` : ""}'?${paramName}=', ` +
                `'?${paramName}_env=' or '?${paramName}_file=' was specified ${dsnString}`);
        }
        if (currentValue === null) {
            let param = value || (searchParams.get(paramName) ?? null);
            let paramSource = source;
            if (param === null) {
                const env = searchParams.get(`${paramName}_env`);
                if (env != null) {
                    param = getEnv(env, true) ?? null;
                    if (param === null) {
                        throw new errors_1.InterfaceError(`'${paramName}_env' environment variable '${env}' doesn't exist`);
                    }
                    paramSource += ` (${paramName}_env: ${env})`;
                }
            }
            if (param === null) {
                const file = searchParams.get(`${paramName}_file`);
                if (file != null) {
                    param = await readFile(file);
                    paramSource += ` (${paramName}_file: ${file})`;
                }
            }
            param = param !== null ? formatter(param) : null;
            await setter(param, paramSource);
        }
        searchParams.delete(paramName);
        searchParams.delete(`${paramName}_env`);
        searchParams.delete(`${paramName}_file`);
    }
    const hostname = /^\[.*\]$/.test(parsed.hostname)
        ? parsed.hostname.slice(1, -1) + zoneId
        : parsed.hostname;
    await handleDSNPart("host", hostname, config._host, config.setHost);
    await handleDSNPart("port", parsed.port, config._port, config.setPort);
    const stripLeadingSlash = (str) => str.replace(/^\//, "");
    const searchParamsContainsDatabase = searchParams.has("database") ||
        searchParams.has("database_env") ||
        searchParams.has("database_file");
    const searchParamsContainsBranch = searchParams.has("branch") ||
        searchParams.has("branch_env") ||
        searchParams.has("branch_file");
    if (searchParamsContainsBranch) {
        if (searchParamsContainsDatabase) {
            throw new errors_1.InterfaceError(`invalid DSN: cannot specify both 'database' and 'branch'`);
        }
        if (config._database === null) {
            await handleDSNPart("branch", stripLeadingSlash(parsed.pathname), config._branch, config.setBranch, stripLeadingSlash);
        }
        else {
            searchParams.delete("branch");
            searchParams.delete("branch_env");
            searchParams.delete("branch_file");
        }
    }
    else {
        if (config._branch === null) {
            await handleDSNPart("database", stripLeadingSlash(parsed.pathname), config._database, config.setDatabase, stripLeadingSlash);
        }
        else {
            searchParams.delete("database");
            searchParams.delete("database_env");
            searchParams.delete("database_file");
        }
    }
    await handleDSNPart("user", parsed.username, config._user, config.setUser);
    await handleDSNPart("password", parsed.password, config._password, config.setPassword);
    await handleDSNPart("secret_key", null, config._secretKey, config.setSecretKey);
    await handleDSNPart("tls_ca", null, config._tlsCAData, config.setTlsCAData);
    await handleDSNPart("tls_ca_file", null, config._tlsCAData, (val, _source) => config.setTlsCAFile(val, _source, readFile));
    await handleDSNPart("tls_server_name", null, config._tlsServerName, config.setTlsServerName);
    await handleDSNPart("tls_security", null, config._tlsSecurity, config.setTlsSecurity);
    await handleDSNPart("wait_until_available", null, config._waitUntilAvailable, config.setWaitUntilAvailable);
    const serverSettings = {};
    for (const [key, value] of searchParams) {
        serverSettings[key] = value;
    }
    config.addServerSettings(serverSettings);
}
async function parseCloudInstanceNameIntoConfig(config, cloudInstanceName, source, serverUtils) {
    const normInstanceName = cloudInstanceName.toLowerCase();
    const [org, instanceName] = normInstanceName.split("/");
    const domainName = `${instanceName}--${org}`;
    if (domainName.length > DOMAIN_NAME_MAX_LEN) {
        throw new errors_1.InterfaceError(`invalid instance name: cloud instance name length cannot exceed ${DOMAIN_NAME_MAX_LEN - 1} characters: ${cloudInstanceName}`);
    }
    let secretKey = config.secretKey;
    if (secretKey == null) {
        try {
            if (!serverUtils) {
                throw new errors_1.InterfaceError(`Cannot get secret key from cloud profile in browser (or edge runtime) environment`);
            }
            const profile = config.cloudProfile;
            const profilePath = await serverUtils.searchConfigDir("cloud-credentials", `${profile}.json`);
            const fileData = await serverUtils.readFileUtf8(profilePath);
            secretKey = JSON.parse(fileData)["secret_key"];
            if (!secretKey) {
                throw new errors_1.InterfaceError(`Cloud profile '${profile}' doesn't contain a secret key`);
            }
            config.setSecretKey(secretKey, `cloud-credentials/${profile}.json`);
        }
        catch (e) {
            throw new errors_1.InterfaceError(`Cannot connect to cloud instances without a secret key: ${e}`);
        }
    }
    try {
        const keyParts = secretKey.split(".");
        if (keyParts.length < 2) {
            throw new errors_1.InterfaceError("Invalid secret key: does not contain payload");
        }
        const dnsZone = _jwtBase64Decode(keyParts[1])["iss"];
        if (!dnsZone) {
            throw new errors_1.InterfaceError("Invalid secret key: payload does not contain 'iss' value");
        }
        const dnsBucket = ((0, crcHqx_1.crcHqx)(buffer_1.utf8Encoder.encode(normInstanceName), 0) % 100)
            .toString(10)
            .padStart(2, "0");
        const host = `${domainName}.c-${dnsBucket}.i.${dnsZone}`;
        config.setHost(host, `resolved from 'secretKey' and ${source}`);
    }
    catch (e) {
        if (e instanceof errors.GelError) {
            throw e;
        }
        else {
            throw new errors_1.InterfaceError(`Invalid secret key: ${e}`);
        }
    }
}
function _jwtBase64Decode(payload) {
    return JSON.parse(buffer_1.utf8Decoder.decode((0, buffer_1.decodeB64)(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))));
}
