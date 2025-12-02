import { Actions } from './actions/actions';
import { CryptoProvider } from './common/crypto/crypto-provider';
import { IronSessionProvider } from './common/iron-session/iron-session-provider';
import { HttpClient } from './common/net/http-client';
import { WorkOSOptions } from './index.worker';
import { Webhooks } from './webhooks/webhooks';
import { WorkOS } from './workos';
export * from './actions/interfaces';
export * from './audit-logs/interfaces';
export * from './common/exceptions';
export * from './common/interfaces';
export * from './common/utils/pagination';
export * from './directory-sync/interfaces';
export * from './directory-sync/utils/get-primary-email';
export * from './events/interfaces';
export * from './fga/interfaces';
export * from './organizations/interfaces';
export * from './organization-domains/interfaces';
export * from './passwordless/interfaces';
export * from './portal/interfaces';
export * from './sso/interfaces';
export * from './user-management/interfaces';
export * from './roles/interfaces';
declare class WorkOSWorker extends WorkOS {
    /** @override */
    createHttpClient(options: WorkOSOptions, userAgent: string): HttpClient;
    /** @override */
    createWebhookClient(): Webhooks;
    getCryptoProvider(): CryptoProvider;
    /** @override */
    createActionsClient(): Actions;
    /** @override */
    createIronSessionProvider(): IronSessionProvider;
    /** @override */
    emitWarning(warning: string): void;
}
export { WorkOSWorker as WorkOS };
