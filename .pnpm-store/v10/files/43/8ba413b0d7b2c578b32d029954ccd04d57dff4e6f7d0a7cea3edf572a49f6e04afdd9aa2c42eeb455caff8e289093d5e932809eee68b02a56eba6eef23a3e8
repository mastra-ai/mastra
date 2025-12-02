// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as RoutingAPI from './routing/routing';
import { Routing } from './routing/routing';
import * as SecurityAPI from './security/security';
import { Security } from './security/security';

export class Email extends APIResource {
  routing: RoutingAPI.Routing = new RoutingAPI.Routing(this._client);
  security: SecurityAPI.Security = new SecurityAPI.Security(this._client);
}

export interface RadarEmailSeries {
  FAIL: Array<string>;

  NONE: Array<string>;

  PASS: Array<string>;
}

export interface RadarEmailSummary {
  /**
   * A numeric string.
   */
  FAIL: string;

  /**
   * A numeric string.
   */
  NONE: string;

  /**
   * A numeric string.
   */
  PASS: string;
}

Email.Routing = Routing;
Email.Security = Security;

export declare namespace Email {
  export { type RadarEmailSeries as RadarEmailSeries, type RadarEmailSummary as RadarEmailSummary };

  export { Routing as Routing };

  export { Security as Security };
}
