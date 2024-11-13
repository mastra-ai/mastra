import { expect, describe, it, beforeAll, afterAll } from '@jest/globals';
import { PostgresEngine } from "./engine";
import { BaseConnection, CredentialInput } from '../adapter';

const engine = new PostgresEngine({
    url: 'postgresql://postgres:postgres@localhost:5433/mastra'
})

let testConnection: BaseConnection;

describe('Connection and Credential Management', () => {
    it('should create and retrieve a connection with credentials', async () => {
        // Create a new connection
        const connection = {
            connectionId: 'test-connection-1',
            name: 'Test Connection',
            issues: [],
            syncConfig: {}
        };

        const credential: CredentialInput = {
            type: 'oauth',
            value: { token: 'test-token' },
            scope: ['read', 'write']
        };

        // Create connection
        testConnection = await engine.createConnection({
            connection,
            credential
        });

        console.log("created", testConnection)

        // Verify connection was created
        expect(testConnection).toBeDefined();
        expect(testConnection.id).toBeDefined();
        expect(testConnection.connectionId).toBe('test-connection-1');

        // // Retrieve credentials
        // const retrievedCredentials = await engine.getCredentialsByConnection(testConnection.id);
        // expect(retrievedCredentials).toBeDefined();
        // expect(retrievedCredentials.type).toBe('oauth');
        // expect(retrievedCredentials.value).toEqual({ token: 'test-token' });
        // expect(retrievedCredentials.scope).toEqual(['read', 'write']);
    });

    // it('should update connection credentials', async () => {
    //     const newToken = { token: 'updated-token' };

    //     const updatedCredential = await engine.updateConnectionCredential({
    //         k_id: testConnection.id,
    //         token: newToken
    //     });

    //     expect(updatedCredential).toBeDefined();
    //     expect(updatedCredential.value).toEqual(newToken);
    // });
});