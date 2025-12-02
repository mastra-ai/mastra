// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as PrebuiltPoliciesAPI from './prebuilt-policies';
import {
  PrebuiltPolicies,
  PrebuiltPolicyListParams,
  PrebuiltPolicyListResponse,
  PrebuiltPolicyListResponsesSinglePage,
} from './prebuilt-policies';
import { SinglePage } from '../../../pagination';

export class CatalogSyncs extends APIResource {
  prebuiltPolicies: PrebuiltPoliciesAPI.PrebuiltPolicies = new PrebuiltPoliciesAPI.PrebuiltPolicies(
    this._client,
  );

  /**
   * Create a new Catalog Sync (Closed Beta).
   */
  create(
    params: CatalogSyncCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncCreateResponse> {
    const { account_id, forwarded, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/cloud/catalog-syncs`, {
        body,
        ...options,
        headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
      }) as Core.APIPromise<{ result: CatalogSyncCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Catalog Sync (Closed Beta).
   */
  update(
    syncId: string,
    params: CatalogSyncUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CatalogSyncUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Catalog Syncs (Closed Beta).
   */
  list(
    params: CatalogSyncListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CatalogSyncListResponsesSinglePage, CatalogSyncListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/cloud/catalog-syncs`,
      CatalogSyncListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete a Catalog Sync (Closed Beta).
   */
  delete(
    syncId: string,
    params: CatalogSyncDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncDeleteResponse> {
    const { account_id, delete_destination } = params;
    return (
      this._client.delete(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
        query: { delete_destination },
        ...options,
      }) as Core.APIPromise<{ result: CatalogSyncDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Catalog Sync (Closed Beta).
   */
  edit(
    syncId: string,
    params: CatalogSyncEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CatalogSyncEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Read a Catalog Sync (Closed Beta).
   */
  get(
    syncId: string,
    params: CatalogSyncGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`,
        options,
      ) as Core.APIPromise<{ result: CatalogSyncGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Refresh a Catalog Sync's destination by running the sync policy against latest
   * resource catalog (Closed Beta).
   */
  refresh(
    syncId: string,
    params: CatalogSyncRefreshParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CatalogSyncRefreshResponse> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}/refresh`,
        options,
      ) as Core.APIPromise<{ result: CatalogSyncRefreshResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CatalogSyncListResponsesSinglePage extends SinglePage<CatalogSyncListResponse> {}

export interface CatalogSyncCreateResponse {
  id: string;

  description: string;

  destination_id: string;

  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  last_user_update_at: string;

  name: string;

  policy: string;

  update_mode: 'AUTO' | 'MANUAL';

  errors?: { [key: string]: CatalogSyncCreateResponse.Errors };

  includes_discoveries_until?: string;

  last_attempted_update_at?: string;

  last_successful_update_at?: string;
}

export namespace CatalogSyncCreateResponse {
  export interface Errors {
    code:
      | 1001
      | 1002
      | 1003
      | 1004
      | 1005
      | 1006
      | 1007
      | 1008
      | 1009
      | 1010
      | 1011
      | 1012
      | 1013
      | 1014
      | 1015
      | 1016
      | 1017
      | 2001
      | 2002
      | 2003
      | 2004
      | 2005
      | 2006
      | 2007
      | 2008
      | 2009
      | 2010
      | 2011
      | 2012
      | 2013
      | 2014
      | 2015
      | 2016
      | 2017
      | 2018
      | 2019
      | 2020
      | 2021
      | 2022
      | 3001
      | 3002
      | 3003
      | 3004
      | 3005
      | 3006
      | 3007
      | 4001
      | 4002
      | 4003
      | 4004
      | 4005
      | 4006
      | 4007
      | 4008
      | 4009
      | 4010
      | 4011
      | 4012
      | 4013
      | 4014
      | 4015
      | 4016
      | 4017
      | 4018
      | 4019
      | 4020
      | 4021
      | 4022
      | 4023
      | 5001
      | 5002
      | 5003
      | 5004
      | 102000
      | 102001
      | 102002
      | 102003
      | 102004
      | 102005
      | 102006
      | 102007
      | 102008
      | 102009
      | 102010
      | 102011
      | 102012
      | 102013
      | 102014
      | 102015
      | 102016
      | 102017
      | 102018
      | 102019
      | 102020
      | 102021
      | 102022
      | 102023
      | 102024
      | 102025
      | 102026
      | 102027
      | 102028
      | 102029
      | 102030
      | 102031
      | 102032
      | 102033
      | 102034
      | 102035
      | 102036
      | 102037
      | 102038
      | 102039
      | 102040
      | 102041
      | 102042
      | 102043
      | 102044
      | 102045
      | 102046
      | 102047
      | 102048
      | 102049
      | 102050
      | 102051
      | 102052
      | 102053
      | 102054
      | 102055
      | 102056
      | 102057
      | 102058
      | 102059
      | 102060
      | 102061
      | 102062
      | 102063
      | 102064
      | 102065
      | 102066
      | 103001
      | 103002
      | 103003
      | 103004
      | 103005
      | 103006
      | 103007
      | 103008;

    message: string;

    documentation_url?: string;

    meta?: Errors.Meta;

    source?: Errors.Source;
  }

  export namespace Errors {
    export interface Meta {
      l10n_key?: string;

      loggable_error?: string;

      template_data?: unknown;

      trace_id?: string;
    }

    export interface Source {
      parameter?: string;

      parameter_value_index?: number;

      pointer?: string;
    }
  }
}

export interface CatalogSyncUpdateResponse {
  id: string;

  description: string;

  destination_id: string;

  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  last_user_update_at: string;

  name: string;

  policy: string;

  update_mode: 'AUTO' | 'MANUAL';

  errors?: { [key: string]: CatalogSyncUpdateResponse.Errors };

  includes_discoveries_until?: string;

  last_attempted_update_at?: string;

  last_successful_update_at?: string;
}

export namespace CatalogSyncUpdateResponse {
  export interface Errors {
    code:
      | 1001
      | 1002
      | 1003
      | 1004
      | 1005
      | 1006
      | 1007
      | 1008
      | 1009
      | 1010
      | 1011
      | 1012
      | 1013
      | 1014
      | 1015
      | 1016
      | 1017
      | 2001
      | 2002
      | 2003
      | 2004
      | 2005
      | 2006
      | 2007
      | 2008
      | 2009
      | 2010
      | 2011
      | 2012
      | 2013
      | 2014
      | 2015
      | 2016
      | 2017
      | 2018
      | 2019
      | 2020
      | 2021
      | 2022
      | 3001
      | 3002
      | 3003
      | 3004
      | 3005
      | 3006
      | 3007
      | 4001
      | 4002
      | 4003
      | 4004
      | 4005
      | 4006
      | 4007
      | 4008
      | 4009
      | 4010
      | 4011
      | 4012
      | 4013
      | 4014
      | 4015
      | 4016
      | 4017
      | 4018
      | 4019
      | 4020
      | 4021
      | 4022
      | 4023
      | 5001
      | 5002
      | 5003
      | 5004
      | 102000
      | 102001
      | 102002
      | 102003
      | 102004
      | 102005
      | 102006
      | 102007
      | 102008
      | 102009
      | 102010
      | 102011
      | 102012
      | 102013
      | 102014
      | 102015
      | 102016
      | 102017
      | 102018
      | 102019
      | 102020
      | 102021
      | 102022
      | 102023
      | 102024
      | 102025
      | 102026
      | 102027
      | 102028
      | 102029
      | 102030
      | 102031
      | 102032
      | 102033
      | 102034
      | 102035
      | 102036
      | 102037
      | 102038
      | 102039
      | 102040
      | 102041
      | 102042
      | 102043
      | 102044
      | 102045
      | 102046
      | 102047
      | 102048
      | 102049
      | 102050
      | 102051
      | 102052
      | 102053
      | 102054
      | 102055
      | 102056
      | 102057
      | 102058
      | 102059
      | 102060
      | 102061
      | 102062
      | 102063
      | 102064
      | 102065
      | 102066
      | 103001
      | 103002
      | 103003
      | 103004
      | 103005
      | 103006
      | 103007
      | 103008;

    message: string;

    documentation_url?: string;

    meta?: Errors.Meta;

    source?: Errors.Source;
  }

  export namespace Errors {
    export interface Meta {
      l10n_key?: string;

      loggable_error?: string;

      template_data?: unknown;

      trace_id?: string;
    }

    export interface Source {
      parameter?: string;

      parameter_value_index?: number;

      pointer?: string;
    }
  }
}

export interface CatalogSyncListResponse {
  id: string;

  description: string;

  destination_id: string;

  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  last_user_update_at: string;

  name: string;

  policy: string;

  update_mode: 'AUTO' | 'MANUAL';

  errors?: { [key: string]: CatalogSyncListResponse.Errors };

  includes_discoveries_until?: string;

  last_attempted_update_at?: string;

  last_successful_update_at?: string;
}

export namespace CatalogSyncListResponse {
  export interface Errors {
    code:
      | 1001
      | 1002
      | 1003
      | 1004
      | 1005
      | 1006
      | 1007
      | 1008
      | 1009
      | 1010
      | 1011
      | 1012
      | 1013
      | 1014
      | 1015
      | 1016
      | 1017
      | 2001
      | 2002
      | 2003
      | 2004
      | 2005
      | 2006
      | 2007
      | 2008
      | 2009
      | 2010
      | 2011
      | 2012
      | 2013
      | 2014
      | 2015
      | 2016
      | 2017
      | 2018
      | 2019
      | 2020
      | 2021
      | 2022
      | 3001
      | 3002
      | 3003
      | 3004
      | 3005
      | 3006
      | 3007
      | 4001
      | 4002
      | 4003
      | 4004
      | 4005
      | 4006
      | 4007
      | 4008
      | 4009
      | 4010
      | 4011
      | 4012
      | 4013
      | 4014
      | 4015
      | 4016
      | 4017
      | 4018
      | 4019
      | 4020
      | 4021
      | 4022
      | 4023
      | 5001
      | 5002
      | 5003
      | 5004
      | 102000
      | 102001
      | 102002
      | 102003
      | 102004
      | 102005
      | 102006
      | 102007
      | 102008
      | 102009
      | 102010
      | 102011
      | 102012
      | 102013
      | 102014
      | 102015
      | 102016
      | 102017
      | 102018
      | 102019
      | 102020
      | 102021
      | 102022
      | 102023
      | 102024
      | 102025
      | 102026
      | 102027
      | 102028
      | 102029
      | 102030
      | 102031
      | 102032
      | 102033
      | 102034
      | 102035
      | 102036
      | 102037
      | 102038
      | 102039
      | 102040
      | 102041
      | 102042
      | 102043
      | 102044
      | 102045
      | 102046
      | 102047
      | 102048
      | 102049
      | 102050
      | 102051
      | 102052
      | 102053
      | 102054
      | 102055
      | 102056
      | 102057
      | 102058
      | 102059
      | 102060
      | 102061
      | 102062
      | 102063
      | 102064
      | 102065
      | 102066
      | 103001
      | 103002
      | 103003
      | 103004
      | 103005
      | 103006
      | 103007
      | 103008;

    message: string;

    documentation_url?: string;

    meta?: Errors.Meta;

    source?: Errors.Source;
  }

  export namespace Errors {
    export interface Meta {
      l10n_key?: string;

      loggable_error?: string;

      template_data?: unknown;

      trace_id?: string;
    }

    export interface Source {
      parameter?: string;

      parameter_value_index?: number;

      pointer?: string;
    }
  }
}

export interface CatalogSyncDeleteResponse {
  id: string;
}

export interface CatalogSyncEditResponse {
  id: string;

  description: string;

  destination_id: string;

  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  last_user_update_at: string;

  name: string;

  policy: string;

  update_mode: 'AUTO' | 'MANUAL';

  errors?: { [key: string]: CatalogSyncEditResponse.Errors };

  includes_discoveries_until?: string;

  last_attempted_update_at?: string;

  last_successful_update_at?: string;
}

export namespace CatalogSyncEditResponse {
  export interface Errors {
    code:
      | 1001
      | 1002
      | 1003
      | 1004
      | 1005
      | 1006
      | 1007
      | 1008
      | 1009
      | 1010
      | 1011
      | 1012
      | 1013
      | 1014
      | 1015
      | 1016
      | 1017
      | 2001
      | 2002
      | 2003
      | 2004
      | 2005
      | 2006
      | 2007
      | 2008
      | 2009
      | 2010
      | 2011
      | 2012
      | 2013
      | 2014
      | 2015
      | 2016
      | 2017
      | 2018
      | 2019
      | 2020
      | 2021
      | 2022
      | 3001
      | 3002
      | 3003
      | 3004
      | 3005
      | 3006
      | 3007
      | 4001
      | 4002
      | 4003
      | 4004
      | 4005
      | 4006
      | 4007
      | 4008
      | 4009
      | 4010
      | 4011
      | 4012
      | 4013
      | 4014
      | 4015
      | 4016
      | 4017
      | 4018
      | 4019
      | 4020
      | 4021
      | 4022
      | 4023
      | 5001
      | 5002
      | 5003
      | 5004
      | 102000
      | 102001
      | 102002
      | 102003
      | 102004
      | 102005
      | 102006
      | 102007
      | 102008
      | 102009
      | 102010
      | 102011
      | 102012
      | 102013
      | 102014
      | 102015
      | 102016
      | 102017
      | 102018
      | 102019
      | 102020
      | 102021
      | 102022
      | 102023
      | 102024
      | 102025
      | 102026
      | 102027
      | 102028
      | 102029
      | 102030
      | 102031
      | 102032
      | 102033
      | 102034
      | 102035
      | 102036
      | 102037
      | 102038
      | 102039
      | 102040
      | 102041
      | 102042
      | 102043
      | 102044
      | 102045
      | 102046
      | 102047
      | 102048
      | 102049
      | 102050
      | 102051
      | 102052
      | 102053
      | 102054
      | 102055
      | 102056
      | 102057
      | 102058
      | 102059
      | 102060
      | 102061
      | 102062
      | 102063
      | 102064
      | 102065
      | 102066
      | 103001
      | 103002
      | 103003
      | 103004
      | 103005
      | 103006
      | 103007
      | 103008;

    message: string;

    documentation_url?: string;

    meta?: Errors.Meta;

    source?: Errors.Source;
  }

  export namespace Errors {
    export interface Meta {
      l10n_key?: string;

      loggable_error?: string;

      template_data?: unknown;

      trace_id?: string;
    }

    export interface Source {
      parameter?: string;

      parameter_value_index?: number;

      pointer?: string;
    }
  }
}

export interface CatalogSyncGetResponse {
  id: string;

  description: string;

  destination_id: string;

  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  last_user_update_at: string;

  name: string;

  policy: string;

  update_mode: 'AUTO' | 'MANUAL';

  errors?: { [key: string]: CatalogSyncGetResponse.Errors };

  includes_discoveries_until?: string;

  last_attempted_update_at?: string;

  last_successful_update_at?: string;
}

export namespace CatalogSyncGetResponse {
  export interface Errors {
    code:
      | 1001
      | 1002
      | 1003
      | 1004
      | 1005
      | 1006
      | 1007
      | 1008
      | 1009
      | 1010
      | 1011
      | 1012
      | 1013
      | 1014
      | 1015
      | 1016
      | 1017
      | 2001
      | 2002
      | 2003
      | 2004
      | 2005
      | 2006
      | 2007
      | 2008
      | 2009
      | 2010
      | 2011
      | 2012
      | 2013
      | 2014
      | 2015
      | 2016
      | 2017
      | 2018
      | 2019
      | 2020
      | 2021
      | 2022
      | 3001
      | 3002
      | 3003
      | 3004
      | 3005
      | 3006
      | 3007
      | 4001
      | 4002
      | 4003
      | 4004
      | 4005
      | 4006
      | 4007
      | 4008
      | 4009
      | 4010
      | 4011
      | 4012
      | 4013
      | 4014
      | 4015
      | 4016
      | 4017
      | 4018
      | 4019
      | 4020
      | 4021
      | 4022
      | 4023
      | 5001
      | 5002
      | 5003
      | 5004
      | 102000
      | 102001
      | 102002
      | 102003
      | 102004
      | 102005
      | 102006
      | 102007
      | 102008
      | 102009
      | 102010
      | 102011
      | 102012
      | 102013
      | 102014
      | 102015
      | 102016
      | 102017
      | 102018
      | 102019
      | 102020
      | 102021
      | 102022
      | 102023
      | 102024
      | 102025
      | 102026
      | 102027
      | 102028
      | 102029
      | 102030
      | 102031
      | 102032
      | 102033
      | 102034
      | 102035
      | 102036
      | 102037
      | 102038
      | 102039
      | 102040
      | 102041
      | 102042
      | 102043
      | 102044
      | 102045
      | 102046
      | 102047
      | 102048
      | 102049
      | 102050
      | 102051
      | 102052
      | 102053
      | 102054
      | 102055
      | 102056
      | 102057
      | 102058
      | 102059
      | 102060
      | 102061
      | 102062
      | 102063
      | 102064
      | 102065
      | 102066
      | 103001
      | 103002
      | 103003
      | 103004
      | 103005
      | 103006
      | 103007
      | 103008;

    message: string;

    documentation_url?: string;

    meta?: Errors.Meta;

    source?: Errors.Source;
  }

  export namespace Errors {
    export interface Meta {
      l10n_key?: string;

      loggable_error?: string;

      template_data?: unknown;

      trace_id?: string;
    }

    export interface Source {
      parameter?: string;

      parameter_value_index?: number;

      pointer?: string;
    }
  }
}

export type CatalogSyncRefreshResponse = string;

export interface CatalogSyncCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  destination_type: 'NONE' | 'ZERO_TRUST_LIST';

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  update_mode: 'AUTO' | 'MANUAL';

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  policy?: string;

  /**
   * Header param:
   */
  forwarded?: string;
}

export interface CatalogSyncUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  policy?: string;

  /**
   * Body param:
   */
  update_mode?: 'AUTO' | 'MANUAL';
}

export interface CatalogSyncListParams {
  account_id: string;
}

export interface CatalogSyncDeleteParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  delete_destination?: boolean;
}

export interface CatalogSyncEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  policy?: string;

  /**
   * Body param:
   */
  update_mode?: 'AUTO' | 'MANUAL';
}

export interface CatalogSyncGetParams {
  account_id: string;
}

export interface CatalogSyncRefreshParams {
  account_id: string;
}

CatalogSyncs.CatalogSyncListResponsesSinglePage = CatalogSyncListResponsesSinglePage;
CatalogSyncs.PrebuiltPolicies = PrebuiltPolicies;
CatalogSyncs.PrebuiltPolicyListResponsesSinglePage = PrebuiltPolicyListResponsesSinglePage;

export declare namespace CatalogSyncs {
  export {
    type CatalogSyncCreateResponse as CatalogSyncCreateResponse,
    type CatalogSyncUpdateResponse as CatalogSyncUpdateResponse,
    type CatalogSyncListResponse as CatalogSyncListResponse,
    type CatalogSyncDeleteResponse as CatalogSyncDeleteResponse,
    type CatalogSyncEditResponse as CatalogSyncEditResponse,
    type CatalogSyncGetResponse as CatalogSyncGetResponse,
    type CatalogSyncRefreshResponse as CatalogSyncRefreshResponse,
    CatalogSyncListResponsesSinglePage as CatalogSyncListResponsesSinglePage,
    type CatalogSyncCreateParams as CatalogSyncCreateParams,
    type CatalogSyncUpdateParams as CatalogSyncUpdateParams,
    type CatalogSyncListParams as CatalogSyncListParams,
    type CatalogSyncDeleteParams as CatalogSyncDeleteParams,
    type CatalogSyncEditParams as CatalogSyncEditParams,
    type CatalogSyncGetParams as CatalogSyncGetParams,
    type CatalogSyncRefreshParams as CatalogSyncRefreshParams,
  };

  export {
    PrebuiltPolicies as PrebuiltPolicies,
    type PrebuiltPolicyListResponse as PrebuiltPolicyListResponse,
    PrebuiltPolicyListResponsesSinglePage as PrebuiltPolicyListResponsesSinglePage,
    type PrebuiltPolicyListParams as PrebuiltPolicyListParams,
  };
}
