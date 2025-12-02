import { WorkOS } from '../workos';
import { GeneratePortalLinkIntent } from './interfaces/generate-portal-link-intent.interface';
export declare class Portal {
    private readonly workos;
    constructor(workos: WorkOS);
    generateLink({ intent, organization, returnUrl, successUrl, }: {
        intent: GeneratePortalLinkIntent;
        organization: string;
        returnUrl?: string;
        successUrl?: string;
    }): Promise<{
        link: string;
    }>;
}
