// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as RayIDAPI from './rayid';
import { RayID, RayIDGetParams, RayIDGetResponse } from './rayid';
import * as ControlAPI from './control/control';
import { Control } from './control/control';
import * as ReceivedAPI from './received/received';
import { Received, ReceivedGetParams, ReceivedGetResponse } from './received/received';

export class Logs extends APIResource {
  control: ControlAPI.Control = new ControlAPI.Control(this._client);
  RayID: RayIDAPI.RayID = new RayIDAPI.RayID(this._client);
  received: ReceivedAPI.Received = new ReceivedAPI.Received(this._client);
}

Logs.Control = Control;
Logs.RayID = RayID;
Logs.Received = Received;

export declare namespace Logs {
  export { Control as Control };

  export { RayID as RayID, type RayIDGetResponse as RayIDGetResponse, type RayIDGetParams as RayIDGetParams };

  export {
    Received as Received,
    type ReceivedGetResponse as ReceivedGetResponse,
    type ReceivedGetParams as ReceivedGetParams,
  };
}
