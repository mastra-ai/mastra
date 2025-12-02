// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as TemporaryCredentialsAPI from "./temporary-credentials.mjs";
import { TemporaryCredentials, } from "./temporary-credentials.mjs";
import * as BucketsAPI from "./buckets/buckets.mjs";
import { Buckets, } from "./buckets/buckets.mjs";
import * as SuperSlurperAPI from "./super-slurper/super-slurper.mjs";
import { SuperSlurper } from "./super-slurper/super-slurper.mjs";
export class R2 extends APIResource {
    constructor() {
        super(...arguments);
        this.buckets = new BucketsAPI.Buckets(this._client);
        this.temporaryCredentials = new TemporaryCredentialsAPI.TemporaryCredentials(this._client);
        this.superSlurper = new SuperSlurperAPI.SuperSlurper(this._client);
    }
}
R2.Buckets = Buckets;
R2.TemporaryCredentials = TemporaryCredentials;
R2.SuperSlurper = SuperSlurper;
//# sourceMappingURL=r2.mjs.map