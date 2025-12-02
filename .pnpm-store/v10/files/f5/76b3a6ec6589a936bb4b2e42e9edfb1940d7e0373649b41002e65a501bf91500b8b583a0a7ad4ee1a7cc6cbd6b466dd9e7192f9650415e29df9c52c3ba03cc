"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Radar = void 0;
const resource_1 = require("../../resource.js");
const DatasetsAPI = __importStar(require("./datasets.js"));
const datasets_1 = require("./datasets.js");
const SearchAPI = __importStar(require("./search.js"));
const search_1 = require("./search.js");
const TCPResetsTimeoutsAPI = __importStar(require("./tcp-resets-timeouts.js"));
const tcp_resets_timeouts_1 = require("./tcp-resets-timeouts.js");
const AIAPI = __importStar(require("./ai/ai.js"));
const ai_1 = require("./ai/ai.js");
const AnnotationsAPI = __importStar(require("./annotations/annotations.js"));
const annotations_1 = require("./annotations/annotations.js");
const AS112API = __importStar(require("./as112/as112.js"));
const as112_1 = require("./as112/as112.js");
const AttacksAPI = __importStar(require("./attacks/attacks.js"));
const attacks_1 = require("./attacks/attacks.js");
const BGPAPI = __importStar(require("./bgp/bgp.js"));
const bgp_1 = require("./bgp/bgp.js");
const BotsAPI = __importStar(require("./bots/bots.js"));
const bots_1 = require("./bots/bots.js");
const DNSAPI = __importStar(require("./dns/dns.js"));
const dns_1 = require("./dns/dns.js");
const EmailAPI = __importStar(require("./email/email.js"));
const email_1 = require("./email/email.js");
const EntitiesAPI = __importStar(require("./entities/entities.js"));
const entities_1 = require("./entities/entities.js");
const HTTPAPI = __importStar(require("./http/http.js"));
const http_1 = require("./http/http.js");
const LeakedCredentialsAPI = __importStar(require("./leaked-credentials/leaked-credentials.js"));
const leaked_credentials_1 = require("./leaked-credentials/leaked-credentials.js");
const NetflowsAPI = __importStar(require("./netflows/netflows.js"));
const netflows_1 = require("./netflows/netflows.js");
const QualityAPI = __importStar(require("./quality/quality.js"));
const quality_1 = require("./quality/quality.js");
const RankingAPI = __importStar(require("./ranking/ranking.js"));
const ranking_1 = require("./ranking/ranking.js");
const RobotsTXTAPI = __importStar(require("./robots-txt/robots-txt.js"));
const robots_txt_1 = require("./robots-txt/robots-txt.js");
const TrafficAnomaliesAPI = __importStar(require("./traffic-anomalies/traffic-anomalies.js"));
const traffic_anomalies_1 = require("./traffic-anomalies/traffic-anomalies.js");
const VerifiedBotsAPI = __importStar(require("./verified-bots/verified-bots.js"));
const verified_bots_1 = require("./verified-bots/verified-bots.js");
class Radar extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.ai = new AIAPI.AI(this._client);
        this.annotations = new AnnotationsAPI.Annotations(this._client);
        this.bgp = new BGPAPI.BGP(this._client);
        this.bots = new BotsAPI.Bots(this._client);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.dns = new DNSAPI.DNS(this._client);
        this.netflows = new NetflowsAPI.Netflows(this._client);
        this.search = new SearchAPI.Search(this._client);
        this.verifiedBots = new VerifiedBotsAPI.VerifiedBots(this._client);
        this.as112 = new AS112API.AS112(this._client);
        this.email = new EmailAPI.Email(this._client);
        this.attacks = new AttacksAPI.Attacks(this._client);
        this.entities = new EntitiesAPI.Entities(this._client);
        this.http = new HTTPAPI.HTTP(this._client);
        this.quality = new QualityAPI.Quality(this._client);
        this.ranking = new RankingAPI.Ranking(this._client);
        this.trafficAnomalies = new TrafficAnomaliesAPI.TrafficAnomalies(this._client);
        this.tcpResetsTimeouts = new TCPResetsTimeoutsAPI.TCPResetsTimeouts(this._client);
        this.robotsTXT = new RobotsTXTAPI.RobotsTXT(this._client);
        this.leakedCredentials = new LeakedCredentialsAPI.LeakedCredentials(this._client);
    }
}
exports.Radar = Radar;
Radar.AI = ai_1.AI;
Radar.Annotations = annotations_1.Annotations;
Radar.BGP = bgp_1.BGP;
Radar.Bots = bots_1.Bots;
Radar.Datasets = datasets_1.Datasets;
Radar.DNS = dns_1.DNS;
Radar.Netflows = netflows_1.Netflows;
Radar.Search = search_1.Search;
Radar.VerifiedBots = verified_bots_1.VerifiedBots;
Radar.AS112 = as112_1.AS112;
Radar.Email = email_1.Email;
Radar.Attacks = attacks_1.Attacks;
Radar.Entities = entities_1.Entities;
Radar.HTTP = http_1.HTTP;
Radar.Quality = quality_1.Quality;
Radar.Ranking = ranking_1.Ranking;
Radar.TrafficAnomalies = traffic_anomalies_1.TrafficAnomalies;
Radar.TCPResetsTimeouts = tcp_resets_timeouts_1.TCPResetsTimeouts;
Radar.RobotsTXT = robots_txt_1.RobotsTXT;
Radar.LeakedCredentials = leaked_credentials_1.LeakedCredentials;
//# sourceMappingURL=radar.js.map