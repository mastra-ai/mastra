
import { Integration, IntegrationAuth, OpenAPI } from '@arkw/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets'
import { z } from 'zod'
import openapi from './openapi'
import { ListAssigneeFieldAssignableGroupsAndAgentsSearch } from './events/ListAssigneeFieldAssignableGroupsAndAgentsSearch'
import { ListAssigneeFieldAssignableGroups } from './events/ListAssigneeFieldAssignableGroups'
import { ListAssigneeFieldAssignableGroupAgents } from './events/ListAssigneeFieldAssignableGroupAgents'
import { GetSourcesByTar } from './events/GetSourcesByTar'
import { ShowAccountSettings } from './events/ShowAccountSettings'
import { ListActivities } from './events/ListActivities'
import { ShowActivity } from './events/ShowActivity'
import { CountActivities } from './events/CountActivities'
import { ShowAttachment } from './events/ShowAttachment'
import { ListAuditLogs } from './events/ListAuditLogs'
import { ShowAuditLog } from './events/ShowAuditLog'
import { AutocompleteTags } from './events/AutocompleteTags'
import { ListAutomations } from './events/ListAutomations'
import { ShowAutomation } from './events/ShowAutomation'
import { ListActiveAutomations } from './events/ListActiveAutomations'
import { SearchAutomations } from './events/SearchAutomations'
import { ListBookmarks } from './events/ListBookmarks'
import { ListBrands } from './events/ListBrands'
import { ShowBrand } from './events/ShowBrand'
import { CheckHostMappingValidityForExistingBrand } from './events/CheckHostMappingValidityForExistingBrand'
import { CheckHostMappingValidity } from './events/CheckHostMappingValidity'
import { ListMonitoredTwitterHandles } from './events/ListMonitoredTwitterHandles'
import { ShowMonitoredTwitterHandle } from './events/ShowMonitoredTwitterHandle'
import { GettingTwicketStatus } from './events/GettingTwicketStatus'
import { ListCustomObjects } from './events/ListCustomObjects'
import { ShowCustomObject } from './events/ShowCustomObject'
import { ListCustomObjectFields } from './events/ListCustomObjectFields'
import { ShowCustomObjectField } from './events/ShowCustomObjectField'
import { CustomObjectFieldsLimit } from './events/CustomObjectFieldsLimit'
import { ListCustomObjectRecords } from './events/ListCustomObjectRecords'
import { ShowCustomObjectRecord } from './events/ShowCustomObjectRecord'
import { AutocompleteCustomObjectRecordSearch } from './events/AutocompleteCustomObjectRecordSearch'
import { SearchCustomObjectRecords } from './events/SearchCustomObjectRecords'
import { ListObjectTriggers } from './events/ListObjectTriggers'
import { GetObjectTrigger } from './events/GetObjectTrigger'
import { ListActiveObjectTriggers } from './events/ListActiveObjectTriggers'
import { ListObjectTriggersDefinitions } from './events/ListObjectTriggersDefinitions'
import { SearchObjectTriggers } from './events/SearchObjectTriggers'
import { CustomObjectsLimit } from './events/CustomObjectsLimit'
import { CustomObjectRecordsLimit } from './events/CustomObjectRecordsLimit'
import { ListCustomRoles } from './events/ListCustomRoles'
import { ShowCustomRoleById } from './events/ShowCustomRoleById'
import { ListCustomStatuses } from './events/ListCustomStatuses'
import { ShowCustomStatus } from './events/ShowCustomStatus'
import { ListDeletedTickets } from './events/ListDeletedTickets'
import { ListDeletedUsers } from './events/ListDeletedUsers'
import { ShowDeletedUser } from './events/ShowDeletedUser'
import { CountDeletedUsers } from './events/CountDeletedUsers'
import { ListDynamicContents } from './events/ListDynamicContents'
import { ShowDynamicContentItem } from './events/ShowDynamicContentItem'
import { DynamicContentListVariants } from './events/DynamicContentListVariants'
import { ShowDynamicContentVariant } from './events/ShowDynamicContentVariant'
import { ShowManyDynamicContents } from './events/ShowManyDynamicContents'
import { ListEmailNotifications } from './events/ListEmailNotifications'
import { ShowEmailNotification } from './events/ShowEmailNotification'
import { ListGroupMemberships } from './events/ListGroupMemberships'
import { ShowGroupMembershipById } from './events/ShowGroupMembershipById'
import { ListAssignableGroupMemberships } from './events/ListAssignableGroupMemberships'
import { ListGroupSLAPolicies } from './events/ListGroupSLAPolicies'
import { ShowGroupSLAPolicy } from './events/ShowGroupSLAPolicy'
import { RetrieveGroupSLAPolicyFilterDefinitionItems } from './events/RetrieveGroupSLAPolicyFilterDefinitionItems'
import { ListGroups } from './events/ListGroups'
import { ShowGroupById } from './events/ShowGroupById'
import { ListAssignableGroups } from './events/ListAssignableGroups'
import { CountGroups } from './events/CountGroups'
import { IncrementalSampleExport } from './events/IncrementalSampleExport'
import { IncrementalOrganizationExport } from './events/IncrementalOrganizationExport'
import { IncrementalSkilBasedRoutingAttributeValuesExport } from './events/IncrementalSkilBasedRoutingAttributeValuesExport'
import { IncrementalSkilBasedRoutingAttributesExport } from './events/IncrementalSkilBasedRoutingAttributesExport'
import { IncrementalSkilBasedRoutingInstanceValuesExport } from './events/IncrementalSkilBasedRoutingInstanceValuesExport'
import { IncrementalTicketEvents } from './events/IncrementalTicketEvents'
import { ListTicketMetricEvents } from './events/ListTicketMetricEvents'
import { IncrementalTicketExportTime } from './events/IncrementalTicketExportTime'
import { IncrementalTicketExportCursor } from './events/IncrementalTicketExportCursor'
import { IncrementalUserExportTime } from './events/IncrementalUserExportTime'
import { IncrementalUserExportCursor } from './events/IncrementalUserExportCursor'
import { ListJobStatuses } from './events/ListJobStatuses'
import { ShowJobStatus } from './events/ShowJobStatus'
import { ShowManyJobStatuses } from './events/ShowManyJobStatuses'
import { ListLocales } from './events/ListLocales'
import { ShowLocaleById } from './events/ShowLocaleById'
import { ListLocalesForAgent } from './events/ListLocalesForAgent'
import { ShowCurrentLocale } from './events/ShowCurrentLocale'
import { DetectBestLocale } from './events/DetectBestLocale'
import { ListAvailablePublicLocales } from './events/ListAvailablePublicLocales'
import { ListMacros } from './events/ListMacros'
import { ShowMacro } from './events/ShowMacro'
import { ShowChangesToTicket } from './events/ShowChangesToTicket'
import { ListMacroAttachments } from './events/ListMacroAttachments'
import { ListActiveMacros } from './events/ListActiveMacros'
import { ShowMacroAttachment } from './events/ShowMacroAttachment'
import { ListMacroCategories } from './events/ListMacroCategories'
import { ShowDerivedMacro } from './events/ShowDerivedMacro'
import { SearchMacro } from './events/SearchMacro'
import { ShowEssentialsCard } from './events/ShowEssentialsCard'
import { ShowEssentialsCards } from './events/ShowEssentialsCards'
import { ListOrganizationFields } from './events/ListOrganizationFields'
import { ShowOrganizationField } from './events/ShowOrganizationField'
import { ListOrganizationMemberships } from './events/ListOrganizationMemberships'
import { ShowOrganizationMembershipById } from './events/ShowOrganizationMembershipById'
import { ShowOrganizationMerge } from './events/ShowOrganizationMerge'
import { ListOrganizationSubscriptions } from './events/ListOrganizationSubscriptions'
import { ShowOrganizationSubscription } from './events/ShowOrganizationSubscription'
import { ListOrganizations } from './events/ListOrganizations'
import { ShowOrganization } from './events/ShowOrganization'
import { ListOrganizationMerges } from './events/ListOrganizationMerges'
import { OrganizationRelated } from './events/OrganizationRelated'
import { AutocompleteOrganizations } from './events/AutocompleteOrganizations'
import { CountOrganizations } from './events/CountOrganizations'
import { SearchOrganizations } from './events/SearchOrganizations'
import { ShowManyOrganizations } from './events/ShowManyOrganizations'
import { ListTicketProblems } from './events/ListTicketProblems'
import { ListQueues } from './events/ListQueues'
import { ShowQueueById } from './events/ShowQueueById'
import { ListQueueDefinitions } from './events/ListQueueDefinitions'
import { ListSupportAddresses } from './events/ListSupportAddresses'
import { ShowSupportAddress } from './events/ShowSupportAddress'
import { GetRelationshipFilterDefinitions } from './events/GetRelationshipFilterDefinitions'
import { ListRequests } from './events/ListRequests'
import { ShowRequest } from './events/ShowRequest'
import { ListComments } from './events/ListComments'
import { ShowComment } from './events/ShowComment'
import { SearchRequests } from './events/SearchRequests'
import { ListResourceCollections } from './events/ListResourceCollections'
import { RetrieveResourceCollection } from './events/RetrieveResourceCollection'
import { ListAGentAttributeValues } from './events/ListAGentAttributeValues'
import { ListAccountAttributes } from './events/ListAccountAttributes'
import { ShowAttribute } from './events/ShowAttribute'
import { ListAttributeValues } from './events/ListAttributeValues'
import { ShowAttributeValue } from './events/ShowAttributeValue'
import { ListRoutingAttributeDefinitions } from './events/ListRoutingAttributeDefinitions'
import { ListTicketsFullfilledByUser } from './events/ListTicketsFullfilledByUser'
import { ListTicketAttributeValues } from './events/ListTicketAttributeValues'
import { ListSatisfactionRatings } from './events/ListSatisfactionRatings'
import { ShowSatisfactionRating } from './events/ShowSatisfactionRating'
import { CountSatisfactionRatings } from './events/CountSatisfactionRatings'
import { ListSatisfactionRatingReasons } from './events/ListSatisfactionRatingReasons'
import { ShowSatisfactionRatings } from './events/ShowSatisfactionRatings'
import { ListSearchResults } from './events/ListSearchResults'
import { CountSearchResults } from './events/CountSearchResults'
import { ExportSearchResults } from './events/ExportSearchResults'
import { ListSessions } from './events/ListSessions'
import { ListSharingAgreements } from './events/ListSharingAgreements'
import { ShowSharingAgreement } from './events/ShowSharingAgreement'
import { ListSLAPolicies } from './events/ListSLAPolicies'
import { ShowSLAPolicy } from './events/ShowSLAPolicy'
import { RetrieveSLAPolicyFilterDefinitionItems } from './events/RetrieveSLAPolicyFilterDefinitionItems'
import { ListSuspendedTickets } from './events/ListSuspendedTickets'
import { ShowSuspendedTickets } from './events/ShowSuspendedTickets'
import { ListTags } from './events/ListTags'
import { CountTags } from './events/CountTags'
import { ListTarFailures } from './events/ListTarFailures'
import { ShowTarFailure } from './events/ShowTarFailure'
import { ListTars } from './events/ListTars'
import { ShowTar } from './events/ShowTar'
import { ListTicketAudits } from './events/ListTicketAudits'
import { ListTicketFields } from './events/ListTicketFields'
import { ShowTicketfield } from './events/ShowTicketfield'
import { ListTicketFieldOptions } from './events/ListTicketFieldOptions'
import { ShowTicketFieldOption } from './events/ShowTicketFieldOption'
import { CountTicketFields } from './events/CountTicketFields'
import { ListTicketForms } from './events/ListTicketForms'
import { ShowTicketForm } from './events/ShowTicketForm'
import { ShowManyTicketForms } from './events/ShowManyTicketForms'
import { ListTicketMetrics } from './events/ListTicketMetrics'
import { ShowTicketMetrics } from './events/ShowTicketMetrics'
import { ListTickets } from './events/ListTickets'
import { ShowTicket } from './events/ShowTicket'
import { ListAuditsForTicket } from './events/ListAuditsForTicket'
import { ShowTicketAudit } from './events/ShowTicketAudit'
import { CountAuditsForTicket } from './events/CountAuditsForTicket'
import { ListTicketCollaborators } from './events/ListTicketCollaborators'
import { ListTicketComments } from './events/ListTicketComments'
import { CountTicketComments } from './events/CountTicketComments'
import { ListTicketEmailCCs } from './events/ListTicketEmailCCs'
import { ListTicketFollowers } from './events/ListTicketFollowers'
import { ListTicketIncidents } from './events/ListTicketIncidents'
import { ShowTicketAfterChanges } from './events/ShowTicketAfterChanges'
import { TicketRelatedInformation } from './events/TicketRelatedInformation'
import { ListResourceTags } from './events/ListResourceTags'
import { TicketsShowMany } from './events/TicketsShowMany'
import { ShowTriggerCategoryById } from './events/ShowTriggerCategoryById'
import { ListTriggers } from './events/ListTriggers'
import { GetTrigger } from './events/GetTrigger'
import { ListTriggerRevisions } from './events/ListTriggerRevisions'
import { TriggerRevision } from './events/TriggerRevision'
import { ListActiveTriggers } from './events/ListActiveTriggers'
import { ListTriggerActionConditionDefinitions } from './events/ListTriggerActionConditionDefinitions'
import { SearchTriggers } from './events/SearchTriggers'
import { ListUserFields } from './events/ListUserFields'
import { ShowUserField } from './events/ShowUserField'
import { ListUserFieldOptions } from './events/ListUserFieldOptions'
import { ShowUserFieldOption } from './events/ShowUserFieldOption'
import { ListUsers } from './events/ListUsers'
import { ShowUser } from './events/ShowUser'
import { ShowUserComplianceDeletionStatuses } from './events/ShowUserComplianceDeletionStatuses'
import { ListUserIdentities } from './events/ListUserIdentities'
import { ShowUserIdentity } from './events/ShowUserIdentity'
import { GetUserPasswordRequirements } from './events/GetUserPasswordRequirements'
import { ShowUserRelated } from './events/ShowUserRelated'
import { ShowSession } from './events/ShowSession'
import { ListTicketSkips } from './events/ListTicketSkips'
import { AutocompleteUsers } from './events/AutocompleteUsers'
import { CountUsers } from './events/CountUsers'
import { ShowCurrentUser } from './events/ShowCurrentUser'
import { ShowCurrentlyAuthenticatedSession } from './events/ShowCurrentlyAuthenticatedSession'
import { RenewCurrentSession } from './events/RenewCurrentSession'
import { SearchUsers } from './events/SearchUsers'
import { ShowManyUsers } from './events/ShowManyUsers'
import { ListViews } from './events/ListViews'
import { ShowView } from './events/ShowView'
import { GetViewCount } from './events/GetViewCount'
import { ExecuteView } from './events/ExecuteView'
import { ExportView } from './events/ExportView'
import { ListTicketsFromView } from './events/ListTicketsFromView'
import { ListActiveViews } from './events/ListActiveViews'
import { ListCompactViews } from './events/ListCompactViews'
import { CountViews } from './events/CountViews'
import { GetViewCounts } from './events/GetViewCounts'
import { SearchViews } from './events/SearchViews'
import { ListViewsById } from './events/ListViewsById'
import { ListWorkspaces } from './events/ListWorkspaces'

type ZendeskConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  [key: string]: any;
};

export class ZendeskIntegration extends Integration {
  config: ZendeskConfig;

  constructor({ config }: { config: ZendeskConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'ZENDESK',
      logoUrl: "TODO",
    });

    this.config = config;
  }

  registerEvents() {
    this.events = {
             'zendesk.ListAssigneeFieldAssignableGroupsAndAgentsSearch/sync': {
                schema: z.object({
                  'AssigneeFieldSearchValue': z.string()}),
                handler: ListAssigneeFieldAssignableGroupsAndAgentsSearch,
            },
        

             'zendesk.ListAssigneeFieldAssignableGroups/sync': {
                schema: z.object({}),
                handler: ListAssigneeFieldAssignableGroups,
            },
        

             'zendesk.ListAssigneeFieldAssignableGroupAgents/sync': {
                schema: z.object({
                  'group_id': z.string(),
'GroupId': z.string()}),
                handler: ListAssigneeFieldAssignableGroupAgents,
            },
        

             'zendesk.GetSourcesByTar/sync': {
                schema: z.object({
                  'target_type': z.string(),
'target_id': z.string(),
'field_id': z.string(),
'source_type': z.string(),
'target_id': z.number(),
'field_id': z.number()}),
                handler: GetSourcesByTar,
            },
        

             'zendesk.ShowAccountSettings/sync': {
                schema: z.object({}),
                handler: ShowAccountSettings,
            },
        

             'zendesk.ListActivities/sync': {
                schema: z.object({}),
                handler: ListActivities,
            },
        

             'zendesk.ShowActivity/sync': {
                schema: z.object({
                  'activity_id': z.string()}),
                handler: ShowActivity,
            },
        

             'zendesk.CountActivities/sync': {
                schema: z.object({}),
                handler: CountActivities,
            },
        

             'zendesk.ShowAttachment/sync': {
                schema: z.object({
                  'attachment_id': z.string(),
'AttachmentId': z.string()}),
                handler: ShowAttachment,
            },
        

             'zendesk.ListAuditLogs/sync': {
                schema: z.object({
                  'filter[source_type]': z.string(),
'filter[source_id]': z.number(),
'filter[actor_id]': z.number(),
'filter[ip_address]': z.string(),
'filter[created_at]': z.string(),
'filter[action]': z.string(),
'sort_by': z.string(),
'sort_order': z.string(),
'sort': z.string()}),
                handler: ListAuditLogs,
            },
        

             'zendesk.ShowAuditLog/sync': {
                schema: z.object({
                  'audit_log_id': z.string()}),
                handler: ShowAuditLog,
            },
        

             'zendesk.AutocompleteTags/sync': {
                schema: z.object({}),
                handler: AutocompleteTags,
            },
        

             'zendesk.ListAutomations/sync': {
                schema: z.object({}),
                handler: ListAutomations,
            },
        

             'zendesk.ShowAutomation/sync': {
                schema: z.object({
                  'automation_id': z.string()}),
                handler: ShowAutomation,
            },
        

             'zendesk.ListActiveAutomations/sync': {
                schema: z.object({}),
                handler: ListActiveAutomations,
            },
        

             'zendesk.SearchAutomations/sync': {
                schema: z.object({}),
                handler: SearchAutomations,
            },
        

             'zendesk.ListBookmarks/sync': {
                schema: z.object({}),
                handler: ListBookmarks,
            },
        

             'zendesk.ListBrands/sync': {
                schema: z.object({}),
                handler: ListBrands,
            },
        

             'zendesk.ShowBrand/sync': {
                schema: z.object({
                  'brand_id': z.string(),
'BrandId': z.string()}),
                handler: ShowBrand,
            },
        

             'zendesk.CheckHostMappingValidityForExistingBrand/sync': {
                schema: z.object({
                  'brand_id': z.string(),
'BrandId': z.string()}),
                handler: CheckHostMappingValidityForExistingBrand,
            },
        

             'zendesk.CheckHostMappingValidity/sync': {
                schema: z.object({
                  'HostMapping': z.string(),
'Subdomain': z.string()}),
                handler: CheckHostMappingValidity,
            },
        

             'zendesk.ListMonitoredTwitterHandles/sync': {
                schema: z.object({}),
                handler: ListMonitoredTwitterHandles,
            },
        

             'zendesk.ShowMonitoredTwitterHandle/sync': {
                schema: z.object({
                  'monitored_twitter_handle_id': z.string()}),
                handler: ShowMonitoredTwitterHandle,
            },
        

             'zendesk.GettingTwicketStatus/sync': {
                schema: z.object({
                  'comment_id': z.string(),
'ids': z.string()}),
                handler: GettingTwicketStatus,
            },
        

             'zendesk.ListCustomObjects/sync': {
                schema: z.object({}),
                handler: ListCustomObjects,
            },
        

             'zendesk.ShowCustomObject/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string()}),
                handler: ShowCustomObject,
            },
        

             'zendesk.ListCustomObjectFields/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string(),
'IncludeStandardFields': z.string()}),
                handler: ListCustomObjectFields,
            },
        

             'zendesk.ShowCustomObjectField/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'custom_object_field_key_or_id': z.string(),
'CustomObjectKey': z.string(),
'CustomObjectFieldKeyOrId': z.string()}),
                handler: ShowCustomObjectField,
            },
        

             'zendesk.CustomObjectFieldsLimit/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string()}),
                handler: CustomObjectFieldsLimit,
            },
        

             'zendesk.ListCustomObjectRecords/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string(),
'filter[ids]': z.string(),
'filter[external_ids]': z.string(),
'sort': z.string(),
'page[before]': z.string(),
'page[after]': z.string(),
'page[size]': z.number()}),
                handler: ListCustomObjectRecords,
            },
        

             'zendesk.ShowCustomObjectRecord/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'custom_object_record_id': z.string(),
'CustomObjectKey': z.string(),
'CustomObjectRecordId': z.string()}),
                handler: ShowCustomObjectRecord,
            },
        

             'zendesk.AutocompleteCustomObjectRecordSearch/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string(),
'name': z.string(),
'page[before]': z.string(),
'page[after]': z.string(),
'page[size]': z.number(),
'field_id': z.string(),
'source': z.string(),
'requester_id': z.number(),
'assignee_id': z.number(),
'organization_id': z.number()}),
                handler: AutocompleteCustomObjectRecordSearch,
            },
        

             'zendesk.SearchCustomObjectRecords/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'CustomObjectKey': z.string(),
'query': z.string(),
'sort': z.string(),
'page[before]': z.string(),
'page[after]': z.string(),
'page[size]': z.number()}),
                handler: SearchCustomObjectRecords,
            },
        

             'zendesk.ListObjectTriggers/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'TriggerActive': z.string(),
'TriggerSortBy': z.string(),
'TriggerSortOrder': z.string()}),
                handler: ListObjectTriggers,
            },
        

             'zendesk.GetObjectTrigger/sync': {
                schema: z.object({
                  'custom_object_key': z.string(),
'trigger_id': z.string()}),
                handler: GetObjectTrigger,
            },
        

             'zendesk.ListActiveObjectTriggers/sync': {
                schema: z.object({
                  'custom_object_key': z.string()}),
                handler: ListActiveObjectTriggers,
            },
        

             'zendesk.ListObjectTriggersDefinitions/sync': {
                schema: z.object({
                  'custom_object_key': z.string()}),
                handler: ListObjectTriggersDefinitions,
            },
        

             'zendesk.SearchObjectTriggers/sync': {
                schema: z.object({
                  'custom_object_key': z.string()}),
                handler: SearchObjectTriggers,
            },
        

             'zendesk.CustomObjectsLimit/sync': {
                schema: z.object({}),
                handler: CustomObjectsLimit,
            },
        

             'zendesk.CustomObjectRecordsLimit/sync': {
                schema: z.object({}),
                handler: CustomObjectRecordsLimit,
            },
        

             'zendesk.ListCustomRoles/sync': {
                schema: z.object({}),
                handler: ListCustomRoles,
            },
        

             'zendesk.ShowCustomRoleById/sync': {
                schema: z.object({
                  'custom_role_id': z.string()}),
                handler: ShowCustomRoleById,
            },
        

             'zendesk.ListCustomStatuses/sync': {
                schema: z.object({
                  'status_categories': z.string(),
'active': z.boolean(),
'default': z.boolean()}),
                handler: ListCustomStatuses,
            },
        

             'zendesk.ShowCustomStatus/sync': {
                schema: z.object({
                  'custom_status_id': z.string(),
'CustomStatusId': z.string()}),
                handler: ShowCustomStatus,
            },
        

             'zendesk.ListDeletedTickets/sync': {
                schema: z.object({
                  'TicketSortBy': z.string(),
'TicketSortOrder': z.string()}),
                handler: ListDeletedTickets,
            },
        

             'zendesk.ListDeletedUsers/sync': {
                schema: z.object({}),
                handler: ListDeletedUsers,
            },
        

             'zendesk.ShowDeletedUser/sync': {
                schema: z.object({
                  'deleted_user_id': z.string()}),
                handler: ShowDeletedUser,
            },
        

             'zendesk.CountDeletedUsers/sync': {
                schema: z.object({}),
                handler: CountDeletedUsers,
            },
        

             'zendesk.ListDynamicContents/sync': {
                schema: z.object({}),
                handler: ListDynamicContents,
            },
        

             'zendesk.ShowDynamicContentItem/sync': {
                schema: z.object({
                  'dynamic_content_item_id': z.string()}),
                handler: ShowDynamicContentItem,
            },
        

             'zendesk.DynamicContentListVariants/sync': {
                schema: z.object({
                  'dynamic_content_item_id': z.string()}),
                handler: DynamicContentListVariants,
            },
        

             'zendesk.ShowDynamicContentVariant/sync': {
                schema: z.object({
                  'dynamic_content_item_id': z.string(),
'dynammic_content_variant_id': z.string()}),
                handler: ShowDynamicContentVariant,
            },
        

             'zendesk.ShowManyDynamicContents/sync': {
                schema: z.object({
                  'identifiers': z.string()}),
                handler: ShowManyDynamicContents,
            },
        

             'zendesk.ListEmailNotifications/sync': {
                schema: z.object({}),
                handler: ListEmailNotifications,
            },
        

             'zendesk.ShowEmailNotification/sync': {
                schema: z.object({
                  'notification_id': z.string()}),
                handler: ShowEmailNotification,
            },
        

             'zendesk.ListGroupMemberships/sync': {
                schema: z.object({
                  'GroupId': z.string(),
'UserId': z.string()}),
                handler: ListGroupMemberships,
            },
        

             'zendesk.ShowGroupMembershipById/sync': {
                schema: z.object({
                  'group_membership_id': z.string()}),
                handler: ShowGroupMembershipById,
            },
        

             'zendesk.ListAssignableGroupMemberships/sync': {
                schema: z.object({}),
                handler: ListAssignableGroupMemberships,
            },
        

             'zendesk.ListGroupSLAPolicies/sync': {
                schema: z.object({}),
                handler: ListGroupSLAPolicies,
            },
        

             'zendesk.ShowGroupSLAPolicy/sync': {
                schema: z.object({
                  'group_sla_policy_id': z.string()}),
                handler: ShowGroupSLAPolicy,
            },
        

             'zendesk.RetrieveGroupSLAPolicyFilterDefinitionItems/sync': {
                schema: z.object({}),
                handler: RetrieveGroupSLAPolicyFilterDefinitionItems,
            },
        

             'zendesk.ListGroups/sync': {
                schema: z.object({
                  'UserId': z.string(),
'ExcludeDeleted': z.string()}),
                handler: ListGroups,
            },
        

             'zendesk.ShowGroupById/sync': {
                schema: z.object({
                  'group_id': z.string()}),
                handler: ShowGroupById,
            },
        

             'zendesk.ListAssignableGroups/sync': {
                schema: z.object({}),
                handler: ListAssignableGroups,
            },
        

             'zendesk.CountGroups/sync': {
                schema: z.object({}),
                handler: CountGroups,
            },
        

             'zendesk.IncrementalSampleExport/sync': {
                schema: z.object({
                  'incremental_resource': z.string()}),
                handler: IncrementalSampleExport,
            },
        

             'zendesk.IncrementalOrganizationExport/sync': {
                schema: z.object({}),
                handler: IncrementalOrganizationExport,
            },
        

             'zendesk.IncrementalSkilBasedRoutingAttributeValuesExport/sync': {
                schema: z.object({}),
                handler: IncrementalSkilBasedRoutingAttributeValuesExport,
            },
        

             'zendesk.IncrementalSkilBasedRoutingAttributesExport/sync': {
                schema: z.object({}),
                handler: IncrementalSkilBasedRoutingAttributesExport,
            },
        

             'zendesk.IncrementalSkilBasedRoutingInstanceValuesExport/sync': {
                schema: z.object({}),
                handler: IncrementalSkilBasedRoutingInstanceValuesExport,
            },
        

             'zendesk.IncrementalTicketEvents/sync': {
                schema: z.object({}),
                handler: IncrementalTicketEvents,
            },
        

             'zendesk.ListTicketMetricEvents/sync': {
                schema: z.object({
                  'start_time': z.number()}),
                handler: ListTicketMetricEvents,
            },
        

             'zendesk.IncrementalTicketExportTime/sync': {
                schema: z.object({}),
                handler: IncrementalTicketExportTime,
            },
        

             'zendesk.IncrementalTicketExportCursor/sync': {
                schema: z.object({}),
                handler: IncrementalTicketExportCursor,
            },
        

             'zendesk.IncrementalUserExportTime/sync': {
                schema: z.object({}),
                handler: IncrementalUserExportTime,
            },
        

             'zendesk.IncrementalUserExportCursor/sync': {
                schema: z.object({}),
                handler: IncrementalUserExportCursor,
            },
        

             'zendesk.ListJobStatuses/sync': {
                schema: z.object({}),
                handler: ListJobStatuses,
            },
        

             'zendesk.ShowJobStatus/sync': {
                schema: z.object({
                  'job_status_id': z.string()}),
                handler: ShowJobStatus,
            },
        

             'zendesk.ShowManyJobStatuses/sync': {
                schema: z.object({
                  'ids': z.string()}),
                handler: ShowManyJobStatuses,
            },
        

             'zendesk.ListLocales/sync': {
                schema: z.object({}),
                handler: ListLocales,
            },
        

             'zendesk.ShowLocaleById/sync': {
                schema: z.object({
                  'locale_id': z.string()}),
                handler: ShowLocaleById,
            },
        

             'zendesk.ListLocalesForAgent/sync': {
                schema: z.object({}),
                handler: ListLocalesForAgent,
            },
        

             'zendesk.ShowCurrentLocale/sync': {
                schema: z.object({}),
                handler: ShowCurrentLocale,
            },
        

             'zendesk.DetectBestLocale/sync': {
                schema: z.object({}),
                handler: DetectBestLocale,
            },
        

             'zendesk.ListAvailablePublicLocales/sync': {
                schema: z.object({}),
                handler: ListAvailablePublicLocales,
            },
        

             'zendesk.ListMacros/sync': {
                schema: z.object({
                  'MacroInclude': z.string(),
'MacroAccess': z.string(),
'MacroActive': z.string(),
'MacroCategory': z.string(),
'MacroGroupId': z.string(),
'MacroOnlyViewable': z.string(),
'MacroSortBy': z.string(),
'MacroSortOrder': z.string()}),
                handler: ListMacros,
            },
        

             'zendesk.ShowMacro/sync': {
                schema: z.object({
                  'macro_id': z.string()}),
                handler: ShowMacro,
            },
        

             'zendesk.ShowChangesToTicket/sync': {
                schema: z.object({
                  'macro_id': z.string()}),
                handler: ShowChangesToTicket,
            },
        

             'zendesk.ListMacroAttachments/sync': {
                schema: z.object({
                  'macro_id': z.string()}),
                handler: ListMacroAttachments,
            },
        

             'zendesk.ListActiveMacros/sync': {
                schema: z.object({
                  'MacroInclude': z.string(),
'MacroAccess': z.string(),
'MacroCategory': z.string(),
'MacroGroupId': z.string(),
'MacroSortBy': z.string(),
'MacroSortOrder': z.string()}),
                handler: ListActiveMacros,
            },
        

             'zendesk.ShowMacroAttachment/sync': {
                schema: z.object({
                  'attachment_id': z.string()}),
                handler: ShowMacroAttachment,
            },
        

             'zendesk.ListMacroCategories/sync': {
                schema: z.object({}),
                handler: ListMacroCategories,
            },
        

             'zendesk.ShowDerivedMacro/sync': {
                schema: z.object({}),
                handler: ShowDerivedMacro,
            },
        

             'zendesk.SearchMacro/sync': {
                schema: z.object({}),
                handler: SearchMacro,
            },
        

             'zendesk.ShowEssentialsCard/sync': {
                schema: z.object({
                  'object_type': z.string()}),
                handler: ShowEssentialsCard,
            },
        

             'zendesk.ShowEssentialsCards/sync': {
                schema: z.object({}),
                handler: ShowEssentialsCards,
            },
        

             'zendesk.ListOrganizationFields/sync': {
                schema: z.object({}),
                handler: ListOrganizationFields,
            },
        

             'zendesk.ShowOrganizationField/sync': {
                schema: z.object({
                  'organization_field_id': z.string()}),
                handler: ShowOrganizationField,
            },
        

             'zendesk.ListOrganizationMemberships/sync': {
                schema: z.object({}),
                handler: ListOrganizationMemberships,
            },
        

             'zendesk.ShowOrganizationMembershipById/sync': {
                schema: z.object({
                  'organization_membership_id': z.string()}),
                handler: ShowOrganizationMembershipById,
            },
        

             'zendesk.ShowOrganizationMerge/sync': {
                schema: z.object({
                  'organization_merge_id': z.string()}),
                handler: ShowOrganizationMerge,
            },
        

             'zendesk.ListOrganizationSubscriptions/sync': {
                schema: z.object({}),
                handler: ListOrganizationSubscriptions,
            },
        

             'zendesk.ShowOrganizationSubscription/sync': {
                schema: z.object({
                  'organization_subscription_id': z.string(),
'OrganizationSubscriptionId': z.string()}),
                handler: ShowOrganizationSubscription,
            },
        

             'zendesk.ListOrganizations/sync': {
                schema: z.object({}),
                handler: ListOrganizations,
            },
        

             'zendesk.ShowOrganization/sync': {
                schema: z.object({
                  'organization_id': z.string()}),
                handler: ShowOrganization,
            },
        

             'zendesk.ListOrganizationMerges/sync': {
                schema: z.object({
                  'organization_id': z.string()}),
                handler: ListOrganizationMerges,
            },
        

             'zendesk.OrganizationRelated/sync': {
                schema: z.object({
                  'organization_id': z.string()}),
                handler: OrganizationRelated,
            },
        

             'zendesk.AutocompleteOrganizations/sync': {
                schema: z.object({}),
                handler: AutocompleteOrganizations,
            },
        

             'zendesk.CountOrganizations/sync': {
                schema: z.object({}),
                handler: CountOrganizations,
            },
        

             'zendesk.SearchOrganizations/sync': {
                schema: z.object({}),
                handler: SearchOrganizations,
            },
        

             'zendesk.ShowManyOrganizations/sync': {
                schema: z.object({}),
                handler: ShowManyOrganizations,
            },
        

             'zendesk.ListTicketProblems/sync': {
                schema: z.object({}),
                handler: ListTicketProblems,
            },
        

             'zendesk.ListQueues/sync': {
                schema: z.object({}),
                handler: ListQueues,
            },
        

             'zendesk.ShowQueueById/sync': {
                schema: z.object({
                  'queue_id': z.string()}),
                handler: ShowQueueById,
            },
        

             'zendesk.ListQueueDefinitions/sync': {
                schema: z.object({}),
                handler: ListQueueDefinitions,
            },
        

             'zendesk.ListSupportAddresses/sync': {
                schema: z.object({}),
                handler: ListSupportAddresses,
            },
        

             'zendesk.ShowSupportAddress/sync': {
                schema: z.object({
                  'support_address_id': z.string()}),
                handler: ShowSupportAddress,
            },
        

             'zendesk.GetRelationshipFilterDefinitions/sync': {
                schema: z.object({
                  'target_type': z.string(),
'source_type': z.string()}),
                handler: GetRelationshipFilterDefinitions,
            },
        

             'zendesk.ListRequests/sync': {
                schema: z.object({
                  'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ListRequests,
            },
        

             'zendesk.ShowRequest/sync': {
                schema: z.object({
                  'request_id': z.string()}),
                handler: ShowRequest,
            },
        

             'zendesk.ListComments/sync': {
                schema: z.object({
                  'request_id': z.string(),
'since': z.string(),
'role': z.string()}),
                handler: ListComments,
            },
        

             'zendesk.ShowComment/sync': {
                schema: z.object({
                  'request_id': z.string(),
'ticket_comment_id': z.string()}),
                handler: ShowComment,
            },
        

             'zendesk.SearchRequests/sync': {
                schema: z.object({
                  'query': z.string()}),
                handler: SearchRequests,
            },
        

             'zendesk.ListResourceCollections/sync': {
                schema: z.object({}),
                handler: ListResourceCollections,
            },
        

             'zendesk.RetrieveResourceCollection/sync': {
                schema: z.object({
                  'resource_collection_id': z.string()}),
                handler: RetrieveResourceCollection,
            },
        

             'zendesk.ListAGentAttributeValues/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: ListAGentAttributeValues,
            },
        

             'zendesk.ListAccountAttributes/sync': {
                schema: z.object({}),
                handler: ListAccountAttributes,
            },
        

             'zendesk.ShowAttribute/sync': {
                schema: z.object({
                  'attribute_id': z.string()}),
                handler: ShowAttribute,
            },
        

             'zendesk.ListAttributeValues/sync': {
                schema: z.object({
                  'attribute_id': z.string()}),
                handler: ListAttributeValues,
            },
        

             'zendesk.ShowAttributeValue/sync': {
                schema: z.object({
                  'attribute_id': z.string(),
'attribute_value_id': z.string()}),
                handler: ShowAttributeValue,
            },
        

             'zendesk.ListRoutingAttributeDefinitions/sync': {
                schema: z.object({}),
                handler: ListRoutingAttributeDefinitions,
            },
        

             'zendesk.ListTicketsFullfilledByUser/sync': {
                schema: z.object({
                  'ticket_ids': z.number()}),
                handler: ListTicketsFullfilledByUser,
            },
        

             'zendesk.ListTicketAttributeValues/sync': {
                schema: z.object({
                  'ticket_id': z.string()}),
                handler: ListTicketAttributeValues,
            },
        

             'zendesk.ListSatisfactionRatings/sync': {
                schema: z.object({}),
                handler: ListSatisfactionRatings,
            },
        

             'zendesk.ShowSatisfactionRating/sync': {
                schema: z.object({
                  'satisfaction_rating_id': z.string(),
'satisfaction_rating_id': z.number()}),
                handler: ShowSatisfactionRating,
            },
        

             'zendesk.CountSatisfactionRatings/sync': {
                schema: z.object({}),
                handler: CountSatisfactionRatings,
            },
        

             'zendesk.ListSatisfactionRatingReasons/sync': {
                schema: z.object({}),
                handler: ListSatisfactionRatingReasons,
            },
        

             'zendesk.ShowSatisfactionRatings/sync': {
                schema: z.object({
                  'satisfaction_reason_id': z.string(),
'satisfaction_reason_id': z.number()}),
                handler: ShowSatisfactionRatings,
            },
        

             'zendesk.ListSearchResults/sync': {
                schema: z.object({
                  'query': z.string(),
'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ListSearchResults,
            },
        

             'zendesk.CountSearchResults/sync': {
                schema: z.object({
                  'query': z.string()}),
                handler: CountSearchResults,
            },
        

             'zendesk.ExportSearchResults/sync': {
                schema: z.object({
                  'query': z.string(),
'page[size]': z.number(),
'filter[type]': z.string()}),
                handler: ExportSearchResults,
            },
        

             'zendesk.ListSessions/sync': {
                schema: z.object({}),
                handler: ListSessions,
            },
        

             'zendesk.ListSharingAgreements/sync': {
                schema: z.object({}),
                handler: ListSharingAgreements,
            },
        

             'zendesk.ShowSharingAgreement/sync': {
                schema: z.object({
                  'sharing_agreement_id': z.string()}),
                handler: ShowSharingAgreement,
            },
        

             'zendesk.ListSLAPolicies/sync': {
                schema: z.object({}),
                handler: ListSLAPolicies,
            },
        

             'zendesk.ShowSLAPolicy/sync': {
                schema: z.object({
                  'sla_policy_id': z.string()}),
                handler: ShowSLAPolicy,
            },
        

             'zendesk.RetrieveSLAPolicyFilterDefinitionItems/sync': {
                schema: z.object({}),
                handler: RetrieveSLAPolicyFilterDefinitionItems,
            },
        

             'zendesk.ListSuspendedTickets/sync': {
                schema: z.object({}),
                handler: ListSuspendedTickets,
            },
        

             'zendesk.ShowSuspendedTickets/sync': {
                schema: z.object({
                  'id': z.string(),
'SuspendedTicketId': z.string()}),
                handler: ShowSuspendedTickets,
            },
        

             'zendesk.ListTags/sync': {
                schema: z.object({}),
                handler: ListTags,
            },
        

             'zendesk.CountTags/sync': {
                schema: z.object({}),
                handler: CountTags,
            },
        

             'zendesk.ListTarFailures/sync': {
                schema: z.object({}),
                handler: ListTarFailures,
            },
        

             'zendesk.ShowTarFailure/sync': {
                schema: z.object({
                  'target_failure_id': z.string()}),
                handler: ShowTarFailure,
            },
        

             'zendesk.ListTars/sync': {
                schema: z.object({}),
                handler: ListTars,
            },
        

             'zendesk.ShowTar/sync': {
                schema: z.object({
                  'target_id': z.string()}),
                handler: ShowTar,
            },
        

             'zendesk.ListTicketAudits/sync': {
                schema: z.object({
                  'limit': z.number()}),
                handler: ListTicketAudits,
            },
        

             'zendesk.ListTicketFields/sync': {
                schema: z.object({
                  'locale': z.string(),
'creator': z.boolean()}),
                handler: ListTicketFields,
            },
        

             'zendesk.ShowTicketfield/sync': {
                schema: z.object({
                  'ticket_field_id': z.string()}),
                handler: ShowTicketfield,
            },
        

             'zendesk.ListTicketFieldOptions/sync': {
                schema: z.object({
                  'ticket_field_id': z.string()}),
                handler: ListTicketFieldOptions,
            },
        

             'zendesk.ShowTicketFieldOption/sync': {
                schema: z.object({
                  'ticket_field_id': z.string(),
'ticket_field_option_id': z.string()}),
                handler: ShowTicketFieldOption,
            },
        

             'zendesk.CountTicketFields/sync': {
                schema: z.object({}),
                handler: CountTicketFields,
            },
        

             'zendesk.ListTicketForms/sync': {
                schema: z.object({
                  'active': z.boolean(),
'end_user_visible': z.boolean(),
'fallback_to_default': z.boolean(),
'associated_to_brand': z.boolean()}),
                handler: ListTicketForms,
            },
        

             'zendesk.ShowTicketForm/sync': {
                schema: z.object({
                  'ticket_form_id': z.string()}),
                handler: ShowTicketForm,
            },
        

             'zendesk.ShowManyTicketForms/sync': {
                schema: z.object({
                  'ids': z.string(),
'active': z.boolean(),
'end_user_visible': z.boolean(),
'fallback_to_default': z.boolean(),
'associated_to_brand': z.boolean()}),
                handler: ShowManyTicketForms,
            },
        

             'zendesk.ListTicketMetrics/sync': {
                schema: z.object({}),
                handler: ListTicketMetrics,
            },
        

             'zendesk.ShowTicketMetrics/sync': {
                schema: z.object({
                  'ticket_metric_id': z.string()}),
                handler: ShowTicketMetrics,
            },
        

             'zendesk.ListTickets/sync': {
                schema: z.object({
                  'external_id': z.string()}),
                handler: ListTickets,
            },
        

             'zendesk.ShowTicket/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: ShowTicket,
            },
        

             'zendesk.ListAuditsForTicket/sync': {
                schema: z.object({
                  'ticket_id': z.string()}),
                handler: ListAuditsForTicket,
            },
        

             'zendesk.ShowTicketAudit/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'ticket_audit_id': z.string()}),
                handler: ShowTicketAudit,
            },
        

             'zendesk.CountAuditsForTicket/sync': {
                schema: z.object({
                  'ticket_id': z.string()}),
                handler: CountAuditsForTicket,
            },
        

             'zendesk.ListTicketCollaborators/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: ListTicketCollaborators,
            },
        

             'zendesk.ListTicketComments/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'include_inline_images': z.boolean(),
'include': z.string()}),
                handler: ListTicketComments,
            },
        

             'zendesk.CountTicketComments/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: CountTicketComments,
            },
        

             'zendesk.ListTicketEmailCCs/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: ListTicketEmailCCs,
            },
        

             'zendesk.ListTicketFollowers/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: ListTicketFollowers,
            },
        

             'zendesk.ListTicketIncidents/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: ListTicketIncidents,
            },
        

             'zendesk.ShowTicketAfterChanges/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'macro_id': z.string()}),
                handler: ShowTicketAfterChanges,
            },
        

             'zendesk.TicketRelatedInformation/sync': {
                schema: z.object({
                  'ticket_id': z.string(),
'TicketId': z.string()}),
                handler: TicketRelatedInformation,
            },
        

             'zendesk.ListResourceTags/sync': {
                schema: z.object({
                  'ticket_id': z.string()}),
                handler: ListResourceTags,
            },
        

             'zendesk.TicketsShowMany/sync': {
                schema: z.object({
                  'TicketIds': z.string()}),
                handler: TicketsShowMany,
            },
        

             'zendesk.ShowTriggerCategoryById/sync': {
                schema: z.object({
                  'trigger_category_id': z.string()}),
                handler: ShowTriggerCategoryById,
            },
        

             'zendesk.ListTriggers/sync': {
                schema: z.object({
                  'TriggerActive': z.string(),
'TriggerSort': z.string(),
'TriggerSortBy': z.string(),
'TriggerSortOrder': z.string(),
'TriggerCategoryId': z.string()}),
                handler: ListTriggers,
            },
        

             'zendesk.GetTrigger/sync': {
                schema: z.object({
                  'trigger_id': z.string()}),
                handler: GetTrigger,
            },
        

             'zendesk.ListTriggerRevisions/sync': {
                schema: z.object({
                  'trigger_id': z.string()}),
                handler: ListTriggerRevisions,
            },
        

             'zendesk.TriggerRevision/sync': {
                schema: z.object({
                  'trigger_id': z.string(),
'trigger_revision_id': z.string()}),
                handler: TriggerRevision,
            },
        

             'zendesk.ListActiveTriggers/sync': {
                schema: z.object({}),
                handler: ListActiveTriggers,
            },
        

             'zendesk.ListTriggerActionConditionDefinitions/sync': {
                schema: z.object({}),
                handler: ListTriggerActionConditionDefinitions,
            },
        

             'zendesk.SearchTriggers/sync': {
                schema: z.object({}),
                handler: SearchTriggers,
            },
        

             'zendesk.ListUserFields/sync': {
                schema: z.object({}),
                handler: ListUserFields,
            },
        

             'zendesk.ShowUserField/sync': {
                schema: z.object({
                  'user_field_id': z.string()}),
                handler: ShowUserField,
            },
        

             'zendesk.ListUserFieldOptions/sync': {
                schema: z.object({
                  'user_field_id': z.string()}),
                handler: ListUserFieldOptions,
            },
        

             'zendesk.ShowUserFieldOption/sync': {
                schema: z.object({
                  'user_field_id': z.string(),
'user_field_option_id': z.string()}),
                handler: ShowUserFieldOption,
            },
        

             'zendesk.ListUsers/sync': {
                schema: z.object({
                  'UserRoleFilter': z.string(),
'UserRolesFilter': z.string(),
'UserPermissionSetFilter': z.string(),
'UserExternalIdFilter': z.string()}),
                handler: ListUsers,
            },
        

             'zendesk.ShowUser/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: ShowUser,
            },
        

             'zendesk.ShowUserComplianceDeletionStatuses/sync': {
                schema: z.object({
                  'user_id': z.string(),
'application': z.string()}),
                handler: ShowUserComplianceDeletionStatuses,
            },
        

             'zendesk.ListUserIdentities/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: ListUserIdentities,
            },
        

             'zendesk.ShowUserIdentity/sync': {
                schema: z.object({
                  'user_id': z.string(),
'user_identity_id': z.string()}),
                handler: ShowUserIdentity,
            },
        

             'zendesk.GetUserPasswordRequirements/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: GetUserPasswordRequirements,
            },
        

             'zendesk.ShowUserRelated/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: ShowUserRelated,
            },
        

             'zendesk.ShowSession/sync': {
                schema: z.object({
                  'user_id': z.string(),
'session_id': z.string()}),
                handler: ShowSession,
            },
        

             'zendesk.ListTicketSkips/sync': {
                schema: z.object({
                  'user_id': z.string()}),
                handler: ListTicketSkips,
            },
        

             'zendesk.AutocompleteUsers/sync': {
                schema: z.object({
                  'name': z.string(),
'LookupRelationshipAutocompleteFieldIdFragment': z.string(),
'LookupRelationshipAutocompleteSourceFragment': z.string()}),
                handler: AutocompleteUsers,
            },
        

             'zendesk.CountUsers/sync': {
                schema: z.object({
                  'UserRoleFilter': z.string(),
'UserRolesFilter': z.string(),
'UserPermissionSetFilter': z.string()}),
                handler: CountUsers,
            },
        

             'zendesk.ShowCurrentUser/sync': {
                schema: z.object({}),
                handler: ShowCurrentUser,
            },
        

             'zendesk.ShowCurrentlyAuthenticatedSession/sync': {
                schema: z.object({}),
                handler: ShowCurrentlyAuthenticatedSession,
            },
        

             'zendesk.RenewCurrentSession/sync': {
                schema: z.object({}),
                handler: RenewCurrentSession,
            },
        

             'zendesk.SearchUsers/sync': {
                schema: z.object({
                  'query': z.string(),
'external_id': z.string()}),
                handler: SearchUsers,
            },
        

             'zendesk.ShowManyUsers/sync': {
                schema: z.object({
                  'ids': z.string(),
'external_ids': z.string()}),
                handler: ShowManyUsers,
            },
        

             'zendesk.ListViews/sync': {
                schema: z.object({
                  'access': z.string(),
'active': z.boolean(),
'group_id': z.number(),
'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ListViews,
            },
        

             'zendesk.ShowView/sync': {
                schema: z.object({
                  'view_id': z.string()}),
                handler: ShowView,
            },
        

             'zendesk.GetViewCount/sync': {
                schema: z.object({
                  'view_id': z.string()}),
                handler: GetViewCount,
            },
        

             'zendesk.ExecuteView/sync': {
                schema: z.object({
                  'view_id': z.string(),
'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ExecuteView,
            },
        

             'zendesk.ExportView/sync': {
                schema: z.object({
                  'view_id': z.string()}),
                handler: ExportView,
            },
        

             'zendesk.ListTicketsFromView/sync': {
                schema: z.object({
                  'view_id': z.string(),
'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ListTicketsFromView,
            },
        

             'zendesk.ListActiveViews/sync': {
                schema: z.object({
                  'access': z.string(),
'group_id': z.number(),
'sort_by': z.string(),
'sort_order': z.string()}),
                handler: ListActiveViews,
            },
        

             'zendesk.ListCompactViews/sync': {
                schema: z.object({}),
                handler: ListCompactViews,
            },
        

             'zendesk.CountViews/sync': {
                schema: z.object({}),
                handler: CountViews,
            },
        

             'zendesk.GetViewCounts/sync': {
                schema: z.object({
                  'ids': z.string()}),
                handler: GetViewCounts,
            },
        

             'zendesk.SearchViews/sync': {
                schema: z.object({
                  'query': z.string(),
'access': z.string(),
'active': z.boolean(),
'group_id': z.number(),
'sort_by': z.string(),
'sort_order': z.string(),
'include': z.string()}),
                handler: SearchViews,
            },
        

             'zendesk.ListViewsById/sync': {
                schema: z.object({
                  'ids': z.string(),
'active': z.boolean()}),
                handler: ListViewsById,
            },
        

             'zendesk.ListWorkspaces/sync': {
                schema: z.object({}),
                handler: ListWorkspaces,
            },
        }
    return this.events;
  }

  getOpenApiSpec() {
    return openapi as unknown as OpenAPI;
  }

  getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<typeof openapi>>> => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`)
    }

    // TODO: HANDLE REFRESH TOKEN IF EXPIRED
    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: "https://{subdomain}.{domain}.com",
      globalParams: {
        headers: {
          Authorization: `Bearer ${credential?.value}`
        }
      }
    })

    return client
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://${this.config.zendesk_subdomain}.zendesk.com`,
        AUTHORIZATION_ENDPOINT: '/oauth/authorizations/new',
        TOKEN_ENDPOINT: '/oauth/authorizations/tokens',
        SCOPES: [],
      },
    });
  }
}

    