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
exports.ZoneTransfers = void 0;
const resource_1 = require("../../../resource.js");
const ACLsAPI = __importStar(require("./acls.js"));
const acls_1 = require("./acls.js");
const ForceAXFRAPI = __importStar(require("./force-axfr.js"));
const force_axfr_1 = require("./force-axfr.js");
const IncomingAPI = __importStar(require("./incoming.js"));
const incoming_1 = require("./incoming.js");
const PeersAPI = __importStar(require("./peers.js"));
const peers_1 = require("./peers.js");
const TSIGsAPI = __importStar(require("./tsigs.js"));
const tsigs_1 = require("./tsigs.js");
const OutgoingAPI = __importStar(require("./outgoing/outgoing.js"));
const outgoing_1 = require("./outgoing/outgoing.js");
class ZoneTransfers extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.forceAXFR = new ForceAXFRAPI.ForceAXFRResource(this._client);
        this.incoming = new IncomingAPI.IncomingResource(this._client);
        this.outgoing = new OutgoingAPI.OutgoingResource(this._client);
        this.acls = new ACLsAPI.ACLs(this._client);
        this.peers = new PeersAPI.Peers(this._client);
        this.tsigs = new TSIGsAPI.TSIGs(this._client);
    }
}
exports.ZoneTransfers = ZoneTransfers;
ZoneTransfers.ForceAXFRResource = force_axfr_1.ForceAXFRResource;
ZoneTransfers.IncomingResource = incoming_1.IncomingResource;
ZoneTransfers.OutgoingResource = outgoing_1.OutgoingResource;
ZoneTransfers.ACLs = acls_1.ACLs;
ZoneTransfers.ACLsSinglePage = acls_1.ACLsSinglePage;
ZoneTransfers.Peers = peers_1.Peers;
ZoneTransfers.PeersSinglePage = peers_1.PeersSinglePage;
ZoneTransfers.TSIGs = tsigs_1.TSIGs;
ZoneTransfers.TSIGsSinglePage = tsigs_1.TSIGsSinglePage;
//# sourceMappingURL=zone-transfers.js.map