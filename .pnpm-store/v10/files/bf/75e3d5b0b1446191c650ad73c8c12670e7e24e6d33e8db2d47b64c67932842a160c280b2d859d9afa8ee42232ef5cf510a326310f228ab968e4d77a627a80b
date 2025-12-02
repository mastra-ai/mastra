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
import { Duration } from "./datatypes/datetime";
export type Address = [string, number];
export declare const validTlsSecurityValues: readonly ["insecure", "no_host_verification", "strict", "default"];
export type TlsSecurity = (typeof validTlsSecurityValues)[number];
export declare function isValidTlsSecurityValue(candidate: unknown): candidate is TlsSecurity;
interface PartiallyNormalizedConfig {
    connectionParams: ResolvedConnectConfig;
    inProject: () => Promise<boolean>;
    fromProject: boolean;
    fromEnv: boolean;
}
export interface NormalizedConnectConfig extends PartiallyNormalizedConfig {
    connectTimeout?: number;
    logging: boolean;
}
export interface ConnectConfig {
    dsn?: string;
    instanceName?: string;
    credentials?: string;
    credentialsFile?: string;
    host?: string;
    port?: number;
    database?: string;
    branch?: string;
    user?: string;
    password?: string;
    secretKey?: string;
    serverSettings?: any;
    tlsCA?: string;
    tlsCAFile?: string;
    tlsSecurity?: TlsSecurity;
    tlsServerName?: string;
    timeout?: number;
    waitUntilAvailable?: Duration | number;
    logging?: boolean;
}
export interface ServerUtils {
    findProjectDir: (required?: boolean) => Promise<string | null>;
    findStashPath: (projectDir: string) => Promise<string>;
    readFileUtf8: (...path: string[]) => Promise<string>;
    searchConfigDir: (...configPath: string[]) => Promise<string>;
}
export type ConnectArgumentsParser = (opts: ConnectConfig) => Promise<NormalizedConnectConfig>;
export declare function getConnectArgumentsParser(utils: ServerUtils | null): ConnectArgumentsParser;
type ConnectConfigParams = "host" | "port" | "database" | "branch" | "user" | "password" | "secretKey" | "cloudProfile" | "tlsCAData" | "tlsSecurity" | "tlsServerName" | "waitUntilAvailable";
export type ResolvedConnectConfigReadonly = Readonly<Pick<ResolvedConnectConfig, Exclude<keyof ResolvedConnectConfig, `${"_" | "set" | "add"}${string}`> | "address">>;
export declare class ResolvedConnectConfig {
    _host: string | null;
    _hostSource: string | null;
    _port: number | null;
    _portSource: string | null;
    _database: string | null;
    _databaseSource: string | null;
    _branch: string | null;
    _branchSource: string | null;
    _user: string | null;
    _userSource: string | null;
    _password: string | null;
    _passwordSource: string | null;
    _secretKey: string | null;
    _secretKeySource: string | null;
    _cloudProfile: string | null;
    _cloudProfileSource: string | null;
    _tlsCAData: string | null;
    _tlsCADataSource: string | null;
    _tlsSecurity: TlsSecurity | null;
    _tlsSecuritySource: string | null;
    _tlsServerName: string | null;
    _tlsServerNameSource: string | null;
    _waitUntilAvailable: number | null;
    _waitUntilAvailableSource: string | null;
    serverSettings: {
        readonly [key: string]: string;
    };
    constructor();
    _setParam<Param extends ConnectConfigParams, Value>(param: Param, value: Value, source: string, validator?: (value: NonNullable<Value>) => this[`_${Param}`]): boolean;
    _setParamAsync<Param extends ConnectConfigParams, Value>(param: Param, value: Value, source: string, validator?: (value: NonNullable<Value>) => Promise<this[`_${Param}`]>): Promise<boolean>;
    setHost(host: string | null, source: string): boolean;
    setPort(port: string | number | null, source: string): boolean;
    setDatabase(database: string | null, source: string): boolean;
    setBranch(branch: string | null, source: string): boolean;
    setUser(user: string | null, source: string): boolean;
    setPassword(password: string | null, source: string): boolean;
    setSecretKey(secretKey: string | null, source: string): boolean;
    setCloudProfile(cloudProfile: string | null, source: string): boolean;
    setTlsCAData(caData: string | null, source: string): boolean;
    setTlsCAFile(caFile: string | null, source: string, readFile: (fn: string) => Promise<string>): Promise<boolean>;
    setTlsServerName(serverName: string | null, source: string): boolean;
    setTlsSecurity(tlsSecurity: string | null, source: string): boolean;
    setWaitUntilAvailable(duration: string | number | Duration | null, source: string): boolean;
    addServerSettings(settings: {
        [key: string]: string;
    }): void;
    get address(): Address;
    get database(): string;
    get branch(): string;
    get user(): string;
    get password(): string | undefined;
    get secretKey(): string | undefined;
    get cloudProfile(): string;
    get tlsServerName(): string | undefined;
    get tlsSecurity(): Exclude<TlsSecurity, "default">;
    get waitUntilAvailable(): number;
    explainConfig(): string;
}
export declare function parseDuration(duration: string | number | Duration): number;
export {};
