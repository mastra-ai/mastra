// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AnalyzeAPI from './analyze';
import { Analyze, AnalyzeCreateParams, AnalyzeCreateResponse } from './analyze';
import * as RecommendationsAPI from './recommendations';
import { RecommendationGetParams, RecommendationGetResponse, Recommendations } from './recommendations';
import * as VerificationAPI from './verification';
import {
  Verification,
  VerificationEditParams,
  VerificationEditResponse,
  VerificationGetParams,
  VerificationGetResponse,
  VerificationResource,
} from './verification';
import * as CertificatePacksAPI from './certificate-packs/certificate-packs';
import {
  CertificatePackCreateParams,
  CertificatePackCreateResponse,
  CertificatePackDeleteParams,
  CertificatePackDeleteResponse,
  CertificatePackEditParams,
  CertificatePackEditResponse,
  CertificatePackGetParams,
  CertificatePackGetResponse,
  CertificatePackListParams,
  CertificatePackListResponse,
  CertificatePackListResponsesSinglePage,
  CertificatePacks,
  Host,
  RequestValidity,
  Status,
  ValidationMethod,
} from './certificate-packs/certificate-packs';
import * as UniversalAPI from './universal/universal';
import { Universal } from './universal/universal';

export class SSL extends APIResource {
  analyze: AnalyzeAPI.Analyze = new AnalyzeAPI.Analyze(this._client);
  certificatePacks: CertificatePacksAPI.CertificatePacks = new CertificatePacksAPI.CertificatePacks(
    this._client,
  );
  recommendations: RecommendationsAPI.Recommendations = new RecommendationsAPI.Recommendations(this._client);
  universal: UniversalAPI.Universal = new UniversalAPI.Universal(this._client);
  verification: VerificationAPI.VerificationResource = new VerificationAPI.VerificationResource(this._client);
}

SSL.Analyze = Analyze;
SSL.CertificatePacks = CertificatePacks;
SSL.CertificatePackListResponsesSinglePage = CertificatePackListResponsesSinglePage;
SSL.Recommendations = Recommendations;
SSL.Universal = Universal;
SSL.VerificationResource = VerificationResource;

export declare namespace SSL {
  export {
    Analyze as Analyze,
    type AnalyzeCreateResponse as AnalyzeCreateResponse,
    type AnalyzeCreateParams as AnalyzeCreateParams,
  };

  export {
    CertificatePacks as CertificatePacks,
    type Host as Host,
    type RequestValidity as RequestValidity,
    type Status as Status,
    type ValidationMethod as ValidationMethod,
    type CertificatePackCreateResponse as CertificatePackCreateResponse,
    type CertificatePackListResponse as CertificatePackListResponse,
    type CertificatePackDeleteResponse as CertificatePackDeleteResponse,
    type CertificatePackEditResponse as CertificatePackEditResponse,
    type CertificatePackGetResponse as CertificatePackGetResponse,
    CertificatePackListResponsesSinglePage as CertificatePackListResponsesSinglePage,
    type CertificatePackCreateParams as CertificatePackCreateParams,
    type CertificatePackListParams as CertificatePackListParams,
    type CertificatePackDeleteParams as CertificatePackDeleteParams,
    type CertificatePackEditParams as CertificatePackEditParams,
    type CertificatePackGetParams as CertificatePackGetParams,
  };

  export {
    Recommendations as Recommendations,
    type RecommendationGetResponse as RecommendationGetResponse,
    type RecommendationGetParams as RecommendationGetParams,
  };

  export { Universal as Universal };

  export {
    VerificationResource as VerificationResource,
    type Verification as Verification,
    type VerificationEditResponse as VerificationEditResponse,
    type VerificationGetResponse as VerificationGetResponse,
    type VerificationEditParams as VerificationEditParams,
    type VerificationGetParams as VerificationGetParams,
  };
}
