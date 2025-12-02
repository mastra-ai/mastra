// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as ACLsAPI from './acls';
import {
  ACL,
  ACLCreateParams,
  ACLDeleteParams,
  ACLDeleteResponse,
  ACLGetParams,
  ACLListParams,
  ACLUpdateParams,
  ACLs,
  ACLsSinglePage,
} from './acls';
import * as ForceAXFRAPI from './force-axfr';
import { ForceAXFR, ForceAXFRCreateParams, ForceAXFRResource } from './force-axfr';
import * as IncomingAPI from './incoming';
import {
  Incoming,
  IncomingCreateParams,
  IncomingCreateResponse,
  IncomingDeleteParams,
  IncomingDeleteResponse,
  IncomingGetParams,
  IncomingGetResponse,
  IncomingResource,
  IncomingUpdateParams,
  IncomingUpdateResponse,
} from './incoming';
import * as PeersAPI from './peers';
import {
  Peer,
  PeerCreateParams,
  PeerDeleteParams,
  PeerDeleteResponse,
  PeerGetParams,
  PeerListParams,
  PeerUpdateParams,
  Peers,
  PeersSinglePage,
} from './peers';
import * as TSIGsAPI from './tsigs';
import {
  TSIG,
  TSIGCreateParams,
  TSIGDeleteParams,
  TSIGDeleteResponse,
  TSIGGetParams,
  TSIGListParams,
  TSIGUpdateParams,
  TSIGs,
  TSIGsSinglePage,
} from './tsigs';
import * as OutgoingAPI from './outgoing/outgoing';
import {
  DisableTransfer,
  EnableTransfer,
  Outgoing,
  OutgoingCreateParams,
  OutgoingCreateResponse,
  OutgoingDeleteParams,
  OutgoingDeleteResponse,
  OutgoingDisableParams,
  OutgoingEnableParams,
  OutgoingForceNotifyParams,
  OutgoingForceNotifyResponse,
  OutgoingGetParams,
  OutgoingGetResponse,
  OutgoingResource,
  OutgoingStatus,
  OutgoingUpdateParams,
  OutgoingUpdateResponse,
} from './outgoing/outgoing';

export class ZoneTransfers extends APIResource {
  forceAXFR: ForceAXFRAPI.ForceAXFRResource = new ForceAXFRAPI.ForceAXFRResource(this._client);
  incoming: IncomingAPI.IncomingResource = new IncomingAPI.IncomingResource(this._client);
  outgoing: OutgoingAPI.OutgoingResource = new OutgoingAPI.OutgoingResource(this._client);
  acls: ACLsAPI.ACLs = new ACLsAPI.ACLs(this._client);
  peers: PeersAPI.Peers = new PeersAPI.Peers(this._client);
  tsigs: TSIGsAPI.TSIGs = new TSIGsAPI.TSIGs(this._client);
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

export declare namespace ZoneTransfers {
  export {
    ForceAXFRResource as ForceAXFRResource,
    type ForceAXFR as ForceAXFR,
    type ForceAXFRCreateParams as ForceAXFRCreateParams,
  };

  export {
    IncomingResource as IncomingResource,
    type Incoming as Incoming,
    type IncomingCreateResponse as IncomingCreateResponse,
    type IncomingUpdateResponse as IncomingUpdateResponse,
    type IncomingDeleteResponse as IncomingDeleteResponse,
    type IncomingGetResponse as IncomingGetResponse,
    type IncomingCreateParams as IncomingCreateParams,
    type IncomingUpdateParams as IncomingUpdateParams,
    type IncomingDeleteParams as IncomingDeleteParams,
    type IncomingGetParams as IncomingGetParams,
  };

  export {
    OutgoingResource as OutgoingResource,
    type DisableTransfer as DisableTransfer,
    type EnableTransfer as EnableTransfer,
    type Outgoing as Outgoing,
    type OutgoingStatus as OutgoingStatus,
    type OutgoingCreateResponse as OutgoingCreateResponse,
    type OutgoingUpdateResponse as OutgoingUpdateResponse,
    type OutgoingDeleteResponse as OutgoingDeleteResponse,
    type OutgoingForceNotifyResponse as OutgoingForceNotifyResponse,
    type OutgoingGetResponse as OutgoingGetResponse,
    type OutgoingCreateParams as OutgoingCreateParams,
    type OutgoingUpdateParams as OutgoingUpdateParams,
    type OutgoingDeleteParams as OutgoingDeleteParams,
    type OutgoingDisableParams as OutgoingDisableParams,
    type OutgoingEnableParams as OutgoingEnableParams,
    type OutgoingForceNotifyParams as OutgoingForceNotifyParams,
    type OutgoingGetParams as OutgoingGetParams,
  };

  export {
    ACLs as ACLs,
    type ACL as ACL,
    type ACLDeleteResponse as ACLDeleteResponse,
    ACLsSinglePage as ACLsSinglePage,
    type ACLCreateParams as ACLCreateParams,
    type ACLUpdateParams as ACLUpdateParams,
    type ACLListParams as ACLListParams,
    type ACLDeleteParams as ACLDeleteParams,
    type ACLGetParams as ACLGetParams,
  };

  export {
    Peers as Peers,
    type Peer as Peer,
    type PeerDeleteResponse as PeerDeleteResponse,
    PeersSinglePage as PeersSinglePage,
    type PeerCreateParams as PeerCreateParams,
    type PeerUpdateParams as PeerUpdateParams,
    type PeerListParams as PeerListParams,
    type PeerDeleteParams as PeerDeleteParams,
    type PeerGetParams as PeerGetParams,
  };

  export {
    TSIGs as TSIGs,
    type TSIG as TSIG,
    type TSIGDeleteResponse as TSIGDeleteResponse,
    TSIGsSinglePage as TSIGsSinglePage,
    type TSIGCreateParams as TSIGCreateParams,
    type TSIGUpdateParams as TSIGUpdateParams,
    type TSIGListParams as TSIGListParams,
    type TSIGDeleteParams as TSIGDeleteParams,
    type TSIGGetParams as TSIGGetParams,
  };
}
