import { ConnectionProvider } from '../driver/connection-provider.js';
import { DatabaseConnection } from '../driver/database-connection.js';
export interface ControlledConnection {
    readonly connection: DatabaseConnection;
    readonly release: () => void;
}
export declare function provideControlledConnection(connectionProvider: ConnectionProvider): Promise<ControlledConnection>;
