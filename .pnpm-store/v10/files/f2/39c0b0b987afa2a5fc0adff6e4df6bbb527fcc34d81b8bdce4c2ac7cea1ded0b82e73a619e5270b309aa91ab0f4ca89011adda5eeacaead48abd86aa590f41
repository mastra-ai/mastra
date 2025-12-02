// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AnalyzeAPI from "./analyze.mjs";
import { Analyze } from "./analyze.mjs";
import * as RecommendationsAPI from "./recommendations.mjs";
import { Recommendations } from "./recommendations.mjs";
import * as VerificationAPI from "./verification.mjs";
import { VerificationResource, } from "./verification.mjs";
import * as CertificatePacksAPI from "./certificate-packs/certificate-packs.mjs";
import { CertificatePackListResponsesSinglePage, CertificatePacks, } from "./certificate-packs/certificate-packs.mjs";
import * as UniversalAPI from "./universal/universal.mjs";
import { Universal } from "./universal/universal.mjs";
export class SSL extends APIResource {
    constructor() {
        super(...arguments);
        this.analyze = new AnalyzeAPI.Analyze(this._client);
        this.certificatePacks = new CertificatePacksAPI.CertificatePacks(this._client);
        this.recommendations = new RecommendationsAPI.Recommendations(this._client);
        this.universal = new UniversalAPI.Universal(this._client);
        this.verification = new VerificationAPI.VerificationResource(this._client);
    }
}
SSL.Analyze = Analyze;
SSL.CertificatePacks = CertificatePacks;
SSL.CertificatePackListResponsesSinglePage = CertificatePackListResponsesSinglePage;
SSL.Recommendations = Recommendations;
SSL.Universal = Universal;
SSL.VerificationResource = VerificationResource;
//# sourceMappingURL=ssl.mjs.map