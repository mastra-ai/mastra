// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ACLsAPI from "./acls.mjs";
import { ACLs, ACLsSinglePage, } from "./acls.mjs";
import * as ForceAXFRAPI from "./force-axfr.mjs";
import { ForceAXFRResource } from "./force-axfr.mjs";
import * as IncomingAPI from "./incoming.mjs";
import { IncomingResource, } from "./incoming.mjs";
import * as PeersAPI from "./peers.mjs";
import { Peers, PeersSinglePage, } from "./peers.mjs";
import * as TSIGsAPI from "./tsigs.mjs";
import { TSIGs, TSIGsSinglePage, } from "./tsigs.mjs";
import * as OutgoingAPI from "./outgoing/outgoing.mjs";
import { OutgoingResource, } from "./outgoing/outgoing.mjs";
export class ZoneTransfers extends APIResource {
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
ZoneTransfers.ForceAXFRResource = ForceAXFRResource;
ZoneTransfers.IncomingResource = IncomingResource;
ZoneTransfers.OutgoingResource = OutgoingResource;
ZoneTransfers.ACLs = ACLs;
ZoneTransfers.ACLsSinglePage = ACLsSinglePage;
ZoneTransfers.Peers = Peers;
ZoneTransfers.PeersSinglePage = PeersSinglePage;
ZoneTransfers.TSIGs = TSIGs;
ZoneTransfers.TSIGsSinglePage = TSIGsSinglePage;
//# sourceMappingURL=zone-transfers.mjs.map