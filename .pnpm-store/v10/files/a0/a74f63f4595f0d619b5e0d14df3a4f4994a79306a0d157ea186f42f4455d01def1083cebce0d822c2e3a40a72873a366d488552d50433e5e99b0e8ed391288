import { WorkOS } from '../workos';
import { CreatePasswordlessSessionOptions, PasswordlessSession, SendSessionResponse } from './interfaces';
export declare class Passwordless {
    private readonly workos;
    constructor(workos: WorkOS);
    createSession({ redirectURI, expiresIn, ...options }: CreatePasswordlessSessionOptions): Promise<PasswordlessSession>;
    sendSession(sessionId: string): Promise<SendSessionResponse>;
}
