// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class CloudIntegrations extends APIResource {
  /**
   * Create a new Cloud Integration (Closed Beta).
   */
  create(
    params: CloudIntegrationCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationCreateResponse> {
    const { account_id, forwarded, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/cloud/providers`, {
        body,
        ...options,
        headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
      }) as Core.APIPromise<{ result: CloudIntegrationCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Cloud Integration (Closed Beta).
   */
  update(
    providerId: string,
    params: CloudIntegrationUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CloudIntegrationUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Cloud Integrations (Closed Beta).
   */
  list(
    params: CloudIntegrationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CloudIntegrationListResponsesSinglePage, CloudIntegrationListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/cloud/providers`,
      CloudIntegrationListResponsesSinglePage,
      { query, ...options },
    );
  }

  /**
   * Delete a Cloud Integration (Closed Beta).
   */
  delete(
    providerId: string,
    params: CloudIntegrationDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/magic/cloud/providers/${providerId}`,
        options,
      ) as Core.APIPromise<{ result: CloudIntegrationDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Run discovery for a Cloud Integration (Closed Beta).
   */
  discover(
    providerId: string,
    params: CloudIntegrationDiscoverParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationDiscoverResponse> {
    const { account_id, v2 } = params;
    return this._client.post(`/accounts/${account_id}/magic/cloud/providers/${providerId}/discover`, {
      query: { v2 },
      ...options,
    });
  }

  /**
   * Run discovery for all Cloud Integrations in an account (Closed Beta).
   */
  discoverAll(
    params: CloudIntegrationDiscoverAllParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationDiscoverAllResponse> {
    const { account_id } = params;
    return this._client.post(`/accounts/${account_id}/magic/cloud/providers/discover`, options);
  }

  /**
   * Update a Cloud Integration (Closed Beta).
   */
  edit(
    providerId: string,
    params: CloudIntegrationEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: CloudIntegrationEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Read a Cloud Integration (Closed Beta).
   */
  get(
    providerId: string,
    params: CloudIntegrationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationGetResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: CloudIntegrationGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get initial configuration to complete Cloud Integration setup (Closed Beta).
   */
  initialSetup(
    providerId: string,
    params: CloudIntegrationInitialSetupParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<CloudIntegrationInitialSetupResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/cloud/providers/${providerId}/initial_setup`,
        options,
      ) as Core.APIPromise<{ result: CloudIntegrationInitialSetupResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class CloudIntegrationListResponsesSinglePage extends SinglePage<CloudIntegrationListResponse> {}

export interface CloudIntegrationCreateResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  friendly_name: string;

  last_updated: string;

  lifecycle_state: 'ACTIVE' | 'PENDING_SETUP' | 'RETIRED';

  state: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  state_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  aws_arn?: string;

  azure_subscription_id?: string;

  azure_tenant_id?: string;

  description?: string;

  gcp_project_id?: string;

  gcp_service_account_email?: string;

  status?: CloudIntegrationCreateResponse.Status;
}

export namespace CloudIntegrationCreateResponse {
  export interface Status {
    discovery_progress: Status.DiscoveryProgress;

    discovery_progress_v2: Status.DiscoveryProgressV2;

    last_discovery_status: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    last_discovery_status_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    regions: Array<string>;

    credentials_good_since?: string;

    credentials_missing_since?: string;

    credentials_rejected_since?: string;

    discovery_message?: string;

    discovery_message_v2?: string;

    in_use_by?: Array<Status.InUseBy>;

    last_discovery_completed_at?: string;

    last_discovery_completed_at_v2?: string;

    last_discovery_started_at?: string;

    last_discovery_started_at_v2?: string;

    last_updated?: string;
  }

  export namespace Status {
    export interface DiscoveryProgress {
      done: number;

      total: number;

      unit: string;
    }

    export interface DiscoveryProgressV2 {
      done: number;

      total: number;

      unit: string;
    }

    export interface InUseBy {
      id: string;

      client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

      name: string;
    }
  }
}

export interface CloudIntegrationUpdateResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  friendly_name: string;

  last_updated: string;

  lifecycle_state: 'ACTIVE' | 'PENDING_SETUP' | 'RETIRED';

  state: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  state_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  aws_arn?: string;

  azure_subscription_id?: string;

  azure_tenant_id?: string;

  description?: string;

  gcp_project_id?: string;

  gcp_service_account_email?: string;

  status?: CloudIntegrationUpdateResponse.Status;
}

export namespace CloudIntegrationUpdateResponse {
  export interface Status {
    discovery_progress: Status.DiscoveryProgress;

    discovery_progress_v2: Status.DiscoveryProgressV2;

    last_discovery_status: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    last_discovery_status_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    regions: Array<string>;

    credentials_good_since?: string;

    credentials_missing_since?: string;

    credentials_rejected_since?: string;

    discovery_message?: string;

    discovery_message_v2?: string;

    in_use_by?: Array<Status.InUseBy>;

    last_discovery_completed_at?: string;

    last_discovery_completed_at_v2?: string;

    last_discovery_started_at?: string;

    last_discovery_started_at_v2?: string;

    last_updated?: string;
  }

  export namespace Status {
    export interface DiscoveryProgress {
      done: number;

      total: number;

      unit: string;
    }

    export interface DiscoveryProgressV2 {
      done: number;

      total: number;

      unit: string;
    }

    export interface InUseBy {
      id: string;

      client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

      name: string;
    }
  }
}

export interface CloudIntegrationListResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  friendly_name: string;

  last_updated: string;

  lifecycle_state: 'ACTIVE' | 'PENDING_SETUP' | 'RETIRED';

  state: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  state_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  aws_arn?: string;

  azure_subscription_id?: string;

  azure_tenant_id?: string;

  description?: string;

  gcp_project_id?: string;

  gcp_service_account_email?: string;

  status?: CloudIntegrationListResponse.Status;
}

export namespace CloudIntegrationListResponse {
  export interface Status {
    discovery_progress: Status.DiscoveryProgress;

    discovery_progress_v2: Status.DiscoveryProgressV2;

    last_discovery_status: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    last_discovery_status_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    regions: Array<string>;

    credentials_good_since?: string;

    credentials_missing_since?: string;

    credentials_rejected_since?: string;

    discovery_message?: string;

    discovery_message_v2?: string;

    in_use_by?: Array<Status.InUseBy>;

    last_discovery_completed_at?: string;

    last_discovery_completed_at_v2?: string;

    last_discovery_started_at?: string;

    last_discovery_started_at_v2?: string;

    last_updated?: string;
  }

  export namespace Status {
    export interface DiscoveryProgress {
      done: number;

      total: number;

      unit: string;
    }

    export interface DiscoveryProgressV2 {
      done: number;

      total: number;

      unit: string;
    }

    export interface InUseBy {
      id: string;

      client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

      name: string;
    }
  }
}

export interface CloudIntegrationDeleteResponse {
  id: string;
}

export interface CloudIntegrationDiscoverResponse {
  errors: Array<CloudIntegrationDiscoverResponse.Error>;

  messages: Array<CloudIntegrationDiscoverResponse.Message>;

  success: boolean;
}

export namespace CloudIntegrationDiscoverResponse {
  export interface Error {
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

    meta?: Error.Meta;

    source?: Error.Source;
  }

  export namespace Error {
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

  export interface Message {
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

    meta?: Message.Meta;

    source?: Message.Source;
  }

  export namespace Message {
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

export interface CloudIntegrationDiscoverAllResponse {
  errors: Array<CloudIntegrationDiscoverAllResponse.Error>;

  messages: Array<CloudIntegrationDiscoverAllResponse.Message>;

  success: boolean;
}

export namespace CloudIntegrationDiscoverAllResponse {
  export interface Error {
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

    meta?: Error.Meta;

    source?: Error.Source;
  }

  export namespace Error {
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

  export interface Message {
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

    meta?: Message.Meta;

    source?: Message.Source;
  }

  export namespace Message {
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

export interface CloudIntegrationEditResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  friendly_name: string;

  last_updated: string;

  lifecycle_state: 'ACTIVE' | 'PENDING_SETUP' | 'RETIRED';

  state: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  state_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  aws_arn?: string;

  azure_subscription_id?: string;

  azure_tenant_id?: string;

  description?: string;

  gcp_project_id?: string;

  gcp_service_account_email?: string;

  status?: CloudIntegrationEditResponse.Status;
}

export namespace CloudIntegrationEditResponse {
  export interface Status {
    discovery_progress: Status.DiscoveryProgress;

    discovery_progress_v2: Status.DiscoveryProgressV2;

    last_discovery_status: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    last_discovery_status_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    regions: Array<string>;

    credentials_good_since?: string;

    credentials_missing_since?: string;

    credentials_rejected_since?: string;

    discovery_message?: string;

    discovery_message_v2?: string;

    in_use_by?: Array<Status.InUseBy>;

    last_discovery_completed_at?: string;

    last_discovery_completed_at_v2?: string;

    last_discovery_started_at?: string;

    last_discovery_started_at_v2?: string;

    last_updated?: string;
  }

  export namespace Status {
    export interface DiscoveryProgress {
      done: number;

      total: number;

      unit: string;
    }

    export interface DiscoveryProgressV2 {
      done: number;

      total: number;

      unit: string;
    }

    export interface InUseBy {
      id: string;

      client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

      name: string;
    }
  }
}

export interface CloudIntegrationGetResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  friendly_name: string;

  last_updated: string;

  lifecycle_state: 'ACTIVE' | 'PENDING_SETUP' | 'RETIRED';

  state: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  state_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

  aws_arn?: string;

  azure_subscription_id?: string;

  azure_tenant_id?: string;

  description?: string;

  gcp_project_id?: string;

  gcp_service_account_email?: string;

  status?: CloudIntegrationGetResponse.Status;
}

export namespace CloudIntegrationGetResponse {
  export interface Status {
    discovery_progress: Status.DiscoveryProgress;

    discovery_progress_v2: Status.DiscoveryProgressV2;

    last_discovery_status: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    last_discovery_status_v2: 'UNSPECIFIED' | 'PENDING' | 'DISCOVERING' | 'FAILED' | 'SUCCEEDED';

    regions: Array<string>;

    credentials_good_since?: string;

    credentials_missing_since?: string;

    credentials_rejected_since?: string;

    discovery_message?: string;

    discovery_message_v2?: string;

    in_use_by?: Array<Status.InUseBy>;

    last_discovery_completed_at?: string;

    last_discovery_completed_at_v2?: string;

    last_discovery_started_at?: string;

    last_discovery_started_at_v2?: string;

    last_updated?: string;
  }

  export namespace Status {
    export interface DiscoveryProgress {
      done: number;

      total: number;

      unit: string;
    }

    export interface DiscoveryProgressV2 {
      done: number;

      total: number;

      unit: string;
    }

    export interface InUseBy {
      id: string;

      client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

      name: string;
    }
  }
}

export type CloudIntegrationInitialSetupResponse =
  | CloudIntegrationInitialSetupResponse.McnAwsTrustPolicy
  | CloudIntegrationInitialSetupResponse.McnAzureSetup
  | CloudIntegrationInitialSetupResponse.McnGcpSetup;

export namespace CloudIntegrationInitialSetupResponse {
  export interface McnAwsTrustPolicy {
    aws_trust_policy: string;

    item_type: string;
  }

  export interface McnAzureSetup {
    azure_consent_url: string;

    integration_identity_tag: string;

    item_type: string;

    tag_cli_command: string;
  }

  export interface McnGcpSetup {
    integration_identity_tag: string;

    item_type: string;

    tag_cli_command: string;
  }
}

export interface CloudIntegrationCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  /**
   * Body param:
   */
  friendly_name: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Header param:
   */
  forwarded?: string;
}

export interface CloudIntegrationUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  aws_arn?: string;

  /**
   * Body param:
   */
  azure_subscription_id?: string;

  /**
   * Body param:
   */
  azure_tenant_id?: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  friendly_name?: string;

  /**
   * Body param:
   */
  gcp_project_id?: string;

  /**
   * Body param:
   */
  gcp_service_account_email?: string;
}

export interface CloudIntegrationListParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  cloudflare?: boolean;

  /**
   * Query param:
   */
  desc?: boolean;

  /**
   * Query param: One of ["updated_at", "id", "cloud_type", "name"].
   */
  order_by?: string;

  /**
   * Query param:
   */
  status?: boolean;
}

export interface CloudIntegrationDeleteParams {
  account_id: string;
}

export interface CloudIntegrationDiscoverParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  v2?: boolean;
}

export interface CloudIntegrationDiscoverAllParams {
  account_id: string;
}

export interface CloudIntegrationEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  aws_arn?: string;

  /**
   * Body param:
   */
  azure_subscription_id?: string;

  /**
   * Body param:
   */
  azure_tenant_id?: string;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  friendly_name?: string;

  /**
   * Body param:
   */
  gcp_project_id?: string;

  /**
   * Body param:
   */
  gcp_service_account_email?: string;
}

export interface CloudIntegrationGetParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  status?: boolean;
}

export interface CloudIntegrationInitialSetupParams {
  account_id: string;
}

CloudIntegrations.CloudIntegrationListResponsesSinglePage = CloudIntegrationListResponsesSinglePage;

export declare namespace CloudIntegrations {
  export {
    type CloudIntegrationCreateResponse as CloudIntegrationCreateResponse,
    type CloudIntegrationUpdateResponse as CloudIntegrationUpdateResponse,
    type CloudIntegrationListResponse as CloudIntegrationListResponse,
    type CloudIntegrationDeleteResponse as CloudIntegrationDeleteResponse,
    type CloudIntegrationDiscoverResponse as CloudIntegrationDiscoverResponse,
    type CloudIntegrationDiscoverAllResponse as CloudIntegrationDiscoverAllResponse,
    type CloudIntegrationEditResponse as CloudIntegrationEditResponse,
    type CloudIntegrationGetResponse as CloudIntegrationGetResponse,
    type CloudIntegrationInitialSetupResponse as CloudIntegrationInitialSetupResponse,
    CloudIntegrationListResponsesSinglePage as CloudIntegrationListResponsesSinglePage,
    type CloudIntegrationCreateParams as CloudIntegrationCreateParams,
    type CloudIntegrationUpdateParams as CloudIntegrationUpdateParams,
    type CloudIntegrationListParams as CloudIntegrationListParams,
    type CloudIntegrationDeleteParams as CloudIntegrationDeleteParams,
    type CloudIntegrationDiscoverParams as CloudIntegrationDiscoverParams,
    type CloudIntegrationDiscoverAllParams as CloudIntegrationDiscoverAllParams,
    type CloudIntegrationEditParams as CloudIntegrationEditParams,
    type CloudIntegrationGetParams as CloudIntegrationGetParams,
    type CloudIntegrationInitialSetupParams as CloudIntegrationInitialSetupParams,
  };
}
