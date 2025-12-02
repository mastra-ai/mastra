import { type ServerUtils, type TlsSecurity } from "./conUtils";
export interface Credentials {
    host?: string;
    port?: number;
    user: string;
    password?: string;
    database?: string;
    branch?: string;
    tlsCAData?: string;
    tlsSecurity?: TlsSecurity;
}
export declare function getCredentialsPath(instanceName: string, serverUtils: ServerUtils): Promise<string>;
export declare function readCredentialsFile(file: string, serverUtils: ServerUtils): Promise<Credentials>;
export declare function validateCredentials(data: any): Credentials;
