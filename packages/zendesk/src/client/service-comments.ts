export const comments = {
  "listAssigneeFieldAssignableGroupsAndAgentsSearch": {
    "comment": "List assignable groups and agents based on query matched against name",
    "doc": "List assignable groups and agents based on query matched against name\n  List assignable groups and agents based on query matched against name\n \n  #### Allowed For\n \n   Agents"
  },
  "listAssigneeFieldAssignableGroups": {
    "comment": "List assignable groups on the AssigneeField",
    "doc": "List assignable groups on the AssigneeField\n  List assignable groups on the AssigneeField\n \n  #### Allowed For\n \n   Agents"
  },
  "listAssigneeFieldAssignableGroupAgents": {
    "comment": "List assignable agents from a group on the AssigneeField",
    "doc": "List assignable agents from a group on the AssigneeField\n  List assignable agents from a group on the AssigneeField\n \n  #### Allowed For\n \n   Agents"
  },
  "getSourcesByTarget": {
    "comment": "Get sources by target",
    "doc": "Get sources by target\n  Returns a list of source objects whose values are populated with the id of a related target object.  For example,\n  if you have a lookup field called \"Success Manager\" on a ticket, this endpoint can answer the question,\n  \"What tickets (sources) is this user (found by `target_type` and `target_id`)\n  assigned as the 'Success Manager' (field referenced by `field_id`)?\"\n \n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "showAccountSettings": {
    "comment": "Show Settings",
    "doc": "Show Settings\n  Shows the settings that are available for the account.\n \n  #### Allowed For\n \n   Agents"
  },
  "updateAccountSettings": {
    "comment": "Update Account Settings",
    "doc": "Update Account Settings\n  Updates settings for the account. See [JSON Format](#json-format) above for the settings you can update.\n \n  #### Allowed For\n \n   Admins"
  },
  "createTrialAccount": {
    "comment": "Create Trial Account",
    "doc": "Create Trial Account"
  },
  "verifySubdomainAvailability": {
    "comment": "Verify Subdomain Availability",
    "doc": "Verify Subdomain Availability\n  Zendesk Support credentials are not required to access this endpoint. You can use any Zendesk Support subdomain.\n \n  Returns \"true\" if the subdomain is available."
  },
  "listActivities": {
    "comment": "List Activities",
    "doc": "List Activities\n  Lists ticket activities in the last 30 days affecting the agent making the request.\n  Also sideloads the following arrays of user records:\n \n  - actors - All actors involved in the listed activities\n  - users - All users involved in the listed activities\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "showActivity": {
    "comment": "Show Activity",
    "doc": "Show Activity\n  Lists a specific activity.\n \n  #### Allowed For\n \n   Agents"
  },
  "countActivities": {
    "comment": "Count Activities",
    "doc": "Count Activities\n  Returns an approximate count of ticket activities in the last 30 days affecting the agent making the request. If the count exceeds 100,000, the count will return a cached result. This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Agents"
  },
  "reportChannelbackError": {
    "comment": "Report Channelback Error to Zendesk",
    "doc": "Report Channelback Error to Zendesk\n  #### Allowed For\n \n   Admins\n \n  #### Request parameters\n \n  The POST request takes a JSON object parameter which contains information about the\n  problematic [channelback](/documentation/channel_framework/understanding-the-channel-framework/channelback/).\n \n  | Name               | Type      | Required  | Comments\n  | ------------------ | ----------| --------- | -------------------\n  | instance_push_id   | string    | yes       | The ID of the account to which data will be pushed.  This was passed to the integration service when the administrator set up the account\n  | external_id        | string    | yes       | Unique identifier of the external resource from the original channelback (string)\n  | description        | string    | no        | A human readable description of the error\n  | request_id         | string    | no        | A unique identifier for the request\n \n \n  #### Response format\n \n  The response does not include a response body"
  },
  "pushContentToSupport": {
    "comment": "Push Content to Support",
    "doc": "Push Content to Support\n  Pushes Channel framework content to Zendesk.\n \n  #### Allowed For\n \n   Admins\n \n  #### Request parameters\n \n  The POST request takes a JSON object parameter which contains data about all\n  the resources that the client is pushing.\n \n  | Name               | Type      | Required  | Comments\n  | ------------------ | ----------| --------- | -------------------\n  | instance_push_id   | string    | yes       | The account ID where data will be pushed. This was passed to the integration service when the administrator set up the account\n  | request_id         | string    | no        | A unique identifier for the push request\n  | external_resources | array     | yes       | The [resources](#external_resource-object) to push\n \n  #### external_resource object\n \n  | Name               | Type                               | Max length | Mandatory | Comments\n  |------------------- | ---------------------------------- |------------| --------- | ----------\n  | external_id        | string                             | 255        | yes       | Unique identifier of the external resource. Must be ASCII characters\n  | internal_note      | boolean                            |            | no        | If true creates a new internal note comment\n  | message            | string                             | 65535      | yes       | Text to be converted to a ticket or comment\n  | html_message       | string                             | 65535      | no        | HTML version of message\n  | parent_id          | string                             | 511        | no        | Unique identifier of the external resource for which this is a response. Used to choose the correct thread. Responses may include `parent_id` or `thread_id`, but not both. See [Conversation threads](/documentation/channel_framework/understanding-the-channel-framework/pull_endpoint/#conversation-threads)\n  | thread_id          | string                             | 255        | no        | Arbitrary identifier of the thread to which this item should belong. Responses may include `parent_id` or `thread_id`, but not both. See [Conversation threads](/documentation/channel_framework/understanding-the-channel-framework/pull_endpoint/#conversation-threads)\n  | created_at         | string                             |            | yes       | When the resource was created in the origin system, as an ISO 8601 extended format date-time. Example: '2015-09-08T22:48:09Z'\n  | author             | object                             |            | yes       | See [author object](#author-object) below\n  | display_info       | array                              |            | no        | Array of integration-specific data used by apps to modify the agent UI. See [display_info object](#display_info-object) below\n  | allow_channelback  | boolean                            |            | no        | If false, prevents the agent from making additional comments on the message in the Zendesk interface\n  | fields             | array                              |            | no        | Array of ticket fields to set in Zendesk and their values. See [fields array](#fields-array)\n  | file_urls          | array                              | 10         | no        | Array of files to be imported into Zendesk. See [file urls](/documentation/channel_framework/understanding-the-channel-framework/pull_endpoint/#file-urls) in the Channel framework docs\n \n  #### author object\n \n  | Name        | Type   | Max chars | Mandatory | Comments\n  |------------ | ------ |---------- |---------- |-----------\n  | external_id | string | 255       | yes       | Unique identifier of the user in the origin service\n  | name        | string | 255       | no        | If not supplied, defaults to external id\n  | image_url   | string | 255       | no        | URL to an image for the user\n  | locale      | String | 255       | no        | The user's locale. Must be one of the supported [locales](/api-reference/ticketing/account-configuration/locales/#list-available-public-locales) in Zendesk\n  | fields      | array  |           | no        | Array of items containing user field identifier ('id') and value of field ('value'.)  For system fields ('notes' or 'details'), the identifier is the English name. For custom fields, the identifier may be the ID or the name\n \n  #### display_info object\n \n  | Name | Type   | Max chars | Mandatory | Comments\n  |----- | ------ |---------- |---------- |-----------\n  | type | string | 255       | yes       | Globally unique type identifier defined by the integration origin service. Examples: a GUID or URI\n  | data | string | 65535     | yes       | JSON data containing display hints\n \n  #### fields array\n \n  The `fields` array lists ticket fields to set in Zendesk and their values. Each item consists of a field identifier (`id`) and a value (`value`) for the field. For Zendesk system fields such as `subject`, the identifier is the English name. For custom fields, the identifier may be a field ID or a name. See [Ticket Fields](/api-reference/ticketing/tickets/ticket_fields/).\n \n  The `fields` array can only set ticket values on ticket creation, not on ticket updates.\n \n  #### Response format\n \n  The response is a JSON object containing a single key:\n \n  | Name      | Type     | Comments\n  | --------- | -------- | -------------------\n  | results   | array    | An array of [result objects](#result-object)\n \n  The `results` array contains an entry for each item in the incoming `external_resources` array, in the\n  same order.  For example, if you call `push` with 3 external resources, a successful response will include\n  `results` with three entries, corresponding to your 3 resources.\n \n  #### result object\n \n  | Name                 | Type                           | Comments\n  | -------------------- | ------------------------------ | -------------------\n  | external_resource_id | string                         | The external ID of the resource, as passed in\n  | status               | object                         | The status of the import for the indicated resource. See [status object](#status-object)\n \n  #### status object\n \n  | Name        | Type   | Comments\n  | ----------- | ------ | -------------------\n  | code        | string | A code indicating the status of the import of the resource, as described in [status codes](#status-codes)\n  | description | string | In the case of an exception, a description of the exception. Otherwise, not present.\n \n  #### status codes\n \n  | Key                                       | Description\n  | ----------------------------------------- | ----------------\n  | success                                   | The external resource was successfully converted to a ticket or comment\n  | already_imported                          | Reimport of the external resource was skipped due to a pre-existing ticket or comment for the resource\n  | could_not_locate_parent_external_resource | The parent resource, as identified by parent_id in the [request](#request-parameters), could not be found. The unrecognized parent ID is returned in the description of the [status](#status-object)\n  | processing_error                          | An internal exception occurred while processing the resource. See `description` in the [status object](#status-object)\n  | halted                                    | This resource was not processed because processing of previous resources failed"
  },
  "validateToken": {
    "comment": "Validate Token",
    "doc": "Validate Token\n  #### Allowed For\n \n   Admins\n \n  #### Request parameters\n \n  The POST request takes a JSON object parameter which contains the token to be validated.\n \n  | Name               | Type      | Required  | Comments\n  | ------------------ | ----------| --------- | -------------------\n  | instance_push_id   | string    | yes       | The ID of the account to which data will be pushed. This was passed to the integration service when the administrator set up the account\n  | request_id         | string    | no        | A unique identifier for the push request\n \n  #### Response format\n \n  The response body is empty."
  },
  "showAttachment": {
    "comment": "Show Attachment",
    "doc": "Show Attachment\n  Shows attachment details. You can get the value of the `attachment_id` parameter by listing the ticket's comments.\n  See [List Comments](/api-reference/ticketing/tickets/ticket_comments/#list-comments). Each comment\n  in the list has an `attachments` list that specifies an `id` for each attachment.\n \n \n  #### Allowed for\n \n   Agents"
  },
  "updateAttachment": {
    "comment": "Update Attachment for Malware",
    "doc": "Update Attachment for Malware\n  Toggles enabling or restricting agent access to attachments with detected malware.\n \n  #### Allowed For\n \n   Admins"
  },
  "listAuditLogs": {
    "comment": "List Audit Logs",
    "doc": "List Audit Logs\n  #### Allowed For\n \n   Admins on accounts that have audit log access\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page."
  },
  "showAuditLog": {
    "comment": "Show Audit Log",
    "doc": "Show Audit Log\n  #### Allowed For\n \n   Admins on accounts that have audit-log access"
  },
  "exportAuditLogs": {
    "comment": "Export Audit Logs",
    "doc": "Export Audit Logs\n  #### Allowed For\n \n   Admins on accounts that have audit log access"
  },
  "autocompleteTags": {
    "comment": "Search Tags",
    "doc": "Search Tags\n  Returns an array of registered and recent tag names that start with the characters specified in the `name` query parameter. You must specify at least 2 characters.\n \n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n \n  #### Allowed For\n \n   Agents"
  },
  "listAutomations": {
    "comment": "List Automations",
    "doc": "List Automations\n  Lists all automations for the current account.\n \n  #### Allowed For\n \n   Agents\n \n  #### Available Parameters\n \n  You can pass in any combination of the following optional filters:\n \n  | Name       | Type    | Comment\n  | ---------- | ------- | -------\n  | active     | boolean | Only active automations if true, inactive automations if false\n  | sort_by    | string  | Possible values are \"alphabetical\", \"created_at\", \"updated_at\", \"usage_1h\", \"usage_24h\", or \"usage_7d\". Defaults to \"position\"\n  | sort_order | string  | One of \"asc\" or \"desc\". Defaults to \"asc\" for alphabetical and position sort, \"desc\" for all others\n \n  #### Sideloads\n \n  The following sideloads are supported. The usage sideloads are only supported on the Support Professional or Suite Growth plan or above.\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each automation, if present\n  | permissions      | The permissions for each automation\n  | usage_1h         | The number of times each automation has been used in the past hour\n  | usage_24h        | The number of times each automation has been used in the past day\n  | usage_7d         | The number of times each automation has been used in the past week\n  | usage_30d        | The number of times each automation has been used in the past thirty days\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page."
  },
  "createAutomation": {
    "comment": "Create Automation",
    "doc": "Create Automation\n  Creates an automation.\n \n  New automations must be unique and have at least one condition that is true only once or an action that nullifies at least one of the conditions. Active automations can have overlapping conditions but can't be identical.\n \n  The request must include the following conditions in the `all` array:\n \n  - At least one time-based condition\n  - At least one condition that checks one of the following fields: `status`, `type`, `group_id`, `assignee_id`, or `requester_id`.\n \n  #### Allowed For\n \n   Agents"
  },
  "showAutomation": {
    "comment": "Show Automation",
    "doc": "Show Automation\n  #### Allowed For\n \n   Agents"
  },
  "updateAutomation": {
    "comment": "Update Automation",
    "doc": "Update Automation\n  Updates an automation.\n \n  Updated automations must be unique and have at least one condition that is true only once or an action that nullifies at least one of the conditions. Active automations can have overlapping conditions but can't be identical.\n \n  The request must include the following conditions in the `all` array:\n  - At least one time-based condition\n  - At least one condition that checks one of the following fields: 'status', 'type', 'group_id', 'assignee_id', or 'requester_id'\n \n  Note: Updating a condition or action updates both the `conditions` and `actions` arrays, clearing all existing values of both arrays. Include all your conditions and actions when updating any condition or action.\n  Note: You might be restricted from updating some default automations.\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteAutomation": {
    "comment": "Delete Automation",
    "doc": "Delete Automation\n  Note: You might be restricted from deleting some default automations.\n \n  #### Allowed For\n \n   Agents"
  },
  "listActiveAutomations": {
    "comment": "List Active Automations",
    "doc": "List Active Automations\n  Lists all active automations.\n \n  #### Allowed For\n \n   Agents\n \n  #### Available Parameters\n \n  You can pass in any combination of the following optional filters:\n \n  | Name       | Type   | Comment\n  | ---------- | ------ | -------\n  | sort_by    | string | Possible values are \"alphabetical\", \"created_at\", \"updated_at\", \"usage_1h\", \"usage_24h\", or \"usage_7d\". Defaults to \"position\"\n  | sort_order | string | One of \"asc\" or \"desc\". Defaults to \"asc\" for alphabetical and position sort, \"desc\" for all others\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each automation, if present\n  | permissions      | The permissions for each automation\n  | usage_1h         | The number of times each automation has been used in the past hour\n  | usage_24h        | The number of times each automation has been used in the past day\n  | usage_7d         | The number of times each automation has been used in the past week\n  | usage_30d        | The number of times each automation has been used in the past thirty days"
  },
  "bulkDeleteAutomations": {
    "comment": "Bulk Delete Automations",
    "doc": "Bulk Delete Automations\n  Deletes the automations corresponding to the provided comma-separated list of IDs.\n \n  Note: You might be restricted from deleting some default automations. If included in a bulk deletion, the unrestricted automations will be deleted.\n \n  #### Allowed For\n \n   Agents\n \n  #### Request Parameters\n \n  The DELETE request takes one parameter, an `ids` object that lists the automations to delete.\n \n  | Name | Description\n  | ---- | -----------\n  | ids  | The IDs of the automations to delete\n \n  #### Example request\n \n  ```js\n  {\n  \"ids\": \"25,23,27,22\"\n  }\n  ```"
  },
  "searchAutomations": {
    "comment": "Search Automations",
    "doc": "Search Automations\n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported. For more information, see [Side-loading](/documentation/ticketing/using-the-zendesk-api/side_loading/).\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each automation, if present\n  | permissions      | The permissions for each automation\n  | usage_1h         | The number of times each automation has been used in the past hour\n  | usage_24h        | The number of times each automation has been used in the past day\n  | usage_7d         | The number of times each automation has been used in the past week\n  | usage_30d        | The number of times each automation has been used in the past thirty days"
  },
  "updateManyAutomations": {
    "comment": "Update Many Automations",
    "doc": "Update Many Automations\n  Note: You might be restricted from updating some default automations. If included in a bulk update, the unrestricted automations will be updated.\n \n  #### Allowed For\n \n   Agents\n \n  #### Request Parameters\n \n  The PUT request expects an `automations` object that lists the automations to update.\n \n  Each automation may have the following properties:\n \n  | Name     | Mandatory | Description\n  | -------- | --------- | -----------\n  | id       | yes       | The ID of the automation to update\n  | position | no        | The new position of the automation\n  | active   | no        | The active status of the automation (true or false)\n \n  #### Example Request\n \n  ```js\n  {\n  \"automations\": [\n  {\"id\": 25, \"position\": 3},\n  {\"id\": 23, \"position\": 5},\n  {\"id\": 27, \"position\": 9},\n  {\"id\": 22, \"position\": 7}\n  ]\n  }\n  ```"
  },
  "listBookmarks": {
    "comment": "List Bookmarks",
    "doc": "List Bookmarks\n  #### Allowed For\n  - Agents"
  },
  "createBookmark": {
    "comment": "Create Bookmark",
    "doc": "Create Bookmark\n  #### Allowed For\n  - Agents"
  },
  "deleteBookmark": {
    "comment": "Delete Bookmark",
    "doc": "Delete Bookmark\n  #### Allowed For\n  - Agents (own bookmarks only)\n \n  If the bookmark already exists with a specified ticket id, the response status will be `http Status: 200 OK`."
  },
  "listBrands": {
    "comment": "List Brands",
    "doc": "List Brands\n  Returns a list of all brands for your account sorted by name.\n \n  #### Allowed for\n \n   Admins\n   Agents with the `assign_tickets_to_any_brand` permission can list all brands for the account\n   Agents without the `assign_tickets_to_any_brand` permission can only list brands they are members of\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createBrand": {
    "comment": "Create Brand",
    "doc": "Create Brand\n  #### Allowed for\n  - Admins"
  },
  "showBrand": {
    "comment": "Show a Brand",
    "doc": "Show a Brand\n  Returns a brand for your account.\n \n  #### Allowed for\n \n   Admins, Agents"
  },
  "updateBrand": {
    "comment": "Update a Brand",
    "doc": "Update a Brand\n  Returns an updated brand.\n \n  #### Allowed for\n   Admins\n \n  #### Updating a Brand's Image\n  A brand image can be updated by uploading a local file using the update brand endpoint. See the Using curl sections below for more information."
  },
  "deleteBrand": {
    "comment": "Delete a Brand",
    "doc": "Delete a Brand\n  Deletes a brand.\n \n  #### Allowed for\n  - Admins"
  },
  "checkHostMappingValidityForExistingBrand": {
    "comment": "Check Host Mapping Validity for an Existing Brand",
    "doc": "Check Host Mapping Validity for an Existing Brand\n  Returns a JSON object determining whether a host mapping is valid for the given brand.\n \n  #### Allowed for\n  - Admins"
  },
  "checkHostMappingValidity": {
    "comment": "Check Host Mapping Validity",
    "doc": "Check Host Mapping Validity\n  Returns a JSON object determining whether a host mapping is valid for a given subdomain.\n \n  #### Allowed for\n \n   Admins"
  },
  "listMonitoredTwitterHandles": {
    "comment": "List Monitored X Handles",
    "doc": "List Monitored X Handles\n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "showMonitoredTwitterHandle": {
    "comment": "Show Monitored X Handle",
    "doc": "Show Monitored X Handle\n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "createTicketFromTweet": {
    "comment": "Create Ticket from Tweet",
    "doc": "Create Ticket from Tweet\n  Turns a tweet into a ticket. You must provide the tweet id as well as the id of a monitored X (formerly Twitter) handle configured for your account.\n \n  The submitter of the ticket is set to be the user submitting the API request.\n \n  #### Allowed For\n \n   Agents"
  },
  "gettingTwicketStatus": {
    "comment": "List Ticket statuses",
    "doc": "List Ticket statuses\n  #### Allowed For\n \n   Agents"
  },
  "openTicketInAgentBrowser": {
    "comment": "Open Ticket in Agent's Browser",
    "doc": "Open Ticket in Agent's Browser\n  Allows you to instruct an agent's browser to open a ticket.\n \n  When the message is successfully delivered to an agent's browser:\n \n  ```http\n  Status: 200 OK\n  ```\n \n  When `agent_id` or `ticket_id` is invalid:\n \n  ```http\n  Status: 404 Not Found\n  ```\n \n  #### Allowed For\n   Agents"
  },
  "openUsersProfileInAgentBrowser": {
    "comment": "Open a User's Profile in an Agent's Browser",
    "doc": "Open a User's Profile in an Agent's Browser\n  Allows you to instruct an agent's browser to open a user's profile.\n \n  When the message is successfully delivered to an agent's browser:\n \n  ```http\n  Status: 200 OK\n  ```\n \n  When `agent_id` or `user_id` is invalid:\n \n  ```http\n  Status: 404 Not Found\n  ```\n \n  #### Allowed For\n   Agents"
  },
  "createTicketOrVoicemailTicket": {
    "comment": "Create Ticket or Voicemail Ticket",
    "doc": "Create Ticket or Voicemail Ticket\n  #### Allowed For\n   Agents\n \n  ### Creating tickets\n \n  #### Introduction\n \n  Creating tickets using Talk Partner Edition follows the same conventions as the Create Ticket endpoint. See [Create Ticket](/api-reference/ticketing/tickets/tickets/#create-ticket).\n \n  #### Request parameters\n \n  The POST request takes a mandatory `ticket` object that lists the values to set when the ticket is created.\n  You may also include an optional `display_to_agent` value such as the ID of the agent that will see the newly created ticket.\n \n  Tickets created using this endpoint must have a `via_id` parameter. See the following\n  section for possible values.\n \n  #### Zendesk Talk Integration Via IDs\n \n  Tickets created using this endpoint must have one of the following `via_id` parameters:\n \n  | ID       | Description\n  | ---------| -------------\n  | 44       | Voicemail\n  | 45       | Phone call (inbound)\n  | 46       | Phone call (outbound)\n \n  ### Creating voicemail tickets\n  #### Request parameters\n \n  The POST request takes a mandatory `ticket` object that lists the values to set when the ticket is created.\n  The ticket must have a `voice_comment` with the following values:\n \n  | Name               | Type                  | Comment\n  | ------------------ | ----------------------| -------\n  | from               | string                | Incoming phone number\n  | to                 | string                | Dialed phone number\n  | recording_url      | string                | URL of the recording\n  | started_at         | date                  | [ISO 8601](http://en.wikipedia.org/wiki/ISO_8601) timestamp of the call starting time\n  | call_duration      | integer               | Duration in seconds of the call\n  | answered_by_id     | integer               | The agent who answered the call\n  | transcription_text | string                | Transcription of the call (optional)\n  | location           | string                | Location of the caller (optional)"
  },
  "redactChatCommentAttachment": {
    "comment": "Redact Chat Comment Attachment",
    "doc": "Redact Chat Comment Attachment\n  Permanently removes one or more chat attachments from a chat ticket.\n \n  Note: This does not work on active chats. For chat tickets that predate March 2020, consider using [Redact Ticket Comment In Agent Workspace](#redact-ticket-comment-in-agent-workspace).\n \n  #### Allowed For\n \n  - Agents\n \n  [Agent Workspace](https://support.zendesk.com/hc/en-us/articles/360024218473) must enabled for the account. Deleting tickets must be enabled for agents.\n \n  #### Request Body Properties\n \n  | Name         | Type    | Required | Description                                                                                                                                                                                                                                            |\n  | ------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |\n  | chat_id      | string  | true     | The `chat_id` in the `ChatStartedEvent` event in the ticket audit. See [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits)                                                                                                                 |\n  | chat_indexes | array   | false    | The array of `chat_index` in the `ChatFileAttachment` event in the ticket audit. See [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits). Mandatory if `message_ids` is not used                                                           |\n  | message_ids  | array   | false    | The array of `message_id` in the `ChatFileAttachment` event in the ticket audit that is part of a `ChatStartedEvent` history. Used when redacting a ChatFileAttachment that is part of a conversation history. Mandatory if `chat_indexes` is not used |\n \n  To get the required body properties, make a request to the [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits) endpoint. Example response:\n \n  ```http\n  Status 200 OK\n  {\n  \"audits\": [\n  \"events\": [\n  {\n  \"id\": 1932802680168,\n  \"type\": \"ChatStartedEvent\",\n  \"value\": {\n  \"visitor_id\": \"10502823-16EkM3T6VNq7KMd\",\n  \"chat_id\": \"2109.10502823.Sjuj2YrBpXwei\",\n  \"history\": [\n  {\n  \"chat_index\": 0,\n  \"type\": \"ChatFileAttachment\",\n  \"filename\": \"image1.jpg\"\n  },\n  {\n  \"chat_index\": 1,\n  \"type\": \"ChatFileAttachment\",\n  \"filename\": \"image2.jpg\"\n  }\n  ]\n  }\n  }\n  ]\n  ]\n  }\n  ```"
  },
  "redactChatComment": {
    "comment": "Redact Chat Comment",
    "doc": "Redact Chat Comment\n  Permanently removes words or strings from a chat ticket's comment.\n \n  Wrap `<redact>` tags around the content in the chat comment you want redacted. Example:\n \n  ```json\n  {\n  \"text\": \"My ID number is <redact>847564</redact>!\"\n  }\n  ```\n \n  The characters contained in the tag will be replaced by the ▇ symbol.\n \n  Note: This does not work on active chats. For chat tickets that predate March 2020, consider using [Redact Ticket Comment In Agent Workspace](#redact-ticket-comment-in-agent-workspace).\n \n  #### Allowed For\n \n  - Agents\n \n  [Agent Workspace](https://support.zendesk.com/hc/en-us/articles/360024218473) must enabled for the account. Deleting tickets must be enabled for agents.\n \n  #### Request Body Properties\n \n  | Name                     | Type    | Required | Description                                                                                                                                                                                                                                       |\n  | ------------------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n  | chat_id                  | string  | true     | The `chat_id` in the `ChatStartedEvent` event in the ticket audit. See [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits)                                                                                                            |\n  | chat_index               | integer | false    | The `chat_index` in the `ChatMessage` event in the ticket audit. See [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits). Mandatory if `message_id` is not used                                                                       |\n  | message_id               | string  | false    | The `message_id` of the `ChatMessage` event in the ticket audit that is part of a `ChatStartedEvent` history. Used when redacting a ChatMessage that is part of a conversation history. Mandatory if `chat_index` is not used                     |\n  | text                     | string  | true     | The `message` in the `ChatMessage` event in the ticket audit. See [Ticket Audits](/api-reference/ticketing/tickets/ticket_audits).  Wrap `message` with `<redact>` tags                                                                           |\n \n  To get the required body properties, make a request to the [Ticket Audit](/api-reference/ticketing/tickets/ticket_audits) endpoint. Example response:\n \n  ```http\n  Status 200 OK\n  {\n  \"audits\": [\n  \"events\": [\n  {\n  \"id\": 1932802680168,\n  \"type\": \"ChatStartedEvent\",\n  \"value\": {\n  \"visitor_id\": \"10502823-16EkM3T6VNq7KMd\",\n  \"chat_id\": \"2109.10502823.Sjuj2YrBpXwei\",\n  \"history\": [\n  {\n  \"chat_index\": 0,\n  \"type\": \"ChatMessage\",\n  \"message\": \"My ID number is 847564!\"\n  }\n  ]\n  }\n  }\n  ]\n  ]\n  }\n  ```"
  },
  "redactTicketCommentInAgentWorkspace": {
    "comment": "Redact Ticket Comment In Agent Workspace",
    "doc": "Redact Ticket Comment In Agent Workspace\n  Redaction allows you to permanently remove words, strings, or attachments from a ticket comment.\n \n  In the `html_body` of the comment, wrap the content you want redacted in `<redact>` tags. Example:\n \n  ```json\n  {\n  \"html_body\": \"<div class=\\\"zd-comment\\\" dir=\\\"auto\\\">My ID number is <redact>847564</redact>!</div>\",\n  \"ticket_id\":100\n  }\n  ```\n \n  The characters in the redact tag will be replaced by the ▇ symbol.\n \n  To redact HTML elements such inline images, anchor tags, and links, add the `redact` tag attribute to the element as well as the `<redact>` tag to inner text, if any. Example:\n \n  `<a href=\"http://example.com\" redact><redact>some link</redact></a>`\n \n  The `redact` attribute only redacts the tag. Any inner text will be left behind if not enclosed in a `<redact>` tag.\n \n  Redaction is permanent and can not be undone. Data is permanently deleted from Zendesk servers with no way to recover it.\n \n  This endpoint provides all the same functionality that the [Redact String in Comment](/api-reference/ticketing/tickets/ticket_comments/#redact-string-in-comment) endpoint provides, plus:\n \n  - Redaction of comments in closed tickets\n \n  - Redaction of comments in archived tickets\n \n  - Redaction of formatted text (bold, italics, hyperlinks)\n \n  Limitations: When content is redacted from an email comment, the content is also redacted from the original email through a background job. It may take a while for the changes to be completed.\n \n  Note: We recommend using this endpoint instead of the [Redact String in Comment](/api-reference/ticketing/tickets/ticket_comments/#redact-string-in-comment) endpoint, which will eventually be deprecated.\n \n  #### Allowed For\n \n  - Agents\n \n  [Agent Workspace](https://support.zendesk.com/hc/en-us/articles/360024218473) must be enabled on the account. For professional accounts, deleting tickets must be enabled for agents. On Enterprise accounts, you can assign agents to a custom role with permissions to redact ticket content.\n \n  #### Request Body Properties\n \n  | Name                     | Type    | Required | Description                                                                                                                                      |\n  | -------------------------| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |\n  | ticket_id                | integer | true     | The ID of the ticket                                                                                                                             |\n  | html_body                | string  | false    | The `html_body` of the comment containing `<redact>` tags or `redact` attributes                                           |\n  | external_attachment_urls | array   | false    | Array of attachment URLs belonging to the comment to be redacted. See [`content_url` property of Attachment](/api-reference/ticketing/tickets/ticket-attachments/) |"
  },
  "listCustomObjects": {
    "comment": "List Custom Objects",
    "doc": "List Custom Objects\n  Lists all undeleted custom objects for the account\n  #### Allowed For\n   Agents"
  },
  "createCustomObject": {
    "comment": "Create Custom Object",
    "doc": "Create Custom Object\n  Creates an object describing all the properties required to create a custom object record\n  #### Allowed For\n   Admins"
  },
  "showCustomObject": {
    "comment": "Show Custom Object",
    "doc": "Show Custom Object\n  Returns an object with the specified key\n  #### Allowed For\n   Agents"
  },
  "updateCustomObject": {
    "comment": "Update Custom Object",
    "doc": "Update Custom Object\n  Updates an individual custom object. The updating rules are as follows:\n   Takes a `custom_object` object that specifies the properties to update\n   The `key` property cannot be updated\n  #### Allowed For\n   Admins"
  },
  "deleteCustomObject": {
    "comment": "Delete Custom Object",
    "doc": "Delete Custom Object\n  Permanently deletes the custom object with the specified key\n  #### Allowed For\n   Admins"
  },
  "listCustomObjectFields": {
    "comment": "List Custom Object Fields",
    "doc": "List Custom Object Fields\n  Lists all undeleted custom fields for the specified object.\n \n  #### Allowed For\n   Agents\n \n  #### Pagination\n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createCustomObjectField": {
    "comment": "Create Custom Object Field",
    "doc": "Create Custom Object Field\n  Creates any of the following custom field types:\n \n   text (default when no \"type\" is specified)\n   textarea\n   checkbox\n   date\n   integer\n   decimal\n   regexp\n   dropdown\n   lookup\n   multiselect\n \n  See [About custom field types](https://support.zendesk.com/hc/en-us/articles/203661866) in Zendesk help.\n \n  #### Allowed For\n \n   Admins"
  },
  "showCustomObjectField": {
    "comment": "Show Custom Object Field",
    "doc": "Show Custom Object Field\n  Returns a custom field for a specific object using a provided key or id of the field.\n  #### Allowed For\n   Agents"
  },
  "updateCustomObjectField": {
    "comment": "Update Custom Object Field",
    "doc": "Update Custom Object Field\n  Updates individual custom object fields. The updating rules are as follows:\n   Takes a `custom_object_field` object that specifies the properties to update\n   The `key` property cannot be updated\n   If updating a standard field, only the `title` and `description` properties can be updated.\n  #### Allowed For\n   Admins"
  },
  "deleteCustomObjectField": {
    "comment": "Delete Custom Object Field",
    "doc": "Delete Custom Object Field\n  Deletes a field with the specified key. Note: You can't delete standard fields.\n  #### Allowed For\n   Admins"
  },
  "reorderCustomObjectFields": {
    "comment": "Reorder Custom Fields of an Object",
    "doc": "Reorder Custom Fields of an Object\n  Sets a preferred order of custom fields for a specific object by providing field ids in the desired order.\n  #### Allowed For\n \n   Admins"
  },
  "customObjectRecordBulkJobs": {
    "comment": "Custom Object Record Bulk Jobs",
    "doc": "Custom Object Record Bulk Jobs\n  Queues a background job to perform bulk actions on up to 100 custom object records per single request.\n  Takes a `job` object with two nested fields:\n   `action`, one of:\n   `\"create\"`\n   `\"delete\"`\n   `\"delete_by_external_id\"`\n   `\"create_or_update_by_external_id\"`\n   `\"update\"`\n   `items`\n   For a `\"create\"` action, an array of JSON objects representing the custom object records being created\n   For a `\"delete\"` action, an array of strings representing Zendesk record ids\n   For a `\"delete_by_external_id\"` action, an array of strings representing external ids\n   For a `\"create_or_update_by_external_id\"` action, an array of JSON objects representing the custom object records being created or updated\n   For an `\"update\"` action, an array of JSON objects representing the custom object records being updated\n \n  #### Allowed For\n   Agents\n \n  #### Response ###\n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information."
  },
  "customObjectFieldsLimit": {
    "comment": "Custom Object Fields Limit",
    "doc": "Custom Object Fields Limit\n  List the current count and the limit for a custom object's fields\n  #### Allowed For\n   Agents"
  },
  "listCustomObjectRecords": {
    "comment": "List Custom Object Records",
    "doc": "List Custom Object Records\n  Lists all undeleted custom object records for the specified object\n \n  #### Pagination\n \n   [Cursor pagination](/api-reference/introduction/pagination/#cursor-pagination) only.\n  #### Allowed For\n   Agents"
  },
  "createCustomObjectRecord": {
    "comment": "Create Custom Object Record",
    "doc": "Create Custom Object Record\n  Creates a custom object record according to all the properties described by a custom object definition\n  #### Allowed For\n   Agents"
  },
  "upsertCustomObjectRecord": {
    "comment": "Set Custom Object Record by External Id",
    "doc": "Set Custom Object Record by External Id\n  If a record exists for the given external id, updates it. Only the specified attributes are updated. Otherwise, creates a new record with the provided external id and attributes.\n  #### Allowed For\n   Agents"
  },
  "deleteCustomObjectRecordByExternalId": {
    "comment": "Delete Custom Object Record by External Id",
    "doc": "Delete Custom Object Record by External Id\n  Deletes a record with the specified external id.\n  #### Allowed For\n   Agents"
  },
  "showCustomObjectRecord": {
    "comment": "Show Custom Object Record",
    "doc": "Show Custom Object Record\n  Returns a custom record for a specific object using a provided id.\n  #### Allowed For\n   Agents"
  },
  "updateCustomObjectRecord": {
    "comment": "Update Custom Object Record",
    "doc": "Update Custom Object Record\n  Updates an individual custom object record. The updating rules are as follows:\n   Takes a `custom_object_record` object that specifies the properties to update\n   The custom object fields should be nested inside a `custom_object_fields` object\n  #### Allowed For\n   Agents"
  },
  "deleteCustomObjectRecord": {
    "comment": "Delete Custom Object Record",
    "doc": "Delete Custom Object Record\n  Deletes a record with the specified id\n  #### Allowed For\n   Agents"
  },
  "autocompleteCustomObjectRecordSearch": {
    "comment": "Autocomplete Custom Object Record Search",
    "doc": "Autocomplete Custom Object Record Search\n  Retrieves an array of custom object records that have a field value that matches the value specified in the `name` parameter.\n \n  #### Pagination\n \n   [Cursor pagination](/api-reference/introduction/pagination/#cursor-pagination) only.\n   Returns the first 10,000 records sorted by relevancy with page limits.\n  #### Allowed For\n   Agents"
  },
  "countCustomObjectRecords": {
    "comment": "Count Custom Object Records",
    "doc": "Count Custom Object Records\n  Returns a total count of records for a specific custom object as well as the time the count was refreshed.\n  #### Allowed For\n   Agents"
  },
  "searchCustomObjectRecords": {
    "comment": "Search Custom Object Records",
    "doc": "Search Custom Object Records\n  Returns an array of custom object records that meet the search criteria\n \n  #### Pagination\n \n   [Cursor pagination](/api-reference/introduction/pagination/#cursor-pagination) only.\n   Returns the records sorted by relevancy with page limits. Without a `sort` parameter, only the first 10,000 records are returned. With a `sort` parameter, all records are returned.\n  #### Allowed For\n   Agents"
  },
  "filteredSearchCustomObjectRecords": {
    "comment": "Filtered Search of Custom Object Records",
    "doc": "Filtered Search of Custom Object Records\n  Returns an array of custom object records that meet the search and filter criteria.\n \n  Filters can contain either an individual [comparison object](#comparison-object) or an array of [comparison objects](#comparison-object) within logical namespaces.\n \n  A filter is a JSON object that has the following properties:\n \n  | Name      | Type   | Required | Description\n  | --------- | ------ | -------- | -----------\n  | ATTRIBUTE | object | no       | A [comparison object](#comparison-object) specifying an attribute value condition to be met for records to match.<br/><br/>Examples are marked below.\n  | $and      | array  | no       | Array of conjunctive filter objects (logical AND)\n  | $or       | array  | no       | Array of conjunctive filter objects (logical OR)\n \n  ##### Examples\n \n \n  ```js\n  {\n  \"filter\": {\n  \"custom_object_fields.field_key\": { \"$eq\": \"value\" } // ATTRIBUTE\n  }\n  }\n  ```\n \n  ```js\n  // $or\n  {\n  \"filter\": {\n  \"$or\": [\n  { \"custom_object_fields.field_key\": { \"$eq\": \"value\" } }, // ATTRIBUTE\n  { \"external_id\": { \"$eq\": \"Record123\" } } // ATTRIBUTE\n  ]\n  }\n  }\n  ```\n \n  #### Comparison Object\n \n  A comparison object defines a condition a record must meet to be considered a match. The condition is based on an attribute value or object type.\n \n  A comparison object is a JSON object that has the following properties:\n \n  | Name      | Type          | Required | Description\n  | --------- | ------------- | -------- | -----------\n  | FIELD_KEY | string        | yes      | When filtering on a custom field, they must be namedspaced with `custom_object_fields.`. ex. `custom_object_fields.field_key`<br/><br/>When filtering on a standard field, no namespace is required. The following fields are considered standard: `created_at`, `updated_at`, `created_by_user`, `updated_by_user`, `name`, `external_id`\n  | OPERATOR  | string        | yes      | [Supported operators](/documentation/custom-data/v2/searching-custom-object-records/) vary by the value's data type\n  | VALUE     | string, array | yes      | The value you're filtering for\n \n  #### Pagination\n \n   [Cursor pagination](/api-reference/introduction/pagination/#cursor-pagination) only.\n   Returns the records sorted by relevancy with page limits. Without a `sort` parameter, only the first 10,000 records are returned. With a `sort` parameter, all records are returned.\n \n  #### Allowed For\n \n   Agents\n   End users (when an admin [configures](https://support.zendesk.com/hc/en-us/articles/6034260247066) the custom object to be accessible to end users)"
  },
  "listObjectTriggers": {
    "comment": "List Object Triggers",
    "doc": "List Object Triggers\n  Lists all triggers for the specified custom object.\n \n  #### Allowed For\n   Agents"
  },
  "createObjectTrigger": {
    "comment": "Create Object Trigger",
    "doc": "Create Object Trigger\n  Creates a new object trigger for a specified object.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)"
  },
  "getObjectTrigger": {
    "comment": "Show Object Trigger",
    "doc": "Show Object Trigger\n  Returns details of a specific object trigger.\n  #### Allowed For\n \n   Agents"
  },
  "updateObjectTrigger": {
    "comment": "Update Object Trigger",
    "doc": "Update Object Trigger\n  Updates a specified object trigger.\n \n  Note: Updating a condition or action updates both the conditions and actions arrays,\n  clearing all existing values of both arrays. Include all your conditions\n  and actions when updating any condition or action.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)"
  },
  "deleteObjectTrigger": {
    "comment": "Delete Object Trigger",
    "doc": "Delete Object Trigger\n  Deletes a specified object trigger.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)"
  },
  "listActiveObjectTriggers": {
    "comment": "List Active Object Triggers",
    "doc": "List Active Object Triggers\n  Lists all active object triggers.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)"
  },
  "listObjectTriggersDefinitions": {
    "comment": "List Object Trigger Action and Condition Definitions",
    "doc": "List Object Trigger Action and Condition Definitions\n  Lists the conditions and actions of all triggers for the specified custom object.\n \n  #### Allowed For\n   Agents"
  },
  "deleteManyObjectTriggers": {
    "comment": "Delete Many Object Triggers",
    "doc": "Delete Many Object Triggers\n  Deletes the object triggers corresponding to the provided comma-separated list of ids.\n \n  Note: You can only bulk-delete triggers associated with one object at a time, specified by the `custom_object_key` in the request.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)\n \n  #### Request Parameters\n \n  The DELETE request takes an `ids` object that lists the\n  object triggers to delete. All of the specified object trigger `ids` must be associated with a single object.\n \n  | Name | Description\n  | ---- | -----------\n  | ids  | The ids of the triggers to delete\n \n  #### Example request\n \n  ```js\n  {\n  \"ids\": \"25,23,27,22\"\n  }\n  ```"
  },
  "searchObjectTriggers": {
    "comment": "Search Object Triggers",
    "doc": "Search Object Triggers\n  Returns a list of object triggers that meet your filter or search criteria.\n \n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents\n \n  #### Filter\n \n  Use the `filter` query parameter to filter an object trigger search by one or more attributes. For example, the following `filter` argument filters object triggers by the `title` attribute:\n \n  ```json\n  {\n  \"json\": {\n  \"title\": \"test\"\n  }\n  }\n  ```"
  },
  "updateManyObjectTriggers": {
    "comment": "Update Many Object Triggers",
    "doc": "Update Many Object Triggers\n  Updates the position or the active status of multiple object triggers. Any additional properties are ignored.\n \n  Note: You can only bulk-update triggers associated with one object at a time, specified by the `custom_object_key` in the request.\n \n  #### Allowed For\n \n   Administrators\n   Agents in custom roles with the `manage_triggers` permission (Enterprise only)\n \n  #### Request Parameters\n \n  The PUT request expects a `triggers` object that lists the object triggers to update. All of the specified object trigger `ids` must be associated with a single object.\n \n  You can specify the following properties for each object trigger you're updating:\n \n  | Name        | Mandatory | Description\n  | --------    | --------- | -----------\n  | id          | yes       | The ID of the object trigger to update\n  | position    | no        | The new position of the object trigger\n  | active      | no        | The active status of the object trigger (true or false)\n \n  #### Example Request\n \n  ```js\n  {\n  \"triggers\": [\n  {\"id\": 25, \"position\": 3},\n  {\"id\": 23, \"active\": true},\n  {\"id\": 27, \"position\": 9, \"active\": false},\n  {\"id\": 22, \"position\": 7}\n  ]\n  }\n  ```"
  },
  "customObjectsLimit": {
    "comment": "Custom Objects Limit",
    "doc": "Custom Objects Limit\n  List the current count and the limit for custom objects\n  #### Allowed For\n   Admins"
  },
  "customObjectRecordsLimit": {
    "comment": "Custom Object Records Limit",
    "doc": "Custom Object Records Limit\n  List the current count and the limit for custom object records\n  #### Allowed For\n   Agents"
  },
  "listCustomRoles": {
    "comment": "List Custom Roles",
    "doc": "List Custom Roles\n  #### Availability\n \n   Accounts on the Enterprise plan or above\n \n  #### Allowed For\n \n   Agents"
  },
  "createCustomRole": {
    "comment": "Create Custom Role",
    "doc": "Create Custom Role\n  #### Availability\n \n   Accounts on the Enterprise plan or above\n \n  #### Allowed for\n \n   Administrators\n   Agents with the `manage_roles` permission"
  },
  "showCustomRoleById": {
    "comment": "Show Custom Role",
    "doc": "Show Custom Role\n  #### Availability\n \n   Accounts on the Enterprise plan or above\n \n  #### Allowed for\n \n   Administrators\n   Agents with the `manage_roles` permission"
  },
  "updateCustomRoleById": {
    "comment": "Update Custom Role",
    "doc": "Update Custom Role\n  #### Availability\n \n   Accounts on the Enterprise plan or above\n \n  #### Allowed for\n \n   Administrators\n  Agents with the `manage_roles` permission"
  },
  "deleteCustomRoleById": {
    "comment": "Delete Custom Role",
    "doc": "Delete Custom Role\n  #### Availability\n \n   Accounts on the Enterprise plan or above\n \n  #### Allowed for\n \n   Administrators\n   Agents with the `manage_roles` permission"
  },
  "bulkUpdateDefaultCustomStatus": {
    "comment": "Bulk Update Default Custom Ticket Status",
    "doc": "Bulk Update Default Custom Ticket Status\n  Updates the default values for many custom ticket statuses at once.\n \n  #### Allowed For\n \n   Admins"
  },
  "listCustomStatuses": {
    "comment": "List Custom Ticket Statuses",
    "doc": "List Custom Ticket Statuses\n  Lists all undeleted custom ticket statuses for the account. No pagination is provided.\n \n  #### Allowed For\n \n   End Users"
  },
  "createCustomStatus": {
    "comment": "Create Custom Ticket Status",
    "doc": "Create Custom Ticket Status\n  Takes a `custom_status` object that specifies the custom ticket status properties to create.\n \n  #### Allowed For\n \n   Admins"
  },
  "showCustomStatus": {
    "comment": "Show Custom Ticket Status",
    "doc": "Show Custom Ticket Status\n  Returns the custom ticket status object.\n \n  #### Allowed For\n \n   End Users"
  },
  "updateCustomStatus": {
    "comment": "Update Custom Ticket Status",
    "doc": "Update Custom Ticket Status\n  Takes a `custom_status` object that specifies the properties to update.\n \n  #### Allowed For\n \n   Admins"
  },
  "listDeletedTickets": {
    "comment": "List Deleted Tickets",
    "doc": "List Deleted Tickets\n  Returns a maximum of 100 deleted tickets per page. See [Pagination](/api-reference/introduction/pagination/).\n \n  The results includes all deleted (and not yet archived) tickets that\n  have not yet been [scrubbed](https://support.zendesk.com/hc/en-us/articles/4408845703194#topic_fv5_w51_sdb) in the past 30 days. Archived tickets are\n  not included in the results. See [About archived tickets](https://support.zendesk.com/hc/en-us/articles/203657756)\n  in the Support Help Center.\n \n  The tickets are ordered chronologically by created date, from oldest to newest.\n  The first ticket listed may not be the oldest ticket in your\n  account due to [ticket archiving](https://support.zendesk.com/hc/en-us/articles/203657756).\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents\n \n  #### Rate Limit\n \n  You can make 10 requests every 1 minute using this endpoint.\n  When making requests beyond page 100, you can make 5 requests every 1 minute.\n  The rate limiting mechanism behaves as described in\n  [Monitoring your request activity](/api-reference/ticketing/account-configuration/usage_limits/#monitoring-your-request-activity) in the API introduction."
  },
  "deleteTicketPermanently": {
    "comment": "Delete Ticket Permanently",
    "doc": "Delete Ticket Permanently\n  Permanently deletes a soft-deleted ticket. See [Soft delete](https://support.zendesk.com/hc/en-us/articles/4408834005530#topic_zrm_wbj_1db)\n  in the Zendesk GDPR docs. To soft delete a ticket, use the [Delete Ticket](#delete-ticket) endpoint.\n \n  This endpoint enqueues a ticket deletion job and returns a payload with the jobs status.\n \n  If the job succeeds, the ticket is permanently deleted. This operation can't be undone.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work.\n  Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion.\n \n  #### Allowed For\n \n   Agents"
  },
  "restoreDeletedTicket": {
    "comment": "Restore a Previously Deleted Ticket",
    "doc": "Restore a Previously Deleted Ticket\n  #### Allowed For\n \n   Agents"
  },
  "bulkPermanentlyDeleteTickets": {
    "comment": "Delete Multiple Tickets Permanently",
    "doc": "Delete Multiple Tickets Permanently\n  Permanently deletes up to 100 soft-deleted tickets. See [Soft delete](https://support.zendesk.com/hc/en-us/articles/4408834005530#topic_zrm_wbj_1db)\n  in the Zendesk GDPR docs. To soft delete tickets, use the [Bulk Delete Tickets](#bulk-delete-tickets) endpoint.\n \n  This endpoint accepts a comma-separated list of up to 100 ticket ids. It enqueues\n  a ticket deletion job and returns a payload with the jobs status.\n \n  If one ticket fails to be deleted, the endpoint still attempts to delete the others. If the job succeeds,\n  the tickets that were successfully deleted are permanently deleted. This operation can't be undone.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Agents"
  },
  "bulkRestoreDeletedTickets": {
    "comment": "Restore Previously Deleted Tickets in Bulk",
    "doc": "Restore Previously Deleted Tickets in Bulk\n  #### Allowed For\n \n   Agents"
  },
  "listDeletedUsers": {
    "comment": "List Deleted Users",
    "doc": "List Deleted Users\n  Returns deleted users, including permanently deleted users.\n \n  If the results contains permanently deleted users, the users' properties\n  that normally contain personal data, such as `email` and `phone`,\n  are null. The `name` property is \"Permanently Deleted User\".\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "showDeletedUser": {
    "comment": "Show Deleted User",
    "doc": "Show Deleted User\n  Returns users that have been deleted but not permanently yet. See [Permanently Delete User](#permanently-delete-user).\n \n  #### Allowed For:\n \n   Agents"
  },
  "permanentlyDeleteUser": {
    "comment": "Permanently Delete User",
    "doc": "Permanently Delete User\n  Before permanently deleting a user, you must delete the user first. See [Delete User](/api-reference/ticketing/users/users/#delete-user).\n \n  WARNING: Permanently deleting a user deletes all of their information. This information is not recoverable.\n \n  #### Permanent user deletion rate limit\n \n  You can permanently delete 700 users every 10 minutes.\n  The rate limiting mechanism behaves as described in\n  [Rates Limits](/api-reference/introduction/rate-limits/#monitoring-your-request-activity) in the API introduction.\n  Zendesk recommends that you obey the Retry-After header values.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage end users or team members"
  },
  "countDeletedUsers": {
    "comment": "Count Deleted Users",
    "doc": "Count Deleted Users\n  Returns an approximate count of deleted users, including permanently deleted users. If the count exceeds 100,000, it is updated every 24 hours.\n \n  The response includes a `refreshed_at` property in a `count` object that contains a timestamp indicating when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n \n   Agents"
  },
  "listDeletionSchedules": {
    "comment": "List Deletion Schedules",
    "doc": "List Deletion Schedules\n  Lists all deletion schedules for the account. Deletion schedules are used to automatically delete data from the account after a certain period of time.\n \n  #### Allowed For\n \n   Admins"
  },
  "createDeletionSchedule": {
    "comment": "Create Deletion Schedule",
    "doc": "Create Deletion Schedule\n  Creates a new deletion schedule.\n \n  #### Allowed For\n \n   Admins"
  },
  "getDeletionSchedule": {
    "comment": "Get Deletion Schedule",
    "doc": "Get Deletion Schedule\n  Gets a deletion schedule by its id.\n \n  #### Allowed For\n \n   Admins"
  },
  "updateDeletionSchedule": {
    "comment": "Update Deletion Schedule",
    "doc": "Update Deletion Schedule\n  Updates a deletion schedule by its id.\n \n  Note: Updating a condition updates the conditions array, clearing all existing values of the array. Include all your conditions when updating any condition.\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteDeletionSchedule": {
    "comment": "Delete Deletion Schedule",
    "doc": "Delete Deletion Schedule\n  Deletes a deletion schedule by its id.\n \n  #### Allowed For\n \n   Admins"
  },
  "listDynamicContents": {
    "comment": "List Items",
    "doc": "List Items\n  Returns a list of all dynamic content items for your account if accessed as an admin or agents who have permission to manage dynamic content.\n \n  #### Allowed For\n \n   Admins, Agents\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createDynamicContent": {
    "comment": "Create Item",
    "doc": "Create Item\n  Create a new content item, with one or more variants in the item's `variants` array. See [Specifying item variants](#specifying-item-variants).\n \n  The `default_locale_id` and variant `locale_id` values must be one of the locales the account has active. You can get the list with the [List Locales](/api-reference/ticketing/account-configuration/locales/#list-locales) endpoint.\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "showDynamicContentItem": {
    "comment": "Show Item",
    "doc": "Show Item\n  #### Allowed For\n \n   Admins, Agents"
  },
  "updateDynamicContentItem": {
    "comment": "Update Item",
    "doc": "Update Item\n  The only attribute you can change is the name.\n \n  To add a variant to the item, or to update or delete the variants of the item, use the [Item Variants API](/api-reference/ticketing/ticket-management/dynamic_content_item_variants/#update-many-variants).\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "deleteDynamicContentItem": {
    "comment": "Delete Item",
    "doc": "Delete Item\n  #### Allowed For\n \n   Admins, Agents"
  },
  "dynamicContentListVariants": {
    "comment": "List Variants",
    "doc": "List Variants\n  Returns all the variants of the specified dynamic content item.\n \n  #### Allowed For\n \n   Admins\n   Agents who have permission to manage dynamic content\n \n  #### Pagination\n \n   Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createDynamicContentVariant": {
    "comment": "Create Variant",
    "doc": "Create Variant\n  You can only create one variant for each locale id. If a locale variant already exists, the request is rejected.\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "showDynamicContentVariant": {
    "comment": "Show Variant",
    "doc": "Show Variant\n  #### Allowed For\n \n   Admins, Agents"
  },
  "updateDynamicContentVariant": {
    "comment": "Update Variant",
    "doc": "Update Variant\n  Updates the specified variant. You don't need to include all the properties. If you just want to update content, for example, then include just that.\n \n  You can't switch the active state of the default variant of an item. Similarly, you can't switch the default to false if the variant is the default. You must make another variant default instead.\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "deleteDynamicContentVariant": {
    "comment": "Delete Variant",
    "doc": "Delete Variant\n  #### Allowed For\n \n   Admins, Agents"
  },
  "createManyDynamicContentVariants": {
    "comment": "Create Many Variants",
    "doc": "Create Many Variants\n  #### Allowed For\n \n   Admins, Agents"
  },
  "updateManyDynamicContentVariants": {
    "comment": "Update Many Variants",
    "doc": "Update Many Variants\n  Updates one or more variants. See [Update Variant](/api-reference/ticketing/ticket-management/dynamic_content_item_variants/#update-variant).\n \n  You must specify the variants by id in the body. To get the variant ids, see [List Variants](/api-reference/ticketing/ticket-management/dynamic_content_item_variants/#list-variants).\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "showManyDynamicContents": {
    "comment": "Show Many Items",
    "doc": "Show Many Items\n  #### Stability\n \n   Development\n \n  #### Allowed For\n \n   Admins, Agents"
  },
  "listEmailNotifications": {
    "comment": "List Email Notifications",
    "doc": "List Email Notifications\n  #### Allowed For\n \n   Admins\n   Unrestricted agents\n \n  #### Filters\n \n   By notification: `api/v2/email_notifications.json?filter[notification_id]=7824075373693`\n   By comment: `api/v2/email_notifications.json?filter[comment_id]=7824075373565`\n   By ticket: `api/v2/email_notifications.json?filter[ticket_id]=623`\n \n  #### Pagination\n \n   Cursor pagination: `api/v2/email_notifications.json?page[size]=10`\n \n  By default, a maximum of 100 email notifications are included per page. See [Pagination](/api-reference/introduction/pagination/) for more details.\n \n  #### Sorting\n \n  By default, email notifications are sorted by creation time (oldest first). The query parameter is not supported for this endpoint.\n \n   By creation time (newest first): `api/v2/email_notifications.json?sort=created_at`\n   By creation time (oldest first): `api/v2/email_notifications.json?sort=-created_at`\n   By modification time (recently updated first): `api/v2/email_notifications.json?sort=updated_at`\n   By modification time (recently updated last): `api/v2/email_notifications.json?sort=-updated_at`"
  },
  "showEmailNotification": {
    "comment": "Show Email Notification",
    "doc": "Show Email Notification\n  Shows email notification details. You can get the value of the `notification_id` parameter by listing the ticket's outbound emails.\n \n  #### Allowed For\n \n   Admins\n   Unrestricted agents"
  },
  "listGroupMemberships": {
    "comment": "List Memberships",
    "doc": "List Memberships\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For:\n \n   Agents"
  },
  "createGroupMembership": {
    "comment": "Create Membership",
    "doc": "Create Membership\n  Assigns an agent to a given group.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage group memberships (Enterprise only)"
  },
  "showGroupMembershipById": {
    "comment": "Show Membership",
    "doc": "Show Membership\n  The 'id' is the group membership id, not a group id.\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteGroupMembership": {
    "comment": "Delete Membership",
    "doc": "Delete Membership\n  Immediately removes a user from a group and schedules a job to unassign all working tickets that are assigned to the given user and group combination.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage group memberships (Enterprise only)"
  },
  "listAssignableGroupMemberships": {
    "comment": "List Assignable Memberships",
    "doc": "List Assignable Memberships\n  Returns a maximum of 100 group memberships per page.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For:\n \n   Agents"
  },
  "groupMembershipBulkCreate": {
    "comment": "Bulk Create Memberships",
    "doc": "Bulk Create Memberships\n  Assigns up to 100 agents to given groups.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage group memberships (Enterprise only)\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion."
  },
  "groupMembershipBulkDelete": {
    "comment": "Bulk Delete Memberships",
    "doc": "Bulk Delete Memberships\n  Immediately removes users from groups and schedules a job to unassign all working tickets that are assigned to the given user and group combinations.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage group memberships (Enterprise only)"
  },
  "listGroupSlaPolicies": {
    "comment": "List Group SLA Policies",
    "doc": "List Group SLA Policies\n  #### Allowed For\n \n   Admins"
  },
  "createGroupSlaPolicy": {
    "comment": "Create Group SLA Policy",
    "doc": "Create Group SLA Policy\n  #### Allowed For\n \n   Admins"
  },
  "showGroupSlaPolicy": {
    "comment": "Show Group SLA Policy",
    "doc": "Show Group SLA Policy\n  #### Allowed For\n \n   Admins"
  },
  "updateGroupSlaPolicy": {
    "comment": "Update Group SLA Policy",
    "doc": "Update Group SLA Policy\n  Updates the specified policy.\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteGroupSlaPolicy": {
    "comment": "Delete Group SLA Policy",
    "doc": "Delete Group SLA Policy\n  #### Allowed For\n \n   Admins"
  },
  "retrieveGroupSlaPolicyFilterDefinitionItems": {
    "comment": "Retrieve Supported Filter Definition Items",
    "doc": "Retrieve Supported Filter Definition Items\n  #### Allowed For\n \n   Admins"
  },
  "reorderGroupSlaPolicies": {
    "comment": "Reorder Group SLA Policies",
    "doc": "Reorder Group SLA Policies\n  #### Allowed For\n \n   Admins"
  },
  "listGroups": {
    "comment": "List Groups",
    "doc": "List Groups\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "createGroup": {
    "comment": "Create Group",
    "doc": "Create Group\n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage groups (Enterprise only)"
  },
  "showGroupById": {
    "comment": "Show Group",
    "doc": "Show Group\n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "updateGroup": {
    "comment": "Update Group",
    "doc": "Update Group\n  #### Allowed For\n \n   Admins"
  },
  "deleteGroup": {
    "comment": "Delete Group",
    "doc": "Delete Group\n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage groups (Enterprise only)"
  },
  "listAssignableGroups": {
    "comment": "List Assignable Groups",
    "doc": "List Assignable Groups\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "countGroups": {
    "comment": "Count Groups",
    "doc": "Count Groups\n  Returns an approximate count of groups. If the count exceeds 100,000, it is updated every 24 hours.\n \n  The `refreshed_at` property of the `count` object is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `refreshed_at` may occasionally be null. This indicates that the count is being updated in the background, and the `value` property of the `count` object is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "ticketImport": {
    "comment": "Ticket Import",
    "doc": "Ticket Import\n  #### Allowed For\n \n   Admins"
  },
  "ticketBulkImport": {
    "comment": "Ticket Bulk Import",
    "doc": "Ticket Bulk Import\n  Accepts an array of up to 100 ticket objects.\n \n  #### Allowed For\n \n   Admins"
  },
  "incrementalSampleExport": {
    "comment": "Incremental Sample Export",
    "doc": "Incremental Sample Export\n  Use this endpoint to test the incremental export format. It's more strict in terms of rate limiting,\n  at 10 requests per 20 minutes instead of 10 requests per minute. It also returns only up to 50\n  results per request. Otherwise, it's identical to the above APIs.\n \n  Use the `incremental_resource` parameter to specify the resource. Possible values are \"tickets\", \"ticket_events\", \"users\", or \"organizations\"."
  },
  "incrementalOrganizationExport": {
    "comment": "Incremental Organization Export",
    "doc": "Incremental Organization Export\n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  See [Organizations sideloads](/documentation/ticketing/using-the-zendesk-api/side_loading/#supported-endpoints)."
  },
  "incrementalSkilBasedRoutingAttributeValuesExport": {
    "comment": "Incremental Attributes Values Export",
    "doc": "Incremental Attributes Values Export\n  Returns a stream of changes that occurred on routing attribute values.\n \n  #### Allowed For\n \n   Admins\n \n  #### Parameters\n \n  Optional\n \n  | Name   | Type   | Comment\n  | ------ | ------ | -------\n  | cursor | string | The `cursor` parameter is a non-human-readable argument you can use to move forward or backward in time. The cursor is a read-only URL parameter that's only available in API responses. See [Pagination](#pagination)."
  },
  "incrementalSkilBasedRoutingAttributesExport": {
    "comment": "Incremental Attributes Export",
    "doc": "Incremental Attributes Export\n  Returns a stream of changes that occurred on routing attributes.\n \n  #### Allowed For\n \n   Admins\n \n  #### Parameters\n \n  Optional\n \n \n  | Name   | Type   | Comment\n  | ------ | ------ | -------\n  | cursor | string | The `cursor` parameter is a non-human-readable argument you can use to move forward or backward in time. The cursor is a read-only URL parameter that's only available in API responses. See [Pagination](#pagination)."
  },
  "incrementalSkilBasedRoutingInstanceValuesExport": {
    "comment": "Incremental Instance Values Export",
    "doc": "Incremental Instance Values Export\n  Returns a stream of changes that occurred on routing instance values. Changes are grouped by `attribute_value_id`,\n  with associate type events listed alongside unassociate type events based on the unassociate event’s timestamp.\n \n  #### Allowed For\n \n   Admins\n \n  #### Parameters\n \n  Optional\n \n  | Name   | Type   | Comment\n  | ------ | ------ | -------\n  | cursor | string | The `cursor` parameter is a non-human-readable argument you can use to move forward or backward in time. The cursor is a read-only URL parameter that's only available in API responses. See [Pagination](#pagination)."
  },
  "incrementalTicketEvents": {
    "comment": "Incremental Ticket Event Export",
    "doc": "Incremental Ticket Event Export\n  Returns a stream of changes that occurred on tickets. Each event is tied\n  to an update on a ticket and contains all the fields that were updated in that\n  change. For more information, see:\n \n  - [Exporting ticket events](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#exporting-ticket-events) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api)\n  - [Time-based incremental exports](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#time-based-incremental-exports) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api)\n \n  You can include comments in the event stream by using the `comment_events`\n  sideload. See Sideloading below. If you don't specify the sideload, any comment\n  present in the ticket update is described only by Boolean `comment_present`\n  and `comment_public` object properties in the event's `child_events` array.\n  The comment itself is not included.\n \n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  The endpoint supports the `comment_events` sideload. Any comment present in the ticket\n  update is listed as an object in the event's `child_events` array. Example:\n \n  ```js\n  \"child_events\": [\n  {\n  \"id\": 91048994488,\n  \"via\": {\n  \"channel\": \"api\",\n  \"source\": {\"from\":{},\"to\":{},\"rel\":null}},\n  \"via_reference_id\":null,\n  \"type\": \"Comment\",\n  \"author_id\": 5031726587,\n  \"body\": \"This is a comment\",\n  \"html_body\": \"&lt;div class=\"zd-comment\"&gt;&lt;p dir=\"auto\"&gt;This is a comment&lt;/p&gt;\",\n  \"public\": true,\n  \"attachments\": [],\n  \"audit_id\": 91048994468,\n  \"created_at\": \"2009-06-25T10:15:18Z\",\n  \"event_type\": \"Comment\"\n  },\n  ...\n  ],\n  ...\n  ```"
  },
  "listTicketMetricEvents": {
    "comment": "List Ticket Metric Events",
    "doc": "List Ticket Metric Events\n  Returns ticket metric events that occurred on or after the start time.\n \n  Cursor pagination returns a maximum of 100 records per page. Events are listed in chronological order.\n \n  If the results are not paginated, events will be returned as a time-based incremental export.\n \n  See [Time-based incremental exports](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#time-based-incremental-exports).\n \n  #### Pagination\n   Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Allowed For\n \n   Admins"
  },
  "incrementalTicketExportTime": {
    "comment": "Incremental Ticket Export, Time Based",
    "doc": "Incremental Ticket Export, Time Based\n  Returns the tickets that changed since the start time. For more information,\n  see [Exporting tickets](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#exporting-tickets) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api).\n \n  This endpoint supports time-based incremental exports.\n  For more information, see [Time-based incremental exports](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#time-based-incremental-exports) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api). You can also return tickets using cursor-based pagination. See [Incremental Ticket Export, Cursor Based](#incremental-ticket-export-cursor-based).\n \n  The results include tickets that were updated by the system. See\n  [Excluding system-updated tickets](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#excluding-system-updated-tickets-time-based-exports) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api).\n \n  The endpoint can return tickets with an `updated_at` time that's earlier than the\n  `start_time` time. The reason is that the API compares the `start_time` with the ticket's\n  `generated_timestamp` value, not its `updated_at` value. The `updated_at` value is\n  updated only if the update generates a [ticket event](#incremental-ticket-event-export).\n  The `generated_timestamp` value is updated for all ticket updates, including system\n  updates. If a system update occurs after a ticket event, the unchanged\n  `updated_at` time will become earlier relative to the updated `generated_timestamp`\n  time.\n \n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  See [Tickets sideloads](/documentation/ticketing/using-the-zendesk-api/side_loading/#supported-endpoints). For performance reasons,\n  `last_audits` sideloads aren't supported."
  },
  "incrementalTicketExportCursor": {
    "comment": "Incremental Ticket Export, Cursor Based",
    "doc": "Incremental Ticket Export, Cursor Based\n  Returns the tickets that changed since the start time. For more information,\n  see [Exporting tickets](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#exporting-tickets) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api).\n \n  This endpoint supports cursor-based incremental exports.\n  Cursor-based exports are highly encouraged because they provide more consistent performance and\n  response body sizes. For more information, see [Cursor-based incremental exports](/documentation/ticketing/managing-tickets/using-the-incremental-export-api#cursor-based-incremental-exports) in [Using the Incremental Exports API](/documentation/ticketing/managing-tickets/using-the-incremental-export-api).\n \n \n \n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  See [Tickets sideloads](/documentation/ticketing/using-the-zendesk-api/side_loading/#supported-endpoints). For performance reasons,\n  `last_audits` sideloads aren't supported."
  },
  "incrementalUserExportTime": {
    "comment": "Incremental User Export, Time Based",
    "doc": "Incremental User Export, Time Based\n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  See [Users sideloads](/documentation/ticketing/using-the-zendesk-api/side_loading/#supported-endpoints)."
  },
  "incrementalUserExportCursor": {
    "comment": "Incremental User Export, Cursor Based",
    "doc": "Incremental User Export, Cursor Based\n  #### Allowed For\n \n   Admins\n \n  #### Sideloading\n \n  See [Users sideloads](/documentation/ticketing/using-the-zendesk-api/side_loading/#supported-endpoints)."
  },
  "listJobStatuses": {
    "comment": "List Job Statuses",
    "doc": "List Job Statuses\n  Shows the statuses for background jobs. Statuses are sorted first by completion date and then by creation date in descending order.\n \n  #### Allowed For:\n \n   Agents\n \n  #### Pagination\n \n   Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "showJobStatus": {
    "comment": "Show Job Status",
    "doc": "Show Job Status\n  Shows the status of a background job.\n \n  #### Allowed For:\n \n   Agents"
  },
  "showManyJobStatuses": {
    "comment": "Show Many Job Statuses",
    "doc": "Show Many Job Statuses\n  Accepts a comma-separated list of job status ids.\n \n  #### Allowed For:\n \n   Agents"
  },
  "listLocales": {
    "comment": "List Locales",
    "doc": "List Locales\n  Lists the translation locales available for the account.\n \n  Note: You can alter the list by passing an updated `locale_ids` array to the [Update Account Settings](/api-reference/ticketing/account-configuration/account_settings/#update-account-settings) endpoint.\n \n  #### Allowed For\n \n   Anyone"
  },
  "showLocaleById": {
    "comment": "Show Locale",
    "doc": "Show Locale\n  #### Allowed For\n \n   Anyone"
  },
  "listLocalesForAgent": {
    "comment": "List Locales for Agent",
    "doc": "List Locales for Agent\n  Lists the translation locales that have been localized for agents on a specific account.\n \n  #### Allowed For\n \n   Anyone"
  },
  "showCurrentLocale": {
    "comment": "Show Current Locale",
    "doc": "Show Current Locale\n  This works like [Show Locale](#show-locale), but instead of taking a locale id as an argument, it renders the locale of the user performing the request.\n \n  #### Allowed For\n \n   Anyone"
  },
  "detectBestLocale": {
    "comment": "Detect Best Language for User",
    "doc": "Detect Best Language for User\n  #### Allowed For\n \n   Anyone"
  },
  "listAvailablePublicLocales": {
    "comment": "List Available Public Locales",
    "doc": "List Available Public Locales\n  Lists the translation locales that are available to all accounts.\n \n  #### Allowed For\n \n   Anyone"
  },
  "listMacros": {
    "comment": "List Macros",
    "doc": "List Macros\n  Lists all shared and personal macros available to the current user. For admins, the API returns all macros for the account, including the personal macros of agents and other admins.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n   Agents"
  },
  "createMacro": {
    "comment": "Create Macro",
    "doc": "Create Macro\n  #### Allowed For\n   Agents"
  },
  "showMacro": {
    "comment": "Show Macro",
    "doc": "Show Macro\n  #### Allowed For\n   Agents"
  },
  "updateMacro": {
    "comment": "Update Macro",
    "doc": "Update Macro\n  #### Allowed For\n   Agents"
  },
  "deleteMacro": {
    "comment": "Delete Macro",
    "doc": "Delete Macro\n  #### Allowed For\n   Agents, with restrictions applying on certain actions"
  },
  "showChangesToTicket": {
    "comment": "Show Changes to Ticket",
    "doc": "Show Changes to Ticket\n  Returns the changes the macro would make to a ticket. It doesn't actually\n  change a ticket. You can use the response data in a subsequent API call\n  to the [Tickets](/api-reference/ticketing/tickets/tickets/) endpoint to update the ticket.\n \n  The response includes only the ticket fields that would be changed by the\n  macro. To get the full ticket object after the macro is applied,\n  see [Show Ticket After Changes](#show-ticket-after-changes).\n \n  #### Allowed For\n   Agents"
  },
  "listMacroAttachments": {
    "comment": "List Macro Attachments",
    "doc": "List Macro Attachments\n  Lists the attachments associated with a macro.\n \n  #### Allowed For\n   Agents"
  },
  "createAssociatedMacroAttachment": {
    "comment": "Create Macro Attachment",
    "doc": "Create Macro Attachment\n  Allows an attachment to be uploaded and associated with a macro at the same time.\n \n  Note: A macro can be associated with up to five attachments.\n \n  #### Allowed For\n \n   Agents"
  },
  "listMacrosActions": {
    "comment": "List Supported Actions for Macros",
    "doc": "List Supported Actions for Macros\n  #### Allowed For\n   Agents"
  },
  "listActiveMacros": {
    "comment": "List Active Macros",
    "doc": "List Active Macros\n  Lists all active shared and personal macros available to the current user.\n \n  #### Allowed For\n   Agents"
  },
  "createMacroAttachment": {
    "comment": "Create Unassociated Macro Attachment",
    "doc": "Create Unassociated Macro Attachment\n  Allows an attachment to be uploaded that can be associated with a macro at a later time.\n \n  Note: To ensure an uploaded attachment is not lost, associate it with a macro as soon as possible. From time to time, old attachments that are not not associated with any macro are purged.\n \n  #### Allowed For\n \n   Agents"
  },
  "showMacroAttachment": {
    "comment": "Show Macro Attachment",
    "doc": "Show Macro Attachment\n  Shows the properties of the specified macro attachment.\n \n  #### Allowed For\n   Agents"
  },
  "listMacroCategories": {
    "comment": "List Macro Categories",
    "doc": "List Macro Categories\n  Lists all macro categories available to the current user.\n \n  #### Allowed For\n   Agents"
  },
  "listMacroActionDefinitions": {
    "comment": "List Macro Action Definitions",
    "doc": "List Macro Action Definitions\n  Returns the definitions of the actions a macro can perform. For example,\n  one action can set the status of a ticket. The definition of the action\n  includes a title (\"Status\"), a type (\"list\"), and possible values. For a\n  list of support actions, see [Actions reference](/documentation/ticketing/reference-guides/actions-reference).\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteManyMacros": {
    "comment": "Bulk Delete Macros",
    "doc": "Bulk Delete Macros\n  Deletes the macros corresponding to the provided comma-separated list of IDs.\n \n  #### Allowed For\n   Agents"
  },
  "showDerivedMacro": {
    "comment": "Show Macro Replica",
    "doc": "Show Macro Replica\n  Returns an unpersisted macro representation derived from a ticket or macro.\n \n  The endpoint takes one of the following query parameters: `macro_id` or `ticket_id`. If you include both, `macro_id` is used.\n \n  #### Allowed For\n   Agents"
  },
  "searchMacro": {
    "comment": "Search Macros",
    "doc": "Search Macros\n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n   Agents"
  },
  "updateManyMacros": {
    "comment": "Update Many Macros",
    "doc": "Update Many Macros\n  Updates the provided macros with the specified changes.\n \n  #### Allowed For\n   Agents"
  },
  "showEssentialsCard": {
    "comment": "Show Essentials Card",
    "doc": "Show Essentials Card\n  Gets the essentials card for an object type.\n  #### Allowed For\n   Admins and agents"
  },
  "updateEssentialsCard": {
    "comment": "Update Essentials Card",
    "doc": "Update Essentials Card\n  Updates the essentials card for an object type.\n  #### Allowed For\n   Admins"
  },
  "deleteEssentialsCard": {
    "comment": "Delete Essentials Card",
    "doc": "Delete Essentials Card\n  Delete the essentials card for an object type.\n  #### Allowed For\n   Admins and agents"
  },
  "showEssentialsCards": {
    "comment": "List of Essentials Cards",
    "doc": "List of Essentials Cards\n  Gets the list of essentials cards.\n  #### Allowed For\n   Admins"
  },
  "listOrganizationFields": {
    "comment": "List Organization Fields",
    "doc": "List Organization Fields\n  Returns a list of custom organization fields in your account. Fields are returned in the order that you specify in your organization fields configuration in Zendesk Support. Clients should cache this resource for the duration of their API usage and map the key for each organization field to the values returned under the `organization_fields` attribute on the [organization](/api-reference/ticketing/organizations/organizations/) resource.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "createOrganizationField": {
    "comment": "Create Organization Field",
    "doc": "Create Organization Field\n  Creates any of the following custom field types:\n \n   text (default when no \"type\" is specified)\n   textarea\n   checkbox\n   date\n   integer\n   decimal\n   regexp\n   dropdown\n   lookup\n   multiselect\n \n  See [About custom field types](https://support.zendesk.com/hc/en-us/articles/203661866) in Zendesk help.\n \n  #### Allowed For\n \n   Admins"
  },
  "showOrganizationField": {
    "comment": "Show Organization Field",
    "doc": "Show Organization Field\n  #### Allowed for\n \n   Agents"
  },
  "updateOrganizationField": {
    "comment": "Update Organization Field",
    "doc": "Update Organization Field\n  #### Updating a Dropdown (Tagger) or Multiselect Field\n \n  Dropdown and multiselect fields return an array of `custom_field_options` which specify the name, value, and order of dropdown or multiselect options. When updating a dropdown or multiselect field, note the following information:\n \n  - All options must be passed on update. Options that are not passed will be removed. As a result, these values will be removed from any organizations\n  - To create a new option, pass a null `id` along with the `name` and `value`\n  - To update an existing option, pass its `id` along with the `name` and `value`\n  - To reorder an option, reposition it in the `custom_field_options` array relative to the other options\n  - To remove an option, omit it from the list of options upon update\n \n  #### Example Request\n \n  ```bash\n  curl https://{subdomain}.zendesk.com/api/v2/organization_fields/{organization_field_id}.json \\\n  -H \"Content-Type: application/json\" -X PUT \\\n  -d '{\"organization_field\": {\"custom_field_options\": [{\"id\": 124, \"name\": \"Option 2\", \"value\": \"option_2\"}, {\"id\": 123, \"name\": \"Option 1\", \"value\": \"option_1\"}, {\"id\": 125, \"name\": \"Option 3\", \"value\": \"option_3\"}]}}' \\\n  -v -u {email_address}/token:{api_token}\n  ```\n  #### Allowed for\n \n   Admins"
  },
  "deleteOrganizationField": {
    "comment": "Delete Organization Field",
    "doc": "Delete Organization Field\n  #### Allowed for\n \n   Admins"
  },
  "reorderOrganizationField": {
    "comment": "Reorder Organization Field",
    "doc": "Reorder Organization Field\n  #### Allowed For\n \n   Admins"
  },
  "listOrganizationMemberships": {
    "comment": "List Memberships",
    "doc": "List Memberships\n  Returns a list of organization memberships for the account, user or organization in question.\n \n  Note: When returning organization memberships for a user, organization memberships are sorted with the default organization first, and then by organization name.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n  - Agents\n  - End users"
  },
  "createOrganizationMembership": {
    "comment": "Create Membership",
    "doc": "Create Membership\n  Assigns a user to a given organization. Returns an error with status 422 if the user is already assigned to the organization.\n \n  #### Allowed For\n \n   Admins\n   Agents when creating a new organization membership for an end user"
  },
  "showOrganizationMembershipById": {
    "comment": "Show Membership",
    "doc": "Show Membership\n  #### Allowed for\n \n   Agents"
  },
  "deleteOrganizationMembership": {
    "comment": "Delete Membership",
    "doc": "Delete Membership\n  Immediately removes a user from an organization and schedules a job to unassign all working tickets currently assigned to the user and organization combination. The `organization_id` of the unassigned tickets is set to null.\n \n  #### Allowed for\n \n   Admins\n   Agents when deleting an organization membership for an end user"
  },
  "createManyOrganizationMemberships": {
    "comment": "Create Many Memberships",
    "doc": "Create Many Memberships\n  Accepts an array of up to 100 organization membership objects.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n   Admins\n   Agents"
  },
  "deleteManyOrganizationMemberships": {
    "comment": "Bulk Delete Memberships",
    "doc": "Bulk Delete Memberships\n  Immediately removes a user from an organization and schedules a job to unassign all working tickets currently assigned to the user and organization combination. The `organization_id` of the unassigned tickets is set to null.\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Agents"
  },
  "showOrganizationMerge": {
    "comment": "Show Organization Merge",
    "doc": "Show Organization Merge\n  Retrieves the details of a specific organization merge operation. This endpoint is useful for obtaining the status and outcome of a merge that was previously initiated. It provides information such as the winning and losing organization IDs, the status of the merge, and the associated URLs.\n \n  This endpoint can be used to determine if a merge is still in progress, has completed successfully, or has encountered an error.\n \n  #### Allowed For\n \n   Admins"
  },
  "listOrganizationSubscriptions": {
    "comment": "List Organization Subscriptions",
    "doc": "List Organization Subscriptions\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For:\n \n   Agents\n   End users\n \n  For end users, the response will only list the subscriptions created by the requesting end user."
  },
  "createOrganizationSubscription": {
    "comment": "Create Organization Subscription",
    "doc": "Create Organization Subscription\n  #### Allowed For:\n \n   Agents\n   End users\n \n  End users can only subscribe to shared organizations in which they're members."
  },
  "showOrganizationSubscription": {
    "comment": "Show Organization Subscription",
    "doc": "Show Organization Subscription\n  #### Allowed For:\n \n   Agents\n   End users\n \n  For end users, the response will only list the subscriptions created by the requesting end user."
  },
  "deleteOrganizationSubscription": {
    "comment": "Delete Organization Subscription",
    "doc": "Delete Organization Subscription\n  #### Allowed For:\n \n   Agents\n   End users"
  },
  "listOrganizations": {
    "comment": "List Organizations",
    "doc": "List Organizations\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents, with certain restrictions\n \n  If the agent has a custom agent role that restricts their access to only users in their own organization, a 403 Forbidden error is returned. See [Creating custom agent roles](https://support.zendesk.com/hc/en-us/articles/203662026-Creating-custom-roles-and-assigning-agents#topic_cxn_hig_bd) in Zendesk help."
  },
  "createOrganization": {
    "comment": "Create Organization",
    "doc": "Create Organization\n  You must provide a unique `name` for each organization. Normally\n  the system doesn't allow records to be created with identical names.\n  However, a race condition can occur if you make two or more identical\n  POSTs very close to each other, causing the records to have identical\n  organization names.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage organizations (Enterprise only)"
  },
  "showOrganization": {
    "comment": "Show Organization",
    "doc": "Show Organization\n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "updateOrganization": {
    "comment": "Update Organization",
    "doc": "Update Organization\n  #### Allowed For\n \n   Admins\n   Agents\n \n  Agents with no permissions restrictions can only update \"notes\" on organizations.\n \n  Note: Updating an organization's `domain_names` property overwrites all existing `domain_names` values. To prevent this, submit a complete list of `domain_names` for the organization in your request.\n \n  #### Example Request\n \n  ```js\n  {\n  \"organization\": {\n  \"notes\": \"Something interesting\"\n  }\n  }\n  ```"
  },
  "deleteOrganization": {
    "comment": "Delete Organization",
    "doc": "Delete Organization\n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage organizations (Enterprise only)"
  },
  "createOrganizationMerge": {
    "comment": "Merge Organization With Another Organization",
    "doc": "Merge Organization With Another Organization\n  Merges two organizations by moving all users, tickets, and domain names from the organization specified by `{organization_id}` to the organization specified by `winner_id`. After the merge:\n \n  - The \"losing\" organization will be deleted.\n  - Other organization fields and their values will not be carried over to the \"winning\" organization.\n  - The merge operation creates an `Organization Merge` record which contains a status indicating the progress of the merge.\n \n  Note: This operation is irreversible.\n \n  #### Merge Statuses\n \n  | Status | Description |\n  |--------|-------------|\n  | new | A job has been queued to merge the two organizations. |\n  | in progress | The job to merge the two organizations has started. |\n  | error | An error occurred during the merge job. The merge can be retried by repeating the API call. |\n  | complete | The merge has been completed successfully. |\n \n  #### Allowed For\n \n   Admins"
  },
  "listOrganizationMerges": {
    "comment": "List Organization Merges",
    "doc": "List Organization Merges\n  Retrieves a list of all organization merge operations associated with a given organization. This endpoint allows you to track the history of merge actions for an organization, including ongoing and completed merges.\n \n  Each entry in the list contains details such as the ID of the merge, the winning and losing organization IDs, the current status of the merge, and a URL to access the `Organization Merge` record.\n \n  #### Pagination\n \n  - Cursor pagination is used for this endpoint.\n  - A maximum of 100 records can be returned per page.\n \n  See [Pagination](/api-reference/introduction/pagination/) for more details.\n \n  #### Allowed For\n \n   Admins"
  },
  "organizationRelated": {
    "comment": "Show Organization's Related Information",
    "doc": "Show Organization's Related Information\n  #### Allowed For\n \n   Agents"
  },
  "autocompleteOrganizations": {
    "comment": "Autocomplete Organizations",
    "doc": "Autocomplete Organizations\n  Returns an array of organizations whose name starts with the\n  value specified in the `name` parameter.\n \n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents"
  },
  "countOrganizations": {
    "comment": "Count Organizations",
    "doc": "Count Organizations\n  Returns an approximate count of organizations. If the count exceeds\n  100,000, it is updated every 24 hours.\n \n  The `refreshed_at` property of the `count` object is a timestamp that indicates\n  when the count was last updated.\n \n  When the count exceeds 100,000, the `refreshed_at` property may\n  occasionally be null. This indicates that the count is being\n  updated in the background and the `value` property of the `count` object is limited to\n  100,000 until the update is complete.\n \n  #### Allowed For\n \n   Agents"
  },
  "createManyOrganizations": {
    "comment": "Create Many Organizations",
    "doc": "Create Many Organizations\n  Accepts an array of up to 100 organization objects.\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Agents, with restrictions applying on certain actions"
  },
  "createOrUpdateOrganization": {
    "comment": "Create Or Update Organization",
    "doc": "Create Or Update Organization\n  Creates an organization if it doesn't already exist, or updates\n  an existing organization. Using this method means one less call\n  to check if an organization exists before creating it. You need\n  to specify the id or external id when updating\n  an organization to avoid a duplicate error response. Name is\n  not available as a matching criteria.\n \n  #### Allowed For\n \n   Agents, with restrictions on certain actions"
  },
  "deleteManyOrganizations": {
    "comment": "Bulk Delete Organizations",
    "doc": "Bulk Delete Organizations\n  Accepts a comma-separated list of up to 100 organization ids or external ids.\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Admins\n   Agents assigned to a custom role with permissions to manage organizations (Enterprise only)"
  },
  "searchOrganizations": {
    "comment": "Search Organizations",
    "doc": "Search Organizations\n  Returns an array of organizations matching the criteria. You may search by an organization's `external_id` or `name`, but not both:\n \n  #### Searching by `external_id`\n \n  If you set the `external_id` value of an organization to associate it to an external record, you can use it to search for the organization.\n \n  For an organization to be returned, its `external_id` must exactly match the value provided (case insensitive).\n \n  #### Searching by `name`\n \n  For an organization to be returned, its `name` must exactly match the value provided (case insensitive).\n \n  #### Allowed For:\n \n   Admins\n   Agents assigned to a custom role with permissions to add or modify organizations (Enterprise only)\n \n  See [Creating custom agent roles](https://support.zendesk.com/hc/en-us/articles/203662026#topic_cxn_hig_bd) in the Support Help Center."
  },
  "showManyOrganizations": {
    "comment": "Show Many Organizations",
    "doc": "Show Many Organizations\n  Accepts a comma-separated list of up to 100 organization ids or external ids.\n \n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "updateManyOrganizations": {
    "comment": "Update Many Organizations",
    "doc": "Update Many Organizations\n  Bulk or batch updates up to 100 organizations.\n \n  #### Bulk update\n \n  To make the same change to multiple organizations, use the following endpoint and data format:\n \n  `https://{subdomain}.zendesk.com/api/v2/organizations/update_many.json?ids=1,2,3`\n \n  ```js\n  {\n  \"organization\": {\n  \"notes\": \"Priority\"\n  }\n  }\n  ```\n \n  #### Batch update\n \n  To make different changes to multiple organizations, use the following endpoint and data format:\n \n  `https://{subdomain}.zendesk.com/api/v2/organizations/update_many.json`\n \n  ```js\n  {\n  \"organizations\": [\n  { \"id\": 1, \"notes\": \"Priority\" },\n  { \"id\": 2, \"notes\": \"Normal\" }\n  ]\n  }\n  ```\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Admins\n   Agents\n \n  Agents with no permissions restrictions can only update \"notes\" on organizations."
  },
  "listTicketProblems": {
    "comment": "List Ticket Problems",
    "doc": "List Ticket Problems\n  The response is always ordered by `updated_at` in descending order\n \n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "autocompleteProblems": {
    "comment": "Autocomplete Problems",
    "doc": "Autocomplete Problems\n  Returns tickets whose type is \"problem\" and whose subject contains the string specified in the `text` parameter.\n \n  You can specify the `text` parameter in the request body rather than the query string. Example:\n \n  `{\"text\": \"fire\"}`\n \n  #### Allowed For\n \n   Agents"
  },
  "pushNotificationDevices": {
    "comment": "Bulk Unregister Push Notification Devices",
    "doc": "Bulk Unregister Push Notification Devices\n  Unregisters the mobile devices that are receiving push notifications. Specify the devices as an array of mobile device tokens.\n \n  #### Allowed for\n \n   Admins"
  },
  "listQueues": {
    "comment": "List queues",
    "doc": "List queues\n  #### Allowed For\n \n   Admins"
  },
  "createQueue": {
    "comment": "Create queue",
    "doc": "Create queue\n  #### Allowed For\n \n   Admins"
  },
  "showQueueById": {
    "comment": "Show Queue",
    "doc": "Show Queue\n  #### Allowed For\n \n   Admins"
  },
  "updateQueue": {
    "comment": "Update queue",
    "doc": "Update queue\n  #### Allowed For\n \n   Admins"
  },
  "deleteQueue": {
    "comment": "Delete queue",
    "doc": "Delete queue\n  #### Allowed For\n \n   Admins"
  },
  "listQueueDefinitions": {
    "comment": "List queue definitions",
    "doc": "List queue definitions\n  #### Allowed For\n \n   Admins"
  },
  "listSupportAddresses": {
    "comment": "List Support Addresses",
    "doc": "List Support Addresses\n  Lists all the support addresses for the account.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "createSupportAddress": {
    "comment": "Create Support Address",
    "doc": "Create Support Address\n  Adds a Zendesk or external support address to your account.\n \n  To add a Zendesk address, use the following syntax: `{local-part}@{accountname}.zendesk.com`.\n  Example: 'sales-team@example.zendesk.com'. The [local-part](https://en.wikipedia.org/wiki/Email_address#Local-part) can be anything you like.\n \n  To add an external email address such as help@omniwearshop.com, the email must already exist and you must set up forwarding on your email server. The exact steps depend on your mail server. See [Forwarding incoming email to Zendesk Support](https://support.zendesk.com/hc/en-us/articles/203663266). After setting up forwarding, run the [Verify Support Address Forwarding](#verify-support-address-forwarding) endpoint. The address won't work in Zendesk Support until it's been verified.\n \n  #### Allowed For\n \n   Admins\n   Agents with permission to manage channels and extensions. See the system permissions in [Creating custom roles and assigning agents (Enterprise)](https://support.zendesk.com/hc/en-us/articles/203662026-Creating-custom-roles-and-assigning-agents-Enterprise-#topic_cxn_hig_bd) in the Support Help Center"
  },
  "showSupportAddress": {
    "comment": "Show Support Address",
    "doc": "Show Support Address\n  #### Allowed For\n \n   Admins\n   Agents"
  },
  "updateSupportAddress": {
    "comment": "Update Support Address",
    "doc": "Update Support Address\n  Updates an existing support address for your account.\n \n  You can't use this endpoint to update a support address's `email` property.\n  Instead, you can create a new address using the [Create Support\n  Address](#create-support-address) endpoint.\n \n  #### Allowed For\n \n   Admins\n   Agents with permission to manage channels and extensions. See the system permissions in [Creating custom roles and assigning agents (Enterprise)](https://support.zendesk.com/hc/en-us/articles/203662026-Creating-custom-roles-and-assigning-agents-Enterprise-#topic_cxn_hig_bd) in the Support Help Center"
  },
  "deleteRecipientAddress": {
    "comment": "Delete Support Address",
    "doc": "Delete Support Address\n  Deletes a support address.\n \n  #### Allowed For\n \n   Admins\n   Agents with permission to manage channels and extensions. See the system permissions in [Creating custom roles and assigning agents (Enterprise)](https://support.zendesk.com/hc/en-us/articles/203662026-Creating-custom-roles-and-assigning-agents-Enterprise-#topic_cxn_hig_bd) in the Support Help Center"
  },
  "verifySupportAddressForwarding": {
    "comment": "Verify Support Address Forwarding",
    "doc": "Verify Support Address Forwarding\n  Sends a test email to the specified support address to verify that email forwarding for the address works. An external support address won't work in Zendesk Support until it's verified.\n \n  Note: You don't need to verify Zendesk system support addresses.\n \n  The endpoint takes the following body: `{\"type\": \"forwarding\"}`. The value of the `type` property defaults to \"forwarding\" if none is specified, but the values \"spf\" and \"dns\" are also accepted.\n \n  Use this endpoint after [adding](#create-support-address) an external support address to Zendesk Support and setting up forwarding on your email server. See [Forwarding incoming email to Zendesk Support](https://support.zendesk.com/hc/en-us/articles/203663266).\n \n  The endpoint doesn't return the results of the test. Instead, use the [Show Support Address](#show-support-address) endpoint to check that the `forwarding_status` property is \"verified\".\n \n  Other verification checks can also be performed using this API. These include SPF checks and DNS checks.\n \n  When calling the endpoint with `type` set to \"spf\", it will queries the DNS records to check that the SPF records for Zendesk are present for outbound emails.\n \n  When calling the endpoint with `type` set to \"dns\", it runs checks on your CNAME records to make sure they are set up properly in your DNS.\n \n  #### Allowed For\n \n   Admins\n   Agents with permission to manage channels and extensions. See the system permissions in [Creating custom roles and assigning agents (Enterprise)](https://support.zendesk.com/hc/en-us/articles/203662026-Creating-custom-roles-and-assigning-agents-Enterprise-#topic_cxn_hig_bd) in the Support Help Center"
  },
  "getRelationshipFilterDefinitions": {
    "comment": "Filter Definitions",
    "doc": "Filter Definitions\n  Returns filter definitions based on the given target type.  Target types\n  include users (zen:user), tickets (zen:ticket), organizations (zen:organization), or custom objects (zen:custom_object:CUSTOM_OBJECT_KEY).\n  The returned filter definitions are the options that you can use to build a custom field or ticket field's\n  `relationship_filter`."
  },
  "listRequests": {
    "comment": "List Requests",
    "doc": "List Requests\n  #### Allowed for\n \n   End Users\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createRequest": {
    "comment": "Create Request",
    "doc": "Create Request\n  Accepts a `request` object that sets one or more properties.\n \n  #### Allowed for\n \n   End users\n   Anonymous users (rate limit of 5 requests per hour for [trial accounts](/documentation/developer-tools/getting-started/getting-a-trial-or-sponsored-account-for-development/))\n \n  #### Additional properties\n \n  In addition to the writable request properties in the [JSON Format table](#json-format) above, you can set the following properties when creating a request.\n \n  | Name                | Type   | Mandatory | Comment\n  | ----------------    | -------| --------- | -------\n  | comment             | object | yes       | Describes the problem, incident, question, or task. See [Request comments](#request-comments)\n  | collaborators       | array  | no        | Adds collaborators (cc's) to the request. An email notification is sent to them when the ticket is created. See [Setting collaborators](/documentation/ticketing/managing-tickets/creating-and-managing-requests#setting-collaborators)\n  | requester           | object | yes      | \\Required for anonymous requests. Specifies the requester of the anonymous request. See [Creating anonymous requests](/documentation/ticketing/managing-tickets/creating-and-managing-requests#creating-anonymous-requests)\n \n  #### Creating follow-up requests\n \n  Once a ticket is closed (as distinct from solved), it can't be reopened. However, you can create a new request that references the closed ticket. To create the follow-up request, include a `via_followup_source_id` property in the `request` object that specifies the closed ticket. The parameter only works with closed tickets. It has no effect with other tickets."
  },
  "showRequest": {
    "comment": "Show Request",
    "doc": "Show Request\n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | users            | The email ccs for a request by side-loading users\n \n  #### Allowed For\n \n   End Users"
  },
  "updateRequest": {
    "comment": "Update Request",
    "doc": "Update Request\n  Updates a request with a comment or collaborators (cc's). The end user who created the request can also use it to mark the request as solved. The endpoint can't be used to update other request attributes.\n \n  #### Writable properties\n  This endpoint can only update the following properties in the request.\n \n  | Name                     | Type    | Required | Description                                          |\n  | ------------------------ | ------- | -------- | ---------------------------------------------------- |\n  | comment                  | object  | no       | Adds a comment to the request. See [Request comments](#request-comments) |\n  | solved                   | boolean | no       | Marks the request as solved. Example: `{\"request\": {\"solved\": \"true\"}}`. End users can mark requests as solved only if the request's `can_be_solved_by_me` property is true. The property is true only when the ticket is assigned to an agent and the ticket type is not a problem but a question, task, or incident |\n  | additional_collaborators | array   | no       | Adds collaborators to the request. An email notification is sent to them when the ticket is updated. See [Adding collaborators](/documentation/ticketing/managing-tickets/creating-and-managing-requests#adding-collaborators) |\n \n  #### Allowed For\n \n   End users"
  },
  "listComments": {
    "comment": "Listing Comments",
    "doc": "Listing Comments\n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Sorting\n \n  By default, comments are sorted by creation date in ascending order.\n \n  When using cursor pagination, use the following parameter to change the sort order:\n \n  | Name   | Type   | Required | Comments\n  | ------ | ------ | -------- | --------\n  | `sort` | string | no       | Possible values are \"created_at\" (ascending order) or \"-created_at\" (descending order)\n \n  When using offset pagination, use the following parameters to change the sort order:\n \n  | Name         | Type   | Required | Comments\n  | ------------ | ------ | -------- | --------\n  | `sort_by`    | string | no       | One of `created_at`, `updated_at`\n  | `sort_order` | string | no       | One of `asc`, `desc`\n \n  #### Allowed For\n \n   End Users"
  },
  "showComment": {
    "comment": "Getting Comments",
    "doc": "Getting Comments\n  #### Allowed For\n \n   End Users"
  },
  "searchRequests": {
    "comment": "Search Requests",
    "doc": "Search Requests\n  Examples:\n \n   `GET /api/v2/requests/search.json?query=printer`\n   `GET /api/v2/requests/search.json?query=printer&organization_id=1`\n   `GET /api/v2/requests/search.json?query=printer&cc_id=true`\n   `GET /api/v2/requests/search.json?query=printer&status=hold,open`\n \n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Results limit\n \n  The Search Requests endpoint returns up to 1,000 results per query, with a maximum of 100 results per page. See [Pagination](/api-reference/ticketing/introduction/#pagination). If you request a page past the limit (`page=11` at 100 results per page), a 422 Insufficient Resource Error is returned.\n \n  #### Allowed For\n \n   End Users"
  },
  "listResourceCollections": {
    "comment": "List Resource Collections",
    "doc": "List Resource Collections\n  Lists resource collections for the account.\n \n  #### Allowed for\n \n   Admins"
  },
  "createResourceCollection": {
    "comment": "Create Resource Collection",
    "doc": "Create Resource Collection\n  Creates a resource collection from a provided `payload` object. The `payload` object is specified the same way as the content of a requirements.json file in a Zendesk app. See [Specifying Apps Requirements](/documentation/apps/app-developer-guide/apps_requirements/) in the Zendesk Apps framework docs.\n \n  The response includes a [job\n  status](/api-reference/ticketing/ticket-management/job_statuses/) for creation of the specified resources.\n \n  #### Allowed for\n \n   Admins"
  },
  "retrieveResourceCollection": {
    "comment": "Show Resource Collection",
    "doc": "Show Resource Collection\n  Retrieves details for a specified resource collection.\n \n  #### Allowed for\n \n   Admins"
  },
  "updateResourceCollection": {
    "comment": "Update Resource Collection",
    "doc": "Update Resource Collection\n  Updates a resource collection using a provided `payload` object. The `payload` object  is specified the same way as the content of a requirements.json file in a Zendesk app. See [Specifying Apps Requirements](/documentation/apps/app-developer-guide/apps_requirements/) in the Zendesk Apps framework docs.\n \n  The response includes a [job\n  status](/api-reference/ticketing/ticket-management/job_statuses/) for the resource updates.\n \n  #### Allowed for\n \n   Admins"
  },
  "deleteResourceCollection": {
    "comment": "Delete Resource Collection",
    "doc": "Delete Resource Collection\n  Deletes a specified resource collection.\n \n  The response includes a [job\n  status](/api-reference/ticketing/ticket-management/job_statuses/) for deletion of the collection's resources.\n \n  #### Allowed for\n \n   Admins"
  },
  "listAgentAttributeValues": {
    "comment": "List Agent Attribute Values",
    "doc": "List Agent Attribute Values\n  Returns an attribute value.\n \n  #### Allowed For\n \n   Agents and admins"
  },
  "setAgentAttributeValues": {
    "comment": "Set Agent Attribute Values",
    "doc": "Set Agent Attribute Values\n  Adds the specified attributes if no attributes exists, or replaces all existing attributes with the specified attributes.\n \n  #### Allowed For\n \n   Admins"
  },
  "listAccountAttributes": {
    "comment": "List Account Attributes",
    "doc": "List Account Attributes\n  Returns a list of attributes for the account.\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | attribute_values | The attribute values available on the account\n \n  #### Allowed For\n \n   Agents and admins"
  },
  "createAttribute": {
    "comment": "Create Attribute",
    "doc": "Create Attribute\n  Creates an attribute.\n \n  #### Allowed For\n \n   Agents"
  },
  "showAttribute": {
    "comment": "Show Attribute",
    "doc": "Show Attribute\n  Returns an attribute.\n \n  #### Allowed For\n \n   Admins"
  },
  "updateAttribute": {
    "comment": "Update Attribute",
    "doc": "Update Attribute\n  Updates an attribute.\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteAttribute": {
    "comment": "Delete Attribute",
    "doc": "Delete Attribute\n  Deletes an attribute.\n \n  #### Allowed For\n \n   Admins"
  },
  "listAttributeValues": {
    "comment": "List Attribute Values for an Attribute",
    "doc": "List Attribute Values for an Attribute\n  Returns a list of attribute values for a provided attribute.\n \n  #### Allowed For\n \n   Admins"
  },
  "createAttributeValue": {
    "comment": "Create Attribute Value",
    "doc": "Create Attribute Value\n  Creates an attribute value.\n \n  #### Allowed For\n \n   Admins"
  },
  "showAttributeValue": {
    "comment": "Show Attribute Value",
    "doc": "Show Attribute Value\n  Returns an attribute value.\n \n  #### Allowed For\n \n   Admins"
  },
  "updateAttributeValue": {
    "comment": "Update Attribute Value",
    "doc": "Update Attribute Value\n  Updates the name and ticket conditions of a skill. When a ticket is created, the skill is applied to a ticket  if the ticket meets the specified condition or conditions. See the [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference/) for more information.\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteAttributeValue": {
    "comment": "Delete Attribute Value",
    "doc": "Delete Attribute Value\n  Deletes an attribute value.\n \n  #### Allowed For\n \n   Agents"
  },
  "listRoutingAttributeDefinitions": {
    "comment": "List Routing Attribute Definitions",
    "doc": "List Routing Attribute Definitions\n  Returns the condition definitions that can be configured to apply attributes to a ticket.\n \n  #### Allowed For\n \n   Admins"
  },
  "listTicketsFullfilledByUser": {
    "comment": "List Tickets Fulfilled by a User",
    "doc": "List Tickets Fulfilled by a User\n  Returns a list of ticket ids that contain attributes matching the current user's attributes. Accepts a `ticket_ids` parameter for relevant tickets to check for matching attributes.\n \n  #### Allowed For\n \n   Agents and admins"
  },
  "listTicketAttributeValues": {
    "comment": "List Ticket Attribute Values",
    "doc": "List Ticket Attribute Values\n  Returns a list of attributes values for the ticket.\n \n  #### Allowed For\n \n   Agents and admins"
  },
  "setTicketAttributeValues": {
    "comment": "Set Ticket Attribute Values",
    "doc": "Set Ticket Attribute Values\n  Adds the specified attributes if no attributes exists, or replaces all existing attributes with the specified attributes.\n \n  Invalid or deleted attributes are ignored.\n \n  #### Allowed For\n \n   Admins"
  },
  "listSatisfactionRatings": {
    "comment": "List Satisfaction Ratings",
    "doc": "List Satisfaction Ratings\n  #### Allowed For\n   Admins\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Filters\n \n  | Parameter  | Value\n  | ---------- | -----\n  | score      | offered, unoffered, received, received\\_with\\_comment, received\\_without\\_comment,<br/>good, good\\_with\\_comment, good\\_without\\_comment,<br/>bad, bad\\_with\\_comment, bad\\_without\\_comment\n  | start_time | Time of the oldest satisfaction rating, as a [Unix epoch time](https://www.epochconverter.com/)\n  | end_time   | Time of the most recent satisfaction rating, as a [Unix epoch time](https://www.epochconverter.com/)\n \n  If you specify an unqualified score such as `good`, the results include all the records with and without comments.\n \n  Examples:\n \n   `/api/v2/satisfaction_ratings.json?score=bad`\n   `/api/v2/satisfaction_ratings.json?score=bad&start_time=1498151194`\n   `/api/v2/satisfaction_ratings.json?start_time=1340384793&end_time=1371920793`"
  },
  "showSatisfactionRating": {
    "comment": "Show Satisfaction Rating",
    "doc": "Show Satisfaction Rating\n  Returns a specific satisfaction rating. You can get the id from\n  the [List Satisfaction Ratings](#list-satisfaction-ratings) endpoint.\n \n  #### Allowed For\n \n   Admins"
  },
  "countSatisfactionRatings": {
    "comment": "Count Satisfaction Ratings",
    "doc": "Count Satisfaction Ratings\n  Returns an approximate count of satisfaction ratings in the account. If the count exceeds 100,000, the count will return a cached result. This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Admins"
  },
  "listSatisfactionRatingReasons": {
    "comment": "List Reasons for Satisfaction Rating",
    "doc": "List Reasons for Satisfaction Rating\n  List all reasons for an account\n \n  #### Allowed For\n \n   Admins"
  },
  "showSatisfactionRatings": {
    "comment": "Show Reason for Satisfaction Rating",
    "doc": "Show Reason for Satisfaction Rating\n  #### Allowed For\n \n   Admins"
  },
  "listSearchResults": {
    "comment": "List Search Results",
    "doc": "List Search Results\n  Returns the search results. See [Query basics](#query-basics) for the syntax of the `query` parameter.\n \n  Use the ampersand character (&) to append the `sort_by` or `sort_order` parameters to the URL.\n \n  For examples, see [Searching with Zendesk API](/documentation/ticketing/using-the-zendesk-api/searching-with-the-zendesk-api).\n \n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n \n   Offset pagination only\n \n  Offset pagination may result in duplicate results when paging. You can also use the\n  [Export Search Results](/api-reference/ticketing/ticket-management/search/#export-search-results) endpoint, which\n  uses cursor-based pagination and doesn't return duplicate results. See\n  [Using cursor pagination](/api-reference/introduction/pagination/#using-cursor-pagination) for more information.\n \n \n  #### Errors JSON Format\n \n  Errors are represented as JSON objects which have the following keys:\n \n  | Name                  | Type                 | Comment\n  | --------------------- | ---------------------| --------------------\n  | error                 | string               | The type of error. Examples: \"unavailable\", \"invalid\"\n  | description           | string               |\n \n  ##### Example Error\n  ```js\n  {\n  \"error\": \"unavailable\",\n  \"description\": \"Sorry, we could not complete your search query. Please try again in a moment.\"\n  }\n  ```"
  },
  "countSearchResults": {
    "comment": "Show Results Count",
    "doc": "Show Results Count\n  Returns the number of items matching the query rather than the items. The search string works the same as a regular search.\n \n  #### Allowed For\n \n  - Agents"
  },
  "exportSearchResults": {
    "comment": "Export Search Results",
    "doc": "Export Search Results\n  Exports a set of results. See [Query syntax](#query-syntax) for the syntax of the `query` parameter.\n \n  Use this endpoint for search queries that will return more than 1000 results. The result set is ordered only by the `created_at` attribute.\n \n  The search only returns results of a single object type. The following object types are supported: ticket, organization, user, or group.\n \n  You must specify the type in the `filter[type]` parameter. Searches with type in the query string will result in an error.\n \n  #### Allowed For\n \n  - Agents\n \n  #### Pagination\n \n  - Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 1000 records per page. The number of results shown in a page is determined by the `page[size]` parameter.\n \n  Note: You may experience a speed reduction or a timeout if you request 1000 results per page and you have many archived tickets in the results. Try reducing the number of results per page. We recommend 100 results per page.\n \n  The cursor specified by the `after_cursor` property in a response expires after one hour.\n \n  For more information on cursor-based pagination, see the following articles:\n \n  - [Comparing cursor pagination and offset pagination](/documentation/developer-tools/pagination/comparing-cursor-pagination-and-offset-pagination)\n  - [Paginating through lists using cursor pagination](/documentation/developer-tools/pagination/paginating-through-lists-using-cursor-pagination)\n \n  #### Limits\n \n  This API endpoint is rate-limited to 100 requests per minute per account. The limit also counts towards the global API rate limit.\n \n  #### Response Format\n \n  | Name                  | Type                 | Comment\n  | --------------------- | ---------------------| --------------------\n  | links[next]           | string               | URL to the next page of results\n  | meta[has_more]        | string               | Boolean indicating if there are more results\n  | meta[after_cursor]    | string               | Cursor object returned from the Search Service\n  | results               | array                | May consist of tickets, users, groups, or organizations, as specified by the `filter_type` parameter\n \n  The response is similar to the response of `GET /api/v2/search.json?`, with a few changes:\n \n   `links` - Has the following nested properties: `prev` and `next`. These replace the `next_page` and `prev_page` links. The `prev` property is always null because backward pagination is not supported. The `next` property may include an auto-generated link to the next page of results.\n   `meta` - Has the following nested properties: `has_more` and `after_cursor`. The `has_more` property indicates whether the next page has more results. The `after_cursor` property is the cursor used to paginate to the next page. It expires after one hour.\n \n  There's no `count` property."
  },
  "listSessions": {
    "comment": "List Sessions",
    "doc": "List Sessions\n  If authenticated as an admin, returns all the account's sessions. If authenticated as an agent or end user, returns only the sessions of the user making the request.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "listSharingAgreements": {
    "comment": "List Sharing Agreements",
    "doc": "List Sharing Agreements\n  #### Allowed For\n \n   Agents"
  },
  "createSharingAgreement": {
    "comment": "Create Sharing Agreement",
    "doc": "Create Sharing Agreement\n  #### Allowed For\n \n   Admins"
  },
  "showSharingAgreement": {
    "comment": "Show a Sharing Agreement",
    "doc": "Show a Sharing Agreement\n  Returns a sharing agreement for your account.\n \n  #### Allowed For\n \n   Agents"
  },
  "updateSharingAgreement": {
    "comment": "Update a Sharing Agreement",
    "doc": "Update a Sharing Agreement\n  Returns an updated sharing agreement. Only `status` is allowed to be updated.\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteSharingAgreement": {
    "comment": "Delete a Sharing Agreement",
    "doc": "Delete a Sharing Agreement\n  Deletes a sharing agreement.\n \n  #### Allowed For\n \n   Admins"
  },
  "recordNewSkip": {
    "comment": "Record a New Skip for the Current User",
    "doc": "Record a New Skip for the Current User\n  Record a new ticket skip for the current user.\n \n  #### Allowed For\n \n   Agents"
  },
  "listSlaPolicies": {
    "comment": "List SLA Policies",
    "doc": "List SLA Policies\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "createSlaPolicy": {
    "comment": "Create SLA Policy",
    "doc": "Create SLA Policy\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "showSlaPolicy": {
    "comment": "Show SLA Policy",
    "doc": "Show SLA Policy\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "updateSlaPolicy": {
    "comment": "Update SLA Policy",
    "doc": "Update SLA Policy\n  Updates the specified policy.\n \n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "deleteSlaPolicy": {
    "comment": "Delete SLA Policy",
    "doc": "Delete SLA Policy\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "retrieveSlaPolicyFilterDefinitionItems": {
    "comment": "Retrieve Supported Filter Definition Items",
    "doc": "Retrieve Supported Filter Definition Items\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "reorderSlaPolicies": {
    "comment": "Reorder SLA Policies",
    "doc": "Reorder SLA Policies\n  #### Availability\n \n   Accounts on the Support Professional or Suite Growth plan or above\n \n  #### Allowed For\n \n   Admins"
  },
  "listSuspendedTickets": {
    "comment": "List Suspended Tickets",
    "doc": "List Suspended Tickets\n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans\n \n  #### Sorting\n \n  You can sort the tickets with the `sort_by` and `sort_order` query string parameters.\n \n  #### Pagination\n \n   Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "showSuspendedTickets": {
    "comment": "Show Suspended Ticket",
    "doc": "Show Suspended Ticket\n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans"
  },
  "deleteSuspendedTicket": {
    "comment": "Delete Suspended Ticket",
    "doc": "Delete Suspended Ticket\n  #### Allowed For\n \n   Unrestricted agents"
  },
  "recoverSuspendedTicket": {
    "comment": "Recover Suspended Ticket",
    "doc": "Recover Suspended Ticket\n  Note: During recovery, the API sets the requester to the authenticated agent who called the API, not the original requester. This prevents the ticket from being re-suspended after recovery. To preserve the original requester, use the [Recover Multiple Suspended Tickets](#recover-multiple-suspended-tickets) endpoint with the single ticket.\n \n  This endpoint does not queue an asynchronous job that can be tracked from [Job Statuses](/api-reference/ticketing/ticket-management/job_statuses/). Instead, it processes the request with a synchronous response.\n  - If all recoveries are successful, it returns a 200 with a `tickets` array in the response.\n  - If all recoveries fail, it returns a 422 with a `suspended_tickets` array in the response.\n  - If there is a mixture of successes and failures in a single call, it returns a 422 with a `suspended_tickets` array of the failures in the response.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans"
  },
  "suspendedTicketsAttachments": {
    "comment": "Suspended Ticket Attachments",
    "doc": "Suspended Ticket Attachments\n  Makes copies of any attachments on a suspended ticket and returns them as [attachment tokens](/api-reference/ticketing/tickets/ticket-attachments/). If the  ticket is manually recovered, you can include the attachment tokens on the new ticket.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans"
  },
  "deleteSuspendedTickets": {
    "comment": "Delete Multiple Suspended Tickets",
    "doc": "Delete Multiple Suspended Tickets\n  Accepts up to 100 ids (the auto-generated id, not the ticket id.)\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans"
  },
  "exportSuspendedTickets": {
    "comment": "Export Suspended Tickets",
    "doc": "Export Suspended Tickets\n  Exports a list of suspended tickets for the Zendesk Support instance. To export the list, the endpoint enqueues a job to create a CSV file with the data. When done, Zendesk sends the requester an email containing a link to the CSV file. In the CSV, tickets are sorted by the update timestamp in ascending order.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans\n \n  #### Rate limits\n \n  Limited to one request per minute and up to one million records in return. The rate-limiting mechanism behaves identically to the one described in [Usage limits](/api-reference/ticketing/account-configuration/usage_limits/#monitoring-your-request-activity).\n  We recommend using the `Retry-After` header value as described in [Catching errors caused by rate limiting](/documentation/ticketing/using-the-zendesk-api/best-practices-for-avoiding-rate-limiting#catch)."
  },
  "recoverSuspendedTickets": {
    "comment": "Recover Multiple Suspended Tickets",
    "doc": "Recover Multiple Suspended Tickets\n  Accepts up to 100 ids (the auto-generated id, not the ticket id.) Note that suspended tickets that fail to be recovered are still included in the response.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage suspended tickets on Enterprise plans\n   Unrestricted agents on all other plans"
  },
  "listTags": {
    "comment": "List Tags",
    "doc": "List Tags\n  Lists up to the 20,000 most popular tags in the last 60 days, in decreasing popularity.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "countTags": {
    "comment": "Count Tags",
    "doc": "Count Tags\n  Returns an approximate count of tags. If the count exceeds 100,000, it\n  is updated every 24 hours.\n \n  The `refreshed_at` property of the `count` object is a timestamp that indicates when\n  the count was last updated.\n \n  Note: When the count exceeds 100,000, the `refreshed_at` property in the `count` object may\n  occasionally be null. This indicates that the count is being\n  updated in the background and the `value` property in the `count` object is limited to\n  100,000 until the update is complete.\n \n  #### Allowed For\n \n   Agents"
  },
  "listTargetFailures": {
    "comment": "List Target Failures",
    "doc": "List Target Failures\n  Returns the 25 most recent target failures, per target.\n \n  #### Stability\n \n   Development\n \n  #### Allowed For\n \n   Admins"
  },
  "showTargetFailure": {
    "comment": "Show Target Failure",
    "doc": "Show Target Failure\n  #### Stability\n \n   Development\n \n  #### Allowed For\n \n   Admins"
  },
  "listTargets": {
    "comment": "List Targets",
    "doc": "List Targets\n  #### Allowed For\n \n   Agents"
  },
  "createTarget": {
    "comment": "Create Target",
    "doc": "Create Target\n  #### Allowed For\n \n   Admins"
  },
  "showTarget": {
    "comment": "Show Target",
    "doc": "Show Target\n  #### Allowed For\n \n   Agents"
  },
  "updateTarget": {
    "comment": "Update Target",
    "doc": "Update Target\n  #### Allowed For\n   Admins"
  },
  "deleteTarget": {
    "comment": "Delete Target",
    "doc": "Delete Target\n  #### Allowed For\n   Admins"
  },
  "listTicketAudits": {
    "comment": "List All Ticket Audits",
    "doc": "List All Ticket Audits\n  Returns ticket audits. Archived tickets are not included in the response. Use the [List Audits for a Ticket](#list-audits-for-a-ticket) endpoint to\n  retrieve audit records for an archived ticket. To learn more about archived tickets, see [About archived tickets](https://support.zendesk.com/hc/en-us/articles/203657756).\n \n  This endpoint should not be used for capturing change data. When continually chasing the tail of a cursor, some records will be skipped. For this use case, use the [Incremental Ticket Event Export API](/api-reference/ticketing/ticket-management/incremental_exports/#incremental-ticket-event-export).\n \n  #### Pagination\n \n  - Cursor pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Admins"
  },
  "listTicketFields": {
    "comment": "List Ticket Fields",
    "doc": "List Ticket Fields\n  Returns a list of all system and custom ticket fields in your account.\n \n  For end users, only the ticket fields with visible_in_portal set to true are returned.\n \n  Cursor pagination returns a maximum of 100 records per page and fields are returned in the order specified by their id.\n \n  If the results are not paginated, every field is returned in the response and fields are returned in the order specified by the position.\n \n  You can adjust the position of ticket fields by:\n \n  - Using the [Update Ticket Field](/api-reference/ticketing/tickets/ticket_fields/#update-ticket-field) endpoint\n  - Using the [Reorder Ticket Fields](/api-reference/ticketing/tickets/ticket_fields/#reorder-ticket-fields) endpoint\n  - Ticket Fields page in the Admin Center (Admin Center > Manage > Ticket > Fields > Actions > Edit order)\n \n  These adjustments determine the order in which fields are displayed in various locations. For accounts without access to multiple ticket forms, the order will also be used to display field values within tickets. However, for accounts with access to multiple ticket forms, the field order on the ticket page is defined within each form.\n \n  Consider caching this resource to use with the [Tickets](/api-reference/ticketing/tickets/tickets/#json-format) API.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - No pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | users            | The user or users that created the ticket field\n \n  #### Allowed For\n \n   Anyone"
  },
  "createTicketField": {
    "comment": "Create Ticket Field",
    "doc": "Create Ticket Field\n  Creates any of the following custom field types:\n \n  | Custom field type | Description                                                                                                                                                     |\n  |-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|\n  | text              | Default custom field type when `type` is not specified                                                                                                          |\n  | textarea          | For multi-line text                                                                                                                                             |\n  | checkbox          | To capture a boolean value. Allowed values are true or false. Optionally, you can specify a tag to be added to the ticket when the value is true.               |\n  | date              | Example: 2021-04-16                                                                                                                                             |\n  | integer           | String composed of numbers. May contain an optional decimal point                                                                                               |\n  | decimal           | For numbers containing decimals                                                                                                                                 |\n  | regexp            | Matches the Regex pattern found in the custom field settings                                                                                                    |\n  | partialcreditcard | A credit card number. Only the last 4 digits are retained                                                                                                       |\n  | multiselect       | Enables users to choose multiple options from a dropdown menu. It contains one or more tag values belonging to the field's options.                             |\n  | tagger            | Single-select dropdown menu. It contains one or more tag values belonging to the field's options. Example: ( {\"id\": 21938362, \"value\": [\"hd_3000\", \"hd_5555\"]}) |\n  | lookup            | A field to create a relationship (see [lookup relationships](/api-reference/ticketing/lookup_relationships/lookup_relationships/)) to another object such as a user, ticket, or organization |\n \n  Note: Tags can't be re-used across custom ticket fields. For example, if you configure a tag for a checkbox field, you can't use that tag value for a dropdown field option.\n \n  See [About custom field types](https://support.zendesk.com/hc/en-us/articles/203661866) in the Zendesk Help Center.\n \n  #### Allowed For\n \n   Admins\n \n  #### Field limits\n \n  We recommend the following best practices for ticket fields limits. Creating more than these amounts can affect performance.\n \n   400 ticket fields per account if your account doesn't have ticket forms\n   400 ticket fields per ticket form if your account has ticket forms"
  },
  "showTicketfield": {
    "comment": "Show Ticket Field",
    "doc": "Show Ticket Field\n  #### Allowed for\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | users            | The user or users that created the ticket field"
  },
  "updateTicketField": {
    "comment": "Update Ticket Field",
    "doc": "Update Ticket Field\n  #### Updating drop-down field options\n \n  You can also use the update endpoint to add, update, or remove options in a drop-down custom field. Updating field options for multi-select fields works exactly the same as drop-down field options.\n \n  Important: Unless you want to remove some options, you must specify all existing options in any update request. Omitting an option removes it from the drop-down field, which removes its values from any tickets or macros.\n \n  Use the `custom_field_options` attribute to update the options. The attribute consists of an array of option objects, with each object consisting of a `name` and `value` property. The properties correspond to the \"Title\" and \"Tag\" text boxes in the admin interface. Example request body:\n \n  ```json\n  {\"ticket_field\": {\n  \"custom_field_options\": [\n  {\"name\": \"Apple Pie\", \"value\": \"apple\"},\n  {\"name\": \"Pecan Pie\", \"value\": \"pecan\"}\n  ]\n  }\n  }\n  ```\n \n  #### Example Request\n \n  ```bash\n  curl https://{subdomain}.zendesk.com/api/v2/ticket_fields/{id}.json \\\n  -d '{\"ticket_field\": {\"custom_field_options\": [{\"name\": \"Apple Pie\", \"value\": \"apple\"}, {\"name\": \"Pecan Pie\", \"value\": \"pecan\"}]}}' \\\n  -H \"Content-Type: application/json\" -X PUT \\\n  -v -u {email_address}/token:{api_token}\n  ```\n \n  #### Example Response\n \n  ```http\n  Status: 200 OK\n \n  {\n  \"ticket_field\": {\n  \"id\":21938362,\n  \"type\":\"tagger\",\n  \"title\":\"Pies\",\n  ...\n  \"custom_field_options\": [\n  {\n  \"id\":21029772,\n  \"name\":\"Apple Pie\",\n  \"raw_name\":\"Apple Pie\",\n  \"value\":\"apple\",\n  \"default\":false\n  },\n  ...\n  ]\n  }\n  }\n  ```\n \n  #### Allowed for\n \n   Admins"
  },
  "deleteTicketField": {
    "comment": "Delete Ticket Field",
    "doc": "Delete Ticket Field\n  #### Allowed for\n \n   Admins"
  },
  "listTicketFieldOptions": {
    "comment": "List Ticket Field Options",
    "doc": "List Ticket Field Options\n  Returns a list of custom ticket field options for the given drop-down ticket field.\n \n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createOrUpdateTicketFieldOption": {
    "comment": "Create or Update Ticket Field Option",
    "doc": "Create or Update Ticket Field Option\n  Creates or updates an option for the given drop-down ticket field.\n \n  To update an option, include the id of the option in the `custom_field_option` object. Example:\n \n  `{\"custom_field_option\": {\"id\": 10002, \"name\": \"Pineapples\", ... }`\n \n  If an option exists for the given ID, the option will be updated. Otherwise, a new option will be created.\n \n  #### Response\n \n  Returns one of the following status codes:\n \n  - 200 with `Location: /api/v2/ticket_fields/{ticket_field_id}/options.json` if the ticket field option already exists in the database\n  - 201 with `Location: /api/v2/ticket_fields/{ticket_field_id}/options.json` if the ticket field option is new\n \n  #### Allowed For\n \n   Admins\n \n  #### Rate Limit\n  You can make 100 requests every 1 minute using this endpoint.\n  The rate limiting mechanism behaves as described in\n  [Monitoring your request activity](/api-reference/ticketing/account-configuration/usage_limits/#monitoring-your-request-activity) in the API introduction.\n \n  #### Field Option Limits\n \n   2000 options per ticket field"
  },
  "showTicketFieldOption": {
    "comment": "Show Ticket Field Option",
    "doc": "Show Ticket Field Option\n  #### Allowed for\n   Agents"
  },
  "deleteTicketFieldOption": {
    "comment": "Delete Ticket Field Option",
    "doc": "Delete Ticket Field Option\n  #### Allowed for\n   Admins"
  },
  "countTicketFields": {
    "comment": "Count Ticket Fields",
    "doc": "Count Ticket Fields\n  Returns an approximate count of system and custom ticket fields in the account. If the count exceeds 100,000, the count will return a cached result.  This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Agents"
  },
  "reorderTicketFields": {
    "comment": "Reorder Ticket Fields",
    "doc": "Reorder Ticket Fields\n  #### Allowed For\n   Admins\n \n  #### Request Parameters\n \n  You can pass in the following parameter in the payload:\n \n  | Name                | Type   | Comment\n  | ------------------- | ------ | --------\n  | ticket_field_ids    | array  | An array of ticket field ids. Example: \"[2, 23, 46, 50]\". Not all ticket_field_ids are necessary in the payload; only those provided will be assigned to the first positions. Missing IDs will be assigned incremental positions automatically."
  },
  "listTicketForms": {
    "comment": "List Ticket Forms",
    "doc": "List Ticket Forms\n  Returns a list of all ticket forms for your account if accessed as an admin or agent. End users only see ticket forms that have `end_user_visible` set to true.\n \n  #### Allowed For\n \n   Anyone"
  },
  "createTicketForm": {
    "comment": "Create Ticket Form",
    "doc": "Create Ticket Form\n  #### Allowed For\n \n   Admins"
  },
  "showTicketForm": {
    "comment": "Show Ticket Form",
    "doc": "Show Ticket Form\n  #### Allowed For\n \n   Admins, Agents, and End Users"
  },
  "updateTicketForm": {
    "comment": "Update Ticket Form",
    "doc": "Update Ticket Form\n  #### Allowed For\n   Admins"
  },
  "deleteTicketForm": {
    "comment": "Delete Ticket Form",
    "doc": "Delete Ticket Form\n  #### Allowed For\n   Admins"
  },
  "cloneTicketForm": {
    "comment": "Clone an Already Existing Ticket Form",
    "doc": "Clone an Already Existing Ticket Form\n  #### Allowed For\n \n   Admins"
  },
  "reorderTicketForms": {
    "comment": "Reorder Ticket Forms",
    "doc": "Reorder Ticket Forms\n  #### Allowed For\n   Admins\n \n  #### Request Parameters\n \n  You can pass in the following parameter in the payload:\n \n  | Name                | Type   | Comment\n  | ------------------- | ------ | --------\n  | ticket_form_ids     | array  | An array of ticket form ids. Example: \"[2, 23, 46, 50]\""
  },
  "showManyTicketForms": {
    "comment": "Show Many Ticket Forms",
    "doc": "Show Many Ticket Forms\n  Takes an `ids` query parameter that accepts a comma-separated list of up to 100 ticket form ids. This endpoint is used primarily by the [mobile SDK](/documentation/classic-web-widget-sdks/) and the [Web Widget](/api-reference/widget/introduction/).\n \n  #### Allowed For\n \n   Anyone"
  },
  "listTicketMetrics": {
    "comment": "List Ticket Metrics",
    "doc": "List Ticket Metrics\n  Returns a list of tickets with their metrics.\n \n  Tickets are ordered chronologically by created date, from newest to oldest.\n  The last ticket listed may not be the absolute oldest ticket in your account\n  due to ticket archiving.\n \n  Archived tickets are not included in the response. See\n  [About archived tickets](https://support.zendesk.com/hc/en-us/articles/203657756) in\n  Zendesk help.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n \n  #### Allowed For\n \n   Agents"
  },
  "showTicketMetrics": {
    "comment": "Show Ticket Metrics",
    "doc": "Show Ticket Metrics\n  Returns a specific metric, or the metrics of a specific ticket.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "listTickets": {
    "comment": "List Tickets",
    "doc": "List Tickets"
  },
  "createTicket": {
    "comment": "Create Ticket",
    "doc": "Create Ticket"
  },
  "showTicket": {
    "comment": "Show Ticket",
    "doc": "Show Ticket\n  Returns a number of ticket properties though not the ticket comments. To get the comments, use [List Comments](/api-reference/ticketing/tickets/ticket_comments/#list-comments)\n \n  #### Allowed For\n   Agents"
  },
  "updateTicket": {
    "comment": "Update Ticket",
    "doc": "Update Ticket"
  },
  "deleteTicket": {
    "comment": "Delete Ticket",
    "doc": "Delete Ticket\n  #### Allowed For\n \n   Admins\n   Agents with permission to delete tickets\n \n  Agent delete permissions are set in Support. See\n  [Deleting tickets](https://support.zendesk.com/hc/en-us/articles/203690936)\n  in the Support Help Center.\n \n  #### Ticket deletion rate limit\n \n  You can delete 400 tickets every 1 minute using this endpoint.\n  The rate limiting mechanism behaves as described in\n  [Rate limits](/api-reference/introduction/rate-limits/) in the API introduction.\n  Zendesk recommends that you obey the Retry-After header values.\n  To delete many tickets, you may use [Bulk Delete Tickets](/api-reference/ticketing/tickets/tickets/#bulk-delete-tickets)."
  },
  "listAuditsForTicket": {
    "comment": "List Audits for a Ticket",
    "doc": "List Audits for a Ticket\n  Lists the audits for a specified ticket.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  Note: Audits for [Archived Tickets](https://support.zendesk.com/hc/en-us/articles/4408887617050) do not support pagination for this endpoint.\n \n  #### Allowed for\n \n   Agents"
  },
  "showTicketAudit": {
    "comment": "Show Audit",
    "doc": "Show Audit\n  #### Allowed for\n \n   Agents"
  },
  "makeTicketCommentPrivateFromAudits": {
    "comment": "Change a Comment From Public To Private",
    "doc": "Change a Comment From Public To Private\n  #### Allowed for\n \n   Agents"
  },
  "countAuditsForTicket": {
    "comment": "Count Audits for a Ticket",
    "doc": "Count Audits for a Ticket\n  Returns an approximate count of audits for a specified ticket. If the count exceeds 100,000, the count will return a cached result.  This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed for\n \n   Agents"
  },
  "listTicketCollaborators": {
    "comment": "List Collaborators for a Ticket",
    "doc": "List Collaborators for a Ticket\n  #### Allowed For\n \n   Agents"
  },
  "listTicketComments": {
    "comment": "List Comments",
    "doc": "List Comments\n  Returns the comments added to the ticket.\n \n  Each comment may include a `content_url` for an attachment or a `recording_url` for a voice comment that points to a file that may be hosted externally. For security reasons, take care not to inadvertently send Zendesk authentication credentials to third parties when attempting to access these files. See [Working with url properties](/documentation/ticketing/managing-tickets/working-with-url-properties).\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Sorting\n \n  By default, comments are sorted by creation date in ascending order.\n \n  When using cursor pagination, use the following parameter to change the sort order:\n \n  | Name   | Type   | Required | Comments\n  | ------ | ------ | -------- | --------\n  | `sort` | string | no       | Possible values are \"created_at\" (ascending order) or \"-created_at\" (descending order)\n \n  When using offset pagination, use the following parameters to change the sort order:\n \n  | Name         | Type   | Required | Comments\n  | ------------ | ------ | -------- | --------\n  | `sort_order` | string | no       | One of `asc`, `desc`. Defaults to `asc`\n \n  #### Allowed For\n \n   Agents"
  },
  "redactCommentAttachment": {
    "comment": "Redact Comment Attachment",
    "doc": "Redact Comment Attachment\n  Redaction allows you to permanently remove attachments from an existing comment on a ticket. Once removed from a comment, the attachment is replaced with an empty \"redacted.txt\" file.\n \n  The redaction is permanent. It is not possible to undo redaction or see what was removed. Once a ticket is closed, redacting its attachments is no longer possible.\n \n  Also, if you want to redact an inline attachment, you can use the `include_inline_images` parameter in the [List Comments](/api-reference/ticketing/tickets/ticket_comments/#list-comments) operation to obtain the inline attachment ID, and use it in the request URL.\n \n  #### Allowed For\n \n   Admins\n   Agents when [deleting tickets is enabled for agents on professional accounts](https://support.zendesk.com/hc/en-us/articles/360002128107)\n   Agents assigned to a custom role with permissions to redact ticket content (Enterprise only)"
  },
  "makeTicketCommentPrivate": {
    "comment": "Make Comment Private",
    "doc": "Make Comment Private\n  #### Allowed For\n \n   Agents"
  },
  "redactStringInComment": {
    "comment": "Redact String in Comment",
    "doc": "Redact String in Comment\n  Permanently removes words or strings from a ticket comment. Specify the string to redact in an object with a `text` property. Example: `'{\"text\": \"987-65-4320\"}'`. The characters of the word or string are replaced by the ▇ symbol.\n \n  If the comment was made by email, the endpoint also attempts to redact the string from the original email retained by Zendesk for audit purposes.\n \n  Note: If you use the rich text editor, support for redacting formatted text (bold, italics, hyperlinks) is limited.\n \n  Redaction is permanent. You can't undo the redaction or see what was removed. Once a ticket is closed, you can no longer redact strings from its comments.\n \n  To use this endpoint, the \"Agents can delete tickets\" option must be enabled in the Zendesk Support admin interface at Admin > Settings > Agents.\n \n  #### Allowed For\n \n   Agents"
  },
  "countTicketComments": {
    "comment": "Count Ticket Comments",
    "doc": "Count Ticket Comments\n  Returns an approximate count of the comments added to the ticket. If the count exceeds 100,000, the count will return a cached result.  This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Agents"
  },
  "listTicketEmailCcs": {
    "comment": "List Email CCs for a Ticket",
    "doc": "List Email CCs for a Ticket\n  Returns any users cc'd on the ticket.\n \n  #### Availability\n \n  The [CCs and Followers](https://support.zendesk.com/hc/en-us/articles/203690846) feature must be enabled in Zendesk Support.\n \n  If the feature is not enabled, the default CC functionality is used. In that case, use [List Collaborators](/api-reference/ticketing/tickets/tickets/#list-collaborators-for-a-ticket) to list the users cc'ed on the ticket.\n \n  #### Allowed For\n \n   Agents"
  },
  "listTicketFollowers": {
    "comment": "List Followers for a Ticket",
    "doc": "List Followers for a Ticket\n  Returns any users who follow the ticket.\n \n  #### Availability\n \n  The [CCs and Followers](https://support.zendesk.com/hc/en-us/articles/203690846) feature must be enabled in Zendesk Support.\n \n  #### Allowed For\n \n   Agents"
  },
  "listTicketIncidents": {
    "comment": "List Ticket Incidents",
    "doc": "List Ticket Incidents\n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "showTicketAfterChanges": {
    "comment": "Show Ticket After Changes",
    "doc": "Show Ticket After Changes\n  Returns the full ticket object as it would be after applying the macro to the ticket.\n  It doesn't actually change the ticket.\n \n  To get only the ticket fields that would be changed by the macro,\n  see [Show Changes to Ticket](#show-changes-to-ticket).\n \n  #### Allowed For\n \n   Agents"
  },
  "markTicketAsSpamAndSuspendRequester": {
    "comment": "Mark Ticket as Spam and Suspend Requester",
    "doc": "Mark Ticket as Spam and Suspend Requester\n  #### Allowed For\n \n   Agents"
  },
  "mergeTicketsIntoTargetTicket": {
    "comment": "Merge Tickets into Target Ticket",
    "doc": "Merge Tickets into Target Ticket\n  Merges one or more tickets into the ticket with the specified id.\n \n  See [Merging tickets](https://support.zendesk.com/hc/en-us/articles/203690916)\n  in the Support Help Center for ticket merging rules.\n \n  Any attachment to the source ticket is copied to the target ticket.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Agents\n \n  Agents in the Enterprise account must have merge permissions.\n  See [Creating custom roles and assigning agents (Enterprise)](https://support.zendesk.com/hc/en-us/articles/203662026)\n  in the Support Help Center.\n \n  #### Available parameters\n \n  The request takes a data object with the following properties:\n \n  | Name                     | Type    | Required | Comments                                                |\n  | ------------------------ | ------- | -------- | ------------------------------------------------------- |\n  | ids                      | array   | yes      | Ids of tickets to merge into the target ticket          |\n  | target_comment           | string  | no       | Private comment to add to the target ticket. This comment is optional but strongly recommended |\n  | source_comment           | string  | no       | Private comment to add to the source ticket. This comment is optional but strongly recommended |\n  | target_comment_is_public | boolean | no       | Whether comments in the target ticket are public or private   |\n  | source_comment_is_public | boolean | no       | Whether comments in the source tickets are public or private |\n \n  `target_comment` and `source_comment` can be used to provide a reason for the merge for recordkeeping purposes. If the source ticket has attachments, they are included in `target_comment`.\n \n  Comments are private and can't be modified in the following cases:\n \n   Any of the sources or target tickets are private\n   Any of the sources or target tickets were created through X (formerly Twitter), Facebook or the Channel framework\n \n  In any other case, comments default to private but can be modified with the comment privacy parameters."
  },
  "ticketRelatedInformation": {
    "comment": "Ticket Related Information",
    "doc": "Ticket Related Information\n  The request returns a data object with the following properties:\n \n  | Name                | Type    | Comment\n  | ------------------- | ------- | -------\n  | topic_id            | string  | Related topic in the Web portal (deprecated feature)\n  | jira_issue_ids      | array   | Array of associated jira issues\n  | followup_source_ids | array   | Sources to follow up\n  | from_archive        | boolean | Is true if the current ticket is archived\n  | incidents           | integer | A count of related incident occurrences\n \n  #### Allowed For\n \n   Agents"
  },
  "createTicketSatisfactionRating": {
    "comment": "Create a Satisfaction Rating",
    "doc": "Create a Satisfaction Rating\n  Creates a CSAT rating for a solved ticket, or for a ticket that was previously\n  solved and then reopened.\n \n  Only the end user listed as the ticket requester can create a satisfaction rating for the ticket.\n \n  #### Allowed For\n \n   End user who requested the ticket\n \n  The end user must be a verified user."
  },
  "listResourceTags": {
    "comment": "List Resource Tags",
    "doc": "List Resource Tags\n  #### Allowed For\n \n   Agents"
  },
  "setTagsTicket": {
    "comment": "Set Tags",
    "doc": "Set Tags\n  #### Allowed For\n \n   Agents"
  },
  "putTagsTicket": {
    "comment": "Add Tags",
    "doc": "Add Tags\n  You can also add tags to multiple tickets with the [Update Many\n  Tickets](/api-reference/ticketing/tickets/tickets/#update-many-tickets) endpoint.\n \n  #### Safe Update\n \n  If the same ticket is updated by multiple API requests at\n  the same time, some tags could be lost because of ticket\n  update collisions. Include `updated_stamp` and `safe_update`\n  properties in the request body to make a safe update.\n \n  For `updated_stamp`, retrieve and specify the ticket's\n  latest `updated_at` timestamp. The tag update only occurs\n  if the `updated_stamp` timestamp matches the ticket's\n  actual `updated_at` timestamp at the time of the request.\n  If the timestamps don't match (in other words, if the\n  ticket was updated since you retrieved the ticket's\n  last `updated_at` timestamp), the request returns a\n  409 Conflict error.\n \n  #### Example\n \n  ```js\n  {\n  \"tags\": [\"customer\"],\n  \"updated_stamp\":\"2019-09-12T21:45:16Z\",\n  \"safe_update\":\"true\"\n  }\n  ```\n \n  For details, see [Protecting against ticket update collisions](/api-reference/ticketing/tickets/tickets/#protecting-against-ticket-update-collisions).\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteTagsTicket": {
    "comment": "Remove Tags",
    "doc": "Remove Tags\n  You can also delete tags from multiple tickets with the\n  [Update Many Tickets](/api-reference/ticketing/tickets/tickets/#update-many-tickets) endpoint.\n \n  This endpoint supports safe updates. See [Safe Update](/api-reference/ticketing/ticket-management/tags/#safe-update).\n \n  #### Allowed For\n \n   Agents"
  },
  "countTickets": {
    "comment": "Count Tickets",
    "doc": "Count Tickets\n  Returns an approximate count of tickets in the account. If the count exceeds 100,000, it is updated every 24 hours.\n \n  `ccd` lists tickets that the specified user is cc'd on.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Agents"
  },
  "ticketsCreateMany": {
    "comment": "Create Many Tickets",
    "doc": "Create Many Tickets\n  Accepts an array of up to 100 ticket objects. Note: Every ticket created with this endpoint may be affected by your business rules, which can include sending email notifications to your end users. If you are importing historical tickets or creating more than 1000 tickets, consider using the [Ticket Bulk Import](/api-reference/ticketing/tickets/ticket_import/#ticket-bulk-import) endpoint.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n   Agents"
  },
  "bulkDeleteTickets": {
    "comment": "Bulk Delete Tickets",
    "doc": "Bulk Delete Tickets\n  Accepts a comma-separated list of up to 100 ticket ids.\n \n  #### Allowed For\n \n   Admins\n   Agents with permission to delete tickets\n \n  Agent delete permissions are set in Support. See\n  [Deleting tickets](https://support.zendesk.com/hc/en-us/articles/203690936)\n  in the Support Help Center.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information."
  },
  "markManyTicketsAsSpam": {
    "comment": "Bulk Mark Tickets as Spam",
    "doc": "Bulk Mark Tickets as Spam\n  Accepts a comma-separated list of up to 100 ticket ids.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Agents"
  },
  "ticketsShowMany": {
    "comment": "Show Multiple Tickets",
    "doc": "Show Multiple Tickets\n  Accepts a comma-separated list of ticket ids to return.\n \n  This endpoint will return up to 100 tickets records.\n \n  #### Allowed For\n   Agents"
  },
  "ticketsUpdateMany": {
    "comment": "Update Many Tickets",
    "doc": "Update Many Tickets\n  Accepts an array of up to 100 ticket objects, or a comma-separated list of up to 100 ticket ids."
  },
  "listTriggerCategories": {
    "comment": "List Ticket Trigger Categories",
    "doc": "List Ticket Trigger Categories\n  Returns all the ticket trigger categories in the account.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "createTriggerCategory": {
    "comment": "Create Ticket Trigger Category",
    "doc": "Create Ticket Trigger Category\n  Creates a ticket trigger category."
  },
  "showTriggerCategoryById": {
    "comment": "Show Ticket Trigger Category",
    "doc": "Show Ticket Trigger Category\n  Returns the ticket trigger category with the specified ID."
  },
  "updateTriggerCategory": {
    "comment": "Update Ticket Trigger Category",
    "doc": "Update Ticket Trigger Category\n  Updates the ticket trigger category with the specified ID."
  },
  "deleteTriggerCategory": {
    "comment": "Delete Ticket Trigger Category",
    "doc": "Delete Ticket Trigger Category\n  Deletes the ticket trigger category with the specified ID."
  },
  "batchOperateTriggerCategories": {
    "comment": "Create Batch Job for Ticket Trigger Categories",
    "doc": "Create Batch Job for Ticket Trigger Categories\n  Creates a job that performs a batch operation for the given ticket trigger categories."
  },
  "listTriggers": {
    "comment": "List Ticket Triggers",
    "doc": "List Ticket Triggers\n  Lists all ticket triggers for the current account.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported. The usage sideloads are only supported on the Support Professional or Suite Growth plan or above.\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each trigger, if present\n  | permissions      | The permissions for each trigger\n  | usage_1h         | The number of times each trigger has been used in the past hour\n  | usage_24h        | The number of times each trigger has been used in the past day\n  | usage_7d         | The number of times each trigger has been used in the past week\n  | usage_30d        | The number of times each trigger has been used in the past thirty days"
  },
  "createTrigger": {
    "comment": "Create Trigger",
    "doc": "Create Trigger\n  #### Allowed For\n \n   Agents"
  },
  "getTrigger": {
    "comment": "Show Ticket Trigger",
    "doc": "Show Ticket Trigger\n  #### Allowed For\n \n   Agents\n \n  The Via Type value is a number instead of a text string. See [Via types reference](/documentation/ticketing/reference-guides/via-types/) for the keys."
  },
  "updateTrigger": {
    "comment": "Update Ticket Trigger",
    "doc": "Update Ticket Trigger\n  #### Allowed For\n \n   Agents\n \n  #### Note\n \n  Updating a condition or action updates both the conditions and actions arrays,\n  clearing all existing values of both arrays. Include all your conditions\n  and actions when updating any condition or action."
  },
  "deleteTrigger": {
    "comment": "Delete Ticket Trigger",
    "doc": "Delete Ticket Trigger\n  #### Allowed For\n \n   Agents"
  },
  "listTriggerRevisions": {
    "comment": "List Ticket Trigger Revisions",
    "doc": "List Ticket Trigger Revisions\n  List the revisions associated with a ticket trigger. Ticket trigger revision history is only available on Enterprise plans.\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name  | Will sideload\n  | ----- | -------------\n  | users | The user that authored each revision\n \n  #### Pagination\n \n  This endpoint uses cursor-based pagination. The records are ordered in\n  descending order by the `created_at` timestamp, then by `id` on duplicate\n  `created_at` values.\n \n  The `cursor` parameter is a non-human-readable argument you can use to move\n  forward or backward in time.\n \n  Each JSON response will contain the following attributes to help you get\n  more results:\n \n  - `after_url` requests more recent results\n  - `before_url` requests older results\n  - `after_cursor` is the cursor to build the request yourself\n  - `before_cursor` is the cursor to build the request yourself\n \n  The properties are null if no more records are available.\n \n  You can request a maximum of 1000 records using the `limit` parameter. If\n  no `limit` parameter is supplied, it will default to 1,000."
  },
  "triggerRevision": {
    "comment": "Show Ticket Trigger Revision",
    "doc": "Show Ticket Trigger Revision\n  Fetches a revision associated with a ticket trigger. Ticket trigger revision history is only available on Enterprise plans.\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name  | Will sideload\n  | ----- | -------------\n  | users | The user that authored each revision"
  },
  "listActiveTriggers": {
    "comment": "List Active Ticket Triggers",
    "doc": "List Active Ticket Triggers\n  Lists all active ticket triggers.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each ticket trigger, if present\n  | permissions      | The permissions for each trigger\n  | usage_1h         | The number of times each ticket trigger has been used in the past hour\n  | usage_24h        | The number of times each ticket trigger has been used in the past day\n  | usage_7d         | The number of times each ticket trigger has been used in the past week\n  | usage_30d        | The number of times each ticket trigger has been used in the past thirty days"
  },
  "listTriggerActionConditionDefinitions": {
    "comment": "List Ticket Trigger Action and Condition Definitions",
    "doc": "List Ticket Trigger Action and Condition Definitions\n  Returns the definitions of the actions a ticket trigger can perform and the\n  definitions of the conditions under which a ticket trigger can execute. The\n  definition of the action includes a title (\"Status\"), a type (\"list\"), and\n  possible values. The definition of the condition includes the same fields\n  as well as the possible operators.\n \n  For a list of supported actions, see the [Actions reference](/documentation/ticketing/reference-guides/actions-reference)\n  For a list of supported conditions, see the [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference)\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteManyTriggers": {
    "comment": "Bulk Delete Ticket Triggers",
    "doc": "Bulk Delete Ticket Triggers\n  Deletes the ticket triggers corresponding to the provided comma-separated list of IDs.\n \n  #### Allowed For\n \n   Agents\n \n  #### Request Parameters\n \n  The DELETE request takes one parameter, an `ids` object that lists the\n  ticket triggers to delete.\n \n  | Name | Description\n  | ---- | -----------\n  | ids  | The IDs of the triggers to delete\n \n  #### Example request\n \n  ```js\n  {\n  \"ids\": \"25,23,27,22\"\n  }\n  ```"
  },
  "reorderTriggers": {
    "comment": "Reorder Ticket Triggers",
    "doc": "Reorder Ticket Triggers\n  Alters the firing order of ticket triggers in the account. See\n  [Reordering and sorting triggers](https://support.zendesk.com/hc/en-us/articles/115015696088)\n  in the Zendesk Help Center. The firing order is set in a `trigger_ids` array in the request body.\n \n  You must include every ticket trigger id in your account to reorder the ticket triggers. If not, the endpoint will return 404 Forbidden.\n \n  Reordering ticket triggers via the API is not permitted if you have more than one ticket trigger category. If there is more than one\n  ticket trigger category, the endpoint will return a `LimitOneCategory` error.\n \n  #### Allowed For\n \n   Agents"
  },
  "searchTriggers": {
    "comment": "Search Ticket Triggers",
    "doc": "Search Ticket Triggers\n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported. For more information, see [Side-loading](/documentation/ticketing/using-the-zendesk-api/side_loading/).\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each ticket trigger, if present\n  | permissions      | The permissions for each ticket trigger\n  | usage_1h         | The number of times each ticket trigger has been used in the past hour\n  | usage_24h        | The number of times each ticket trigger has been used in the past day\n  | usage_7d         | The number of times each ticket trigger has been used in the past week\n  | usage_30d        | The number of times each ticket trigger has been used in the past thirty days\n \n  #### Filter\n \n  Use the `filter` query parameter to filter a ticket trigger search by one or more attributes. For example, the following `filter` argument filters ticket triggers by the `description` attribute:\n \n  ```json\n  {\n  \"json\": {\n  \"description\": \"Close a ticket\"\n  }\n  }\n  ```"
  },
  "updateManyTriggers": {
    "comment": "Update Many Ticket Triggers",
    "doc": "Update Many Ticket Triggers\n  Updates the position or the active status of multiple ticket triggers. Any additional properties are ignored.\n \n  #### Allowed For\n \n   Agents\n \n  #### Request Parameters\n \n  The PUT request expects a `triggers` object that lists the ticket triggers to update.\n \n  Each ticket trigger may have the following properties:\n \n  | Name        | Mandatory | Description\n  | --------    | --------- | -----------\n  | id          | yes       | The ID of the ticket trigger to update\n  | position    | no        | The new position of the ticket trigger\n  | active      | no        | The active status of the ticket trigger (true or false)\n  | category_id | no        | The ID of the new category the ticket trigger is to be moved to\n \n  #### Example Request\n \n  ```js\n  {\n  \"triggers\": [\n  {\"id\": 25, \"position\": 3},\n  {\"id\": 23, \"position\": 5},\n  {\"id\": 27, \"position\": 9},\n  {\"id\": 22, \"position\": 7}\n  ]\n  }\n  ```"
  },
  "uploadFiles": {
    "comment": "Upload Files",
    "doc": "Upload Files\n  Uploads a file that can be attached to a ticket comment. It doesn't attach the file to the comment. For details and examples, see [Attaching ticket comments with the API](/documentation/ticketing/using-the-zendesk-api/adding-ticket-attachments-with-the-api).\n \n  The endpoint has a required `filename` query parameter. The parameter specifies what the file will be named when attached to the ticket comment (to give the agent more context about the file). The parameter does not specify the file on the local system to be uploaded. While the two names can be different, their file extensions must be the same. If they don't match, the agent's browser or file reader could give an error when attempting to open the attachment.\n \n  The `Content-Type` header must contain a recognized MIME type that correctly describes the type of the uploaded file. Failing to send a recognized, correct type may cause undesired behavior. For example, in-browser audio playback may be interrupted by the browser's security mechanisms for MP3s uploaded with an incorrect type.\n \n  Adding multiple files to the same upload is handled by splitting requests and passing the API token received from the first request to each subsequent request. The token is valid for 3 days.\n \n  Note: Even if [private attachments](https://support.zendesk.com/hc/en-us/articles/204265396) are enabled in the Zendesk Support instance, uploaded files are visible to any authenticated user at the `content_URL` specified in the [JSON response](#json-format) until the upload token is consumed. Once a file is associated with a ticket or post, visibility is restricted to users with access to the ticket or post with the attachment.\n \n  #### Allowed For\n \n   End users"
  },
  "deleteUpload": {
    "comment": "Delete Upload",
    "doc": "Delete Upload\n  #### Allowed for\n \n   End Users"
  },
  "listUserFields": {
    "comment": "List User Fields",
    "doc": "List User Fields\n  Returns a list of custom user fields in your account. Fields are returned in the order that you specify in your user fields configuration in Zendesk Support. Clients should cache this resource for the duration of their API usage and map the key for each User Field to the values returned under the `user_fields` attribute on the [User](/api-reference/ticketing/users/users/) resource.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "createUserField": {
    "comment": "Create User Field",
    "doc": "Create User Field\n  Creates any of the following custom field types:\n \n   text (default when no \"type\" is specified)\n   textarea\n   checkbox\n   date\n   integer\n   decimal\n   regexp\n   dropdown\n   lookup\n   multiselect\n \n  See [About custom field types](https://support.zendesk.com/hc/en-us/articles/203661866) in Zendesk help.\n \n  #### Allowed For\n \n   Admins"
  },
  "showUserField": {
    "comment": "Show User Field",
    "doc": "Show User Field\n  #### Allowed for\n \n   Agents"
  },
  "updateUserField": {
    "comment": "Update User Field",
    "doc": "Update User Field\n  #### Updating a Dropdown (Tagger) or Multiselect Field\n \n  Dropdown and multiselect fields return an array of `custom_field_options` which specify the name, value, and order of the list of dropdown or multiselect options.\n  Understand the following behavior when updating a dropdown or multiselect field:\n \n  - All options must be passed on update. Options that are not passed will be removed. As a result, these values will be removed from any organizations.\n  - To create a new option, pass a null `id` along with `name` and `value`.\n  - To update an existing option, pass its `id` along with `name` and `value`.\n  - To re-order an option, reposition it in the `custom_field_options` array relative to the other options.\n  - To remove an option, omit it from the list of options upon update.\n \n  #### Example Request\n \n  ```bash\n  curl https://{subdomain}.zendesk.com/api/v2/user_fields/{user_field_id}.json \\\n  -H \"Content-Type: application/json\" -X PUT \\\n  -d '{\"user_field\": {\"custom_field_options\": [{\"id\": 124, \"name\": \"Option 2\", \"value\": \"option_2\"}, {\"id\": 123, \"name\": \"Option 1\", \"value\": \"option_1\"}, {\"id\": 125, \"name\": \"Option 2\", \"value\": \"option_3\"}]}}' \\\n  -v -u {email_address}/token:{api_token}\n  ```\n  #### Allowed for\n \n   Admins"
  },
  "deleteUserField": {
    "comment": "Delete User Field",
    "doc": "Delete User Field\n  #### Allowed for\n \n   Admins"
  },
  "listUserFieldOptions": {
    "comment": "List User Field Options",
    "doc": "List User Field Options\n  Returns a list of custom user field options for the given dropdown user field.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "createOrUpdateUserFieldOption": {
    "comment": "Create or Update a User Field Option",
    "doc": "Create or Update a User Field Option\n  Creates a new option or updates an existing option for the given drop-down user field.\n \n  To update an option, include the id of the option in the `custom_field_option` object. Example: `{\"custom_field_option\": {\"id\": 10002, \"name\": \"Pineapples\", ... }`. If an option exists for the given ID, the option will be updated. Otherwise, a new option will be created.\n \n  #### Response\n \n  Returns one of the following status codes:\n \n  - 200 with `Location: /api/v2/user_fields/{user_field_id}/options.json` if the user field option already exists in the database\n  - 201 with `Location: /api/v2/user_fields/{user_field_id}/options.json` if the user field option is new\n \n  #### Allowed For\n \n   Admins"
  },
  "showUserFieldOption": {
    "comment": "Show a User Field Option",
    "doc": "Show a User Field Option\n  #### Allowed for\n   Agents"
  },
  "deleteUserFieldOption": {
    "comment": "Delete User Field Option",
    "doc": "Delete User Field Option\n  #### Allowed for\n   Admins"
  },
  "reorderUserField": {
    "comment": "Reorder User Field",
    "doc": "Reorder User Field\n  #### Allowed For\n \n   Admins"
  },
  "listUsers": {
    "comment": "List Users",
    "doc": "List Users\n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Admins, Agents and Light Agents"
  },
  "createUser": {
    "comment": "Create User",
    "doc": "Create User"
  },
  "showUser": {
    "comment": "Show User",
    "doc": "Show User\n  #### Allowed For\n \n   Agents"
  },
  "updateUser": {
    "comment": "Update User",
    "doc": "Update User"
  },
  "deleteUser": {
    "comment": "Delete User",
    "doc": "Delete User\n  Deletes the user and associated records from the account.\n \n  Warning:\n \n   Deleted users are not recoverable.\n   Both agents and administrators can soft delete users in the agent interface in Zendesk Support. Agents with permission can delete end users, while administrators can delete all users except the account owner.\n \n  To comply with GDPR, a further step is needed. See [Permanently Delete User](/api-reference/ticketing/users/users/#permanently-delete-user).\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage end users or team members"
  },
  "showUserComplianceDeletionStatuses": {
    "comment": "Show Compliance Deletion Statuses",
    "doc": "Show Compliance Deletion Statuses\n  Returns the GDPR status for each user per area of compliance. A Zendesk area of compliance is typically a product like \"support/explore\" but can be more fine-grained for areas within the product lines.\n \n  If the user is not in the account, the request returns a 404 status.\n \n  ```http\n  Status: 404\n  {\n  \"error\":\"RecordNotFound\",\n  \"description\":\"Not found\"\n  }\n  ```\n \n  #### Allowed For\n \n   Agents, with restrictions\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "groupMembershipSetDefault": {
    "comment": "Set Membership as Default",
    "doc": "Set Membership as Default\n  #### Allowed For:\n \n   Agents"
  },
  "listUserIdentities": {
    "comment": "List Identities",
    "doc": "List Identities\n  Returns a list of identities for the given user.\n \n  Use the first endpoint if authenticating as an agent. Use the second if authenticating as an end user. End users can only list email and phone number identities.\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents\n   Verified end users"
  },
  "createUserIdentity": {
    "comment": "Create Identity",
    "doc": "Create Identity\n  Adds an identity to a user's profile. An agent can add an identity to any user profile.\n \n  Supported identity types:\n \n  | Type             | Example |\n  | ---------------- | ------- |\n  | email            | `{ \"type\" : \"email\", \"value\" : \"someone@example.com\" }` |\n  | twitter          | `{ \"type\" : \"twitter\", \"value\" : \"screen_name\" }` |\n  | facebook         | `{ \"type\" : \"facebook\", \"value\" : \"855769377321\" }` |\n  | google           | `{ \"type\" : \"google\", \"value\" : \"example@gmail.com\" }` |\n  | agent_forwarding | `{ \"type\" : \"agent_forwarding\", \"value\" : \"+1 555-123-4567\" }` |\n  | phone_number     | `{ \"type\" : \"phone_number\", \"value\" : \"+1 555-123-4567\" }` |\n \n  To create an identity without sending out a verification email, include a `\"skip_verify_email\": true` property.\n \n  #### Allowed For\n \n   Agents"
  },
  "showUserIdentity": {
    "comment": "Show Identity",
    "doc": "Show Identity\n  Shows the identity with the given id for a given user.\n \n  Use the first endpoint if authenticating as an agent. Use the second if authenticating as an end user. End users can only view email or phone number identity.\n \n  #### Allowed For\n \n   Agents\n   Verified end users"
  },
  "updateUserIdentity": {
    "comment": "Update Identity",
    "doc": "Update Identity\n  This endpoint allows you to:\n \n   Set the specified identity as verified (but you cannot unverify a verified identity)\n   Update the `value` property of the specified identity\n \n  You can't change an identity's `primary` attribute with this endpoint. You must use the [Make Identity Primary](#make-identity-primary) endpoint instead.\n \n  #### Allowed For\n \n   Agents"
  },
  "deleteUserIdentity": {
    "comment": "Delete Identity",
    "doc": "Delete Identity\n  Deletes the identity for a given user.\n  In certain cases, a phone number associated with an identity is still visible on the user profile after the identity has been deleted via API. You can remove the phone number from the user profile by updating the `phone` attribute of the user to an empty string. See [Update User via API](/api-reference/ticketing/users/users/#update-user) for details and examples.\n \n  #### Allowed For\n   Agents"
  },
  "makeUserIdentityPrimary": {
    "comment": "Make Identity Primary",
    "doc": "Make Identity Primary\n  Sets the specified identity as primary. To change other attributes, use the [Update  Identity](#update-identity) endpoint. This is a collection-level operation and the correct behavior for an API client is to subsequently reload the entire collection.\n \n  The first endpoint is the preferred option if authenticating as an agent. If authenticating as an end user, you can only use the second endpoint. In addition, an end user can only make an email identity primary if the email is verified.\n \n  #### Allowed For\n \n   Agents\n   Verified end users"
  },
  "requestUserVerfication": {
    "comment": "Request User Verification",
    "doc": "Request User Verification\n  Sends the user a verification email with a link to verify ownership of the email address.\n \n  #### Allowed For\n \n   Agents"
  },
  "verifyUserIdentity": {
    "comment": "Verify Identity",
    "doc": "Verify Identity\n  Sets the specified identity as verified.\n \n  For security reasons, you can't use this endpoint to update the email identity of the account owner. To verify the person's identity, send a verification email. See [Verifying the account owner's email address](https://support.zendesk.com/hc/en-us/articles/4408828975130) in Zendesk help.\n \n  #### Allowed For\n \n   Agents"
  },
  "mergeEndUsers": {
    "comment": "Merge End Users",
    "doc": "Merge End Users\n  Merges the end user specified in the path parameter into the existing end user specified in the request body.\n \n  Any two end users can be merged with the exception of end users created by sharing agreements.\n \n  To be eligible for merging, the user in the path parameter must be a requester on 10,000 or fewer tickets. Otherwise, the merge will be blocked.\n \n  Agents, admins, and users with more than 10,000 requested tickets cannot be merged.\n \n  For more information about how user data is merged, see [Merging a user's duplicate account](https://support.zendesk.com/hc/en-us/articles/4408887695898) in Zendesk help.\n \n  #### Allowed For\n \n   Admins or agents with permission to edit end users"
  },
  "setOrganizationMembershipAsDefault": {
    "comment": "Set Membership as Default",
    "doc": "Set Membership as Default\n  Sets the default organization membership of a given user.\n \n  #### Allowed for\n \n   Admins\n   Agents when setting the default organization membership for an end user"
  },
  "unassignOrganization": {
    "comment": "Unassign Organization",
    "doc": "Unassign Organization\n  Immediately removes a user from an organization and schedules a job to unassign all working tickets currently assigned to the user and organization combination. The `organization_id` of the unassigned tickets is set to null.\n \n  #### Allowed For\n \n   Agents"
  },
  "setOrganizationAsDefault": {
    "comment": "Set Organization as Default",
    "doc": "Set Organization as Default\n  Sets the default organization membership of a given user.\n \n  #### Allowed For\n \n   Agents"
  },
  "setUserPassword": {
    "comment": "Set a User's Password",
    "doc": "Set a User's Password\n  An admin can set a user's password only if the setting is enabled in Zendesk Support under Settings > Security > Global. The setting is off by default. Only the account owner can access and change this setting.\n \n  #### Allowed For\n \n   Admins"
  },
  "changeOwnPassword": {
    "comment": "Change Your Password",
    "doc": "Change Your Password\n  You can only change your own password. Nobody can change the password of another user because it requires knowing the user's existing password. However, an admin can set a new password for another user without knowing the existing password. See [Set a User's Password](#set-a-users-password) above.\n \n  #### Allowed For\n \n   Agents\n   End Users"
  },
  "getUserPasswordRequirements": {
    "comment": "List password requirements",
    "doc": "List password requirements\n  #### Allowed For\n \n   Agents\n   End Users"
  },
  "showUserRelated": {
    "comment": "Show User Related Information",
    "doc": "Show User Related Information"
  },
  "bulkDeleteSessionsByUserId": {
    "comment": "Bulk Delete Sessions",
    "doc": "Bulk Delete Sessions\n  Deletes all the sessions for a user.\n \n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "showSession": {
    "comment": "Show Session",
    "doc": "Show Session\n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "deleteSession": {
    "comment": "Delete Session",
    "doc": "Delete Session\n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "listTicketSkips": {
    "comment": "List Ticket Skips",
    "doc": "List Ticket Skips\n  Archived tickets are not included in the response. See\n  [About archived tickets](https://support.zendesk.com/hc/en-us/articles/203657756) in\n  the Support Help Center.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n   Agents with \"View only\" or higher reports permissions in Support.\n  These permissions are distinct from Explore permissions.\n   Agents retrieving their own skips"
  },
  "autocompleteUsers": {
    "comment": "Autocomplete Users",
    "doc": "Autocomplete Users\n  Returns an array of users whose name starts with the value specified in the `name` parameter.\n  It only returns users with no foreign identities.\n \n  #### Allowed For\n \n   Agents"
  },
  "countUsers": {
    "comment": "Count Users",
    "doc": "Count Users\n  Returns an approximate count of users. If the count exceeds 100,000, it is updated every 24 hours.\n \n  The response includes a `refreshed_at` property in a `count` object that contains a timestamp indicating when the count was last updated.\n \n  Note: When the count exceeds 100,000, the `refreshed_at` property may occasionally be null.\n  This indicates that the count is being updated in the background. The `count` object's `value` property is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n \n   Admins, Agents and Light Agents"
  },
  "createManyUsers": {
    "comment": "Create Many Users",
    "doc": "Create Many Users\n  Accepts an array of up to 100 user objects.\n \n  Note: To protect the data in your Zendesk account, bulk user imports are not enabled by default in Zendesk accounts. The account owner must contact [Zendesk Customer Support](https://support.zendesk.com/hc/en-us/articles/4408843597850) to enable the imports. A 403 Forbidden\n  error is returned if data imports are not enabled.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage end users or team members\n \n  #### Specifying an organization\n \n  You can assign a user to an existing organization by setting an\n  `organization_id` property in the user object.\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information."
  },
  "createOrUpdateUser": {
    "comment": "Create Or Update User",
    "doc": "Create Or Update User\n  Creates a user if the user does not already exist, or updates an existing user\n  identified by e-mail address or external ID.\n \n  If you don't specify a role parameter, the new user is assigned the role of end user.\n \n  If you need to create users without sending out a verification email, include a `\"skip_verify_email\": true` property in the body.\n \n  #### External ID Case Sensitivity\n \n  When providing an external id to identify an existing user to update, the search for the user record is not case sensitive.\n \n  However, if an existing user is found, the system will update the user's external id to match the case of the external id used to find the user.\n \n  #### Response Status Code\n \n  - If the user exists in Zendesk, a successful request returns a 200 status code with \"Location: /api/v2/users/{user_id}.json\".\n  - If the user does not exist in Zendesk, a successful request returns a 201 status code with \"Location: /api/v2/users/{new_user_id}.json\".\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage end users or team members"
  },
  "createOrUpdateManyUsers": {
    "comment": "Create Or Update Many Users",
    "doc": "Create Or Update Many Users\n  Accepts an array of up to 100 user objects. For each user, the user is created if it does not\n  already exist, or the existing user is updated.\n \n  Note: To protect the data in your Zendesk account, bulk user imports are not enabled by default in Zendesk accounts. The account owner must contact [Zendesk Customer Support](https://support.zendesk.com/hc/en-us/articles/4408843597850) to enable the imports. A 403 Forbidden\n  error is returned if data imports are not enabled.\n \n  Each individual user object can identify an existing user by `email` or by `external_id`.\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information.\n \n  #### Allowed For\n \n   Admins and [agents in custom roles with permission](https://support.zendesk.com/hc/en-us/articles/4408882153882#topic_cxn_hig_bd) to manage end users or team members"
  },
  "destroyManyUsers": {
    "comment": "Bulk Delete Users",
    "doc": "Bulk Delete Users\n  Accepts a comma-separated list of up to 100 user ids.\n \n  The request takes an `ids` or an `external_ids` query parameter.\n \n  #### Allowed for\n \n  - Admins\n \n  #### Response\n \n  This endpoint returns a `job_status` [JSON object](/api-reference/ticketing/ticket-management/job_statuses/#json-format) and queues a background job to do the work. Use the [Show Job Status](/api-reference/ticketing/ticket-management/job_statuses/#show-job-status) endpoint to check for the job's completion. Only a certain number of jobs can be queued or running at the same time. See [Job limit](/api-reference/introduction/rate-limits/#job-limit) for more information."
  },
  "logoutManyUsers": {
    "comment": "Logout many users",
    "doc": "Logout many users\n  Accepts a comma-separated list of up to 100 user ids.\n \n  #### Allowed For:\n \n   Admins"
  },
  "showCurrentUser": {
    "comment": "Show Self",
    "doc": "Show Self\n  The endpoint returns [user information](/api-reference/ticketing/users/users/) and an `authenticity_token`.\n \n  #### Allowed For\n \n   Anonymous users\n \n  #### Authenticity Token\n \n  Zendesk API calls made by end users from a Zendesk help center must include `authenticity_token` in the `X-CSRF-Token` HTTP header. This helps prevent [cross-site request forgery (CSRF)](https://en.wikipedia.org/wiki/Cross-site_request_forgery) attacks.\n \n  For an example using an authenticity token, see the AJAX request in the [Upgrading from Templating API v1](https://developer.zendesk.com/documentation/help_center/help-center-templates/v1#jquery) documentation."
  },
  "deleteAuthenticatedSession": {
    "comment": "Delete the Authenticated Session",
    "doc": "Delete the Authenticated Session\n  Deletes the current session. In practice, this only works when using session auth for requests, such as client-side requests\n  made from a Zendesk app. When using OAuth or basic authentication, you don't have a current session so this endpoint has no effect.\n \n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "showCurrentlyAuthenticatedSession": {
    "comment": "Show the Currently Authenticated Session",
    "doc": "Show the Currently Authenticated Session\n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "renewCurrentSession": {
    "comment": "Renew the current session",
    "doc": "Renew the current session\n  #### Allowed For\n \n   Admins, Agents, End users"
  },
  "requestUserCreate": {
    "comment": "Request User Create",
    "doc": "Request User Create\n  Sends the owner a reminder email to update their subscription so more agents can be created.\n \n  #### Allowed For\n \n   Agents"
  },
  "searchUsers": {
    "comment": "Search Users",
    "doc": "Search Users\n  Returns an array of users who meet the search criteria.\n \n  Returns up to 100 records per page to a maximum of 10,000 records per query. See [Using offset pagination](/api-reference/introduction/pagination/#using-offset-pagination).\n \n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents"
  },
  "showManyUsers": {
    "comment": "Show Many Users",
    "doc": "Show Many Users\n  Accepts a comma-separated list of up to 100 user ids or external ids.\n \n  #### Allowed For:\n \n   Agents"
  },
  "updateManyUsers": {
    "comment": "Update Many Users",
    "doc": "Update Many Users"
  },
  "listViewCategories": {
    "comment": "List View Categories",
    "doc": "List View Categories\n  Returns all the view categories in the account."
  },
  "createViewCategory": {
    "comment": "Create View Category",
    "doc": "Create View Category\n  Creates a view category."
  },
  "updateViewCategory": {
    "comment": "Update View Category",
    "doc": "Update View Category\n  Updates the view category with the specified ID."
  },
  "deleteViewCategory": {
    "comment": "Delete View Category",
    "doc": "Delete View Category\n  Deletes the view category with the specified ID."
  },
  "listViews": {
    "comment": "List Views",
    "doc": "List Views\n  Lists shared and personal views available to the current user.\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each view, if present\n  | permissions      | The permissions for each view\n \n  #### Pagination\n \n  - Cursor pagination (recommended, but only sorts by `created_at`)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "createView": {
    "comment": "Create View",
    "doc": "Create View\n  #### Allowed For\n \n   Agents\n \n  #### JSON Format\n \n  The JSON format consists of one property, a `view` object that lists the values to set when the view is created.\n \n  Note: The request must include at least one condition in the `all` array that checks one of the following fields: `status`, `type`, `group_id`, `assignee_id`, or `requester_id`.\n \n  | Name        | Description\n  | ----------- | -----------\n  | title       | Required. The title of the view\n  | all         | Required. An array of one or more conditions. A ticket must meet all of them to be included in the view. See [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference)\n  | any         | An array of one or more conditions. A ticket must meet any of them to be included in the view. See [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference)\n  | description | The description of the view\n  | active      | Allowed values are true or false. Determines if the view is displayed or not\n  | output      | An object that specifies the columns to display. Example: `\"output\": {\"columns\": [\"status\", \"description\", \"priority\"]}`. See [View columns](#view-columns)\n  | restriction | An object that describes who can access the view. To give all agents access to the view, omit this property\n \n  The `restriction` object has the following properties.\n \n  | Name | Comment\n  | ---- | -------\n  | type | Allowed values are \"Group\" or \"User\"\n  | id   | The numeric ID of a single group or user\n  | ids  | The numeric IDs of a single or more groups. Recommended for \"Group\" `type`\n \n  If `type` is \"Group\", the `ids` property is the preferred method of specifying the group id or ids.\n \n  #### Example Request Body\n \n  ```js\n  {\n  \"view\": {\n  \"title\": \"Kelly's tickets\",\n  \"raw_title\": \"{{dc.tickets_assigned_to_kelly}}\",\n  \"description\": \"Tickets that are assigned to Kelly\",\n  \"active\": true,\n  \"position\": 3,\n  \"restriction\": {\n  \"type\": \"User\",\n  \"id\": \"213977756\"\n  },\n  \"all\": [\n  {\n  \"field\": \"status\",\n  \"operator\": \"less_than\",\n  \"value\": \"solved\"\n  },\n  {\n  \"field\": \"group_id\",\n  \"operator\": \"is\",\n  \"value\": \"24000932\"\n  },\n  {\n  \"field\": \"custom_fields_360011872073\",\n  \"operator\": \"is\",\n  \"value\": \"Canada\"\n  },\n  ...\n  ],\n  \"output\": {\n  \"columns\": [\"status\", \"requester\", \"assignee\"],\n  \"group_by\": \"assignee\",\n  \"group_order\": \"desc\",\n  \"sort_by\": \"status\",\n  \"sort_order\": \"desc\"\n  }\n  }\n  }\n  ```\n \n  #### View columns\n \n  The `output` request parameter lets you specify what columns to include in the view in the agent interface. Example: `\"output\": {\"columns\": [\"status\", \"description\", \"priority\"]}`. The following table lists possible columns for views in the agent UI and the corresponding values in the `columns` array.\n \n  For custom fields, specify the id of the custom field in the `columns` array.\n \n  You can specify a total of 10 columns to a view.\n \n  | View column title in UI     | Value                |\n  |---------------------------- | -------------------- |\n  | Assigned                    | `assigned`           |\n  | Assignee                    | `assignee`           |\n  | Due Date                    | `due_date`           |\n  | Group                       | `group`              |\n  | ID                          | `nice_id`            |\n  | Updated                     | `updated`            |\n  | Assignee updated            | `updated_assignee`   |\n  | Requester updated           | `updated_requester`  |\n  | Updater                     | `updated_by_type`    |\n  | Organization                | `organization`       |\n  | Priority                    | `priority`           |\n  | Requested                   | `created`            |\n  | Requester                   | `requester`          |\n  | Requester language          | `locale_id`          |\n  | Satisfaction                | `satisfaction_score` |\n  | Solved                      | `solved`             |\n  | Status category             | `status`             |\n  | Subject                     | `description`        |\n  | Submitter                   | `submitter`          |\n  | Ticket form                 | `ticket_form`        |\n  | Type                        | `type`               |\n  | Brand                       | `brand`              |\n  | Ticket status               | `custom_status_id`   |\n \n  #### View sorting\n \n  You can group and sort items in the view by adding items to the `output` parameter:\n \n  | Attribute                   | Description\n  |-----------------------------| -----------\n  | `group_by`, `sort_by`       | Sort or group the tickets by a column in the [View columns](#view-columns) table. The `subject` and `submitter` columns are not supported\n  | `group_order`, `sort_order` | Either \"asc\" or \"desc\""
  },
  "showView": {
    "comment": "Show View",
    "doc": "Show View\n  #### Allowed For\n \n   Agents"
  },
  "updateView": {
    "comment": "Update View",
    "doc": "Update View\n  #### Allowed For\n \n   Agents\n \n  #### JSON Format\n \n  The PUT request takes one property, a `view` object that lists the values to update. All properties are optional.\n \n  Note: Updating a condition updates the containing array, clearing the other conditions. Include all your conditions when updating any condition.\n \n  | Name        | Description\n  | ----------- | -----------\n  | title       | The title of the view\n  | all         | An array of one or more conditions. A ticket must meet all the conditions to be included in the view. The PUT request replaces all existing conditions. See [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference)\n  | any         | An array of one or more conditions. A ticket must meet any of them to be included in the view. At least one `all` condition must be defined with the `any` conditions. The PUT request replaces all existing `any` conditions. See [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference)\n  | active      | Allowed values are true or false. Determines if the view is displayed or not\n  | output      | An object that specifies the columns to display. Example: `\"output\": {\"columns\": [\"status\", \"description,\" \"priority\"]}`. See [View columns](#view-columns)\n  | restriction | An object that describes who can access the view. To give all agents access to the view, omit this property\n \n  The `restriction` object has the following properties.\n \n  | Name | Comment\n  | ---- | -------\n  | type | Allowed values are \"Group\" or \"User\"\n  | id   | The numeric ID of a single group or user\n  | ids  | The numeric IDs of a single or more groups. Recommended for \"Group\" `type`\n \n  If `type` is \"Group\", the `ids` property is the preferred method of specifying the group id or ids.\n \n  You can also update how items are sorted and grouped. See [View sorting](#view-sorting) in Create View.\n \n  #### Example Request Body\n \n  ```js\n  {\n  \"view\": {\n  \"title\": \"Code red tickets\",\n  \"restriction\": {\n  \"type\": \"Group\",\n  \"ids\": [10052, 10057, 10062, 10002]\n  },\n  \"all\": [\n  {\n  \"field\": \"priority\",\n  \"operator\": \"is\",\n  \"value\": \"urgent\"\n  }\n  ],\n  \"output\": {\n  \"columns\": [\"status\", \"requester\", \"assignee\", \"updated\"]\n  }\n  }\n  }\n  ```"
  },
  "deleteView": {
    "comment": "Delete View",
    "doc": "Delete View\n  #### Allowed For\n   Agents"
  },
  "getViewCount": {
    "comment": "Count Tickets in View",
    "doc": "Count Tickets in View\n  Returns the ticket count for a single view.\n \n  This endpoint is rate limited to 5 requests per minute, per view, per agent.\n \n  #### View Counts\n \n  The view count endpoints, Count Tickets in View (this endpoint) and [Count Tickets in Views](#count-tickets-in-views), let you estimate how many tickets remain in a view without having to retrieve the entire view. They're designed to help estimate view size. From a business perspective, accuracy becomes less relevant as view size increases.\n \n  To ensure quality of service, these counts are cached more heavily as the number of tickets in a view grows. For a view with thousands of tickets, you can expect the count to be cached for 60-90 minutes. As a result, the count may not reflect the actual number of tickets in your view.\n \n  View counts are represented as JSON objects with the following attributes:\n \n  | Name            | Type        | Comment\n  | --------------- | ------------| -------\n  | view_id         | integer     | The id of the view\n  | url             | string      | The API url of the count\n  | value           | integer     | The cached number of tickets in the view. Can also be null if the system is loading and caching new data. Not to be confused with 0 tickets\n  | pretty          | string      | A pretty-printed text approximation of the view count\n  | fresh           | boolean     | false if the cached data is stale and the system is still loading and caching new data\n  | active          | boolean     | Only active views if true, inactive views if false, all views if null.\n \n  #### Example\n  ```js\n  {\n  \"view_count\": {\n  \"view_id\": 25,\n  \"url\":     \"https://company.zendesk.com/api/v2/views/25/count.json\",\n  \"value\":   719,\n  \"pretty\":  \"~700\",\n  \"fresh\":   true\n  }\n  }\n  ```"
  },
  "executeView": {
    "comment": "Execute View",
    "doc": "Execute View\n  Returns the column titles and the rows of the specified view.\n \n  The `columns` array lists the view's column titles and includes only views parameters.\n \n  The `rows` array lists the values of each column for each ticket and includes parameters from both views and tickets. Though not displayed in the view, a partial ticket object is included with each row object.\n \n  Note: To get the full ticket objects for a specified view, use [List Tickets from a View](#list-tickets-from-a-view).\n \n  This endpoint is rate limited to 5 requests per minute, per view, per agent. This rate limit includes activity in Zendesk Support. An API script is more likely to encounter rate limit errors if the authenticating agent or admin is concurrently active in Zendesk Support.\n \n  The view execution system is designed for periodic rather than high-frequency API usage. In particular, views called very frequently may be cached by Zendesk. This means that the API client will still receive a result, but that result may have been computed at any time within the last 10 minutes.\n \n  Zendesk recommends using the Incremental Ticket Export endpoint to get the latest changes. You can call it more often, and it returns all the tickets that changed since the last poll. For details and rate limits, see [Incremental Exports](/api-reference/ticketing/ticket-management/incremental_exports/).\n \n  View output sorting can be controlled by passing the `sort_by` and `sort_order` parameters in the format described in the table in [Preview Views](#preview-views).\n \n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n \n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "exportView": {
    "comment": "Export View",
    "doc": "Export View\n  Returns the csv attachment of the specified view if possible. Enqueues a job to produce the csv if necessary.\n \n  #### Allowed For\n \n   Agents"
  },
  "listTicketsFromView": {
    "comment": "List Tickets From a View",
    "doc": "List Tickets From a View\n  #### Allowed For\n \n   Agents\n \n  #### Pagination\n   Cursor pagination (recommended)\n   Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/)."
  },
  "listActiveViews": {
    "comment": "List Active Views",
    "doc": "List Active Views\n  Lists active shared and personal views available to the current user.\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each view, if present\n  | permissions      | The permissions for each view\n \n  #### Pagination\n \n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  Returns a maximum of 100 records per page.\n \n  #### Allowed For\n \n   Agents"
  },
  "listCompactViews": {
    "comment": "List Views - Compact",
    "doc": "List Views - Compact\n  A compacted list of shared and personal views available to the current user. This endpoint never returns more than 32 records and does not respect the \"per_page\" option.\n \n  #### Allowed For\n \n   Agents"
  },
  "countViews": {
    "comment": "Count Views",
    "doc": "Count Views\n  Returns an approximate count of shared and personal views available to the current user. If the count exceeds 100,000, the count will return a cached result.  This cached result will update every 24 hours.\n \n  The `count[refreshed_at]` property is a timestamp that indicates when the count was last updated.\n \n  Note: When the count exceeds 100,000, `count[refreshed_at]` may occasionally be null.\n  This indicates that the count is being updated in the background, and `count[value]` is limited to 100,000 until the update is complete.\n \n  #### Allowed For\n   Agents"
  },
  "getViewCounts": {
    "comment": "Count Tickets in Views",
    "doc": "Count Tickets in Views\n  Returns the ticket count of each view in a list of views. Accepts up to 20 view ids per request. For the ticket count of a single view, see [Count Tickets in View](#count-tickets-in-view).\n \n  Only returns values for personal and shared views accessible to the user performing the request.\n \n  This endpoint is rate limited to 6 requests every 5 minutes.\n \n  #### Allowed For\n \n   Agents"
  },
  "bulkDeleteViews": {
    "comment": "Bulk Delete Views",
    "doc": "Bulk Delete Views\n  Deletes the views corresponding to the provided list of IDs.\n \n  #### Allowed For\n   Agents"
  },
  "previewViews": {
    "comment": "Preview Views",
    "doc": "Preview Views\n  You can preview views by constructing the conditions in the proper format and nesting them under the `view` property. See [Conditions reference](/documentation/ticketing/reference-guides/conditions-reference/). The output can also be controlled by passing in any of the following parameters and nesting them under the `output` property.\n \n  | Name            | Type    | Comment\n  | --------------- | ------- | -------\n  | columns         | Array   | The ticket fields to display. System fields are looked up by name, custom fields by title or id. See the [View columns](#view-columns) table\n  | group_by        | String  | When present, the field by which the tickets are grouped\n  | group_order     | String  | The direction the tickets are grouped. May be one of \"asc\" or \"desc\"\n  | sort_order      | String  | The direction the tickets are sorted. May be one of \"asc\" or \"desc\"\n  | sort_by         | String  | The ticket field used for sorting. This will either be a title or a custom field id.\n \n  This endpoint is rate limited to 5 requests per minute, per view, per agent.\n \n  #### Pagination\n \n  - Cursor pagination (recommended)\n  - Offset pagination\n \n  See [Pagination](/api-reference/introduction/pagination/).\n \n  #### Allowed For\n \n   Agents"
  },
  "previewCount": {
    "comment": "Preview Ticket Count",
    "doc": "Preview Ticket Count\n  Returns the ticket count for a single preview.\n \n  #### Allowed For\n \n   Agents"
  },
  "searchViews": {
    "comment": "Search Views",
    "doc": "Search Views\n  #### Pagination\n \n   Offset pagination only\n \n  See [Using Offset Pagination](/api-reference/ticketing/introduction/#using-offset-pagination).\n \n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported. For more information, see [Side-loading](/documentation/ticketing/using-the-zendesk-api/side_loading/).\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each view, if present\n  | permissions      | The permissions for each view"
  },
  "listViewsById": {
    "comment": "List Views By ID",
    "doc": "List Views By ID\n  #### Allowed For\n \n   Agents\n \n  #### Sideloads\n \n  The following sideloads are supported:\n \n  | Name             | Will sideload\n  | ---------------- | -------------\n  | app_installation | The app installation that requires each view, if present\n  | permissions      | The permissions for each view"
  },
  "updateManyViews": {
    "comment": "Update Many Views",
    "doc": "Update Many Views\n  #### Allowed For\n \n   Agents\n \n  #### Request Parameters\n \n  The PUT request expects a `views` object that lists the views to update.\n \n  Each view may have the following properties:\n \n  | Name     | Mandatory | Description\n  | -------- | --------- | -----------\n  | id       | yes       | The ID of the view to update\n  | position | no        | The new position of the view\n  | active   | no        | The active status of the view (true or false)\n \n  #### Example Request Body\n \n  ```js\n  {\n  \"views\": [\n  {\"id\": 25, \"position\": 3},\n  {\"id\": 23, \"position\": 5},\n  {\"id\": 27, \"position\": 9},\n  {\"id\": 22, \"position\": 7}\n  ]\n  }\n  ```"
  },
  "listWorkspaces": {
    "comment": "List Workspaces",
    "doc": "List Workspaces\n  #### Allowed For\n \n   Admins, Agents"
  },
  "createWorkspace": {
    "comment": "Create Workspace",
    "doc": "Create Workspace\n  #### Allowed For\n \n   Admins"
  },
  "showWorkspace": {
    "comment": "Show Workspace",
    "doc": "Show Workspace\n  #### Allowed For\n   Admins"
  },
  "updateWorkspace": {
    "comment": "Update Workspace",
    "doc": "Update Workspace\n  #### Allowed For\n   Admins"
  },
  "deleteWorkspace": {
    "comment": "Delete Workspace",
    "doc": "Delete Workspace\n  #### Allowed For\n   Admins"
  },
  "destroyManyWorkspaces": {
    "comment": "Bulk Delete Workspaces",
    "doc": "Bulk Delete Workspaces\n  #### Allowed For\n   Admins"
  },
  "reorderWorkspaces": {
    "comment": "Reorder Workspaces",
    "doc": "Reorder Workspaces\n  #### Allowed For\n   Admins"
  }
}