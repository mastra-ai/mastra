// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as AddressSpacesAPI from './address-spaces';
import {
  AddressSpaceEditParams,
  AddressSpaceEditResponse,
  AddressSpaceListParams,
  AddressSpaceListResponse,
  AddressSpaceUpdateParams,
  AddressSpaceUpdateResponse,
  AddressSpaces,
} from './address-spaces';
import { SinglePage } from '../../../pagination';
import { type Response } from '../../../_shims/index';

export class OnRamps extends APIResource {
  addressSpaces: AddressSpacesAPI.AddressSpaces = new AddressSpacesAPI.AddressSpaces(this._client);

  /**
   * Create a new On-ramp (Closed Beta).
   */
  create(params: OnRampCreateParams, options?: Core.RequestOptions): Core.APIPromise<OnRampCreateResponse> {
    const { account_id, forwarded, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/magic/cloud/onramps`, {
        body,
        ...options,
        headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
      }) as Core.APIPromise<{ result: OnRampCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update an On-ramp (Closed Beta).
   */
  update(
    onrampId: string,
    params: OnRampUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: OnRampUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List On-ramps (Closed Beta).
   */
  list(
    params: OnRampListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<OnRampListResponsesSinglePage, OnRampListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/magic/cloud/onramps`,
      OnRampListResponsesSinglePage,
      { query, ...options },
    );
  }

  /**
   * Delete an On-ramp (Closed Beta).
   */
  delete(
    onrampId: string,
    params: OnRampDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampDeleteResponse> {
    const { account_id, destroy, force } = params;
    return (
      this._client.delete(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
        query: { destroy, force },
        ...options,
      }) as Core.APIPromise<{ result: OnRampDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Apply an On-ramp (Closed Beta).
   */
  apply(
    onrampId: string,
    params: OnRampApplyParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampApplyResponse> {
    const { account_id } = params;
    return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/apply`, options);
  }

  /**
   * Update an On-ramp (Closed Beta).
   */
  edit(
    onrampId: string,
    params: OnRampEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: OnRampEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Export an On-ramp to terraform ready file(s) (Closed Beta).
   */
  export(
    onrampId: string,
    params: OnRampExportParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Response> {
    const { account_id } = params;
    return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/export`, {
      ...options,
      headers: { Accept: 'application/zip', ...options?.headers },
      __binaryResponse: true,
    });
  }

  /**
   * Read an On-ramp (Closed Beta).
   */
  get(
    onrampId: string,
    params: OnRampGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampGetResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: OnRampGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Plan an On-ramp (Closed Beta).
   */
  plan(
    onrampId: string,
    params: OnRampPlanParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OnRampPlanResponse> {
    const { account_id } = params;
    return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/plan`, options);
  }
}

export class OnRampListResponsesSinglePage extends SinglePage<OnRampListResponse> {}

export interface OnRampCreateResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  install_routes_in_cloud: boolean;

  install_routes_in_magic_wan: boolean;

  name: string;

  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  updated_at: string;

  attached_hubs?: Array<string>;

  attached_vpcs?: Array<string>;

  description?: string;

  hub?: string;

  last_applied_at?: string;

  last_exported_at?: string;

  last_planned_at?: string;

  manage_hub_to_hub_attachments?: boolean;

  manage_vpc_to_hub_attachments?: boolean;

  planned_monthly_cost_estimate?: OnRampCreateResponse.PlannedMonthlyCostEstimate;

  planned_resources?: Array<OnRampCreateResponse.PlannedResource>;

  planned_resources_unavailable?: boolean;

  post_apply_monthly_cost_estimate?: OnRampCreateResponse.PostApplyMonthlyCostEstimate;

  post_apply_resources?: { [key: string]: OnRampCreateResponse.PostApplyResources };

  post_apply_resources_unavailable?: boolean;

  region?: string;

  status?: OnRampCreateResponse.Status;

  vpc?: string;

  vpcs_by_id?: { [key: string]: OnRampCreateResponse.VPCsByID };

  /**
   * The list of vpc IDs for which resource details failed to generate.
   */
  vpcs_by_id_unavailable?: Array<string>;
}

export namespace OnRampCreateResponse {
  export interface PlannedMonthlyCostEstimate {
    currency: string;

    current_monthly_cost: number;

    diff: number;

    proposed_monthly_cost: number;
  }

  export interface PlannedResource {
    diff: PlannedResource.Diff;

    keys_require_replace: Array<string>;

    monthly_cost_estimate_diff: PlannedResource.MonthlyCostEstimateDiff;

    planned_action: 'no_op' | 'create' | 'update' | 'replace' | 'destroy';

    resource: PlannedResource.Resource;
  }

  export namespace PlannedResource {
    export interface Diff {
      diff: string;

      left_description: string;

      left_yaml: string;

      right_description: string;

      right_yaml: string;
    }

    export interface MonthlyCostEstimateDiff {
      currency: string;

      current_monthly_cost: number;

      diff: number;

      proposed_monthly_cost: number;
    }

    export interface Resource {
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

  export interface PostApplyMonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface PostApplyResources {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: PostApplyResources.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: PostApplyResources.Observations };

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

    sections: Array<PostApplyResources.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<PostApplyResources.ManagedBy>;
  }

  export namespace PostApplyResources {
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

  export interface Status {
    apply_progress: Status.ApplyProgress;

    lifecycle_state:
      | 'OnrampNeedsApply'
      | 'OnrampPendingPlan'
      | 'OnrampPlanning'
      | 'OnrampPlanFailed'
      | 'OnrampPendingApproval'
      | 'OnrampPendingApply'
      | 'OnrampApplying'
      | 'OnrampApplyFailed'
      | 'OnrampActive'
      | 'OnrampPendingDestroy'
      | 'OnrampDestroying'
      | 'OnrampDestroyFailed';

    plan_progress: Status.PlanProgress;

    routes: Array<string>;

    tunnels: Array<string>;

    lifecycle_errors?: { [key: string]: Status.LifecycleErrors };
  }

  export namespace Status {
    export interface ApplyProgress {
      done: number;

      total: number;
    }

    export interface PlanProgress {
      done: number;

      total: number;
    }

    export interface LifecycleErrors {
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

      meta?: LifecycleErrors.Meta;

      source?: LifecycleErrors.Source;
    }

    export namespace LifecycleErrors {
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

  export interface VPCsByID {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: VPCsByID.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: VPCsByID.Observations };

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

    sections: Array<VPCsByID.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<VPCsByID.ManagedBy>;
  }

  export namespace VPCsByID {
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
}

export interface OnRampUpdateResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  install_routes_in_cloud: boolean;

  install_routes_in_magic_wan: boolean;

  name: string;

  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  updated_at: string;

  attached_hubs?: Array<string>;

  attached_vpcs?: Array<string>;

  description?: string;

  hub?: string;

  last_applied_at?: string;

  last_exported_at?: string;

  last_planned_at?: string;

  manage_hub_to_hub_attachments?: boolean;

  manage_vpc_to_hub_attachments?: boolean;

  planned_monthly_cost_estimate?: OnRampUpdateResponse.PlannedMonthlyCostEstimate;

  planned_resources?: Array<OnRampUpdateResponse.PlannedResource>;

  planned_resources_unavailable?: boolean;

  post_apply_monthly_cost_estimate?: OnRampUpdateResponse.PostApplyMonthlyCostEstimate;

  post_apply_resources?: { [key: string]: OnRampUpdateResponse.PostApplyResources };

  post_apply_resources_unavailable?: boolean;

  region?: string;

  status?: OnRampUpdateResponse.Status;

  vpc?: string;

  vpcs_by_id?: { [key: string]: OnRampUpdateResponse.VPCsByID };

  /**
   * The list of vpc IDs for which resource details failed to generate.
   */
  vpcs_by_id_unavailable?: Array<string>;
}

export namespace OnRampUpdateResponse {
  export interface PlannedMonthlyCostEstimate {
    currency: string;

    current_monthly_cost: number;

    diff: number;

    proposed_monthly_cost: number;
  }

  export interface PlannedResource {
    diff: PlannedResource.Diff;

    keys_require_replace: Array<string>;

    monthly_cost_estimate_diff: PlannedResource.MonthlyCostEstimateDiff;

    planned_action: 'no_op' | 'create' | 'update' | 'replace' | 'destroy';

    resource: PlannedResource.Resource;
  }

  export namespace PlannedResource {
    export interface Diff {
      diff: string;

      left_description: string;

      left_yaml: string;

      right_description: string;

      right_yaml: string;
    }

    export interface MonthlyCostEstimateDiff {
      currency: string;

      current_monthly_cost: number;

      diff: number;

      proposed_monthly_cost: number;
    }

    export interface Resource {
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

  export interface PostApplyMonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface PostApplyResources {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: PostApplyResources.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: PostApplyResources.Observations };

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

    sections: Array<PostApplyResources.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<PostApplyResources.ManagedBy>;
  }

  export namespace PostApplyResources {
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

  export interface Status {
    apply_progress: Status.ApplyProgress;

    lifecycle_state:
      | 'OnrampNeedsApply'
      | 'OnrampPendingPlan'
      | 'OnrampPlanning'
      | 'OnrampPlanFailed'
      | 'OnrampPendingApproval'
      | 'OnrampPendingApply'
      | 'OnrampApplying'
      | 'OnrampApplyFailed'
      | 'OnrampActive'
      | 'OnrampPendingDestroy'
      | 'OnrampDestroying'
      | 'OnrampDestroyFailed';

    plan_progress: Status.PlanProgress;

    routes: Array<string>;

    tunnels: Array<string>;

    lifecycle_errors?: { [key: string]: Status.LifecycleErrors };
  }

  export namespace Status {
    export interface ApplyProgress {
      done: number;

      total: number;
    }

    export interface PlanProgress {
      done: number;

      total: number;
    }

    export interface LifecycleErrors {
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

      meta?: LifecycleErrors.Meta;

      source?: LifecycleErrors.Source;
    }

    export namespace LifecycleErrors {
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

  export interface VPCsByID {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: VPCsByID.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: VPCsByID.Observations };

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

    sections: Array<VPCsByID.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<VPCsByID.ManagedBy>;
  }

  export namespace VPCsByID {
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
}

export interface OnRampListResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  install_routes_in_cloud: boolean;

  install_routes_in_magic_wan: boolean;

  name: string;

  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  updated_at: string;

  attached_hubs?: Array<string>;

  attached_vpcs?: Array<string>;

  description?: string;

  hub?: string;

  last_applied_at?: string;

  last_exported_at?: string;

  last_planned_at?: string;

  manage_hub_to_hub_attachments?: boolean;

  manage_vpc_to_hub_attachments?: boolean;

  planned_monthly_cost_estimate?: OnRampListResponse.PlannedMonthlyCostEstimate;

  planned_resources?: Array<OnRampListResponse.PlannedResource>;

  planned_resources_unavailable?: boolean;

  post_apply_monthly_cost_estimate?: OnRampListResponse.PostApplyMonthlyCostEstimate;

  post_apply_resources?: { [key: string]: OnRampListResponse.PostApplyResources };

  post_apply_resources_unavailable?: boolean;

  region?: string;

  status?: OnRampListResponse.Status;

  vpc?: string;

  vpcs_by_id?: { [key: string]: OnRampListResponse.VPCsByID };

  /**
   * The list of vpc IDs for which resource details failed to generate.
   */
  vpcs_by_id_unavailable?: Array<string>;
}

export namespace OnRampListResponse {
  export interface PlannedMonthlyCostEstimate {
    currency: string;

    current_monthly_cost: number;

    diff: number;

    proposed_monthly_cost: number;
  }

  export interface PlannedResource {
    diff: PlannedResource.Diff;

    keys_require_replace: Array<string>;

    monthly_cost_estimate_diff: PlannedResource.MonthlyCostEstimateDiff;

    planned_action: 'no_op' | 'create' | 'update' | 'replace' | 'destroy';

    resource: PlannedResource.Resource;
  }

  export namespace PlannedResource {
    export interface Diff {
      diff: string;

      left_description: string;

      left_yaml: string;

      right_description: string;

      right_yaml: string;
    }

    export interface MonthlyCostEstimateDiff {
      currency: string;

      current_monthly_cost: number;

      diff: number;

      proposed_monthly_cost: number;
    }

    export interface Resource {
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

  export interface PostApplyMonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface PostApplyResources {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: PostApplyResources.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: PostApplyResources.Observations };

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

    sections: Array<PostApplyResources.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<PostApplyResources.ManagedBy>;
  }

  export namespace PostApplyResources {
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

  export interface Status {
    apply_progress: Status.ApplyProgress;

    lifecycle_state:
      | 'OnrampNeedsApply'
      | 'OnrampPendingPlan'
      | 'OnrampPlanning'
      | 'OnrampPlanFailed'
      | 'OnrampPendingApproval'
      | 'OnrampPendingApply'
      | 'OnrampApplying'
      | 'OnrampApplyFailed'
      | 'OnrampActive'
      | 'OnrampPendingDestroy'
      | 'OnrampDestroying'
      | 'OnrampDestroyFailed';

    plan_progress: Status.PlanProgress;

    routes: Array<string>;

    tunnels: Array<string>;

    lifecycle_errors?: { [key: string]: Status.LifecycleErrors };
  }

  export namespace Status {
    export interface ApplyProgress {
      done: number;

      total: number;
    }

    export interface PlanProgress {
      done: number;

      total: number;
    }

    export interface LifecycleErrors {
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

      meta?: LifecycleErrors.Meta;

      source?: LifecycleErrors.Source;
    }

    export namespace LifecycleErrors {
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

  export interface VPCsByID {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: VPCsByID.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: VPCsByID.Observations };

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

    sections: Array<VPCsByID.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<VPCsByID.ManagedBy>;
  }

  export namespace VPCsByID {
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
}

export interface OnRampDeleteResponse {
  id: string;
}

export interface OnRampApplyResponse {
  errors: Array<OnRampApplyResponse.Error>;

  messages: Array<OnRampApplyResponse.Message>;

  success: boolean;
}

export namespace OnRampApplyResponse {
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

export interface OnRampEditResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  install_routes_in_cloud: boolean;

  install_routes_in_magic_wan: boolean;

  name: string;

  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  updated_at: string;

  attached_hubs?: Array<string>;

  attached_vpcs?: Array<string>;

  description?: string;

  hub?: string;

  last_applied_at?: string;

  last_exported_at?: string;

  last_planned_at?: string;

  manage_hub_to_hub_attachments?: boolean;

  manage_vpc_to_hub_attachments?: boolean;

  planned_monthly_cost_estimate?: OnRampEditResponse.PlannedMonthlyCostEstimate;

  planned_resources?: Array<OnRampEditResponse.PlannedResource>;

  planned_resources_unavailable?: boolean;

  post_apply_monthly_cost_estimate?: OnRampEditResponse.PostApplyMonthlyCostEstimate;

  post_apply_resources?: { [key: string]: OnRampEditResponse.PostApplyResources };

  post_apply_resources_unavailable?: boolean;

  region?: string;

  status?: OnRampEditResponse.Status;

  vpc?: string;

  vpcs_by_id?: { [key: string]: OnRampEditResponse.VPCsByID };

  /**
   * The list of vpc IDs for which resource details failed to generate.
   */
  vpcs_by_id_unavailable?: Array<string>;
}

export namespace OnRampEditResponse {
  export interface PlannedMonthlyCostEstimate {
    currency: string;

    current_monthly_cost: number;

    diff: number;

    proposed_monthly_cost: number;
  }

  export interface PlannedResource {
    diff: PlannedResource.Diff;

    keys_require_replace: Array<string>;

    monthly_cost_estimate_diff: PlannedResource.MonthlyCostEstimateDiff;

    planned_action: 'no_op' | 'create' | 'update' | 'replace' | 'destroy';

    resource: PlannedResource.Resource;
  }

  export namespace PlannedResource {
    export interface Diff {
      diff: string;

      left_description: string;

      left_yaml: string;

      right_description: string;

      right_yaml: string;
    }

    export interface MonthlyCostEstimateDiff {
      currency: string;

      current_monthly_cost: number;

      diff: number;

      proposed_monthly_cost: number;
    }

    export interface Resource {
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

  export interface PostApplyMonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface PostApplyResources {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: PostApplyResources.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: PostApplyResources.Observations };

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

    sections: Array<PostApplyResources.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<PostApplyResources.ManagedBy>;
  }

  export namespace PostApplyResources {
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

  export interface Status {
    apply_progress: Status.ApplyProgress;

    lifecycle_state:
      | 'OnrampNeedsApply'
      | 'OnrampPendingPlan'
      | 'OnrampPlanning'
      | 'OnrampPlanFailed'
      | 'OnrampPendingApproval'
      | 'OnrampPendingApply'
      | 'OnrampApplying'
      | 'OnrampApplyFailed'
      | 'OnrampActive'
      | 'OnrampPendingDestroy'
      | 'OnrampDestroying'
      | 'OnrampDestroyFailed';

    plan_progress: Status.PlanProgress;

    routes: Array<string>;

    tunnels: Array<string>;

    lifecycle_errors?: { [key: string]: Status.LifecycleErrors };
  }

  export namespace Status {
    export interface ApplyProgress {
      done: number;

      total: number;
    }

    export interface PlanProgress {
      done: number;

      total: number;
    }

    export interface LifecycleErrors {
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

      meta?: LifecycleErrors.Meta;

      source?: LifecycleErrors.Source;
    }

    export namespace LifecycleErrors {
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

  export interface VPCsByID {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: VPCsByID.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: VPCsByID.Observations };

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

    sections: Array<VPCsByID.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<VPCsByID.ManagedBy>;
  }

  export namespace VPCsByID {
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
}

export interface OnRampGetResponse {
  id: string;

  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  install_routes_in_cloud: boolean;

  install_routes_in_magic_wan: boolean;

  name: string;

  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  updated_at: string;

  attached_hubs?: Array<string>;

  attached_vpcs?: Array<string>;

  description?: string;

  hub?: string;

  last_applied_at?: string;

  last_exported_at?: string;

  last_planned_at?: string;

  manage_hub_to_hub_attachments?: boolean;

  manage_vpc_to_hub_attachments?: boolean;

  planned_monthly_cost_estimate?: OnRampGetResponse.PlannedMonthlyCostEstimate;

  planned_resources?: Array<OnRampGetResponse.PlannedResource>;

  planned_resources_unavailable?: boolean;

  post_apply_monthly_cost_estimate?: OnRampGetResponse.PostApplyMonthlyCostEstimate;

  post_apply_resources?: { [key: string]: OnRampGetResponse.PostApplyResources };

  post_apply_resources_unavailable?: boolean;

  region?: string;

  status?: OnRampGetResponse.Status;

  vpc?: string;

  vpcs_by_id?: { [key: string]: OnRampGetResponse.VPCsByID };

  /**
   * The list of vpc IDs for which resource details failed to generate.
   */
  vpcs_by_id_unavailable?: Array<string>;
}

export namespace OnRampGetResponse {
  export interface PlannedMonthlyCostEstimate {
    currency: string;

    current_monthly_cost: number;

    diff: number;

    proposed_monthly_cost: number;
  }

  export interface PlannedResource {
    diff: PlannedResource.Diff;

    keys_require_replace: Array<string>;

    monthly_cost_estimate_diff: PlannedResource.MonthlyCostEstimateDiff;

    planned_action: 'no_op' | 'create' | 'update' | 'replace' | 'destroy';

    resource: PlannedResource.Resource;
  }

  export namespace PlannedResource {
    export interface Diff {
      diff: string;

      left_description: string;

      left_yaml: string;

      right_description: string;

      right_yaml: string;
    }

    export interface MonthlyCostEstimateDiff {
      currency: string;

      current_monthly_cost: number;

      diff: number;

      proposed_monthly_cost: number;
    }

    export interface Resource {
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

  export interface PostApplyMonthlyCostEstimate {
    currency: string;

    monthly_cost: number;
  }

  export interface PostApplyResources {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: PostApplyResources.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: PostApplyResources.Observations };

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

    sections: Array<PostApplyResources.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<PostApplyResources.ManagedBy>;
  }

  export namespace PostApplyResources {
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

  export interface Status {
    apply_progress: Status.ApplyProgress;

    lifecycle_state:
      | 'OnrampNeedsApply'
      | 'OnrampPendingPlan'
      | 'OnrampPlanning'
      | 'OnrampPlanFailed'
      | 'OnrampPendingApproval'
      | 'OnrampPendingApply'
      | 'OnrampApplying'
      | 'OnrampApplyFailed'
      | 'OnrampActive'
      | 'OnrampPendingDestroy'
      | 'OnrampDestroying'
      | 'OnrampDestroyFailed';

    plan_progress: Status.PlanProgress;

    routes: Array<string>;

    tunnels: Array<string>;

    lifecycle_errors?: { [key: string]: Status.LifecycleErrors };
  }

  export namespace Status {
    export interface ApplyProgress {
      done: number;

      total: number;
    }

    export interface PlanProgress {
      done: number;

      total: number;
    }

    export interface LifecycleErrors {
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

      meta?: LifecycleErrors.Meta;

      source?: LifecycleErrors.Source;
    }

    export namespace LifecycleErrors {
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

  export interface VPCsByID {
    id: string;

    account_id: string;

    cloud_type: 'AWS' | 'AZURE' | 'GOOGLE' | 'CLOUDFLARE';

    config: { [key: string]: unknown };

    deployment_provider: string;

    managed: boolean;

    monthly_cost_estimate: VPCsByID.MonthlyCostEstimate;

    name: string;

    native_id: string;

    observations: { [key: string]: VPCsByID.Observations };

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

    sections: Array<VPCsByID.Section>;

    state: { [key: string]: unknown };

    tags: { [key: string]: string };

    updated_at: string;

    url: string;

    managed_by?: Array<VPCsByID.ManagedBy>;
  }

  export namespace VPCsByID {
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
}

export interface OnRampPlanResponse {
  errors: Array<OnRampPlanResponse.Error>;

  messages: Array<OnRampPlanResponse.Message>;

  success: boolean;
}

export namespace OnRampPlanResponse {
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

export interface OnRampCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  cloud_type: 'AWS' | 'AZURE' | 'GOOGLE';

  /**
   * Body param:
   */
  install_routes_in_cloud: boolean;

  /**
   * Body param:
   */
  install_routes_in_magic_wan: boolean;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  type: 'OnrampTypeSingle' | 'OnrampTypeHub';

  /**
   * Body param:
   */
  adopted_hub_id?: string;

  /**
   * Body param:
   */
  attached_hubs?: Array<string>;

  /**
   * Body param:
   */
  attached_vpcs?: Array<string>;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  hub_provider_id?: string;

  /**
   * Body param:
   */
  manage_hub_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  manage_vpc_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  region?: string;

  /**
   * Body param:
   */
  vpc?: string;

  /**
   * Header param:
   */
  forwarded?: string;
}

export interface OnRampUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  attached_hubs?: Array<string>;

  /**
   * Body param:
   */
  attached_vpcs?: Array<string>;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  install_routes_in_cloud?: boolean;

  /**
   * Body param:
   */
  install_routes_in_magic_wan?: boolean;

  /**
   * Body param:
   */
  manage_hub_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  manage_vpc_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  vpc?: string;
}

export interface OnRampListParams {
  /**
   * Path param:
   */
  account_id: string;

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

  /**
   * Query param:
   */
  vpcs?: boolean;
}

export interface OnRampDeleteParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  destroy?: boolean;

  /**
   * Query param:
   */
  force?: boolean;
}

export interface OnRampApplyParams {
  account_id: string;
}

export interface OnRampEditParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  attached_hubs?: Array<string>;

  /**
   * Body param:
   */
  attached_vpcs?: Array<string>;

  /**
   * Body param:
   */
  description?: string;

  /**
   * Body param:
   */
  install_routes_in_cloud?: boolean;

  /**
   * Body param:
   */
  install_routes_in_magic_wan?: boolean;

  /**
   * Body param:
   */
  manage_hub_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  manage_vpc_to_hub_attachments?: boolean;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  vpc?: string;
}

export interface OnRampExportParams {
  account_id: string;
}

export interface OnRampGetParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  planned_resources?: boolean;

  /**
   * Query param:
   */
  post_apply_resources?: boolean;

  /**
   * Query param:
   */
  status?: boolean;

  /**
   * Query param:
   */
  vpcs?: boolean;
}

export interface OnRampPlanParams {
  account_id: string;
}

OnRamps.OnRampListResponsesSinglePage = OnRampListResponsesSinglePage;
OnRamps.AddressSpaces = AddressSpaces;

export declare namespace OnRamps {
  export {
    type OnRampCreateResponse as OnRampCreateResponse,
    type OnRampUpdateResponse as OnRampUpdateResponse,
    type OnRampListResponse as OnRampListResponse,
    type OnRampDeleteResponse as OnRampDeleteResponse,
    type OnRampApplyResponse as OnRampApplyResponse,
    type OnRampEditResponse as OnRampEditResponse,
    type OnRampGetResponse as OnRampGetResponse,
    type OnRampPlanResponse as OnRampPlanResponse,
    OnRampListResponsesSinglePage as OnRampListResponsesSinglePage,
    type OnRampCreateParams as OnRampCreateParams,
    type OnRampUpdateParams as OnRampUpdateParams,
    type OnRampListParams as OnRampListParams,
    type OnRampDeleteParams as OnRampDeleteParams,
    type OnRampApplyParams as OnRampApplyParams,
    type OnRampEditParams as OnRampEditParams,
    type OnRampExportParams as OnRampExportParams,
    type OnRampGetParams as OnRampGetParams,
    type OnRampPlanParams as OnRampPlanParams,
  };

  export {
    AddressSpaces as AddressSpaces,
    type AddressSpaceUpdateResponse as AddressSpaceUpdateResponse,
    type AddressSpaceListResponse as AddressSpaceListResponse,
    type AddressSpaceEditResponse as AddressSpaceEditResponse,
    type AddressSpaceUpdateParams as AddressSpaceUpdateParams,
    type AddressSpaceListParams as AddressSpaceListParams,
    type AddressSpaceEditParams as AddressSpaceEditParams,
  };
}
