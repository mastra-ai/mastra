// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as DatasetsAPI from './datasets';
import {
  DatasetDownloadParams,
  DatasetDownloadResponse,
  DatasetGetResponse,
  DatasetListParams,
  DatasetListResponse,
  Datasets,
} from './datasets';
import * as SearchAPI from './search';
import { Search, SearchGlobalParams, SearchGlobalResponse } from './search';
import * as TCPResetsTimeoutsAPI from './tcp-resets-timeouts';
import {
  TCPResetsTimeoutSummaryParams,
  TCPResetsTimeoutSummaryResponse,
  TCPResetsTimeoutTimeseriesGroupsParams,
  TCPResetsTimeoutTimeseriesGroupsResponse,
  TCPResetsTimeouts,
} from './tcp-resets-timeouts';
import * as AIAPI from './ai/ai';
import { AI } from './ai/ai';
import * as AnnotationsAPI from './annotations/annotations';
import { AnnotationListParams, AnnotationListResponse, Annotations } from './annotations/annotations';
import * as AS112API from './as112/as112';
import { AS112, AS112TimeseriesParams, AS112TimeseriesResponse } from './as112/as112';
import * as AttacksAPI from './attacks/attacks';
import { Attacks } from './attacks/attacks';
import * as BGPAPI from './bgp/bgp';
import { BGP, BGPTimeseriesParams, BGPTimeseriesResponse } from './bgp/bgp';
import * as BotsAPI from './bots/bots';
import {
  BotGetParams,
  BotGetResponse,
  BotListParams,
  BotListResponse,
  BotSummaryParams,
  BotSummaryResponse,
  BotTimeseriesGroupsParams,
  BotTimeseriesGroupsResponse,
  BotTimeseriesParams,
  BotTimeseriesResponse,
  Bots,
} from './bots/bots';
import * as DNSAPI from './dns/dns';
import { DNS, DNSTimeseriesParams, DNSTimeseriesResponse } from './dns/dns';
import * as EmailAPI from './email/email';
import { Email, RadarEmailSeries, RadarEmailSummary } from './email/email';
import * as EntitiesAPI from './entities/entities';
import { Entities, EntityGetParams, EntityGetResponse } from './entities/entities';
import * as HTTPAPI from './http/http';
import { HTTP, HTTPTimeseriesParams, HTTPTimeseriesResponse } from './http/http';
import * as LeakedCredentialsAPI from './leaked-credentials/leaked-credentials';
import { LeakedCredentials } from './leaked-credentials/leaked-credentials';
import * as NetflowsAPI from './netflows/netflows';
import {
  NetflowSummaryParams,
  NetflowSummaryResponse,
  NetflowTimeseriesParams,
  NetflowTimeseriesResponse,
  Netflows,
} from './netflows/netflows';
import * as QualityAPI from './quality/quality';
import { Quality } from './quality/quality';
import * as RankingAPI from './ranking/ranking';
import {
  Ranking,
  RankingTimeseriesGroupsParams,
  RankingTimeseriesGroupsResponse,
  RankingTopParams,
  RankingTopResponse,
} from './ranking/ranking';
import * as RobotsTXTAPI from './robots-txt/robots-txt';
import { RobotsTXT } from './robots-txt/robots-txt';
import * as TrafficAnomaliesAPI from './traffic-anomalies/traffic-anomalies';
import {
  TrafficAnomalies,
  TrafficAnomalyGetParams,
  TrafficAnomalyGetResponse,
} from './traffic-anomalies/traffic-anomalies';
import * as VerifiedBotsAPI from './verified-bots/verified-bots';
import { VerifiedBots } from './verified-bots/verified-bots';

export class Radar extends APIResource {
  ai: AIAPI.AI = new AIAPI.AI(this._client);
  annotations: AnnotationsAPI.Annotations = new AnnotationsAPI.Annotations(this._client);
  bgp: BGPAPI.BGP = new BGPAPI.BGP(this._client);
  bots: BotsAPI.Bots = new BotsAPI.Bots(this._client);
  datasets: DatasetsAPI.Datasets = new DatasetsAPI.Datasets(this._client);
  dns: DNSAPI.DNS = new DNSAPI.DNS(this._client);
  netflows: NetflowsAPI.Netflows = new NetflowsAPI.Netflows(this._client);
  search: SearchAPI.Search = new SearchAPI.Search(this._client);
  verifiedBots: VerifiedBotsAPI.VerifiedBots = new VerifiedBotsAPI.VerifiedBots(this._client);
  as112: AS112API.AS112 = new AS112API.AS112(this._client);
  email: EmailAPI.Email = new EmailAPI.Email(this._client);
  attacks: AttacksAPI.Attacks = new AttacksAPI.Attacks(this._client);
  entities: EntitiesAPI.Entities = new EntitiesAPI.Entities(this._client);
  http: HTTPAPI.HTTP = new HTTPAPI.HTTP(this._client);
  quality: QualityAPI.Quality = new QualityAPI.Quality(this._client);
  ranking: RankingAPI.Ranking = new RankingAPI.Ranking(this._client);
  trafficAnomalies: TrafficAnomaliesAPI.TrafficAnomalies = new TrafficAnomaliesAPI.TrafficAnomalies(
    this._client,
  );
  tcpResetsTimeouts: TCPResetsTimeoutsAPI.TCPResetsTimeouts = new TCPResetsTimeoutsAPI.TCPResetsTimeouts(
    this._client,
  );
  robotsTXT: RobotsTXTAPI.RobotsTXT = new RobotsTXTAPI.RobotsTXT(this._client);
  leakedCredentials: LeakedCredentialsAPI.LeakedCredentials = new LeakedCredentialsAPI.LeakedCredentials(
    this._client,
  );
}

Radar.AI = AI;
Radar.Annotations = Annotations;
Radar.BGP = BGP;
Radar.Bots = Bots;
Radar.Datasets = Datasets;
Radar.DNS = DNS;
Radar.Netflows = Netflows;
Radar.Search = Search;
Radar.VerifiedBots = VerifiedBots;
Radar.AS112 = AS112;
Radar.Email = Email;
Radar.Attacks = Attacks;
Radar.Entities = Entities;
Radar.HTTP = HTTP;
Radar.Quality = Quality;
Radar.Ranking = Ranking;
Radar.TrafficAnomalies = TrafficAnomalies;
Radar.TCPResetsTimeouts = TCPResetsTimeouts;
Radar.RobotsTXT = RobotsTXT;
Radar.LeakedCredentials = LeakedCredentials;

export declare namespace Radar {
  export { AI as AI };

  export {
    Annotations as Annotations,
    type AnnotationListResponse as AnnotationListResponse,
    type AnnotationListParams as AnnotationListParams,
  };

  export {
    BGP as BGP,
    type BGPTimeseriesResponse as BGPTimeseriesResponse,
    type BGPTimeseriesParams as BGPTimeseriesParams,
  };

  export {
    Bots as Bots,
    type BotListResponse as BotListResponse,
    type BotGetResponse as BotGetResponse,
    type BotSummaryResponse as BotSummaryResponse,
    type BotTimeseriesResponse as BotTimeseriesResponse,
    type BotTimeseriesGroupsResponse as BotTimeseriesGroupsResponse,
    type BotListParams as BotListParams,
    type BotGetParams as BotGetParams,
    type BotSummaryParams as BotSummaryParams,
    type BotTimeseriesParams as BotTimeseriesParams,
    type BotTimeseriesGroupsParams as BotTimeseriesGroupsParams,
  };

  export {
    Datasets as Datasets,
    type DatasetListResponse as DatasetListResponse,
    type DatasetDownloadResponse as DatasetDownloadResponse,
    type DatasetGetResponse as DatasetGetResponse,
    type DatasetListParams as DatasetListParams,
    type DatasetDownloadParams as DatasetDownloadParams,
  };

  export {
    DNS as DNS,
    type DNSTimeseriesResponse as DNSTimeseriesResponse,
    type DNSTimeseriesParams as DNSTimeseriesParams,
  };

  export {
    Netflows as Netflows,
    type NetflowSummaryResponse as NetflowSummaryResponse,
    type NetflowTimeseriesResponse as NetflowTimeseriesResponse,
    type NetflowSummaryParams as NetflowSummaryParams,
    type NetflowTimeseriesParams as NetflowTimeseriesParams,
  };

  export {
    Search as Search,
    type SearchGlobalResponse as SearchGlobalResponse,
    type SearchGlobalParams as SearchGlobalParams,
  };

  export { VerifiedBots as VerifiedBots };

  export {
    AS112 as AS112,
    type AS112TimeseriesResponse as AS112TimeseriesResponse,
    type AS112TimeseriesParams as AS112TimeseriesParams,
  };

  export {
    Email as Email,
    type RadarEmailSeries as RadarEmailSeries,
    type RadarEmailSummary as RadarEmailSummary,
  };

  export { Attacks as Attacks };

  export {
    Entities as Entities,
    type EntityGetResponse as EntityGetResponse,
    type EntityGetParams as EntityGetParams,
  };

  export {
    HTTP as HTTP,
    type HTTPTimeseriesResponse as HTTPTimeseriesResponse,
    type HTTPTimeseriesParams as HTTPTimeseriesParams,
  };

  export { Quality as Quality };

  export {
    Ranking as Ranking,
    type RankingTimeseriesGroupsResponse as RankingTimeseriesGroupsResponse,
    type RankingTopResponse as RankingTopResponse,
    type RankingTimeseriesGroupsParams as RankingTimeseriesGroupsParams,
    type RankingTopParams as RankingTopParams,
  };

  export {
    TrafficAnomalies as TrafficAnomalies,
    type TrafficAnomalyGetResponse as TrafficAnomalyGetResponse,
    type TrafficAnomalyGetParams as TrafficAnomalyGetParams,
  };

  export {
    TCPResetsTimeouts as TCPResetsTimeouts,
    type TCPResetsTimeoutSummaryResponse as TCPResetsTimeoutSummaryResponse,
    type TCPResetsTimeoutTimeseriesGroupsResponse as TCPResetsTimeoutTimeseriesGroupsResponse,
    type TCPResetsTimeoutSummaryParams as TCPResetsTimeoutSummaryParams,
    type TCPResetsTimeoutTimeseriesGroupsParams as TCPResetsTimeoutTimeseriesGroupsParams,
  };

  export { RobotsTXT as RobotsTXT };

  export { LeakedCredentials as LeakedCredentials };
}
