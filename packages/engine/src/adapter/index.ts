export interface BaseConnection {
    id: string;
    name: string;
    issues: string[];
    syncConfig: Record<string, any> | null;
    connectionId: string;
    createdAt: Date;
    updatedAt: Date | null;
    lastSyncAt: Date | null;
    subscriptionId?: string | null;
}

export interface BaseCredential {
    id: string;
    type: string;
    value: Record<string, any>;
    scope: string[];
    kId: string | null;
}

export type CredentialInput = Omit<BaseCredential, "id" | "kId">;

export abstract class MastraEngine {
    constructor() {
        console.log('MastraEngine')
    }

    abstract createConnection({
        connection,
        credential,
    }: {
        connection: Omit<BaseConnection, 'createdAt' | 'updatedAt' | 'id' | 'lastSyncAt'>;
        credential: CredentialInput;
    }): Promise<BaseConnection & { credential: BaseCredential | null }>;

    async getConnection({
        connectionId,
        name,
    }: {
        name: string;
        connectionId: string;
    }): Promise<BaseConnection> {
        throw new Error('Not implemented');
    }

    abstract deleteConnection({
        id
    }: {
        id: string
    }): Promise<BaseConnection | null>;
}