// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';
import { type Response } from '../../_shims/index';

export class Resources extends APIResource {
  /**
   * List resources in the Resource Catalog (Closed Beta).
   */
  list(
    params: ResourceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ResourceListResponsesV4PagePaginationArray, ResourceListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/cloud/resources`,
      ResourceListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Export resources in the Resource Catalog as a JSON file (Closed Beta).
   */
  export(params: ResourceExportParams, options?: Core.RequestOptions): Core.APIPromise<Response> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/magic/cloud/resources/export`, {
      query,
      ...options,
      headers: { Accept: 'application/octet-stream', ...options?.headers },
      __binaryResponse: true,
    });
  }

  /**
   * Read an resource from the Resource Catalog (Closed Beta).
   */
  get(
    resourceId: string,
    params: ResourceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourceGetResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/cloud/resources/${resourceId}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ResourceGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Preview Rego query result against the latest resource catalog (Closed Beta).
   */
  policyPreview(
    params: ResourcePolicyPreviewParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ResourcePolicyPreviewResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/cloud/resources/policy-preview`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ResourcePolicyPreviewResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class ResourceListResponsesV4PagePaginationArray extends V4PagePaginationArray<ResourceListResponse> {}

export interface ResourceListResponse {
  id: string;

  account_id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  config: { [key: string]: unknown };

  deployment_provider: string;

  managed: boolean;

  monthly_cost_estimate: ResourceListResponse.MonthlyCostEstimate;

  name: string;

  native_id: string;

  observations: { [key: string]: ResourceListResponse.Observations };

  provider_ids: Array<string>;

  provider_names_by_id: { [key: string]: string };

  region: string;

  resource_group: string;

  resource_type:
    | 'aws_customer_gateway'
    | 'aws_egress_only_internet_gateway'
    | 'aws_internet_gateway'
    | 'aws_instance'
    | 'aws_network_interface'
    | 'aws_route'
    | 'aws_route_table'
    | 'aws_route_table_association'
    | 'aws_subnet'
    | 'aws_vpc'
    | 'aws_vpc_ipv4_cidr_block_association'
    | 'aws_vpn_connection'
    | 'aws_vpn_connection_route'
    | 'aws_vpn_gateway'
    | 'aws_security_group'
    | 'aws_vpc_security_group_ingress_rule'
    | 'aws_vpc_security_group_egress_rule'
    | 'aws_ec2_managed_prefix_list'
    | 'aws_ec2_transit_gateway'
    | 'aws_ec2_transit_gateway_prefix_list_reference'
    | 'aws_ec2_transit_gateway_vpc_attachment'
    | 'azurerm_application_security_group'
    | 'azurerm_lb'
    | 'azurerm_lb_backend_address_pool'
    | 'azurerm_lb_nat_pool'
    | 'azurerm_lb_nat_rule'
    | 'azurerm_lb_rule'
    | 'azurerm_local_network_gateway'
    | 'azurerm_network_interface'
    | 'azurerm_network_interface_application_security_group_association'
    | 'azurerm_network_interface_backend_address_pool_association'
    | 'azurerm_network_interface_security_group_association'
    | 'azurerm_network_security_group'
    | 'azurerm_public_ip'
    | 'azurerm_route'
    | 'azurerm_route_table'
    | 'azurerm_subnet'
    | 'azurerm_subnet_route_table_association'
    | 'azurerm_virtual_machine'
    | 'azurerm_virtual_network_gateway_connection'
    | 'azurerm_virtual_network'
    | 'azurerm_virtual_network_gateway'
    | 'google_compute_network'
    | 'google_compute_subnetwork'
    | 'google_compute_vpn_gateway'
    | 'google_compute_vpn_tunnel'
    | 'google_compute_route'
    | 'google_compute_address'
    | 'google_compute_global_address'
    | 'google_compute_router'
    | 'google_compute_interconnect_attachment'
    | 'google_compute_ha_vpn_gateway'
    | 'google_compute_forwarding_rule'
    | 'google_compute_network_firewall_policy'
    | 'google_compute_network_firewall_policy_rule'
    | 'cloudflare_static_route'
    | 'cloudflare_ipsec_tunnel';

  sections: Array<ResourceListResponse.Section>;

  state: { [key: string]: unknown };

  tags: { [key: string]: string };

  updated_at: string;

  url: string;

  managed_by?: Array<ResourceListResponse.ManagedBy>;
}

export namespace ResourceListResponse {
  export interface MonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface Observations {
    first_observed_at: string;

    last_observed_at: string;

    provider_id: string;

    resource_id: string;
  }

  export interface Section {
    hidden_items: Array<Section.HiddenItem>;

    name: string;

    visible_items: Array<Section.VisibleItem>;

    help_text?: string;
  }

  export namespace Section {
    export interface HiddenItem {
      helpText?: string;

      name?: string;

      value?:
        | HiddenItem.McnStringItem
        | HiddenItem.McnYamlItem
        | HiddenItem.McnYamlDiffItem
        | HiddenItem.McnResourcePreviewItem
        | HiddenItem.McnListItem;
    }

    export namespace HiddenItem {
      export interface McnStringItem {
        item_type: string;

        string: string;
      }

      export interface McnYamlItem {
        item_type: string;

        yaml: string;
      }

      export interface McnYamlDiffItem {
        item_type: string;

        yaml_diff: McnYamlDiffItem.YamlDiff;
      }

      export namespace McnYamlDiffItem {
        export interface YamlDiff {
          diff: string;

          left_description: string;

          left_yaml: string;

          right_description: string;

          right_yaml: string;
        }
      }

      export interface McnResourcePreviewItem {
        item_type: string;

        resource_preview: McnResourcePreviewItem.ResourcePreview;
      }

      export namespace McnResourcePreviewItem {
        export interface ResourcePreview {
          id: string;

          cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

          detail: string;

          name: string;

          resource_type:
            | 'aws_customer_gateway'
            | 'aws_egress_only_internet_gateway'
            | 'aws_internet_gateway'
            | 'aws_instance'
            | 'aws_network_interface'
            | 'aws_route'
            | 'aws_route_table'
            | 'aws_route_table_association'
            | 'aws_subnet'
            | 'aws_vpc'
            | 'aws_vpc_ipv4_cidr_block_association'
            | 'aws_vpn_connection'
            | 'aws_vpn_connection_route'
            | 'aws_vpn_gateway'
            | 'aws_security_group'
            | 'aws_vpc_security_group_ingress_rule'
            | 'aws_vpc_security_group_egress_rule'
            | 'aws_ec2_managed_prefix_list'
            | 'aws_ec2_transit_gateway'
            | 'aws_ec2_transit_gateway_prefix_list_reference'
            | 'aws_ec2_transit_gateway_vpc_attachment'
            | 'azurerm_application_security_group'
            | 'azurerm_lb'
            | 'azurerm_lb_backend_address_pool'
            | 'azurerm_lb_nat_pool'
            | 'azurerm_lb_nat_rule'
            | 'azurerm_lb_rule'
            | 'azurerm_local_network_gateway'
            | 'azurerm_network_interface'
            | 'azurerm_network_interface_application_security_group_association'
            | 'azurerm_network_interface_backend_address_pool_association'
            | 'azurerm_network_interface_security_group_association'
            | 'azurerm_network_security_group'
            | 'azurerm_public_ip'
            | 'azurerm_route'
            | 'azurerm_route_table'
            | 'azurerm_subnet'
            | 'azurerm_subnet_route_table_association'
            | 'azurerm_virtual_machine'
            | 'azurerm_virtual_network_gateway_connection'
            | 'azurerm_virtual_network'
            | 'azurerm_virtual_network_gateway'
            | 'google_compute_network'
            | 'google_compute_subnetwork'
            | 'google_compute_vpn_gateway'
            | 'google_compute_vpn_tunnel'
            | 'google_compute_route'
            | 'google_compute_address'
            | 'google_compute_global_address'
            | 'google_compute_router'
            | 'google_compute_interconnect_attachment'
            | 'google_compute_ha_vpn_gateway'
            | 'google_compute_forwarding_rule'
            | 'google_compute_network_firewall_policy'
            | 'google_compute_network_firewall_policy_rule'
            | 'cloudflare_static_route'
            | 'cloudflare_ipsec_tunnel';

          title: string;
        }
      }

      export interface McnListItem {
        item_type: string;

        list: Array<McnListItem.McnStringItem | McnListItem.McnResourcePreviewItem>;
      }

      export namespace McnListItem {
        export interface McnStringItem {
          item_type: string;

          string: string;
        }

        export interface McnResourcePreviewItem {
          item_type: string;

          resource_preview: McnResourcePreviewItem.ResourcePreview;
        }

        export namespace McnResourcePreviewItem {
          export interface ResourcePreview {
            id: string;

            cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

            detail: string;

            name: string;

            resource_type:
              | 'aws_customer_gateway'
              | 'aws_egress_only_internet_gateway'
              | 'aws_internet_gateway'
              | 'aws_instance'
              | 'aws_network_interface'
              | 'aws_route'
              | 'aws_route_table'
              | 'aws_route_table_association'
              | 'aws_subnet'
              | 'aws_vpc'
              | 'aws_vpc_ipv4_cidr_block_association'
              | 'aws_vpn_connection'
              | 'aws_vpn_connection_route'
              | 'aws_vpn_gateway'
              | 'aws_security_group'
              | 'aws_vpc_security_group_ingress_rule'
              | 'aws_vpc_security_group_egress_rule'
              | 'aws_ec2_managed_prefix_list'
              | 'aws_ec2_transit_gateway'
              | 'aws_ec2_transit_gateway_prefix_list_reference'
              | 'aws_ec2_transit_gateway_vpc_attachment'
              | 'azurerm_application_security_group'
              | 'azurerm_lb'
              | 'azurerm_lb_backend_address_pool'
              | 'azurerm_lb_nat_pool'
              | 'azurerm_lb_nat_rule'
              | 'azurerm_lb_rule'
              | 'azurerm_local_network_gateway'
              | 'azurerm_network_interface'
              | 'azurerm_network_interface_application_security_group_association'
              | 'azurerm_network_interface_backend_address_pool_association'
              | 'azurerm_network_interface_security_group_association'
              | 'azurerm_network_security_group'
              | 'azurerm_public_ip'
              | 'azurerm_route'
              | 'azurerm_route_table'
              | 'azurerm_subnet'
              | 'azurerm_subnet_route_table_association'
              | 'azurerm_virtual_machine'
              | 'azurerm_virtual_network_gateway_connection'
              | 'azurerm_virtual_network'
              | 'azurerm_virtual_network_gateway'
              | 'google_compute_network'
              | 'google_compute_subnetwork'
              | 'google_compute_vpn_gateway'
              | 'google_compute_vpn_tunnel'
              | 'google_compute_route'
              | 'google_compute_address'
              | 'google_compute_global_address'
              | 'google_compute_router'
              | 'google_compute_interconnect_attachment'
              | 'google_compute_ha_vpn_gateway'
              | 'google_compute_forwarding_rule'
              | 'google_compute_network_firewall_policy'
              | 'google_compute_network_firewall_policy_rule'
              | 'cloudflare_static_route'
              | 'cloudflare_ipsec_tunnel';

            title: string;
          }
        }
      }
    }

    export interface VisibleItem {
      helpText?: string;

      name?: string;

      value?:
        | VisibleItem.McnStringItem
        | VisibleItem.McnYamlItem
        | VisibleItem.McnYamlDiffItem
        | VisibleItem.McnResourcePreviewItem
        | VisibleItem.McnListItem;
    }

    export namespace VisibleItem {
      export interface McnStringItem {
        item_type: string;

        string: string;
      }

      export interface McnYamlItem {
        item_type: string;

        yaml: string;
      }

      export interface McnYamlDiffItem {
        item_type: string;

        yaml_diff: McnYamlDiffItem.YamlDiff;
      }

      export namespace McnYamlDiffItem {
        export interface YamlDiff {
          diff: string;

          left_description: string;

          left_yaml: string;

          right_description: string;

          right_yaml: string;
        }
      }

      export interface McnResourcePreviewItem {
        item_type: string;

        resource_preview: McnResourcePreviewItem.ResourcePreview;
      }

      export namespace McnResourcePreviewItem {
        export interface ResourcePreview {
          id: string;

          cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

          detail: string;

          name: string;

          resource_type:
            | 'aws_customer_gateway'
            | 'aws_egress_only_internet_gateway'
            | 'aws_internet_gateway'
            | 'aws_instance'
            | 'aws_network_interface'
            | 'aws_route'
            | 'aws_route_table'
            | 'aws_route_table_association'
            | 'aws_subnet'
            | 'aws_vpc'
            | 'aws_vpc_ipv4_cidr_block_association'
            | 'aws_vpn_connection'
            | 'aws_vpn_connection_route'
            | 'aws_vpn_gateway'
            | 'aws_security_group'
            | 'aws_vpc_security_group_ingress_rule'
            | 'aws_vpc_security_group_egress_rule'
            | 'aws_ec2_managed_prefix_list'
            | 'aws_ec2_transit_gateway'
            | 'aws_ec2_transit_gateway_prefix_list_reference'
            | 'aws_ec2_transit_gateway_vpc_attachment'
            | 'azurerm_application_security_group'
            | 'azurerm_lb'
            | 'azurerm_lb_backend_address_pool'
            | 'azurerm_lb_nat_pool'
            | 'azurerm_lb_nat_rule'
            | 'azurerm_lb_rule'
            | 'azurerm_local_network_gateway'
            | 'azurerm_network_interface'
            | 'azurerm_network_interface_application_security_group_association'
            | 'azurerm_network_interface_backend_address_pool_association'
            | 'azurerm_network_interface_security_group_association'
            | 'azurerm_network_security_group'
            | 'azurerm_public_ip'
            | 'azurerm_route'
            | 'azurerm_route_table'
            | 'azurerm_subnet'
            | 'azurerm_subnet_route_table_association'
            | 'azurerm_virtual_machine'
            | 'azurerm_virtual_network_gateway_connection'
            | 'azurerm_virtual_network'
            | 'azurerm_virtual_network_gateway'
            | 'google_compute_network'
            | 'google_compute_subnetwork'
            | 'google_compute_vpn_gateway'
            | 'google_compute_vpn_tunnel'
            | 'google_compute_route'
            | 'google_compute_address'
            | 'google_compute_global_address'
            | 'google_compute_router'
            | 'google_compute_interconnect_attachment'
            | 'google_compute_ha_vpn_gateway'
            | 'google_compute_forwarding_rule'
            | 'google_compute_network_firewall_policy'
            | 'google_compute_network_firewall_policy_rule'
            | 'cloudflare_static_route'
            | 'cloudflare_ipsec_tunnel';

          title: string;
        }
      }

      export interface McnListItem {
        item_type: string;

        list: Array<McnListItem.McnStringItem | McnListItem.McnResourcePreviewItem>;
      }

      export namespace McnListItem {
        export interface McnStringItem {
          item_type: string;

          string: string;
        }

        export interface McnResourcePreviewItem {
          item_type: string;

          resource_preview: McnResourcePreviewItem.ResourcePreview;
        }

        export namespace McnResourcePreviewItem {
          export interface ResourcePreview {
            id: string;

            cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

            detail: string;

            name: string;

            resource_type:
              | 'aws_customer_gateway'
              | 'aws_egress_only_internet_gateway'
              | 'aws_internet_gateway'
              | 'aws_instance'
              | 'aws_network_interface'
              | 'aws_route'
              | 'aws_route_table'
              | 'aws_route_table_association'
              | 'aws_subnet'
              | 'aws_vpc'
              | 'aws_vpc_ipv4_cidr_block_association'
              | 'aws_vpn_connection'
              | 'aws_vpn_connection_route'
              | 'aws_vpn_gateway'
              | 'aws_security_group'
              | 'aws_vpc_security_group_ingress_rule'
              | 'aws_vpc_security_group_egress_rule'
              | 'aws_ec2_managed_prefix_list'
              | 'aws_ec2_transit_gateway'
              | 'aws_ec2_transit_gateway_prefix_list_reference'
              | 'aws_ec2_transit_gateway_vpc_attachment'
              | 'azurerm_application_security_group'
              | 'azurerm_lb'
              | 'azurerm_lb_backend_address_pool'
              | 'azurerm_lb_nat_pool'
              | 'azurerm_lb_nat_rule'
              | 'azurerm_lb_rule'
              | 'azurerm_local_network_gateway'
              | 'azurerm_network_interface'
              | 'azurerm_network_interface_application_security_group_association'
              | 'azurerm_network_interface_backend_address_pool_association'
              | 'azurerm_network_interface_security_group_association'
              | 'azurerm_network_security_group'
              | 'azurerm_public_ip'
              | 'azurerm_route'
              | 'azurerm_route_table'
              | 'azurerm_subnet'
              | 'azurerm_subnet_route_table_association'
              | 'azurerm_virtual_machine'
              | 'azurerm_virtual_network_gateway_connection'
              | 'azurerm_virtual_network'
              | 'azurerm_virtual_network_gateway'
              | 'google_compute_network'
              | 'google_compute_subnetwork'
              | 'google_compute_vpn_gateway'
              | 'google_compute_vpn_tunnel'
              | 'google_compute_route'
              | 'google_compute_address'
              | 'google_compute_global_address'
              | 'google_compute_router'
              | 'google_compute_interconnect_attachment'
              | 'google_compute_ha_vpn_gateway'
              | 'google_compute_forwarding_rule'
              | 'google_compute_network_firewall_policy'
              | 'google_compute_network_firewall_policy_rule'
              | 'cloudflare_static_route'
              | 'cloudflare_ipsec_tunnel';

            title: string;
          }
        }
      }
    }
  }

  export interface ManagedBy {
    id: string;

    client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

    name: string;
  }
}

export interface ResourceGetResponse {
  id: string;

  account_id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

  config: { [key: string]: unknown };

  deployment_provider: string;

  managed: boolean;

  monthly_cost_estimate: ResourceGetResponse.MonthlyCostEstimate;

  name: string;

  native_id: string;

  observations: { [key: string]: ResourceGetResponse.Observations };

  provider_ids: Array<string>;

  provider_names_by_id: { [key: string]: string };

  region: string;

  resource_group: string;

  resource_type:
    | 'aws_customer_gateway'
    | 'aws_egress_only_internet_gateway'
    | 'aws_internet_gateway'
    | 'aws_instance'
    | 'aws_network_interface'
    | 'aws_route'
    | 'aws_route_table'
    | 'aws_route_table_association'
    | 'aws_subnet'
    | 'aws_vpc'
    | 'aws_vpc_ipv4_cidr_block_association'
    | 'aws_vpn_connection'
    | 'aws_vpn_connection_route'
    | 'aws_vpn_gateway'
    | 'aws_security_group'
    | 'aws_vpc_security_group_ingress_rule'
    | 'aws_vpc_security_group_egress_rule'
    | 'aws_ec2_managed_prefix_list'
    | 'aws_ec2_transit_gateway'
    | 'aws_ec2_transit_gateway_prefix_list_reference'
    | 'aws_ec2_transit_gateway_vpc_attachment'
    | 'azurerm_application_security_group'
    | 'azurerm_lb'
    | 'azurerm_lb_backend_address_pool'
    | 'azurerm_lb_nat_pool'
    | 'azurerm_lb_nat_rule'
    | 'azurerm_lb_rule'
    | 'azurerm_local_network_gateway'
    | 'azurerm_network_interface'
    | 'azurerm_network_interface_application_security_group_association'
    | 'azurerm_network_interface_backend_address_pool_association'
    | 'azurerm_network_interface_security_group_association'
    | 'azurerm_network_security_group'
    | 'azurerm_public_ip'
    | 'azurerm_route'
    | 'azurerm_route_table'
    | 'azurerm_subnet'
    | 'azurerm_subnet_route_table_association'
    | 'azurerm_virtual_machine'
    | 'azurerm_virtual_network_gateway_connection'
    | 'azurerm_virtual_network'
    | 'azurerm_virtual_network_gateway'
    | 'google_compute_network'
    | 'google_compute_subnetwork'
    | 'google_compute_vpn_gateway'
    | 'google_compute_vpn_tunnel'
    | 'google_compute_route'
    | 'google_compute_address'
    | 'google_compute_global_address'
    | 'google_compute_router'
    | 'google_compute_interconnect_attachment'
    | 'google_compute_ha_vpn_gateway'
    | 'google_compute_forwarding_rule'
    | 'google_compute_network_firewall_policy'
    | 'google_compute_network_firewall_policy_rule'
    | 'cloudflare_static_route'
    | 'cloudflare_ipsec_tunnel';

  sections: Array<ResourceGetResponse.Section>;

  state: { [key: string]: unknown };

  tags: { [key: string]: string };

  updated_at: string;

  url: string;

  managed_by?: Array<ResourceGetResponse.ManagedBy>;
}

export namespace ResourceGetResponse {
  export interface MonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface Observations {
    first_observed_at: string;

    last_observed_at: string;

    provider_id: string;

    resource_id: string;
  }

  export interface Section {
    hidden_items: Array<Section.HiddenItem>;

    name: string;

    visible_items: Array<Section.VisibleItem>;

    help_text?: string;
  }

  export namespace Section {
    export interface HiddenItem {
      helpText?: string;

      name?: string;

      value?:
        | HiddenItem.McnStringItem
        | HiddenItem.McnYamlItem
        | HiddenItem.McnYamlDiffItem
        | HiddenItem.McnResourcePreviewItem
        | HiddenItem.McnListItem;
    }

    export namespace HiddenItem {
      export interface McnStringItem {
        item_type: string;

        string: string;
      }

      export interface McnYamlItem {
        item_type: string;

        yaml: string;
      }

      export interface McnYamlDiffItem {
        item_type: string;

        yaml_diff: McnYamlDiffItem.YamlDiff;
      }

      export namespace McnYamlDiffItem {
        export interface YamlDiff {
          diff: string;

          left_description: string;

          left_yaml: string;

          right_description: string;

          right_yaml: string;
        }
      }

      export interface McnResourcePreviewItem {
        item_type: string;

        resource_preview: McnResourcePreviewItem.ResourcePreview;
      }

      export namespace McnResourcePreviewItem {
        export interface ResourcePreview {
          id: string;

          cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

          detail: string;

          name: string;

          resource_type:
            | 'aws_customer_gateway'
            | 'aws_egress_only_internet_gateway'
            | 'aws_internet_gateway'
            | 'aws_instance'
            | 'aws_network_interface'
            | 'aws_route'
            | 'aws_route_table'
            | 'aws_route_table_association'
            | 'aws_subnet'
            | 'aws_vpc'
            | 'aws_vpc_ipv4_cidr_block_association'
            | 'aws_vpn_connection'
            | 'aws_vpn_connection_route'
            | 'aws_vpn_gateway'
            | 'aws_security_group'
            | 'aws_vpc_security_group_ingress_rule'
            | 'aws_vpc_security_group_egress_rule'
            | 'aws_ec2_managed_prefix_list'
            | 'aws_ec2_transit_gateway'
            | 'aws_ec2_transit_gateway_prefix_list_reference'
            | 'aws_ec2_transit_gateway_vpc_attachment'
            | 'azurerm_application_security_group'
            | 'azurerm_lb'
            | 'azurerm_lb_backend_address_pool'
            | 'azurerm_lb_nat_pool'
            | 'azurerm_lb_nat_rule'
            | 'azurerm_lb_rule'
            | 'azurerm_local_network_gateway'
            | 'azurerm_network_interface'
            | 'azurerm_network_interface_application_security_group_association'
            | 'azurerm_network_interface_backend_address_pool_association'
            | 'azurerm_network_interface_security_group_association'
            | 'azurerm_network_security_group'
            | 'azurerm_public_ip'
            | 'azurerm_route'
            | 'azurerm_route_table'
            | 'azurerm_subnet'
            | 'azurerm_subnet_route_table_association'
            | 'azurerm_virtual_machine'
            | 'azurerm_virtual_network_gateway_connection'
            | 'azurerm_virtual_network'
            | 'azurerm_virtual_network_gateway'
            | 'google_compute_network'
            | 'google_compute_subnetwork'
            | 'google_compute_vpn_gateway'
            | 'google_compute_vpn_tunnel'
            | 'google_compute_route'
            | 'google_compute_address'
            | 'google_compute_global_address'
            | 'google_compute_router'
            | 'google_compute_interconnect_attachment'
            | 'google_compute_ha_vpn_gateway'
            | 'google_compute_forwarding_rule'
            | 'google_compute_network_firewall_policy'
            | 'google_compute_network_firewall_policy_rule'
            | 'cloudflare_static_route'
            | 'cloudflare_ipsec_tunnel';

          title: string;
        }
      }

      export interface McnListItem {
        item_type: string;

        list: Array<McnListItem.McnStringItem | McnListItem.McnResourcePreviewItem>;
      }

      export namespace McnListItem {
        export interface McnStringItem {
          item_type: string;

          string: string;
        }

        export interface McnResourcePreviewItem {
          item_type: string;

          resource_preview: McnResourcePreviewItem.ResourcePreview;
        }

        export namespace McnResourcePreviewItem {
          export interface ResourcePreview {
            id: string;

            cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

            detail: string;

            name: string;

            resource_type:
              | 'aws_customer_gateway'
              | 'aws_egress_only_internet_gateway'
              | 'aws_internet_gateway'
              | 'aws_instance'
              | 'aws_network_interface'
              | 'aws_route'
              | 'aws_route_table'
              | 'aws_route_table_association'
              | 'aws_subnet'
              | 'aws_vpc'
              | 'aws_vpc_ipv4_cidr_block_association'
              | 'aws_vpn_connection'
              | 'aws_vpn_connection_route'
              | 'aws_vpn_gateway'
              | 'aws_security_group'
              | 'aws_vpc_security_group_ingress_rule'
              | 'aws_vpc_security_group_egress_rule'
              | 'aws_ec2_managed_prefix_list'
              | 'aws_ec2_transit_gateway'
              | 'aws_ec2_transit_gateway_prefix_list_reference'
              | 'aws_ec2_transit_gateway_vpc_attachment'
              | 'azurerm_application_security_group'
              | 'azurerm_lb'
              | 'azurerm_lb_backend_address_pool'
              | 'azurerm_lb_nat_pool'
              | 'azurerm_lb_nat_rule'
              | 'azurerm_lb_rule'
              | 'azurerm_local_network_gateway'
              | 'azurerm_network_interface'
              | 'azurerm_network_interface_application_security_group_association'
              | 'azurerm_network_interface_backend_address_pool_association'
              | 'azurerm_network_interface_security_group_association'
              | 'azurerm_network_security_group'
              | 'azurerm_public_ip'
              | 'azurerm_route'
              | 'azurerm_route_table'
              | 'azurerm_subnet'
              | 'azurerm_subnet_route_table_association'
              | 'azurerm_virtual_machine'
              | 'azurerm_virtual_network_gateway_connection'
              | 'azurerm_virtual_network'
              | 'azurerm_virtual_network_gateway'
              | 'google_compute_network'
              | 'google_compute_subnetwork'
              | 'google_compute_vpn_gateway'
              | 'google_compute_vpn_tunnel'
              | 'google_compute_route'
              | 'google_compute_address'
              | 'google_compute_global_address'
              | 'google_compute_router'
              | 'google_compute_interconnect_attachment'
              | 'google_compute_ha_vpn_gateway'
              | 'google_compute_forwarding_rule'
              | 'google_compute_network_firewall_policy'
              | 'google_compute_network_firewall_policy_rule'
              | 'cloudflare_static_route'
              | 'cloudflare_ipsec_tunnel';

            title: string;
          }
        }
      }
    }

    export interface VisibleItem {
      helpText?: string;

      name?: string;

      value?:
        | VisibleItem.McnStringItem
        | VisibleItem.McnYamlItem
        | VisibleItem.McnYamlDiffItem
        | VisibleItem.McnResourcePreviewItem
        | VisibleItem.McnListItem;
    }

    export namespace VisibleItem {
      export interface McnStringItem {
        item_type: string;

        string: string;
      }

      export interface McnYamlItem {
        item_type: string;

        yaml: string;
      }

      export interface McnYamlDiffItem {
        item_type: string;

        yaml_diff: McnYamlDiffItem.YamlDiff;
      }

      export namespace McnYamlDiffItem {
        export interface YamlDiff {
          diff: string;

          left_description: string;

          left_yaml: string;

          right_description: string;

          right_yaml: string;
        }
      }

      export interface McnResourcePreviewItem {
        item_type: string;

        resource_preview: McnResourcePreviewItem.ResourcePreview;
      }

      export namespace McnResourcePreviewItem {
        export interface ResourcePreview {
          id: string;

          cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

          detail: string;

          name: string;

          resource_type:
            | 'aws_customer_gateway'
            | 'aws_egress_only_internet_gateway'
            | 'aws_internet_gateway'
            | 'aws_instance'
            | 'aws_network_interface'
            | 'aws_route'
            | 'aws_route_table'
            | 'aws_route_table_association'
            | 'aws_subnet'
            | 'aws_vpc'
            | 'aws_vpc_ipv4_cidr_block_association'
            | 'aws_vpn_connection'
            | 'aws_vpn_connection_route'
            | 'aws_vpn_gateway'
            | 'aws_security_group'
            | 'aws_vpc_security_group_ingress_rule'
            | 'aws_vpc_security_group_egress_rule'
            | 'aws_ec2_managed_prefix_list'
            | 'aws_ec2_transit_gateway'
            | 'aws_ec2_transit_gateway_prefix_list_reference'
            | 'aws_ec2_transit_gateway_vpc_attachment'
            | 'azurerm_application_security_group'
            | 'azurerm_lb'
            | 'azurerm_lb_backend_address_pool'
            | 'azurerm_lb_nat_pool'
            | 'azurerm_lb_nat_rule'
            | 'azurerm_lb_rule'
            | 'azurerm_local_network_gateway'
            | 'azurerm_network_interface'
            | 'azurerm_network_interface_application_security_group_association'
            | 'azurerm_network_interface_backend_address_pool_association'
            | 'azurerm_network_interface_security_group_association'
            | 'azurerm_network_security_group'
            | 'azurerm_public_ip'
            | 'azurerm_route'
            | 'azurerm_route_table'
            | 'azurerm_subnet'
            | 'azurerm_subnet_route_table_association'
            | 'azurerm_virtual_machine'
            | 'azurerm_virtual_network_gateway_connection'
            | 'azurerm_virtual_network'
            | 'azurerm_virtual_network_gateway'
            | 'google_compute_network'
            | 'google_compute_subnetwork'
            | 'google_compute_vpn_gateway'
            | 'google_compute_vpn_tunnel'
            | 'google_compute_route'
            | 'google_compute_address'
            | 'google_compute_global_address'
            | 'google_compute_router'
            | 'google_compute_interconnect_attachment'
            | 'google_compute_ha_vpn_gateway'
            | 'google_compute_forwarding_rule'
            | 'google_compute_network_firewall_policy'
            | 'google_compute_network_firewall_policy_rule'
            | 'cloudflare_static_route'
            | 'cloudflare_ipsec_tunnel';

          title: string;
        }
      }

      export interface McnListItem {
        item_type: string;

        list: Array<McnListItem.McnStringItem | McnListItem.McnResourcePreviewItem>;
      }

      export namespace McnListItem {
        export interface McnStringItem {
          item_type: string;

          string: string;
        }

        export interface McnResourcePreviewItem {
          item_type: string;

          resource_preview: McnResourcePreviewItem.ResourcePreview;
        }

        export namespace McnResourcePreviewItem {
          export interface ResourcePreview {
            id: string;

            cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

            detail: string;

            name: string;

            resource_type:
              | 'aws_customer_gateway'
              | 'aws_egress_only_internet_gateway'
              | 'aws_internet_gateway'
              | 'aws_instance'
              | 'aws_network_interface'
              | 'aws_route'
              | 'aws_route_table'
              | 'aws_route_table_association'
              | 'aws_subnet'
              | 'aws_vpc'
              | 'aws_vpc_ipv4_cidr_block_association'
              | 'aws_vpn_connection'
              | 'aws_vpn_connection_route'
              | 'aws_vpn_gateway'
              | 'aws_security_group'
              | 'aws_vpc_security_group_ingress_rule'
              | 'aws_vpc_security_group_egress_rule'
              | 'aws_ec2_managed_prefix_list'
              | 'aws_ec2_transit_gateway'
              | 'aws_ec2_transit_gateway_prefix_list_reference'
              | 'aws_ec2_transit_gateway_vpc_attachment'
              | 'azurerm_application_security_group'
              | 'azurerm_lb'
              | 'azurerm_lb_backend_address_pool'
              | 'azurerm_lb_nat_pool'
              | 'azurerm_lb_nat_rule'
              | 'azurerm_lb_rule'
              | 'azurerm_local_network_gateway'
              | 'azurerm_network_interface'
              | 'azurerm_network_interface_application_security_group_association'
              | 'azurerm_network_interface_backend_address_pool_association'
              | 'azurerm_network_interface_security_group_association'
              | 'azurerm_network_security_group'
              | 'azurerm_public_ip'
              | 'azurerm_route'
              | 'azurerm_route_table'
              | 'azurerm_subnet'
              | 'azurerm_subnet_route_table_association'
              | 'azurerm_virtual_machine'
              | 'azurerm_virtual_network_gateway_connection'
              | 'azurerm_virtual_network'
              | 'azurerm_virtual_network_gateway'
              | 'google_compute_network'
              | 'google_compute_subnetwork'
              | 'google_compute_vpn_gateway'
              | 'google_compute_vpn_tunnel'
              | 'google_compute_route'
              | 'google_compute_address'
              | 'google_compute_global_address'
              | 'google_compute_router'
              | 'google_compute_interconnect_attachment'
              | 'google_compute_ha_vpn_gateway'
              | 'google_compute_forwarding_rule'
              | 'google_compute_network_firewall_policy'
              | 'google_compute_network_firewall_policy_rule'
              | 'cloudflare_static_route'
              | 'cloudflare_ipsec_tunnel';

            title: string;
          }
        }
      }
    }
  }

  export interface ManagedBy {
    id: string;

    client_type: 'MAGIC_WAN_CLOUD_ONRAMP';

    name: string;
  }
}

export type ResourcePolicyPreviewResponse = string;

export interface ResourceListParams extends V4PagePaginationArrayParams {
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
   * Query param:
   */
  managed?: boolean;

  /**
   * Query param: One of ["id", "resource_type", "region"].
   */
  order_by?: string;

  /**
   * Query param:
   */
  provider_id?: string;

  /**
   * Query param:
   */
  region?: string;

  /**
   * Query param:
   */
  resource_group?: string;

  /**
   * Query param:
   */
  resource_id?: Array<string>;

  /**
   * Query param:
   */
  resource_type?: Array<
    | 'aws_customer_gateway'
    | 'aws_egress_only_internet_gateway'
    | 'aws_internet_gateway'
    | 'aws_instance'
    | 'aws_network_interface'
    | 'aws_route'
    | 'aws_route_table'
    | 'aws_route_table_association'
    | 'aws_subnet'
    | 'aws_vpc'
    | 'aws_vpc_ipv4_cidr_block_association'
    | 'aws_vpn_connection'
    | 'aws_vpn_connection_route'
    | 'aws_vpn_gateway'
    | 'aws_security_group'
    | 'aws_vpc_security_group_ingress_rule'
    | 'aws_vpc_security_group_egress_rule'
    | 'aws_ec2_managed_prefix_list'
    | 'aws_ec2_transit_gateway'
    | 'aws_ec2_transit_gateway_prefix_list_reference'
    | 'aws_ec2_transit_gateway_vpc_attachment'
    | 'azurerm_application_security_group'
    | 'azurerm_lb'
    | 'azurerm_lb_backend_address_pool'
    | 'azurerm_lb_nat_pool'
    | 'azurerm_lb_nat_rule'
    | 'azurerm_lb_rule'
    | 'azurerm_local_network_gateway'
    | 'azurerm_network_interface'
    | 'azurerm_network_interface_application_security_group_association'
    | 'azurerm_network_interface_backend_address_pool_association'
    | 'azurerm_network_interface_security_group_association'
    | 'azurerm_network_security_group'
    | 'azurerm_public_ip'
    | 'azurerm_route'
    | 'azurerm_route_table'
    | 'azurerm_subnet'
    | 'azurerm_subnet_route_table_association'
    | 'azurerm_virtual_machine'
    | 'azurerm_virtual_network_gateway_connection'
    | 'azurerm_virtual_network'
    | 'azurerm_virtual_network_gateway'
    | 'google_compute_network'
    | 'google_compute_subnetwork'
    | 'google_compute_vpn_gateway'
    | 'google_compute_vpn_tunnel'
    | 'google_compute_route'
    | 'google_compute_address'
    | 'google_compute_global_address'
    | 'google_compute_router'
    | 'google_compute_interconnect_attachment'
    | 'google_compute_ha_vpn_gateway'
    | 'google_compute_forwarding_rule'
    | 'google_compute_network_firewall_policy'
    | 'google_compute_network_firewall_policy_rule'
    | 'cloudflare_static_route'
    | 'cloudflare_ipsec_tunnel'
  >;

  /**
   * Query param:
   */
  search?: Array<string>;

  /**
   * Query param:
   */
  v2?: boolean;
}

export interface ResourceExportParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  desc?: boolean;

  /**
   * Query param: One of ["id", "resource_type", "region"].
   */
  order_by?: string;

  /**
   * Query param:
   */
  provider_id?: string;

  /**
   * Query param:
   */
  region?: string;

  /**
   * Query param:
   */
  resource_group?: string;

  /**
   * Query param:
   */
  resource_id?: Array<string>;

  /**
   * Query param:
   */
  resource_type?: Array<
    | 'aws_customer_gateway'
    | 'aws_egress_only_internet_gateway'
    | 'aws_internet_gateway'
    | 'aws_instance'
    | 'aws_network_interface'
    | 'aws_route'
    | 'aws_route_table'
    | 'aws_route_table_association'
    | 'aws_subnet'
    | 'aws_vpc'
    | 'aws_vpc_ipv4_cidr_block_association'
    | 'aws_vpn_connection'
    | 'aws_vpn_connection_route'
    | 'aws_vpn_gateway'
    | 'aws_security_group'
    | 'aws_vpc_security_group_ingress_rule'
    | 'aws_vpc_security_group_egress_rule'
    | 'aws_ec2_managed_prefix_list'
    | 'aws_ec2_transit_gateway'
    | 'aws_ec2_transit_gateway_prefix_list_reference'
    | 'aws_ec2_transit_gateway_vpc_attachment'
    | 'azurerm_application_security_group'
    | 'azurerm_lb'
    | 'azurerm_lb_backend_address_pool'
    | 'azurerm_lb_nat_pool'
    | 'azurerm_lb_nat_rule'
    | 'azurerm_lb_rule'
    | 'azurerm_local_network_gateway'
    | 'azurerm_network_interface'
    | 'azurerm_network_interface_application_security_group_association'
    | 'azurerm_network_interface_backend_address_pool_association'
    | 'azurerm_network_interface_security_group_association'
    | 'azurerm_network_security_group'
    | 'azurerm_public_ip'
    | 'azurerm_route'
    | 'azurerm_route_table'
    | 'azurerm_subnet'
    | 'azurerm_subnet_route_table_association'
    | 'azurerm_virtual_machine'
    | 'azurerm_virtual_network_gateway_connection'
    | 'azurerm_virtual_network'
    | 'azurerm_virtual_network_gateway'
    | 'google_compute_network'
    | 'google_compute_subnetwork'
    | 'google_compute_vpn_gateway'
    | 'google_compute_vpn_tunnel'
    | 'google_compute_route'
    | 'google_compute_address'
    | 'google_compute_global_address'
    | 'google_compute_router'
    | 'google_compute_interconnect_attachment'
    | 'google_compute_ha_vpn_gateway'
    | 'google_compute_forwarding_rule'
    | 'google_compute_network_firewall_policy'
    | 'google_compute_network_firewall_policy_rule'
    | 'cloudflare_static_route'
    | 'cloudflare_ipsec_tunnel'
  >;

  /**
   * Query param:
   */
  search?: Array<string>;

  /**
   * Query param:
   */
  v2?: boolean;
}

export interface ResourceGetParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  v2?: boolean;
}

export interface ResourcePolicyPreviewParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  policy: string;
}

Resources.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;

export declare namespace Resources {
  export {
    type ResourceListResponse as ResourceListResponse,
    type ResourceGetResponse as ResourceGetResponse,
    type ResourcePolicyPreviewResponse as ResourcePolicyPreviewResponse,
    ResourceListResponsesV4PagePaginationArray as ResourceListResponsesV4PagePaginationArray,
    type ResourceListParams as ResourceListParams,
    type ResourceExportParams as ResourceExportParams,
    type ResourceGetParams as ResourceGetParams,
    type ResourcePolicyPreviewParams as ResourcePolicyPreviewParams,
  };
}
