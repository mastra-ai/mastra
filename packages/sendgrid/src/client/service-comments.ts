export const comments = {
  "getAccessSettingsActivity": {
    "comment": "Retrieve all recent access attempts",
    "doc": "Retrieve all recent access attempts\n  This endpoint allows you to retrieve a list of all of the IP addresses that recently attempted to access your account either through the User Interface or the API."
  },
  "deleteAccessSettingsWhitelist": {
    "comment": "Remove one or more IPs from the allow list",
    "doc": "Remove one or more IPs from the allow list\n  This endpoint allows you to remove one or more IP addresses from your list of allowed addresses.\n \n  To remove one or more IP addresses, pass this endpoint an array containing the ID(s) associated with the IP(s) you intend to remove. You can retrieve the IDs associated with your allowed IP addresses using the \"Retrieve a list of currently allowed IPs\" endpoint.\n \n  It is possible to remove your own IP address, which will block access to your account. You will need to submit a [support ticket](https://sendgrid.com/docs/ui/account-and-settings/support/) if this happens. For this reason, it is important to double check that you are removing only the IPs you intend to remove when using this endpoint."
  },
  "getAccessSettingsWhitelist": {
    "comment": "Retrieve a list of currently allowed IPs",
    "doc": "Retrieve a list of currently allowed IPs\n  This endpoint allows you to retrieve a list of IP addresses that are currently allowed to access your account.\n \n  Each IP address returned to you will have `created_at` and `updated_at` dates. Each IP will also be associated with an `id` that can be used to remove the address from your allow list."
  },
  "postAccessSettingsWhitelist": {
    "comment": "Add one or more IPs to the allow list",
    "doc": "Add one or more IPs to the allow list\n  This endpoint allows you to add one or more allowed IP addresses.\n \n  To allow one or more IP addresses, pass them to this endpoint in an array. Once an IP address is added to your allow list, it will be assigned an `id` that can be used to remove the address. You can retrieve the ID associated with an IP using the \"Retrieve a list of currently allowed IPs\" endpoint."
  },
  "deleteAccessSettingsWhitelistRuleId": {
    "comment": "Remove a specific IP from the allowed list",
    "doc": "Remove a specific IP from the allowed list\n  This endpoint allows you to remove a specific IP address from your list of allowed addresses.\n \n  When removing a specific IP address from your list, you must include the ID in your call.  You can retrieve the IDs associated with your allowed IP addresses using the \"Retrieve a list of currently allowed IPs\" endpoint."
  },
  "getAccessSettingsWhitelistRuleId": {
    "comment": "Retrieve a specific allowed IP",
    "doc": "Retrieve a specific allowed IP\n  This endpoint allows you to retreive a specific IP address that has been allowed to access your account.\n \n  You must include the ID for the specific IP address you want to retrieve in your call. You can retrieve the IDs associated with your allowed IP addresses using the \"Retrieve a  list of currently allowed IPs\" endpoint."
  },
  "getAlerts": {
    "comment": "Retrieve all alerts",
    "doc": "Retrieve all alerts\n  This endpoint allows you to retrieve all of your alerts.\n \n  Alerts allow you to specify an email address to receive notifications regarding your email usage or statistics.\n   Usage alerts allow you to set the threshold at which an alert will be sent.\n   Stats notifications allow you to set how frequently you would like to receive email statistics reports. For example, \"daily\", \"weekly\", or \"monthly\".\n \n  For more information about alerts, please see our [Alerts documentation](https://sendgrid.com/docs/ui/account-and-settings/alerts/)."
  },
  "postAlerts": {
    "comment": "Create a new Alert",
    "doc": "Create a new Alert\n  This endpoint allows you to create a new alert.\n \n  Alerts allow you to specify an email address to receive notifications regarding your email usage or statistics. There are two types of alerts that can be created with this endpoint:\n \n   `usage_limit` allows you to set the threshold at which an alert will be sent.\n   `stats_notification` allows you to set how frequently you would like to receive email statistics reports. For example, \"daily\", \"weekly\", or \"monthly\".\n \n  For more information about alerts, please see our [Alerts documentation](https://sendgrid.com/docs/ui/account-and-settings/alerts/)."
  },
  "deleteAlertsAlertId": {
    "comment": "Delete an alert",
    "doc": "Delete an alert\n  This endpoint allows you to delete an alert.\n \n  Alerts allow you to specify an email address to receive notifications regarding your email usage or statistics.\n   Usage alerts allow you to set the threshold at which an alert will be sent.\n   Stats notifications allow you to set how frequently you would like to receive email statistics reports. For example, \"daily\", \"weekly\", or \"monthly\".\n \n  For more information about alerts, please see our [Alerts documentation](https://sendgrid.com/docs/ui/account-and-settings/alerts/)."
  },
  "getAlertsAlertId": {
    "comment": "Retrieve a specific alert",
    "doc": "Retrieve a specific alert\n  This endpoint allows you to retrieve a specific alert.\n \n  Alerts allow you to specify an email address to receive notifications regarding your email usage or statistics.\n   Usage alerts allow you to set the threshold at which an alert will be sent.\n   Stats notifications allow you to set how frequently you would like to receive email statistics reports. For example, \"daily\", \"weekly\", or \"monthly\".\n \n  For more information about alerts, please see our [Alerts documentation](https://sendgrid.com/docs/ui/account-and-settings/alerts/)."
  },
  "patchAlertsAlertId": {
    "comment": "Update an alert",
    "doc": "Update an alert\n  This endpoint allows you to update an alert.\n \n  Alerts allow you to specify an email address to receive notifications regarding your email usage or statistics.\n   Usage alerts allow you to set the threshold at which an alert will be sent.\n   Stats notifications allow you to set how frequently you would like to receive email statistics reports. For example, \"daily\", \"weekly\", or \"monthly\".\n \n  For more information about alerts, please see our [Alerts documentation](https://sendgrid.com/docs/ui/account-and-settings/alerts/)."
  },
  "getApiKeys": {
    "comment": "Retrieve all API Keys belonging to the authenticated user",
    "doc": "Retrieve all API Keys belonging to the authenticated user\n  This endpoint allows you to retrieve all API Keys that belong to the authenticated user.\n \n  A successful response from this API will include all available API keys' names and IDs.\n \n  For security reasons, there is not a way to retrieve the key itself after it's created. If you lose your API key, you must create a new one. Only the \"Create API keys\" endpoint will return a key to you and only at the time of creation.\n \n  An `api_key_id` can be used to update or delete the key, as well as retrieve the key's details, such as its scopes."
  },
  "createApiKeys": {
    "comment": "Create API keys",
    "doc": "Create API keys\n  This endpoint allows you to create a new API Key for the user.\n \n  To create your initial SendGrid API Key, you should [use the SendGrid App](https://app.sendgrid.com/settings/api_keys). Once you have created a first key with scopes to manage additional API keys, you can use this API for all other key management.\n \n  > There is a limit of 100 API Keys on your account.\n \n  A JSON request body containing a `name` property is required when making requests to this endpoint. If the number of maximum keys, 100, is reached, a `403` status will be returned.\n \n  Though the `name` field is required, it does not need to be unique. A unique API key ID will be generated for each key you create and returned in the response body.\n \n  It is not necessary to pass a `scopes` field to the API when creating a key, but you should be aware that omitting the `scopes` field from your request will create a key with \"Full Access\" permissions by default.\n \n  See the [API Key Permissions List](https://sendgrid.api-docs.io/v3.0/how-to-use-the-sendgrid-v3-api/api-authorization) for all available scopes. An API key's scopes can be updated after creation using the \"Update API keys\" endpoint."
  },
  "deleteApiKeysApiKeyId": {
    "comment": "Delete API keys",
    "doc": "Delete API keys\n  This endpoint allows you to revoke an existing API Key using an `api_key_id`\n \n  Authentications using a revoked API Key will fail after after some small propogation delay. If the API Key ID does not exist, a `404` status will be returned."
  },
  "getApiKeysApiKeyId": {
    "comment": "Retrieve an existing API Key",
    "doc": "Retrieve an existing API Key\n  This endpoint allows you to retrieve a single API key using an `api_key_id`.\n \n  The endpoint will return a key's name, ID, and scopes. If the API Key ID does not, exist a `404` status will be returned.\n \n  See the [API Key Permissions List](https://sendgrid.api-docs.io/v3.0/how-to-use-the-sendgrid-v3-api/api-authorization) for all available scopes. An API key's scopes can be updated after creation using the \"Update API keys\" endpoint."
  },
  "patchApiKeysApiKeyId": {
    "comment": "Update API key name",
    "doc": "Update API key name\n  This endpoint allows you to update the name of an existing API Key.\n \n  You must pass this endpoint a JSON request body with a `name` property, which will be used to rename the key associated with the `api_key_id` passed in the URL."
  },
  "putApiKeysApiKeyId": {
    "comment": "Update API key name and scopes",
    "doc": "Update API key name and scopes\n  This endpoint allows you to update the name and scopes of a given API key.\n \n  You must pass this endpoint a JSON request body with a `name` field and a `scopes` array containing at least one scope. The `name` and `scopes` fields will be used to update the key associated with the `api_key_id` in the request URL.\n \n  If you need to update a key's scopes only, pass the `name` field with the key's existing name; the `name` will not be modified. If you need to update a key's name only, use the \"Update API key name\" endpoint.\n \n  See the [API Key Permissions List](https://sendgrid.api-docs.io/v3.0/how-to-use-the-sendgrid-v3-api/api-authorization) for all available scopes."
  },
  "getAsmGroups": {
    "comment": "Retrieve all suppression groups associated with the user.",
    "doc": "Retrieve all suppression groups associated with the user.\n  This endpoint allows you to retrieve a list of all suppression groups created by this user.\n \n  This endpoint can also return information for multiple group IDs that you include in your request. To add a group ID to your request, simply append `?id=123456&id=123456`, with the appropriate group IDs."
  },
  "postAsmGroups": {
    "comment": "Create a new suppression group",
    "doc": "Create a new suppression group\n  This endpoint allows you to create a new suppression group.\n \n  To add an email address to the suppression group, [create a Suppression](https://sendgrid.api-docs.io/v3.0/suppressions-suppressions/add-suppressions-to-a-suppression-group)."
  },
  "deleteAsmGroupsGroupId": {
    "comment": "Delete a Suppression Group",
    "doc": "Delete a Suppression Group\n  This endpoint allows you to delete a suppression group.\n \n  If a recipient uses the \"one-click unsubscribe\" option on an email associated with a deleted group, that recipient will be added to the global suppression list.\n \n  Deleting a suppression group will remove the suppression, meaning email will once again be sent to the previously suppressed addresses. This should be avoided unless a recipient indicates they wish to receive email from you again. You can use our [bypass filters](https://sendgrid.com/docs/ui/sending-email/index-suppressions/#bypass-suppressions) to deliver messages to otherwise suppressed addresses when exceptions are required."
  },
  "getAsmGroupsGroupId": {
    "comment": "Get information on a single suppression group.",
    "doc": "Get information on a single suppression group.\n  This endpoint allows you to retrieve a single suppression group."
  },
  "patchAsmGroupsGroupId": {
    "comment": "Update a suppression group.",
    "doc": "Update a suppression group.\n  This endpoint allows you to update or change a suppression group."
  },
  "getAsmGroupsGroupIdSuppressions": {
    "comment": "Retrieve all suppressions for a suppression group",
    "doc": "Retrieve all suppressions for a suppression group\n  This endpoint allows you to retrieve all suppressed email addresses belonging to the given group."
  },
  "postAsmGroupsGroupIdSuppressions": {
    "comment": "Add suppressions to a suppression group",
    "doc": "Add suppressions to a suppression group\n  This endpoint allows you to add email addresses to an unsubscribe group.\n \n  If you attempt to add suppressions to a group that has been deleted or does not exist, the suppressions will be added to the global suppressions list."
  },
  "postAsmGroupsGroupIdSuppressionsSearch": {
    "comment": "Search for suppressions within a group",
    "doc": "Search for suppressions within a group\n  This endpoint allows you to search a suppression group for multiple suppressions.\n \n  When given a list of email addresses and a group ID, this endpoint will only return the email addresses that have been unsubscribed from the given group."
  },
  "deleteAsmGroupsGroupIdSuppressionsEmail": {
    "comment": "Delete a suppression from a suppression group",
    "doc": "Delete a suppression from a suppression group\n  This endpoint allows you to remove a suppressed email address from the given suppression group.\n \n  Removing an address will remove the suppression, meaning email will once again be sent to the previously suppressed addresses. This should be avoided unless a recipient indicates they wish to receive email from you again. You can use our [bypass filters](https://sendgrid.com/docs/ui/sending-email/index-suppressions/#bypass-suppressions) to deliver messages to otherwise suppressed addresses when exceptions are required."
  },
  "getAsmSuppressions": {
    "comment": "Retrieve all suppressions",
    "doc": "Retrieve all suppressions\n  This endpoint allows you to retrieve a list of all suppressions."
  },
  "postAsmSuppressionsGlobal": {
    "comment": "Add recipient addresses to the global suppression group.",
    "doc": "Add recipient addresses to the global suppression group.\n  This endpoint allows you to add one or more email addresses to the global suppressions group."
  },
  "deleteAsmSuppressionsGlobalEmail": {
    "comment": "Delete a Global Suppression",
    "doc": "Delete a Global Suppression\n  This endpoint allows you to remove an email address from the global suppressions group.\n \n  Deleting a suppression group will remove the suppression, meaning email will once again be sent to the previously suppressed addresses. This should be avoided unless a recipient indicates they wish to receive email from you again. You can use our [bypass filters](https://sendgrid.com/docs/ui/sending-email/index-suppressions/#bypass-suppressions) to deliver messages to otherwise suppressed addresses when exceptions are required."
  },
  "getAsmSuppressionsGlobalEmail": {
    "comment": "Retrieve a Global Suppression",
    "doc": "Retrieve a Global Suppression\n  This endpoint allows you to retrieve a global suppression. You can also use this endpoint to confirm if an email address is already globally suppresed.\n \n  If the email address you include in the URL path parameter `{email}` is already globally suppressed, the response will include that email address. If the address you enter for `{email}` is not globally suppressed, an empty JSON object `{}` will be returned."
  },
  "getAsmSuppressionsEmail": {
    "comment": "Retrieve all suppression groups for an email address",
    "doc": "Retrieve all suppression groups for an email address\n  This endpoint returns a list of all groups from which the given email address has been unsubscribed."
  },
  "getBrowsersStats": {
    "comment": "Retrieve email statistics by browser.",
    "doc": "Retrieve email statistics by browser.\n  This endpoint allows you to retrieve your email statistics segmented by browser type.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [Statistics Overview](https://sendgrid.com/docs/ui/analytics-and-reporting/stats-overview/)."
  },
  "getCampaigns": {
    "comment": "Retrieve all Campaigns",
    "doc": "Retrieve all Campaigns\n  This endpoint allows you to retrieve a list of all of your campaigns.\n \n  Returns campaigns in reverse order they were created (newest first).\n \n  Returns an empty array if no campaigns exist."
  },
  "postCampaigns": {
    "comment": "Create a Campaign",
    "doc": "Create a Campaign\n  This endpoint allows you to create a campaign.\n \n  In order to send or schedule the campaign, you will be required to provide a subject, sender ID, content (we suggest both html and plain text), and at least one list or segment ID. This information is not required when you create a campaign."
  },
  "deleteCampaignsCampaignId": {
    "comment": "Delete a Campaign",
    "doc": "Delete a Campaign\n  This endpoint allows you to delete a specific campaign."
  },
  "getCampaignsCampaignId": {
    "comment": "Retrieve a single campaign",
    "doc": "Retrieve a single campaign\n  This endpoint allows you to retrieve a specific campaign."
  },
  "patchCampaignsCampaignId": {
    "comment": "Update a Campaign",
    "doc": "Update a Campaign\n  This endpoint allows you to update a specific campaign.\n \n  This is especially useful if you only set up the campaign using POST /campaigns, but didn't set many of the parameters."
  },
  "deleteCampaignsCampaignIdSchedules": {
    "comment": "Unschedule a Scheduled Campaign",
    "doc": "Unschedule a Scheduled Campaign\n  This endpoint allows you to unschedule a campaign that has already been scheduled to be sent.\n \n  A successful unschedule will return a 204.\n  If the specified campaign is in the process of being sent, the only option is to cancel (a different method)."
  },
  "getCampaignsCampaignIdSchedules": {
    "comment": "View Scheduled Time of a Campaign",
    "doc": "View Scheduled Time of a Campaign\n  This endpoint allows you to retrieve the date and time that a campaign has been scheduled to be sent."
  },
  "patchCampaignsCampaignIdSchedules": {
    "comment": "Update a Scheduled Campaign",
    "doc": "Update a Scheduled Campaign\n  This endpoint allows to you change the scheduled time and date for a campaign to be sent."
  },
  "postCampaignsCampaignIdSchedules": {
    "comment": "Schedule a Campaign",
    "doc": "Schedule a Campaign\n  This endpoint allows you to schedule a specific date and time for your campaign to be sent.\n \n  If you have the flexibility, it's better to schedule mail for off-peak times. Most emails are scheduled and sent at the top of the hour or half hour. Scheduling email to avoid those times (for example, scheduling at 10:53) can result in lower deferral rates because it won't be going through our servers at the same times as everyone else's mail."
  },
  "postCampaignsCampaignIdSchedulesNow": {
    "comment": "Send a Campaign",
    "doc": "Send a Campaign\n  This endpoint allows you to immediately send an existing campaign.\n \n  Normally a POST request would have a body, but since this endpoint is telling us to send a resource that is already created, a request body is not needed."
  },
  "postCampaignsCampaignIdSchedulesTest": {
    "comment": "Send a Test Campaign",
    "doc": "Send a Test Campaign\n  This endpoint allows you to send a test campaign.\n \n  To send to multiple addresses, use an array for the JSON \"to\" value [\"one@address\",\"two@address\"]"
  },
  "getCategories": {
    "comment": "Retrieve all categories",
    "doc": "Retrieve all categories\n  This endpoint allows you to retrieve a list of all of your categories."
  },
  "getCategoriesStats": {
    "comment": "Retrieve Email Statistics for Categories",
    "doc": "Retrieve Email Statistics for Categories\n  This endpoint allows you to retrieve all of your email statistics for each of your categories.\n \n  If you do not define any query parameters, this endpoint will return a sum for each category in groups of 10."
  },
  "getCategoriesStatsSums": {
    "comment": "Retrieve sums of email stats for each category [Needs: Stats object defined, has category ID?]",
    "doc": "Retrieve sums of email stats for each category [Needs: Stats object defined, has category ID?]\n  This endpoint allows you to retrieve the total sum of each email statistic for every category over the given date range.\n \n  If you do not define any query parameters, this endpoint will return a sum for each category in groups of 10."
  },
  "getClientsStats": {
    "comment": "Retrieve email statistics by client type.",
    "doc": "Retrieve email statistics by client type.\n  This endpoint allows you to retrieve your email statistics segmented by client type.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [Statistics Overview](https://sendgrid.com/docs/ui/analytics-and-reporting/stats-overview/)."
  },
  "getClientsClientTypeStats": {
    "comment": "Retrieve stats by a specific client type.",
    "doc": "Retrieve stats by a specific client type.\n  This endpoint allows you to retrieve your email statistics segmented by a specific client type.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  ## Available Client Types\n  - phone\n  - tablet\n  - webmail\n  - desktop\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [Statistics Overview](https://sendgrid.com/docs/ui/analytics-and-reporting/stats-overview/)."
  },
  "getContactdbCustomFields": {
    "comment": "Retrieve all custom fields",
    "doc": "Retrieve all custom fields\n  This endpoint allows you to retrieve all custom fields."
  },
  "postContactdbCustomFields": {
    "comment": "Create a Custom Field",
    "doc": "Create a Custom Field\n  This endpoint allows you to create a custom field.\n \n  You can create up to 120 custom fields."
  },
  "deleteContactdbCustomFieldsCustomFieldId": {
    "comment": "Delete a Custom Field",
    "doc": "Delete a Custom Field\n  This endpoint allows you to delete a custom field by ID."
  },
  "getContactdbCustomFieldsCustomFieldId": {
    "comment": "Retrieve a Custom Field",
    "doc": "Retrieve a Custom Field\n  This endpoint allows you to retrieve a custom field by ID."
  },
  "deleteContactdbLists": {
    "comment": "Delete Multiple lists",
    "doc": "Delete Multiple lists\n  This endpoint allows you to delete multiple recipient lists."
  },
  "getContactdbLists": {
    "comment": "Retrieve all lists",
    "doc": "Retrieve all lists\n  This endpoint allows you to retrieve all of your recipient lists. If you don't have any lists, an empty array will be returned."
  },
  "postContactdbLists": {
    "comment": "Create a List",
    "doc": "Create a List\n  This endpoint allows you to create a list for your recipients."
  },
  "deleteContactdbListsListId": {
    "comment": "Delete a List",
    "doc": "Delete a List\n  This endpoint allows you to delete a specific recipient list with the given ID."
  },
  "getContactdbListsListId": {
    "comment": "Retrieve a single list",
    "doc": "Retrieve a single list\n  This endpoint allows you to retrieve a single recipient list."
  },
  "patchContactdbListsListId": {
    "comment": "Update a List",
    "doc": "Update a List\n  This endpoint allows you to update the name of one of your recipient lists."
  },
  "getContactdbListsListIdRecipients": {
    "comment": "Retrieve all recipients on a List",
    "doc": "Retrieve all recipients on a List\n  This endpoint allows you to retrieve all recipients on the list with the given ID."
  },
  "postContactdbListsListIdRecipients": {
    "comment": "Add Multiple Recipients to a List",
    "doc": "Add Multiple Recipients to a List\n  This endpoint allows you to add multiple recipients to a list.\n \n  Adds existing recipients to a list, passing in the recipient IDs to add. Recipient IDs should be passed exactly as they are returned from recipient endpoints."
  },
  "deleteContactdbListsListIdRecipientsRecipientId": {
    "comment": "Delete a Single Recipient from a Single List",
    "doc": "Delete a Single Recipient from a Single List\n  This endpoint allows you to delete a single recipient from a list."
  },
  "postContactdbListsListIdRecipientsRecipientId": {
    "comment": "Add a Single Recipient to a List",
    "doc": "Add a Single Recipient to a List\n  This endpoint allows you to add a single recipient to a list."
  },
  "deleteContactdbRecipients": {
    "comment": "Delete Recipients",
    "doc": "Delete Recipients\n  This endpoint allows you to deletes one or more recipients.\n \n  The body of an API call to this endpoint must include an array of recipient IDs of the recipients you want to delete."
  },
  "getContactdbRecipients": {
    "comment": "Retrieve recipients",
    "doc": "Retrieve recipients\n  This endpoint allows you to retrieve all of your Marketing Campaigns recipients.\n \n  Batch deletion of a page makes it possible to receive an empty page of recipients before reaching the end of\n  the list of recipients. To avoid this issue; iterate over pages until a 404 is retrieved."
  },
  "patchContactdbRecipients": {
    "comment": "Update Recipient",
    "doc": "Update Recipient\n  This endpoint allows you to update one or more recipients.\n \n  The body of an API call to this endpoint must include an array of one or more recipient objects.\n \n  It is of note that you can add custom field data as parameters on recipient objects. We have provided an example using some of the default custom fields SendGrid provides."
  },
  "postContactdbRecipients": {
    "comment": "Add recipients",
    "doc": "Add recipients\n  This endpoint allows you to add a Marketing Campaigns recipient.\n \n  You can add custom field data as a parameter on this endpoint. We have provided an example using some of the default custom fields SendGrid provides.\n \n  The rate limit is three requests every 2 seconds. You can upload 1000  contacts per request. So the maximum upload rate is 1500 recipients per second."
  },
  "getContactdbRecipientsBillableCount": {
    "comment": "Retrieve the count of billable recipients",
    "doc": "Retrieve the count of billable recipients\n  This endpoint allows you to retrieve the number of Marketing Campaigns recipients that you will be billed for.\n \n  You are billed for marketing campaigns based on the highest number of recipients you have had in your account at one time. This endpoint will allow you to know the current billable count value."
  },
  "getContactdbRecipientsCount": {
    "comment": "Retrieve a Count of Recipients",
    "doc": "Retrieve a Count of Recipients\n  This endpoint allows you to retrieve the total number of Marketing Campaigns recipients."
  },
  "getContactdbRecipientsSearch": {
    "comment": "Search recipients",
    "doc": "Search recipients\n  This endpoint allows you to perform a search on all of your Marketing Campaigns recipients.\n \n  field_name:\n \n   is a variable that is substituted for your actual custom field name from your recipient.\n   Text fields must be url-encoded. Date fields are searchable only by unix timestamp (e.g. 2/2/2015 becomes 1422835200)\n   If field_name is a 'reserved' date field, such as created_at or updated_at, the system will internally convert\n  your epoch time to a date range encompassing the entire day. For example, an epoch time of 1422835600 converts to\n  Mon, 02 Feb 2015 00:06:40 GMT, but internally the system will search from Mon, 02 Feb 2015 00:00:00 GMT through\n  Mon, 02 Feb 2015 23:59:59 GMT."
  },
  "postContactdbRecipientsSearch": {
    "comment": "Search recipients",
    "doc": "Search recipients\n  <p>\n  Search using segment conditions without actually creating a segment.\n  Body contains a JSON object with <code>conditions</code>, a list of conditions as described below, and an optional <code>list_id</code>, which is a valid list ID for a list to limit the search on.\n  </p>\n \n  <p>\n  Valid operators for create and update depend on the type of the field for which you are searching.\n  </p>\n \n  <ul>\n  <li>Dates:\n  <ul>\n  <li>\"eq\", \"ne\", \"lt\" (before), \"gt\" (after)\n  <ul>\n  <li>You may use MM/DD/YYYY for day granularity or an epoch for second granularity.</li>\n  </ul>\n  </li>\n  <li>\"empty\", \"not_empty\"</li>\n  <li>\"is within\"\n  <ul>\n  <li>You may use an <a href=\"https://en.wikipedia.org/wiki/ISO_8601\">ISO 8601 date format</a> or the # of days.</li>\n  </ul>\n  </li>\n  </ul>\n  </li>\n  <li>Text: \"contains\", \"eq\" (is - matches the full field), \"ne\" (is not - matches any field where the entire field is not the condition value), \"empty\", \"not_empty\"</li>\n  <li>Numbers: \"eq\", \"lt\", \"gt\", \"empty\", \"not_empty\"</li>\n  <li>Email Clicks and Opens: \"eq\" (opened), \"ne\" (not opened)</li>\n  </ul>\n \n  <p>\n  Field values must all be a string.\n  </p>\n \n  <p>\n  Search conditions using \"eq\" or \"ne\" for email clicks and opens should provide a \"field\" of either <code>clicks.campaign_identifier</code> or <code>opens.campaign_identifier</code>.\n  The condition value should be a string containing the id of a completed campaign.\n  </p>\n \n  <p>\n  Search conditions list may contain multiple conditions, joined by an \"and\" or \"or\" in the \"and_or\" field.\n  The first condition in the conditions list must have an empty \"and_or\", and subsequent conditions must all specify an \"and_or\".\n  </p>"
  },
  "deleteContactdbRecipientsRecipientId": {
    "comment": "Delete a Recipient",
    "doc": "Delete a Recipient\n  This endpoint allows you to delete a single recipient with the given ID from your contact database.\n \n  > Use this to permanently delete your recipients from all of your contact lists and all segments if required by applicable law."
  },
  "getContactdbRecipientsRecipientId": {
    "comment": "Retrieve a single recipient",
    "doc": "Retrieve a single recipient\n  This endpoint allows you to retrieve a single recipient by ID from your contact database."
  },
  "getContactdbRecipientsRecipientIdLists": {
    "comment": "Retrieve the lists that a recipient is on",
    "doc": "Retrieve the lists that a recipient is on\n  This endpoint allows you to retrieve the lists that a given recipient belongs to.\n \n  Each recipient can be on many lists. This endpoint gives you all of the lists that any one recipient has been added to."
  },
  "getContactdbReservedFields": {
    "comment": "Retrieve reserved fields",
    "doc": "Retrieve reserved fields\n  This endpoint allows you to list all fields that are reserved and can't be used for custom field names."
  },
  "getContactdbSegments": {
    "comment": "Retrieve all segments",
    "doc": "Retrieve all segments\n  This endpoint allows you to retrieve all of your segments."
  },
  "postContactdbSegments": {
    "comment": "Create a Segment",
    "doc": "Create a Segment\n  This endpoint allows you to create a new segment.\n \n \n  Valid operators for create and update depend on the type of the field for which you are searching.\n \n  Dates\n  - \"eq\", \"ne\", \"lt\" (before), \"gt\" (after)\n  - You may use MM/DD/YYYY for day granularity or an epoch for second granularity.\n  - \"empty\", \"not_empty\"\n  - \"is within\"\n  - You may use an [ISO 8601 date format](https://en.wikipedia.org/wiki/ISO_8601) or the # of days.\n \n  Text\n  - \"contains\"\n  - \"eq\" (is/equals - matches the full field)\n  - \"ne\" (is not/not equals - matches any field where the entire field is not the condition value)\n  - \"empty\"\n  - \"not_empty\"\n \n  Numbers\n  - \"eq\" (is/equals)\n  - \"lt\" (is less than)\n  - \"gt\" (is greater than)\n  - \"empty\"\n  - \"not_empty\"\n \n  Email Clicks and Opens\n  - \"eq\" (opened)\n  - \"ne\" (not opened)\n \n  All field values must be a string.\n \n \n  Conditions using \"eq\" or \"ne\" for email clicks and opens should provide a \"field\" of either `clicks.campaign_identifier` or `opens.campaign_identifier`.\n  The condition value should be a string containing the id of a completed campaign.\n \n \n  The conditions list may contain multiple conditions, joined by an \"and\" or \"or\" in the \"and_or\" field.\n \n  The first condition in the conditions list must have an empty \"and_or\", and subsequent conditions must all specify an \"and_or\"."
  },
  "deleteContactdbSegmentsSegmentId": {
    "comment": "Delete a segment",
    "doc": "Delete a segment\n  This endpoint allows you to delete a segment from your recipients database.\n \n  You also have the option to delete all the contacts from your Marketing Campaigns recipient database who were in this segment."
  },
  "getContactdbSegmentsSegmentId": {
    "comment": "Retrieve a segment",
    "doc": "Retrieve a segment\n  This endpoint allows you to retrieve a single segment with the given ID."
  },
  "patchContactdbSegmentsSegmentId": {
    "comment": "Update a segment",
    "doc": "Update a segment\n  This endpoint allows you to update a segment."
  },
  "getContactdbSegmentsSegmentIdRecipients": {
    "comment": "Retrieve recipients on a segment",
    "doc": "Retrieve recipients on a segment\n  This endpoint allows you to retrieve all of the recipients in a segment with the given ID."
  },
  "getContactdbStatus": {
    "comment": "Get Recipient Upload Status",
    "doc": "Get Recipient Upload Status\n  This endpoint allows you to check the upload status of a Marketing Campaigns recipient."
  },
  "listDesigns": {
    "comment": "List Designs",
    "doc": "List Designs\n  This endpoint allows you to retrieve a list of designs already stored in your Design Library.\n \n  A GET request to `/designs` will return a list of your existing designs. This endpoint will not return the pre-built Twilio SendGrid designs. Pre-built designs can be retrieved using the `/designs/pre-builts` endpoint, which is detailed below.\n \n  By default, you will receive 100 results per request; however, you can modify the number of results returned by passing an integer to the `page_size` query parameter."
  },
  "postDesigns": {
    "comment": "Create Design",
    "doc": "Create Design\n  This endpoint allows you to create a new design.\n \n  You can add a new design by passing data, including a string of HTML email content, to `/designs`. When creating designs from scratch, be aware of the styling constraints inherent to many email clients. For a list of best practices, see our guide to [Cross-Platform Email Design](https://sendgrid.com/docs/ui/sending-email/cross-platform-html-design/).\n \n  The Design Library can also convert your design’s HTML elements into drag and drop modules that are editable in the Designs Library user interface. For more, visit the [Design and Code Editor documentation](https://sendgrid.com/docs/ui/sending-email/editor/#drag--drop-markup).\n \n  Because the `/designs` endpoint makes it easy to add designs, you can create a design with your preferred tooling or migrate designs you already own without relying on the Design Library UI."
  },
  "listSendgridPreBuiltDesigns": {
    "comment": "List SendGrid Pre-built Designs",
    "doc": "List SendGrid Pre-built Designs\n  This endpoint allows you to retrieve a list of pre-built designs provided by Twilio SendGrid.\n \n  Unlike the `/designs` endpoint where your designs are stored, a GET request made to `designs/pre-builts` will retrieve a list of the pre-built Twilio SendGrid designs. This endpoint will not return the designs stored in your Design Library.\n \n  By default, you will receive 100 results per request; however, you can modify the number of results returned by passing an integer to the `page_size` query parameter.\n \n  This endpoint is useful for retrieving the IDs of Twilio SendGrid designs that you want to duplicate and modify."
  },
  "getSendgridPreBuiltDesign": {
    "comment": "Get SendGrid Pre-built Design",
    "doc": "Get SendGrid Pre-built Design\n  This endpoint allows you to retrieve a single pre-built design.\n \n  A GET request to `/designs/pre-builts/{id}` will retrieve details about a specific pre-built design.\n \n  This endpoint is valuable when retrieving details about a pre-built design that you wish to duplicate and modify."
  },
  "postSendgridPreBuiltDesign": {
    "comment": "Duplicate SendGrid Pre-built Design",
    "doc": "Duplicate SendGrid Pre-built Design\n  This endpoint allows you to duplicate one of the pre-built Twilio SendGrid designs.\n \n  Like duplicating one of your existing designs, you are not required to pass any data in the body of a request to this endpoint. If you choose to leave the `name` field blank, your duplicate will be assigned the name of the design it was copied from with the text \"Duplicate: \" prepended to it. This name change is only a convenience, as the duplicate design will be assigned a unique ID that differentiates it from your other designs. You can retrieve the IDs for Twilio SendGrid pre-built designs using the \"List SendGrid Pre-built Designs\" endpoint.\n \n  You can modify your duplicate’s name at the time of creation by passing an updated value to the `name` field when making the initial request.\n  More on retrieving design IDs can be found above."
  },
  "deleteDesign": {
    "comment": "Delete Design",
    "doc": "Delete Design\n  This endpoint allows you to delete a single design.\n \n  Be sure to check the ID of the design you intend to delete before making this request; deleting a design is a permanent action."
  },
  "getDesign": {
    "comment": "Get Design",
    "doc": "Get Design\n  This endpoint allows you to retrieve a single design.\n \n  A GET request to `/designs/{id}` will retrieve details about a specific design in your Design Library.\n \n  This endpoint is valuable when retrieving information stored in a field that you wish to update using a PATCH request."
  },
  "putDesign": {
    "comment": "Update Design",
    "doc": "Update Design\n  This endpoint allows you to edit a design.\n \n  The Design API supports PATCH requests, which allow you to make partial updates to a single design. Passing data to a specific field will update only the data stored in that field; all other fields will be unaltered.\n \n  For example, updating a design's name requires that you make a PATCH request to this endpoint with data specified for the `name` field only.\n \n  ```\n  {\n  \"name\": \"<Updated Name>\"\n  }\n  ```"
  },
  "postDesign": {
    "comment": "Duplicate Design",
    "doc": "Duplicate Design\n  This endpoint allows you to duplicate one of your existing designs.\n \n  Modifying an existing design is often the easiest way to create something new.\n \n  You are not required to pass any data in the body of a request to this endpoint. If you choose to leave the `name` field blank, your duplicate will be assigned the name of the design it was copied from with the text \"Duplicate: \" prepended to it. This name change is only a convenience, as the duplicate will be assigned a unique ID that differentiates it from your other designs.\n \n  You can modify your duplicate’s name at the time of creation by passing an updated value to the `name` field when making the initial request.\n  More on retrieving design IDs can be found below."
  },
  "getDevicesStats": {
    "comment": "Retrieve email statistics by device type.",
    "doc": "Retrieve email statistics by device type.\n  This endpoint allows you to retrieve your email statistics segmented by the device type.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  ## Available Device Types\n  | Device | Description | Example |\n  |---|---|---|\n  | Desktop | Email software on desktop computer. | I.E., Outlook, Sparrow, or Apple Mail. |\n  | Webmail |\tA web-based email client. | I.E., Yahoo, Google, AOL, or Outlook.com. |\n  | Phone | A smart phone. | iPhone, Android, Blackberry, etc.\n  | Tablet | A tablet computer. | iPad, android based tablet, etc. |\n  | Other | An unrecognized device. |\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [Statistics Overview](https://sendgrid.com/docs/ui/analytics-and-reporting/stats-overview/)."
  },
  "getGeoStats": {
    "comment": "Retrieve email statistics by country and state/province.",
    "doc": "Retrieve email statistics by country and state/province.\n  This endpoint allows you to retrieve your email statistics segmented by country and state/province.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [User Guide](https://sendgrid.com/docs/User_Guide/Statistics/index.html)."
  },
  "getIps": {
    "comment": "Retrieve all IP addresses",
    "doc": "Retrieve all IP addresses\n  This endpoint allows you to retrieve a list of all assigned and unassigned IPs.\n \n  Response includes warm up status, pools, assigned subusers, and reverse DNS info. The start_date field corresponds to when warmup started for that IP.\n \n  A single IP address or a range of IP addresses may be dedicated to an account in order to send email for multiple domains. The reputation of this IP is based on the aggregate performance of all the senders who use it."
  },
  "postIps": {
    "comment": "Add IPs",
    "doc": "Add IPs\n  This endpoint is for adding a(n) IP Address(es) to your account."
  },
  "getIpsAssigned": {
    "comment": "Retrieve all assigned IPs",
    "doc": "Retrieve all assigned IPs\n  This endpoint allows you to retrieve only assigned IP addresses.\n \n  A single IP address or a range of IP addresses may be dedicated to an account in order to send email for multiple domains. The reputation of this IP is based on the aggregate performance of all the senders who use it."
  },
  "getIpsPools": {
    "comment": "Retrieve all IP pools",
    "doc": "Retrieve all IP pools\n  This endpoint allows you to get all of your IP pools."
  },
  "postIpsPools": {
    "comment": "Create an IP pool",
    "doc": "Create an IP pool\n  This endpoint allows you to create an IP pool.\n \n  Before you can create an IP pool, you need to activate the IP in your SendGrid account:\n \n  1. Log into your SendGrid account.\n  1. Navigate to Settings and then select IP Addresses.\n  1. Find the IP address you want to activate and then click Edit.\n  1. Check Allow my account to send mail using this IP address.\n  1. Click Save."
  },
  "deleteIpsPoolsPoolName": {
    "comment": "Delete an IP pool",
    "doc": "Delete an IP pool\n  This endpoint allows you to delete an IP pool."
  },
  "getIpsPoolsPoolName": {
    "comment": "Retrieve all the IPs in a specified pool",
    "doc": "Retrieve all the IPs in a specified pool\n  This endpoint allows you to get all of the IP addresses that are in a specific IP pool."
  },
  "putIpsPoolsPoolName": {
    "comment": "Rename an IP pool",
    "doc": "Rename an IP pool\n  This endpoint allows you to update the name of an IP pool."
  },
  "postIpsPoolsPoolNameIps": {
    "comment": "Add an IP address to a pool",
    "doc": "Add an IP address to a pool\n  This endpoint allows you to add an IP address to an IP pool.\n \n  You can add the same IP address to multiple pools. It may take up to 60 seconds for your IP address to be added to a pool after your request is made.\n \n  Before you can add an IP to a pool, you need to activate it in your SendGrid account:\n \n  1. Log into your SendGrid account.\n  1. Navigate to Settings and then select IP Addresses.\n  1. Find the IP address you want to activate and then click Edit.\n  1. Check Allow my account to send mail using this IP address.\n  1. Click Save.\n \n  You can retrieve all of your available IP addresses from the \"Retrieve all IP addresses\" endpoint."
  },
  "deleteIpsPoolsPoolNameIpsIp": {
    "comment": "Remove an IP address from a pool",
    "doc": "Remove an IP address from a pool\n  This endpoint allows you to remove an IP address from an IP pool."
  },
  "getIpsRemaining": {
    "comment": "Get remaining IPs count",
    "doc": "Get remaining IPs count\n  This endpoint gets amount of IP Addresses that can still be created during a given period and the price of those IPs."
  },
  "getIpsWarmup": {
    "comment": "Retrieve all IPs currently in warmup",
    "doc": "Retrieve all IPs currently in warmup\n  This endpoint allows you to retrieve all of your IP addresses that are currently warming up."
  },
  "postIpsWarmup": {
    "comment": "Start warming up an IP address",
    "doc": "Start warming up an IP address\n  This endpoint allows you to put an IP address into warmup mode."
  },
  "deleteIpsWarmupIpAddress": {
    "comment": "Stop warming up an IP address",
    "doc": "Stop warming up an IP address\n  This endpoint allows you to remove an IP address from warmup mode.\n \n  Your request will return a 204 status code if the specified IP was successfully removed from warmup mode. To retrieve details of the IP’s warmup status before removing it from warmup mode, call the  \"Retrieve the warmpup status for a specific IP address\" endpoint."
  },
  "getIpsWarmupIpAddress": {
    "comment": "Retrieve the warmup status for a specific IP address",
    "doc": "Retrieve the warmup status for a specific IP address\n  This endpoint allows you to retrieve the warmup status for a specific IP address.\n \n  You can retrieve all of your warming IPs using the \"Retrieve all IPs currently in warmup\" endpoint."
  },
  "getIpsIpAddress": {
    "comment": "Retrieve all IP pools an IP address belongs to",
    "doc": "Retrieve all IP pools an IP address belongs to\n  This endpoint allows you to see which IP pools a particular IP address has been added to.\n \n  The same IP address can be added to multiple IP pools.\n \n  A single IP address or a range of IP addresses may be dedicated to an account in order to send email for multiple domains. The reputation of this IP is based on the aggregate performance of all the senders who use it."
  },
  "postMailBatch": {
    "comment": "Create a batch ID",
    "doc": "Create a batch ID\n  This endpoint allows you to generate a new batch ID.\n \n  Once a `batch_id` is created, you can associate it with a scheduled send using the `/mail/send` endpoint. Passing the `batch_id` as a field in the `/mail/send` request body will assign the ID to the send you are creating.\n \n  Once an ID is associated with a scheduled send, the send can be accessed and its send status can be modified using the `batch_id`."
  },
  "getMailBatchBatchId": {
    "comment": "Validate batch ID",
    "doc": "Validate batch ID\n  This endpoint allows you to validate a batch ID.\n \n  When you pass a valid `batch_id` to this endpoint, it will return a `200` status code and the batch ID itself.\n \n  If you pass an invalid `batch_id` to the endpoint, you will receive a `400` level status code and an error message.\n \n  A `batch_id` does not need to be assigned to a scheduled send to be considered valid. A successful response means only that the `batch_id` has been created, but it does not indicate that it has been associated with a send."
  },
  "postMailSend": {
    "comment": "v3 Mail Send",
    "doc": "v3 Mail Send\n  The Mail Send endpoint allows you to send email over SendGrid’s v3 Web API, the most recent version of our API. If you are looking for documentation about the v2 Mail Send endpoint, see our [v2 API Reference](https://sendgrid.com/docs/API_Reference/Web_API/mail.html).\n \n  ## Helper Libraries\n \n  Twilio SendGrid provides libraries to help you quickly and easily integrate with the v3 Web API in 7 different languages:\n \n   [C#](https://github.com/sendgrid/sendgrid-csharp)\n   [Go](https://github.com/sendgrid/sendgrid-go)\n   [Java](https://github.com/sendgrid/sendgrid-java)\n   [Node JS](https://github.com/sendgrid/sendgrid-nodejs)\n   [PHP](https://github.com/sendgrid/sendgrid-php)\n   [Python](https://github.com/sendgrid/sendgrid-python)\n   [Ruby](https://github.com/sendgrid/sendgrid-ruby)\n \n  ## Dynamic Transactional Templates and Handlebars\n \n  In order to send a dynamic template, specify the template ID with the `template_id` parameter.\n \n  To specify handlebar substitutions, define your substitutions in the request JSON with this syntax:\n \n  ```\n  \"dynamic_template_data\": {\n  \"guest\": \"Jane Doe\",\n  \"partysize\": \"4\",\n  \"english\": true,\n  \"date\": \"April 1st, 2021\"\n  }\n  ```\n \n  For more information about Dynamic Transactional Templates and Handlebars, see our documentation and reference pages.\n \n   [How to send an email with Dynamic Transactional Templates\n  ](https://sendgrid.com/docs/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates/)\n   [Using Handlebars](https://sendgrid.com/docs/for-developers/sending-email/using-handlebars/)\n \n  ## Mail Body Compression\n \n  Mail body compression is available to some high volume accounts. Talk to your CSM if you are interested in this functionality. Mail body compression works by setting up a JSON payload as defined on this page, then compressing it with gzip (the gzip file can be no more than 30mb).\n \n  To use mail body compression:\n \n  1. Add a `Content-Encoding` header, with a value of `gzip`.\n  a. `Content-Encoding: gzip`\n  2. Send the gzip as a data-binary.\n  a. `--data-binary '@data.json.gz'\n  `\n \n  ## Multiple Reply-To Emails\n \n  Using `reply_to_list` allows senders to include more than one recipient email address to receive reply and/or bounce messages from the recipient of the email.\n \n  ### Usage Considerations\n \n   `reply_to` is mutually exclusive with `reply_to_list`. If both are used, then the API call will be rejected.\n   The `reply_to_list` object, when used, must at least have an email parameter and may also contain a name parameter.\n   Each email address in the `reply_to_list` should be unique.\n   There is a limit of 1000 `reply_to_list` emails per mail/send request.\n   In SMTP calls, we will omit any invalid emails.\n \n  ### Possible 400 Error Messages\n \n   `reply_to` is mutually exclusive with `reply_to_list`.\n   The `reply_to_list` object, when used, must at least have an email parameter and may also contain a name parameter.\n   Each email address in the `reply_to_list` should be unique.\n   There is a limit of X `reply_to` emails per mail/send request.\n   The `reply_to_list` email does not contain a valid address.\n   The `reply_to_list` email exceeds the maximum total length of X characters.\n   The `reply_to_list` email parameter is required."
  },
  "getMailSettings": {
    "comment": "Retrieve all mail settings",
    "doc": "Retrieve all mail settings\n  This endpoint allows you to retrieve a list of all mail settings.\n \n  Each setting will be returned with an `enabled` status set to `true` or `false` and a short description that explains what the setting does."
  },
  "getMailSettingsAddressWhitelist": {
    "comment": "Retrieve address whitelist mail settings",
    "doc": "Retrieve address whitelist mail settings\n  This endpoint allows you to retrieve your current email address whitelist settings.\n \n  The Address Whitelist setting allows you to specify email addresses or domains for which mail should never be suppressed.\n \n  For example, if you own the domain `example.com`, and one or more of your recipients use `email@example.com` addresses, placing `example.com` in the address whitelist setting instructs Twilio SendGrid to ignore all bounces, blocks, and unsubscribes logged for that domain. In other words, all bounces, blocks, and unsubscribes will still be sent to `example.com` as if they were sent under normal sending conditions."
  },
  "patchMailSettingsAddressWhitelist": {
    "comment": "Update address whitelist mail settings",
    "doc": "Update address whitelist mail settings\n  This endpoint allows you to update your current email address whitelist settings.\n \n  You can select whether or not this setting should be enabled by assigning the `enabled` field a `true` or `false` value.\n \n  Passing only the `enabled` field to this endpoint will not alter your current `list` of whitelist entries. However, any modifications to your `list` of entries will overwrite the entire list. For this reason, you must included all existing entries you wish to retain in your `list` in addition to any new entries you intend to add. To remove one or more `list` entries, pass a `list` with only the entries you wish to retain.\n \n  You should not add generic domains such as `gmail.com` or `yahoo.com`  in your `list` because your emails will not honor recipients' unsubscribes. This may cause a legal violation of [CAN-SPAM](https://sendgrid.com/docs/glossary/can-spam/) and could damage your sending reputation.\n \n  The Address Whitelist setting allows you to specify email addresses or domains for which mail should never be suppressed.\n \n  For example, if you own the domain `example.com`, and one or more of your recipients use `email@example.com` addresses, placing `example.com` in the address whitelist setting instructs Twilio SendGrid to ignore all bounces, blocks, and unsubscribes logged for that domain. In other words, all bounces, blocks, and unsubscribes will still be sent to `example.com` as if they were sent under normal sending conditions."
  },
  "getMailSettingsBouncePurge": {
    "comment": "Retrieve bounce purge mail settings",
    "doc": "Retrieve bounce purge mail settings\n  This endpoint allows you to retrieve your current bounce and purge settings.\n \n  The Bounce Perge setting allows you to set a schedule that Twilio SendGrid will use to automatically delete contacts from your soft and hard bounce suppression lists.\n \n  A hard bounce occurs when an email message has been returned to the sender because the recipient's address is invalid. A hard bounce might occur because the domain name doesn't exist or because the recipient is unknown.\n \n  A soft bounce occurs when an email message reaches the recipient's mail server but is bounced back undelivered before it actually reaches the recipient. A soft bounce might occur because the recipient's inbox is full.\n \n  You can also manage this setting in the [Mail Settings section of the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings). You can manage your bounces manually using the [Bounces API](https://sendgrid.api-docs.io/v3.0/bounces-api) or the [Bounces menu in the Twilio SendGrid App](https://app.sendgrid.com/suppressions/bounces)."
  },
  "patchMailSettingsBouncePurge": {
    "comment": "Update bounce purge mail settings",
    "doc": "Update bounce purge mail settings\n  This endpoint allows you to update your current bounce and purge settings.\n \n  The Bounce Perge setting allows you to set a schedule that Twilio SendGrid will use to automatically delete contacts from your soft and hard bounce suppression lists. The schedule is set in full days by assigning the number of days, an integer, to the `soft_bounces` and/or `hard_bounces` fields.\n \n  A hard bounce occurs when an email message has been returned to the sender because the recipient's address is invalid. A hard bounce might occur because the domain name doesn't exist or because the recipient is unknown.\n \n  A soft bounce occurs when an email message reaches the recipient's mail server but is bounced back undelivered before it actually reaches the recipient. A soft bounce might occur because the recipient's inbox is full.\n \n  You can also manage this setting in the [Mail Settings section of the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings). You can manage your bounces manually using the [Bounces API](https://sendgrid.api-docs.io/v3.0/bounces-api) or the [Bounces menu in the Twilio SendGrid App](https://app.sendgrid.com/suppressions/bounces)."
  },
  "getMailSettingsFooter": {
    "comment": "Retrieve footer mail settings",
    "doc": "Retrieve footer mail settings\n  This endpoint allows you to retrieve your current Footer mail settings.\n \n  The Footer setting will insert a custom footer at the bottom of your text and HTML email message bodies.\n \n  You can insert your HTML or plain text directly using the \"Update footer mail settings\" endpoint, or you can create the footer using the [Mail Settings menu in the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings)."
  },
  "patchMailSettingsFooter": {
    "comment": "Update footer mail settings",
    "doc": "Update footer mail settings\n  This endpoint allows you to update your current Footer mail settings.\n \n  The Footer setting will insert a custom footer at the bottom of your text and HTML email message bodies.\n \n  You can insert your HTML or plain text directly using this endpoint, or you can create the footer using the [Mail Settings menu in the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings)."
  },
  "getMailSettingsForwardBounce": {
    "comment": "Retrieve forward bounce mail settings",
    "doc": "Retrieve forward bounce mail settings\n  This endpoint allows you to retrieve your current bounce forwarding mail settings.\n \n  Enabling the Forward Bounce setting allows you to specify `email` addresses to which bounce reports will be forwarded. This endpoint returns the email address you have set to receive forwarded bounces and an `enabled` status indicating if the setting is active."
  },
  "patchMailSettingsForwardBounce": {
    "comment": "Update forward bounce mail settings",
    "doc": "Update forward bounce mail settings\n  This endpoint allows you to update your current bounce forwarding mail settings.\n \n  Enabling the Forward Bounce setting allows you to specify an `email` address to which bounce reports will be forwarded.\n \n  You can also configure the Forward Spam mail settings in the [Mail Settings section of the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings)."
  },
  "getMailSettingsForwardSpam": {
    "comment": "Retrieve forward spam mail settings",
    "doc": "Retrieve forward spam mail settings\n  This endpoint allows you to retrieve your current Forward Spam mail settings.\n \n  Enabling the Forward Spam setting allows you to specify `email` addresses to which spam reports will be forwarded. This endpoint returns any email address(es) you have set to receive forwarded spam and an `enabled` status indicating if the setting is active."
  },
  "patchMailSettingsForwardSpam": {
    "comment": "Update forward spam mail settings",
    "doc": "Update forward spam mail settings\n  This endpoint allows you to update your current Forward Spam mail settings.\n \n  Enabling the Forward Spam setting allows you to specify `email` addresses to which spam reports will be forwarded. You can set multiple addresses by passing this endpoint a comma separated list of emails in a single string.\n \n  ```\n  {\n  \"email\": \"address1@example.com, address2@exapmle.com\",\n  \"enabled\": true\n  }\n  ```\n \n  The Forward Spam setting may also be used to receive emails sent to `abuse@` and `postmaster@` role addresses if you have authenticated your domain.\n \n  For example, if you authenticated `example.com` as your root domain and set a custom return path of `sub` for that domain, you could turn on Forward Spam, and any emails sent to `abuse@sub.example.com` or `postmaster@sub.example.com` would be forwarded to the email address you entered in the `email` field.\n \n  You can authenticate your domain using the \"Authenticate a domain\" endpoint or in the [Sender Authentication section of the Twilio SendGrid App](https://app.sendgrid.com/settings/sender_auth). You can also configure the Forward Spam mail settings in the [Mail Settings section of the Twilio SendGrid App](https://app.sendgrid.com/settings/mail_settings)."
  },
  "getMailSettingsTemplate": {
    "comment": "Retrieve legacy template mail settings",
    "doc": "Retrieve legacy template mail settings\n  This endpoint allows you to retrieve your current legacy email template settings.\n \n  This setting refers to our original email templates. We currently support more fully featured [Dynamic Transactional Templates](https://sendgrid.com/docs/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates/).\n \n  The legacy email template setting wraps an HTML template around your email content. This can be useful for sending out marketing email and/or other HTML formatted messages. For instructions on using legacy templates, see how to [\"Create and Edit Legacy Transactional Templates](https://sendgrid.com/docs/ui/sending-email/create-and-edit-legacy-transactional-templates/). For help migrating to our current template system, see [\"Migrating from Legacy Templates\"](https://sendgrid.com/docs/ui/sending-email/migrating-from-legacy-templates/)."
  },
  "patchMailSettingsTemplate": {
    "comment": "Update template mail settings",
    "doc": "Update template mail settings\n  This endpoint allows you to update your current legacy email template settings.\n \n  This setting refers to our original email templates. We currently support more fully featured [Dynamic Transactional Templates](https://sendgrid.com/docs/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates/).\n \n  The legacy email template setting wraps an HTML template around your email content. This can be useful for sending out marketing email and/or other HTML formatted messages. For instructions on using legacy templates, see how to [\"Create and Edit Legacy Transactional Templates](https://sendgrid.com/docs/ui/sending-email/create-and-edit-legacy-transactional-templates/). For help migrating to our current template system, see [\"Migrating from Legacy Templates\"](https://sendgrid.com/docs/ui/sending-email/migrating-from-legacy-templates/)."
  },
  "getMailboxProvidersStats": {
    "comment": "Retrieve email statistics by mailbox provider.",
    "doc": "Retrieve email statistics by mailbox provider.\n  This endpoint allows you to retrieve your email statistics segmented by recipient mailbox provider.\n \n  We only store up to 7 days of email activity in our database. By default, 500 items will be returned per request via the Advanced Stats API endpoints.\n \n  Advanced Stats provide a more in-depth view of your email statistics and the actions taken by your recipients. You can segment these statistics by geographic location, device type, client type, browser, and mailbox provider. For more information about statistics, please see our [Statistics Overview](https://sendgrid.com/docs/ui/analytics-and-reporting/stats-overview/)."
  },
  "deleteMcContacts": {
    "comment": "Delete Contacts",
    "doc": "Delete Contacts\n  This endpoint can be used to delete one or more contacts.\n \n  The query parameter `ids` must set to a comma-separated list of contact IDs for bulk contact deletion.\n \n  The query parameter `delete_all_contacts` must be set to `\"true\"` to delete all contacts.\n \n  You must set either `ids` or `delete_all_contacts`.\n \n  Deletion jobs are processed asynchronously.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMcContats": {
    "comment": "Get Sample Contacts",
    "doc": "Get Sample Contacts\n  This endpoint will return up to 50 of the most recent contacts uploaded or attached to a list.\n \n  This list will then be sorted by email address.\n \n  The full contact count is also returned.\n \n  Please note that pagination of the contacts has been deprecated.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "putMcContacts": {
    "comment": "Add or Update a Contact",
    "doc": "Add or Update a Contact\n  This endpoint allows the [upsert](https://en.wiktionary.org/wiki/upsert) (insert or update) of up to 30,000 contacts, or 6MB of data, whichever is lower.\n \n  Because the creation and update of contacts is an asynchronous process, the response will not contain immediate feedback on the processing of your upserted contacts. Rather, it will contain an HTTP 202 response indicating the contacts are queued for processing or an HTTP 4XX error containing validation errors. Should you wish to get the resulting contact's ID or confirm your contacts have been updated or added, you can use the \"Get Contacts by Emails\" endpoint.\n \n  Please note that custom fields need to have been already created if you wish to set their values for the contacts being upserted. To do this, please use the \"Create Custom Field Definition\" endpoint.\n \n  You will see a `job_id` in the response to your request. This can be used to check the status of your upsert job. To do so, please use the \"Import Contacts Status\" endpoint.\n \n  If the contact already exists in the system, any entries submitted via this endpoint will update the existing contact. The contact to update will be determined only by the `email` field and any fields omitted from the request will remain as they were. A contact's ID cannot be used to update the contact.\n \n  The email field will be changed to all lower-case. If a contact is added with an email that exists but contains capital letters, the existing contact with the all lower-case email will be updated.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "postMarketingContactsBatch": {
    "comment": "Get Batched Contacts by IDs",
    "doc": "Get Batched Contacts by IDs\n  This endpoint is used to retrieve a set of contacts identified by their IDs.\n \n  This can be more efficient endpoint to get contacts than making a series of individual `GET` requests to the \"Get a Contact by ID\" endpoint.\n \n  You can supply up to 100 IDs. Pass them into the `ids` field in your request body as an array or one or more strings.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMcContactsCount": {
    "comment": "Get Total Contact Count",
    "doc": "Get Total Contact Count\n  This endpoint returns the total number of contacts you have stored.\n \n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMarketingContactsExports": {
    "comment": "Get All Existing Exports",
    "doc": "Get All Existing Exports\n  Use this endpoint to retrieve details of all current exported jobs.\n \n  It will return an array of objects, each of which records an export job in flight or recently completed.\n \n  Each object's `export_type` field will tell you which kind of export it is and its `status` field will indicate what stage of processing it has reached. Exports which are `ready` will be accompanied by a `urls` field which lists the URLs of the export's downloadable files — there will be more than one if you specified a maximum file size in your initial export request.\n \n  Use this endpoint if you have exports in flight but do not know their IDs, which are required for the \"Export Contacts Status\" endpoint.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "postMcContactsExports": {
    "comment": "Export Contacts",
    "doc": "Export Contacts\n  Use this endpoint to export lists or segments of contacts.\n \n  If you would just like to have a link to the exported list sent to your email set the `notifications.email` option to `true` in the `POST` payload.\n \n  If you would like to download the list, take the `id` that is returned and use the \"Export Contacts Status\" endpoint to get the `urls`. Once you have the list of URLs, make a `GET` request to each URL provided to download your CSV file(s).\n \n  You specify the segements and or/contact lists you wish to export by providing the relevant IDs in, respectively, the `segment_ids` and `list_ids` fields in the request body.\n \n  The lists will be provided in either JSON or CSV files. To specify which of these you would required, set the request body `file_type` field to `json` or `csv`.\n \n  You can also specify a maximum file size (in MB). If the export file is larger than this, it will be split into multiple files.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMcContactsExportsId": {
    "comment": "Export Contacts Status",
    "doc": "Export Contacts Status\n  This endpoint can be used to check the status of a contact export job.\n \n  To use this call, you will need the `id` from the \"Export Contacts\" call.\n \n  If you would like to download a list, take the `id` that is returned from the \"Export Contacts\" endpoint and make an API request here to get the `urls`. Once you have the list of URLs, make a `GET` request on each URL to download your CSV file(s).\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "putMcContactsImports": {
    "comment": "Import Contacts",
    "doc": "Import Contacts\n  This endpoint allows a CSV upload containing up to one million contacts or 5GB of data, whichever is smaller.\n \n  Imports take place asynchronously: the endpoint returns a URL (`upload_uri`) and HTTP headers (`upload_headers`) which can subsequently be used to `PUT` a file of contacts to be  imported into our system.\n \n  Uploaded CSV files may also be [gzip-compressed](https://en.wikipedia.org/wiki/Gzip).\n \n  In either case, you must include the field `file_type` with the value `csv` in your request body.\n \n  The `field_mappings` paramter is a respective list of field definition IDs to map the uploaded CSV columns to. It allows you to use CSVs where one or more columns are skipped (`null`) or remapped to the contact field.\n \n  For example, if `field_mappings` is set to `[null, \"w1\", \"_rf1\"]`, this means skip column 0, map column 1 to the custom field with the ID `w1`, and map column 2 to the reserved field with the ID `_rf1`. See the \"Get All Field Definitions\" endpoint to fetch your custom and reserved field IDs to use with `field_mappings`.\n \n  Once you recieve the response body you can then initiate a second API call where you use the supplied URL and HTTP header to upload your file. For example:\n \n  `curl --upload-file \"file/path.csv\" \"URL_GIVEN\" -H 'HEADER_GIVEN'`\n \n  If you'd like to monitor the status of your import job, use the `job_id` and the \"Import Contacts Status\" endpoint.\n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMarketingContactsImportsId": {
    "comment": "Import Contacts Status",
    "doc": "Import Contacts Status\n  This endpoint can be used to check the status of a contact import job.\n \n  Use the `job_id` from the \"Import Contacts,\" \"Add or Update a Contact,\" or \"Delete Contacts\" endpoints as the `id` in the path parameter.\n \n  If there is an error with your `PUT` request, download the `errors_url` file and open it to view more details.\n \n  The job `status` field indicates whether the job is `pending`, `completed`, `errored`, or `failed`.\n \n  Pending means not started. Completed means finished without any errors. Errored means finished with some errors. Failed means finshed with all errors, or the job was entirely unprocessable: for example, if you attempt to import file format we do not support.\n \n  The `results` object will have fields depending on the job type.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "postMcContactsSearch": {
    "comment": "Search Contacts",
    "doc": "Search Contacts\n  Use this endpoint to locate contacts.\n \n  The request body's `query` field accepts valid [SGQL](https://sendgrid.com/docs/for-developers/sending-email/segmentation-query-language/) for searching for a contact.\n \n  Because contact emails are stored in lower case, using SGQL to search by email address requires the provided email address to be in lower case. The SGQL `lower()` function can be used for this.\n \n  Only the first 50 contacts that meet the search criteria will be returned.\n \n  If the query takes longer than 20 seconds, a `408 Request Timeout` status will be returned.\n \n  Formatting the `created_at` and `updated_at` values as Unix timestamps is deprecated. Instead they are returned as ISO format as string.\n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "postMarketingContactsSearchEmails": {
    "comment": "Get Contacts by Emails",
    "doc": "Get Contacts by Emails\n  This endpoint allows you to retrieve up to 100 contacts matching the searched `email` address(es), including any `alternate_emails`.\n \n  Email addresses are unique to a contact, meaning this endpoint can treat an email address as a primary key to search by. The contact object associated with the address, whether it is their `email` or one of their `alternate_emails` will be returned if matched.\n \n  Email addresses in the search request do not need to match the case in which they're stored, but the email addresses in the result will be all lower case. Empty strings are excluded from the search and will not be returned.\n \n  This endpoint should be used in place of the \"Search Contacts\" endpoint when you can provide exact email addresses and do not need to include other [Segmentation Query Language (SGQL)](https://sendgrid.com/docs/for-developers/sending-email/segmentation-query-language/) filters when searching.\n \n  If you need to access a large percentage of your contacts, we recommend exporting your contacts with the \"Export Contacts\" endpoint and filtering the results client side.\n \n  This endpoint returns a `200` status code when any contacts match the address(es) you supplied. When searching multiple addresses in a single request, it is possible that some addresses will match a contact while others will not. When a partially successful search like this is made, the matching contacts are returned in an object and an error message is returned for the email address(es) that are not found.\n \n  This endpoint returns a `404` status code when no contacts are found for the provided email address(es).\n \n  A `400` status code is returned if any searched addresses are invalid.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMcContactsId": {
    "comment": "Get a Contact by ID",
    "doc": "Get a Contact by ID\n  This endpoint returns the full details and all fields for the specified contact.\n \n  The \"Get Contacts by Emails\" endpoint can be used to get the ID of a contact.\n \n  Twilio SendGrid recommends exporting your contacts regularly as a backup to avoid issues or lost data."
  },
  "getMcFieldDefinitions": {
    "comment": "Get All Field Definitions",
    "doc": "Get All Field Definitions\n  This endpoint retrieves all defined Custom Fields and Reserved Fields."
  },
  "postMcFieldDefinitions": {
    "comment": "Create Custom Field Definition",
    "doc": "Create Custom Field Definition\n  This endpoint creates a new custom field definition.\n \n  Custom field definitions are created with the given `name` and `field_type`. Although field names are stored in a case-sensitive manner, all field names must be case-insensitively unique. This means you may create a field named `CamelCase` or `camelcase`, but not both. Additionally, a Custom Field name cannot collide with any Reserved Field names. You should save the returned `id` value in order to update or delete the field at a later date. You can have up to 120 custom fields.\n \n  The custom field name should be created using only alphanumeric characters (A-Z and 0-9) and underscores (\\_). Custom fields can only begin with letters  A-Z or underscores (_). The field type can be date, text, or number fields. The field type is important for creating segments from your contact database.\n \n  Note: Creating a custom field that begins with a number will cause issues with sending in Marketing Campaigns."
  },
  "deleteMcFieldDefinitionsCustomFieldId": {
    "comment": "Delete Custom Field Definition",
    "doc": "Delete Custom Field Definition\n  This endpoint deletes a defined Custom Field.\n \n  You cand delete only Custom Fields; Reserved Fields cannot be deleted."
  },
  "patchMcFieldDefinitionsCustomFieldId": {
    "comment": "Update Custom Field Definition",
    "doc": "Update Custom Field Definition\n  This endopoint allows you to update a defined Custom Field.\n \n  Only your Custom fields can be modified; Reserved Fields cannot be updated."
  },
  "getMcLists": {
    "comment": "Get All Lists",
    "doc": "Get All Lists\n  This endpoint returns an array of all of your contact lists."
  },
  "postMcLists": {
    "comment": "Create List",
    "doc": "Create List\n  This endpoint creates a new contacts list.\n \n  Once you create a list, you can use the UI to [trigger an automation](https://sendgrid.com/docs/ui/sending-email/getting-started-with-automation/#create-an-automation) every time you add a new contact to the list.\n \n  A link to the newly created object is in `_metadata`."
  },
  "deleteListsId": {
    "comment": "Delete a list",
    "doc": "Delete a list\n  This endpoint allows you to deletes a specific list.\n \n  Optionally, you can also delete contacts associated to the list. The query parameter, `delete_contacts=true`, will delete the list and start an asynchronous job to delete associated contacts."
  },
  "getMcListsId": {
    "comment": "Get a List by ID",
    "doc": "Get a List by ID\n  This endpoint returns data about a specific list.\n \n  Setting the optional parameter `contact_sample=true` returns the `contact_sample` in the response body. Up to fifty of the most recent contacts uploaded or attached to a list will be returned, sorted alphabetically, by email address.\n \n  The full contact count is also returned."
  },
  "patchMcListsId": {
    "comment": "Update List",
    "doc": "Update List\n  This endpoint updates the name of a list."
  },
  "deleteMcListsIdContacts": {
    "comment": "Remove Contacts from a List",
    "doc": "Remove Contacts from a List\n  This endpoint allows you to remove contacts from a given list.\n \n  The contacts will not be deleted. Only their list membership will be changed."
  },
  "getMcListsIdContactsCount": {
    "comment": "Get List Contact Count",
    "doc": "Get List Contact Count\n  This endpoint returns the number of contacts on a specific list."
  },
  "getMarketingSegments": {
    "comment": "Get List of Segments",
    "doc": "Get List of Segments\n  This endpoint allows you to retrieve a list of segments.\n \n  The query param `parent_list_ids` is treated as a filter.  Any match will be returned.  0 matches will return a response code of 200 with an empty `results` array.\n \n  `parent_list_ids` | `no_parent_list_id` | `result`\n  -----------------:|:--------------------:|:-------------\n  empty | false | all segments\n  values | false | segments filtered by list_ids\n  values | true | segments filtered by list_ids and segments with no parent list_ids\n  empty | true | segments with no parent list_ids"
  },
  "postMarketingSegments": {
    "comment": "Create Segment",
    "doc": "Create Segment\n  This endpoint allows you to create a segment."
  },
  "getSegments": {
    "comment": "Get List of Segments",
    "doc": "Get List of Segments\n  The Segmentation V2 API is currently in private beta. If you'd like to be added to the beta, please fill out this [form]({https://docs.google.com/forms/d/e/1FAIpQLSd5zwC9dRk8lAp1oTWjdGc-aSY69flW_7wnutvKBhpUluSnfQ/viewform)\n \n  The query param `parent_list_ids` is treated as a filter.  Any match will be returned.  0 matches will return a response code of 200 with an empty `results` array.\n \n  `parent_list_ids` | `no_parent_list_id` | `result`\n  -----------------:|:--------------------:|:-------------\n  empty | false | all segments\n  values | false | segments filtered by list_ids\n  values | true | segments filtered by list_ids and segments with no parent list_ids\n  empty | true | segments with no parent list_ids"
  },
  "postSegments": {
    "comment": "Create Segment",
    "doc": "Create Segment\n  The Segmentation V2 API is currently in private beta. If you'd like to be added to the beta, please fill out this [form]({https://docs.google.com/forms/d/e/1FAIpQLSd5zwC9dRk8lAp1oTWjdGc-aSY69flW_7wnutvKBhpUluSnfQ/viewform)\n \n  Segment `name` has to be unique. A user can not create a new segment with an existing segment name."
  },
  "deleteSegmentsSegmentId": {
    "comment": "Delete segment",
    "doc": "Delete segment\n  The Segmentation V2 API is currently in private beta. If you'd like to be added to the beta, please fill out this [form]({https://docs.google.com/forms/d/e/1FAIpQLSd5zwC9dRk8lAp1oTWjdGc-aSY69flW_7wnutvKBhpUluSnfQ/viewform)"
  },
  "getSegmentsSegmentId": {
    "comment": "Get Segment by ID",
    "doc": "Get Segment by ID\n  The Segmentation V2 API is currently in private beta. If you'd like to be added to the beta, please fill out this [form]({https://docs.google.com/forms/d/e/1FAIpQLSd5zwC9dRk8lAp1oTWjdGc-aSY69flW_7wnutvKBhpUluSnfQ/viewform)"
  },
  "patchSegmentsSegmentId": {
    "comment": "Update Segment",
    "doc": "Update Segment\n  The Segmentation V2 API is currently in private beta. If you'd like to be added to the beta, please fill out this [form]({https://docs.google.com/forms/d/e/1FAIpQLSd5zwC9dRk8lAp1oTWjdGc-aSY69flW_7wnutvKBhpUluSnfQ/viewform)\n \n  Segment `name` has to be unique. A user can not create a new segment with an existing segment name."
  },
  "postMarketingSegmentsDelete": {
    "comment": "Bulk Delete Segments",
    "doc": "Bulk Delete Segments\n  This endpoint allows you to delete segments in bulk.\n \n  If the segments are used by automations or the segments do not exist in the database, the segment IDs that could not be deleted along with automation IDs that are associated to those segments will be returned."
  },
  "deleteMarketingSegmentsSegmentId": {
    "comment": "Delete Segment",
    "doc": "Delete Segment\n  This endpoint allows you to delete a segment by `segment_id`.\n \n  Note that deleting a segment does not delete the contacts associated with the segment by default. Contacts associated with a deleted segment will remain in your list of all contacts and any other segments they belong to."
  },
  "getMarketingSegmentsSegmentId": {
    "comment": "Get Segment by ID",
    "doc": "Get Segment by ID\n  This endpoint allows you to retrieve a single segment by ID."
  },
  "patchMarketingSegmentsSegmentId": {
    "comment": "Update Segment",
    "doc": "Update Segment\n  This endpoint allows you to update a segment.\n \n  Segment `name` needs to be unique. A user can not update a segment name to an existing one."
  },
  "postMarketingSenders": {
    "comment": "Create a Sender Identity",
    "doc": "Create a Sender Identity\n  This endpoint allows you to create a new sender identity.\n \n  You may create up to 100 unique sender identities.\n \n  Sender identities are required to be verified before use. If your domain has been authenticated, a new sender identity will auto verify on creation. Otherwise an email will be sent to the `from.email`."
  },
  "deleteMarketingSinglesends": {
    "comment": "Bulk Delete Single Sends",
    "doc": "Bulk Delete Single Sends\n  This endpoint allows you to delete multiple Single Sends using an array of Single Sends IDs.\n \n  To first retrieve all your Single Sends' IDs, you can make a GET request to the `/marketing/singlensends` endpoint.\n \n  Please note that a DELETE request is permanent, and your Single Sends will not be recoverable after deletion."
  },
  "getMarketingSinglesends": {
    "comment": "Get All Single Sends",
    "doc": "Get All Single Sends\n  This endpoint allows you to retrieve all your Single Sends.\n \n  Returns all of your Single Sends with condensed details about each, including the Single Sends' IDs. For more details about an individual Single Send, pass the Single Send's ID to the `/marketing/singlesends/{id}` endpoint."
  },
  "postMarketingSinglesends": {
    "comment": "Create Single Send",
    "doc": "Create Single Send\n  This endpoint allows you to create a new Single Send.\n \n  Please note that if you are migrating from the previous version of Single Sends, you no longer need to pass a template ID with your request to this endpoint. Instead, you will pass all template data in the `email_config` object."
  },
  "getMarketingSinglesendsCategories": {
    "comment": "Get All Categories",
    "doc": "Get All Categories\n  This endpoint allows you to retrieve all the categories associated with your Single Sends.\n \n  This endpoint will return your latest 1,000 categories."
  },
  "postMarketingSinglesendsSearch": {
    "comment": "Get Single Sends Search",
    "doc": "Get Single Sends Search\n  This endpoint allows you to search for Single Sends based on specified criteria.\n \n  You can search for Single Sends by passing a combination of values using the `name`, `status`, and `categories` request body fields.\n \n  For example, if you want to search for all Single Sends that are \"drafts\" or \"scheduled\" and also associated with the category \"shoes,\" your request body may look like the example below.\n \n  ```javascript\n  {\n  \"status\": [\n  \"draft\",\n  \"scheduled\"\n  ],\n  \"categories\": [\n  \"shoes\"\n  ],\n  }\n  ```"
  },
  "deleteMarketingSinglesendsId": {
    "comment": "Delete Single Send by ID",
    "doc": "Delete Single Send by ID\n  This endpoint allows you to delete one Single Send using a Single Send ID.\n \n  To first retrieve all your Single Sends' IDs, you can make a GET request to the `/marketing/singlensends` endpoint.\n \n  Please note that a `DELETE` request is permanent, and your Single Send will not be recoverable after deletion."
  },
  "getMarketingSinglesendsId": {
    "comment": "Get Single Send by ID",
    "doc": "Get Single Send by ID\n  This endpoint allows you to retrieve details about one Single Send using a Single Send ID.\n \n  You can retrieve all of your Single Sends by making a GET request to the `/marketing/singlesends` endpoint."
  },
  "patchMarketingSinglesendsId": {
    "comment": "Update Single Send",
    "doc": "Update Single Send\n  This endpoint allows you to update a Single Send using a Single Send ID.\n \n  You only need to pass the fields you want to update. Any blank/missing fields will remain unaltered."
  },
  "postMarketingSinglesendsId": {
    "comment": "Duplicate Single Send",
    "doc": "Duplicate Single Send\n  This endpoint allows you to duplicate an existing Single Send using its Single Send ID.\n \n  Duplicating a Single Send is useful when you want to create a Single Send but don't want to start from scratch. Once duplicated, you can update or edit the Single Send by making a PATCH request to the `/marketing/singlesends/{id}` endpoint.\n \n  If you leave the `name` field blank, your duplicate will be assigned the name of the Single Send it was copied from with the text “Copy of ” prepended to it. The `name` field length is limited to 100 characters, so the end of the new Single Send name, including “Copy of ”, will be trimmed if the name exceeds this limit."
  },
  "deleteMarketingSinglesendsIdSchedule": {
    "comment": "Delete Single Send Schedule",
    "doc": "Delete Single Send Schedule\n  This endpoint allows you to cancel a scheduled Single Send using a Single Send ID.\n \n  Making a DELETE request to this endpoint will cancel the scheduled sending of a Single Send. The request will not delete the Single Send itself. Deleting a Single Send can be done by passing a DELETE request to `/marketing/singlesends/{id}`."
  },
  "putMarketingSinglesendsIdSchedule": {
    "comment": "Schedule Single Send",
    "doc": "Schedule Single Send\n  This endpoint allows you to schedule a Single Send for future delivery using a Single Send ID.\n \n  To schedule a Single Send, you must pass a date string in ISO 8601 time format (yyyy-MM-ddTHH:mm:ssZ)  using the required `send_at` field. For example, the ISO 8601 format for 9:00 AM UTC on May 6, 2020 would be `2020-05-06T09:00:00Z`. You may also pass the string `\"now\"` to send the Single Send immediately."
  },
  "getallAutomationStats": {
    "comment": "Get All Automation Stats",
    "doc": "Get All Automation Stats\n  This endpoint allows you to retrieve stats for all your Automations.\n \n  By default, all of your Automations will be returned, but you can specify a selection by passing in a comma-separated list of Automation IDs as the value of the query string parameter `automation_ids`.\n \n  Responses are paginated. You can limit the number of responses returned per batch using the `page_size` query string parameter. The default is 50, but you specify a value between 1 and 100.\n \n  You can retrieve a specific page of responses with the `page_token` query string parameter."
  },
  "getAutomationsStatsExport": {
    "comment": "Export Automation Stats",
    "doc": "Export Automation Stats\n  This endpoint allows you to export Automation stats as CSV data.\n \n  You can specify one Automation or many: include as many Automation IDs as you need, separating them with commas, as the value of the `ids` query string paramter.\n \n  The data is returned as plain text response but in CSV format, so your application making the call can present the information in whatever way is most appropriate, or just save the data as a `.csv` file."
  },
  "getAutomationStat": {
    "comment": "Get Automation Stats by ID",
    "doc": "Get Automation Stats by ID\n  This endpoint allows you to retrieve stats for a single Automation using its ID.\n \n  Multiple Automation IDs can be retrieved using the \"Get All Automation Stats\" endpoint. Once you have an ID, this endpoint will return detailed stats for the single automation specified.\n \n  You may constrain the stats returned using the `start_date` and `end_date` query string parameters. You can also use the `group_by` and `aggregated_by` query string parameters to further refine the stats returned."
  },
  "getAutomationLinkStat": {
    "comment": "Get Automation Click Tracking Stats by ID",
    "doc": "Get Automation Click Tracking Stats by ID\n  This endpoint lets you retrieve click-tracking stats for a single Automation.\n \n  The stats returned list the URLs embedded in your Automation and the number of clicks each one received.\n \n  Responses are paginated. You can limit the number of responses returned per batch using the `page_size` query string parameter. The default is 50, but you specify a value between 1 and 100.\n \n  You can retrieve a specific page of responses with the `page_token` query string parameter."
  },
  "getallSinglesendStats": {
    "comment": "Get All Single Sends Stats",
    "doc": "Get All Single Sends Stats\n  This endpoint allows you to retrieve stats for all your Single Sends.\n \n  By default, all of your Single Sends will be returned, but you can specify a selection by passing in a comma-separated list of Single Send IDs as the value of the query string parameter `singlesend_ids`.\n \n  Responses are paginated. You can limit the number of responses returned per batch using the `page_size` query string parameter. The default is 50, but you specify a value between 1 and 100.\n \n  You can retrieve a specific page of responses with the `page_token` query string parameter."
  },
  "getSinglesendStatsExport": {
    "comment": "Export Single Send Stats",
    "doc": "Export Single Send Stats\n  This endpoint allows you to export Single Send stats as .CSV data.\n \n  You can specify one Single Send or many: include as many Single Send IDs as you need, separating them with commas, as the value of the `ids` query string paramter.\n \n  The data is returned as plain text response but in .CSV format, so your application making the call can present the information in whatever way is most appropriate, or just save the data as a .csv file."
  },
  "getSinglesendStat": {
    "comment": "Get Single Send Stats by ID",
    "doc": "Get Single Send Stats by ID\n  This endpoint allows you to retrieve stats for an individual Single Send using a Single Send ID.\n \n  Multiple Single Send IDs can be retrieved using the \"Get All Single Sends Stats\" endpoint. Once you have an ID, this endpoint will return detailed stats for the Single Send specified.\n \n  You may constrain the stats returned using the `start_date` and `end_date` query string parameters. You can also use the `group_by` and `aggregated_by` query string parameters to further refine the stats returned."
  },
  "getSinglesendLinkStat": {
    "comment": "Get Single Send Click Tracking Stats by ID",
    "doc": "Get Single Send Click Tracking Stats by ID\n  This endpoint lets you retrieve click-tracking stats for one Single Send.\n \n  The stats returned list the URLs embedded in the specified Single Send and the number of clicks each one received.\n \n  Responses are paginated. You can limit the number of responses returned per batch using the `page_size` query string parameter. The default is 50, but you specify a value between 1 and 100.\n \n  You can retrieve a specific page of responses with the `page_token` query string parameter."
  },
  "postMarketingTestSendEmail": {
    "comment": "Send a Test Marketing Email",
    "doc": "Send a Test Marketing Email\n  This endpoint allows you to send a test marketing email to a list of email addresses.\n \n  Before sending a marketing message, you can test it using this endpoint. You may specify up to 10 contacts in the `emails` request body field. You must also specify a `template_id` and include either a `from_address` or `sender_id`. You can manage your templates with the [Twilio SendGrid App](https://mc.sendgrid.com/dynamic-templates) or the [Transactional Templates API](https://sendgrid.api-docs.io/v3.0/transactional-templates).\n \n  > Please note that this endpoint works with Dynamic Transactional Templates only. Legacy Transactional Templates will not be delivered.\n \n  For more information about managing Dynamic Transactional Templates, see [How to Send Email with Dynamic Transactional Templates](https://sendgrid.com/docs/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates/).\n \n  You can also test your Single Sends in the [Twilio SendGrid Marketing Campaigns UI](https://mc.sendgrid.com/single-sends)."
  },
  "getMessages": {
    "comment": "Filter all messages",
    "doc": "Filter all messages\n  This is BETA functionality. You may not have access, and we reserve the right to change functionality without notice.\n \n  Filter all messages to search your Email Activity. All queries need to be [URL encoded](https://meyerweb.com/eric/tools/dencoder/), and have this format:\n \n  `query={query_type}=\"{query_content}\"`\n \n  encoded, this would look like this:\n \n  `query=type%3D%22query_content%22`\n \n  for example:\n \n  Filter by a specific email - `query=to_email%3D%22example%40example.com%22`\n \n  Filter by subject line - `query=subject%3d%22A%20Great%20Subject%22`\n \n  Full list of basic query types and examples:\n \n \n  | Filter query    | Unencoded Example (put this one into the try it out query - it'll automatically encode it for you) | Encoded Example (use this one in your code)                        |\n  |-----------------|----------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|\n  | msg_id          | msg_id=“filter0307p1las1-16816-5A023E36-1.0”                                                                               | msg_id%3D%22filter0307p1las1-16816-5A023E36-1.0%22           |\n  | from_email      | from_email=“testing@sendgrid.net”                                                                                          | from_email%3D%22testing%40sendgrid.net%22                    |\n  | subject         | subject=\"This is a subject test\"                                                                                      | subject%22This%20is%20a%20subject%20test%22                  |\n  | to_email        | to_email=\"example@example.com\"                                                                                       | to_email%3D%22example%40example.com%22                       |\n  | status          |                                                                                                                            | status%22processed%22                                        |\n  | template_id     |                                                                                                                            |                                                                    |\n  | asm_group_id    |                                                                                                                            |                                                                    |\n  | api_key_id      |                                                                                                                            |                                                                    |\n  | events          | status=\"processed\"                                                                                                   | status%3D%22processed%22                                     |\n  | originating_ip  |                                                                                                                            |                                                                    |\n  | categories      |                                                                                                                            |                                                                    |\n  | unique_args     |                                                                                                                            |                                                                    |\n  | outbound_ip     |                                                                                                                            |                                                                    |\n  | last_event_time | last_event_time=“2017-11-07T23:13:58Z”                                                                               | last_event_time%3D%E2%80%9C2017-11-07T23%3A13%3A58Z%E2%80%9D |\n  | clicks          | clicks=\"0\"                                                                                                           | clicks%3D%220%22                                             |\n \n  For information about building compound queries, and for the full query language functionality, see the [query language reference](https://docs.google.com/a/sendgrid.com/document/d/1fWoKTFNfg5UUsB6t9KuIcSo9CetKF_T0bGfWJ_gdPCs/edit?usp=sharing).\n \n  Coming soon, example compound queries: limit + to email + date"
  },
  "postV3MessagesDownload": {
    "comment": "Request CSV",
    "doc": "Request CSV\n  This is BETA functionality. You may not have access, and we reserve the right to change functionality without notice.\n \n  This request will kick off a backend process to generate a CSV file. Once generated, the worker will then send an email for the user download the file. The link will expire in 3 days.\n \n  The CSV fill contain the last 1 million messages. This endpoint will be rate limited to 1 request every 12 hours (rate limit may change).\n \n  This endpoint is similar to the GET Single Message endpoint - the only difference is that /download is added to indicate that this is a CSV download requests but the same query is used to determine what the CSV should contain."
  },
  "getV3MessagesDownloadDownloadUuid": {
    "comment": "Download CSV",
    "doc": "Download CSV\n  This endpoint will return a presigned URL that can be used to download the CSV that was requested from the \"Request a CSV\" endpoint."
  },
  "getV3MessagesMsgId": {
    "comment": "Filter messages by message ID",
    "doc": "Filter messages by message ID\n  This is BETA functionality. You may not have access, and we reserve the right to change functionality without notice.\n \n  Get all of the details about the specified message."
  },
  "getPartnerSettings": {
    "comment": "Returns a list of all partner settings.",
    "doc": "Returns a list of all partner settings.\n  This endpoint allows you to retrieve a list of all partner settings that you can enable.\n \n  Our partner settings allow you to integrate your SendGrid account with our partners to increase your SendGrid experience and functionality. For more information about our partners, and how you can begin integrating with them, please visit our [Partners documentation](https://sendgrid.com/docs/ui/account-and-settings/partners/)."
  },
  "getPartnerSettingsNewRelic": {
    "comment": "Returns all New Relic partner settings.",
    "doc": "Returns all New Relic partner settings.\n  This endpoint allows you to retrieve your current New Relic partner settings.\n \n  Our partner settings allow you to integrate your SendGrid account with our partners to increase your SendGrid experience and functionality. For more information about our partners, and how you can begin integrating with them, please visit our [Partners documentation](https://sendgrid.com/docs/ui/account-and-settings/partners/).\n \n  By integrating with New Relic, you can send your SendGrid email statistics to your New Relic Dashboard. If you enable this setting, your stats will be sent to New Relic every 5 minutes. You will need your New Relic License Key to enable this setting. For more information, please see our [SendGrid for New Relic documentation](https://sendgrid.com/docs/ui/analytics-and-reporting/tracking-stats-using-new-relic/)."
  },
  "patchPartnerSettingsNewRelic": {
    "comment": "Updates New Relic partner settings.",
    "doc": "Updates New Relic partner settings.\n  This endpoint allows you to update or change your New Relic partner settings.\n \n  Our partner settings allow you to integrate your SendGrid account with our partners to increase your SendGrid experience and functionality. For more information about our partners, and how you can begin integrating with them, please visit our [Partners documentation](https://sendgrid.com/docs/ui/account-and-settings/partners/).\n \n  By integrating with New Relic, you can send your SendGrid email statistics to your New Relic Dashboard. If you enable this setting, your stats will be sent to New Relic every 5 minutes. You will need your New Relic License Key to enable this setting. For more information, please see our [SendGrid for New Relic documentation](https://sendgrid.com/docs/ui/analytics-and-reporting/tracking-stats-using-new-relic/)."
  },
  "getScopes": {
    "comment": "Retrieve a list of scopes for which this user has access.",
    "doc": "Retrieve a list of scopes for which this user has access.\n  This endpoint returns a list of all scopes that this user has access to.\n \n  API Keys are used to authenticate with [SendGrid's v3 API](https://sendgrid.api-docs.io/v3.0/how-to-use-the-sendgrid-v3-api/api-authorization).\n \n  API Keys may be assigned certain permissions, or scopes, that limit which API endpoints they are able to access.\n \n  This endpoint returns all the scopes assigned to the key you use to authenticate with it. To retrieve the scopes assigned to another key, you can pass an API key ID to the \"Retrieve an existing API key\" endpoint.\n \n  For a more detailed explanation of how you can use API Key permissions, please visit our [API Keys documentation](https://sendgrid.com/docs/ui/account-and-settings/api-keys/)."
  },
  "getV3ScopesRequests": {
    "comment": "Retrieve access requests",
    "doc": "Retrieve access requests\n  This endpoint allows you to retrieve a list of all recent access requests.\n \n  The Response Header's `link` parameter will include pagination info."
  },
  "deleteV3ScopesRequestsRequestId": {
    "comment": "Deny access request",
    "doc": "Deny access request\n  This endpoint allows you to deny an attempt to access your account.\n \n  Note: Only teammate admins may delete a teammate's access request."
  },
  "patchV3ScopesRequestsApproveId": {
    "comment": "Approve access request",
    "doc": "Approve access request\n  This endpoint allows you to approve an access attempt.\n \n  Note: Only teammate admins may approve another teammate’s access request."
  },
  "getV3Senders": {
    "comment": "Get all Sender Identities",
    "doc": "Get all Sender Identities\n  This endpoint allows you to retrieve a list of all sender identities that have been created for your account."
  },
  "postSenders": {
    "comment": "Create a Sender Identity",
    "doc": "Create a Sender Identity\n  This endpoint allows you to create a new sender identity.\n \n  You may create up to 100 unique sender identities."
  },
  "deleteV3SendersSenderId": {
    "comment": "Delete a Sender Identity",
    "doc": "Delete a Sender Identity\n  This endoint allows you to delete one of your sender identities."
  },
  "getV3SendersSenderId": {
    "comment": "View a Sender Identity",
    "doc": "View a Sender Identity\n  This endpoint allows you to retrieve a specific sender identity."
  },
  "patchV3SendersSenderId": {
    "comment": "Update a Sender Identity",
    "doc": "Update a Sender Identity\n  This endpoint allows you to update a sender identity.\n \n  Updates to `from.email` require re-verification.\n \n  Partial updates are allowed, but fields that are marked as \"required\" in the POST (create) endpoint must not be nil if that field is included in the PATCH request."
  },
  "postV3SendersSenderIdResendVerification": {
    "comment": "Resend Sender Identity Verification",
    "doc": "Resend Sender Identity Verification\n  This enpdoint allows you to resend a sender identity verification email."
  },
  "postSsoCertificates": {
    "comment": "Create an SSO Certificate",
    "doc": "Create an SSO Certificate\n  This endpoint allows you to create an SSO certificate."
  },
  "deleteSsoCertificatesCertId": {
    "comment": "Delete an SSO Certificate",
    "doc": "Delete an SSO Certificate\n  This endpoint allows you to delete an SSO certificate.\n \n  You can retrieve a certificate's ID from the response provided by the \"Get All SSO Integrations\" endpoint."
  },
  "getSsoCertificatesCertId": {
    "comment": "Get an SSO Certificate",
    "doc": "Get an SSO Certificate\n  This endpoint allows you to retrieve an individual SSO certificate."
  },
  "patchSsoCertificatesCertId": {
    "comment": "Update SSO Certificate",
    "doc": "Update SSO Certificate\n  This endpoint allows you to update an existing certificate by ID.\n \n  You can retrieve a certificate's ID from the response provided by the \"Get All SSO Integrations\" endpoint."
  },
  "getSsoIntegrations": {
    "comment": "Get All SSO Integrations",
    "doc": "Get All SSO Integrations\n  This endpoint allows you to retrieve all SSO integrations tied to your Twilio SendGrid account.\n \n  The IDs returned by this endpoint can be used by the APIs additional endpoints to modify your SSO integrations."
  },
  "postSsoIntegrations": {
    "comment": "Create an SSO Integration",
    "doc": "Create an SSO Integration\n  This endpoint allows you to create an SSO integration."
  },
  "deleteSsoIntegrationsId": {
    "comment": "Delete an SSO Integration",
    "doc": "Delete an SSO Integration\n  This endpoint allows you to delete an IdP configuration by ID.\n \n  You can retrieve the IDs for your configurations from the response provided by the \"Get All SSO Integrations\" endpoint."
  },
  "getSsoIntegrationsId": {
    "comment": "Get an SSO Integration",
    "doc": "Get an SSO Integration\n  This endpoint allows you to retrieve an SSO integration by ID.\n \n  You can retrieve the IDs for your configurations from the response provided by the \"Get All SSO Integrations\" endpoint."
  },
  "patchSsoIntegrationsId": {
    "comment": "Update an SSO Integration",
    "doc": "Update an SSO Integration\n  This endpoint allows you to modify an exisiting SSO integration.\n \n  You can retrieve the IDs for your configurations from the response provided by the \"Get All SSO Integrations\" endpoint."
  },
  "getSsoIntegrationsIntegrationIdCertificates": {
    "comment": "Get All SSO Certificates by Integration",
    "doc": "Get All SSO Certificates by Integration\n  This endpoint allows you to retrieve all your IdP configurations by configuration ID.\n \n  The `integration_id` expected by this endpoint is the `id` returned in the response by the \"Get All SSO Integrations\" endpoint."
  },
  "postSsoTeammates": {
    "comment": "Create SSO Teammate",
    "doc": "Create SSO Teammate\n  This endpoint allows you to create an SSO Teammate.\n \n  The email provided for this user will also function as the Teammate’s username."
  },
  "patchSsoTeammatesUsername": {
    "comment": "Edit an SSO Teammate",
    "doc": "Edit an SSO Teammate\n  This endpoint allows you to modify an existing SSO Teammate.\n \n  To turn a teammate into an admin, the request body should contain the `is_admin` field set to `true`. Otherwise, set `is_admin` to false and pass in all the scopes that a teammate should have.\n \n  Only the parent user and Teammates with admin permissions can update another Teammate’s permissions. Admin users can only update permissions."
  },
  "getStats": {
    "comment": "Retrieve global email statistics",
    "doc": "Retrieve global email statistics\n  This endpoint allows you to retrieve all of your global email statistics between a given date range.\n \n  Parent accounts will see aggregated stats for their account and all subuser accounts. Subuser accounts will only see their own stats."
  },
  "getSubusers": {
    "comment": "List all Subusers",
    "doc": "List all Subusers\n  This endpoint allows you to retrieve a list of all of your subusers.\n \n  You can choose to retrieve specific subusers as well as limit the results that come back from the API."
  },
  "postSubusers": {
    "comment": "Create Subuser",
    "doc": "Create Subuser\n  This endpoint allows you to create a new subuser."
  },
  "getSubusersReputations": {
    "comment": "Retrieve Subuser Reputations",
    "doc": "Retrieve Subuser Reputations\n  This endpoint allows you to request the reputations for your subusers.\n \n  Subuser sender reputations give a good idea how well a sender is doing with regards to how recipients and recipient servers react to the mail that is being received. When a bounce, spam report, or other negative action happens on a sent email, it will affect your sender rating."
  },
  "getSubusersStats": {
    "comment": "Retrieve email statistics for your subusers.",
    "doc": "Retrieve email statistics for your subusers.\n  This endpoint allows you to retrieve the email statistics for the given subusers.\n \n  You may retrieve statistics for up to 10 different subusers by including an additional _subusers_ parameter for each additional subuser."
  },
  "getSubusersStatsMonthly": {
    "comment": "Retrieve monthly stats for all subusers",
    "doc": "Retrieve monthly stats for all subusers\n  This endpoint allows you to retrieve the monthly email statistics for all subusers over the given date range.\n \n  When using the `sort_by_metric` to sort your stats by a specific metric, you can not sort by the following metrics:\n  `bounce_drops`, `deferred`, `invalid_emails`, `processed`, `spam_report_drops`, `spam_reports`, or `unsubscribe_drops`."
  },
  "getSubusersStatsSums": {
    "comment": "Retrieve the totals for each email statistic metric for all subusers.",
    "doc": "Retrieve the totals for each email statistic metric for all subusers.\n  This endpoint allows you to retrieve the total sums of each email statistic metric for all subusers over the given date range."
  },
  "deleteSubusersSubuserName": {
    "comment": "Delete a subuser",
    "doc": "Delete a subuser\n  This endpoint allows you to delete a subuser.\n \n  This is a permanent action. Once deleted, a subuser cannot be retrieved."
  },
  "patchSubusersSubuserName": {
    "comment": "Enable/disable a subuser",
    "doc": "Enable/disable a subuser\n  This endpoint allows you to enable or disable a subuser."
  },
  "putSubusersSubuserNameIps": {
    "comment": "Update IPs assigned to a subuser",
    "doc": "Update IPs assigned to a subuser\n  This endpoint allows you update your subusers' assigned IP.\n \n  Each subuser should be assigned to an IP address from which all of this subuser's mail will be sent. Often, this is the same IP as the parent account, but each subuser can have one or more of their own IP addresses as well.\n \n  More information:\n \n   [How to request more IPs](https://sendgrid.com/docs/ui/account-and-settings/dedicated-ip-addresses/)\n   [Setup Reverse DNS](https://sendgrid.com/docs/ui/account-and-settings/how-to-set-up-reverse-dns/)"
  },
  "deleteSubusersSubuserNameMonitor": {
    "comment": "Delete monitor settings",
    "doc": "Delete monitor settings"
  },
  "getSubusersSubuserNameMonitor": {
    "comment": "Retrieve monitor settings for a subuser",
    "doc": "Retrieve monitor settings for a subuser"
  },
  "postSubusersSubuserNameMonitor": {
    "comment": "Create monitor settings",
    "doc": "Create monitor settings"
  },
  "putSubusersSubuserNameMonitor": {
    "comment": "Update Monitor Settings for a subuser",
    "doc": "Update Monitor Settings for a subuser"
  },
  "getSubusersSubuserNameStatsMonthly": {
    "comment": "Retrieve the monthly email statistics for a single subuser",
    "doc": "Retrieve the monthly email statistics for a single subuser\n  This endpoint allows you to retrive the monthly email statistics for a specific subuser.\n \n  When using the `sort_by_metric` to sort your stats by a specific metric, you can not sort by the following metrics:\n  `bounce_drops`, `deferred`, `invalid_emails`, `processed`, `spam_report_drops`, `spam_reports`, or `unsubscribe_drops`."
  },
  "deleteSuppressionBlocks": {
    "comment": "Delete blocks",
    "doc": "Delete blocks\n  This endpoint allows you to delete all email addresses on your blocks list.\n \n  There are two options for deleting blocked emails:\n \n  1. You can delete all blocked emails by setting `delete_all` to `true` in the request body.\n  2. You can delete a selection of blocked emails by specifying the email addresses in the `emails` array of the request body."
  },
  "getSuppressionBlocks": {
    "comment": "Retrieve all blocks",
    "doc": "Retrieve all blocks\n  This endpoint allows you to retrieve all email addresses that are currently on your blocks list."
  },
  "deleteSuppressionBlocksEmail": {
    "comment": "Delete a specific block",
    "doc": "Delete a specific block\n  This endpoint allows you to delete a specific email address from your blocks list."
  },
  "getSuppressionBlocksEmail": {
    "comment": "Retrieve a specific block",
    "doc": "Retrieve a specific block\n  This endpoint allows you to retrieve a specific email address from your blocks list."
  },
  "deleteSuppressionBounces": {
    "comment": "Delete bounces",
    "doc": "Delete bounces\n  This endpoint allows you to delete all emails on your bounces list.\n \n  There are two options for deleting bounced emails:\n \n  1. You can delete all bounced emails by setting `delete_all` to `true` in the request body.\n  2. You can delete a selection of bounced emails by specifying the email addresses in the `emails` array of the request body."
  },
  "getSuppressionBounces": {
    "comment": "Retrieve all bounces",
    "doc": "Retrieve all bounces\n  This endpoint allows you to retrieve all of your bounces."
  },
  "deleteSuppressionBouncesEmail": {
    "comment": "Delete a bounce",
    "doc": "Delete a bounce\n  This endpoint allows you to remove an email address from your bounce list."
  },
  "getSuppressionBouncesEmail": {
    "comment": "Retrieve a Bounce",
    "doc": "Retrieve a Bounce\n  This endpoint allows you to retrieve a specific bounce by email address."
  },
  "deleteSuppressionInvalidEmails": {
    "comment": "Delete invalid emails",
    "doc": "Delete invalid emails\n  This endpoint allows you to remove email addresses from your invalid email address list.\n \n  There are two options for deleting invalid email addresses:\n \n  1) You can delete all invalid email addresses by setting `delete_all` to true in the request body.\n  2) You can delete some invalid email addresses by specifying certain addresses in an array in the request body."
  },
  "getSuppressionInvalidEmails": {
    "comment": "Retrieve all invalid emails",
    "doc": "Retrieve all invalid emails\n  This endpoint allows you to retrieve a list of all invalid email addresses."
  },
  "deleteSuppressionInvalidEmailsEmail": {
    "comment": "Delete a specific invalid email",
    "doc": "Delete a specific invalid email\n  This endpoint allows you to remove a specific email address from the invalid email address list."
  },
  "getSuppressionInvalidEmailsEmail": {
    "comment": "Retrieve a specific invalid email",
    "doc": "Retrieve a specific invalid email\n  This endpoint allows you to retrieve a specific invalid email addresses."
  },
  "deleteSuppressionSpamReports": {
    "comment": "Delete spam reports",
    "doc": "Delete spam reports\n  This endpoint allows you to delete your spam reports.\n \n  Deleting a spam report will remove the suppression, meaning email will once again be sent to the previously suppressed address. This should be avoided unless a recipient indicates they wish to receive email from you again. You can use our [bypass filters](https://sendgrid.com/docs/ui/sending-email/index-suppressions/#bypass-suppressions) to deliver messages to otherwise suppressed addresses when exceptions are required.\n \n  There are two options for deleting spam reports:\n \n  1. You can delete all spam reports by setting the `delete_all` field to `true` in the request body.\n  2. You can delete a list of select spam reports by specifying the email addresses in the `emails` array of the request body."
  },
  "getSuppressionSpamReports": {
    "comment": "Retrieve all spam reports",
    "doc": "Retrieve all spam reports\n  This endpoint allows you to retrieve all spam reports."
  },
  "deleteSuppressionSpamReportsEmail": {
    "comment": "Delete a specific spam report",
    "doc": "Delete a specific spam report\n  This endpoint allows you to delete a specific spam report by email address.\n \n  Deleting a spam report will remove the suppression, meaning email will once again be sent to the previously suppressed address. This should be avoided unless a recipient indicates they wish to receive email from you again. You can use our [bypass filters](https://sendgrid.com/docs/ui/sending-email/index-suppressions/#bypass-suppressions) to deliver messages to otherwise suppressed addresses when exceptions are required."
  },
  "getSuppressionSpamReportsEmail": {
    "comment": "Retrieve a specific spam report",
    "doc": "Retrieve a specific spam report\n  This endpoint allows you to retrieve a specific spam report by email address."
  },
  "getSuppressionUnsubscribes": {
    "comment": "Retrieve all global suppressions",
    "doc": "Retrieve all global suppressions\n  This endpoint allows you to retrieve a list of all email address that are globally suppressed."
  },
  "getV3Teammates": {
    "comment": "Retrieve all teammates",
    "doc": "Retrieve all teammates\n  This endpoint allows you to retrieve a list of all current Teammates.\n \n  You can limit the number of results returned using the `limit` query paramater. To return results from a specific Teammate, use the `offset` paramter. The Response Headers will include pagination info."
  },
  "postV3Teammates": {
    "comment": "Invite teammate",
    "doc": "Invite teammate\n  This endpoint allows you to invite a Teammate to your account via email.\n \n  You can set a Teammate's initial permissions using the `scopes` array in the request body. Teammate's will receive a minimum set of scopes from Twilio SendGrid that are necessary for the Teammate to function.\n \n  Note: A teammate invite will expire after 7 days, but you may resend the invitation at any time to reset the expiration date."
  },
  "getV3TeammatesPending": {
    "comment": "Retrieve all pending teammates",
    "doc": "Retrieve all pending teammates\n  This endpoint allows you to retrieve a list of all pending Teammate invitations.\n \n  Each teammate invitation is valid for 7 days. Users may resend the invitation to refresh the expiration date."
  },
  "deleteV3TeammatesPendingToken": {
    "comment": "Delete pending teammate",
    "doc": "Delete pending teammate\n  This endpoint allows you to delete a pending teammate invite."
  },
  "postV3TeammatesPendingTokenResend": {
    "comment": "Resend teammate invite",
    "doc": "Resend teammate invite\n  This endpoint allows you to resend a Teammate invitation.\n \n  Teammate invitations will expire after 7 days. Resending an invitation will reset the expiration date."
  },
  "deleteV3TeammatesUsername": {
    "comment": "Delete teammate",
    "doc": "Delete teammate\n  This endpoint allows you to delete a teammate.\n \n  Only the parent user or an admin teammate can delete another teammate."
  },
  "getV3TeammatesUsername": {
    "comment": "Retrieve specific teammate",
    "doc": "Retrieve specific teammate\n  This endpoint allows you to retrieve a specific Teammate by username.\n \n  You can retrieve the username's for each of your Teammates using the \"Retrieve all Teammates\" endpoint."
  },
  "patchV3TeammatesUsername": {
    "comment": "Update teammate's permissions",
    "doc": "Update teammate's permissions\n  This endpoint allows you to update a teammate’s permissions.\n \n  To turn a teammate into an admin, the request body should contain an `is_admin` set to `true`. Otherwise, set `is_admin` to `false` and pass in all the scopes that a teammate should have.\n \n  Only the parent user or other admin teammates can update another teammate’s permissions.\n \n  Admin users can only update permissions."
  },
  "getTemplates": {
    "comment": "Retrieve paged transactional templates.",
    "doc": "Retrieve paged transactional templates.\n  This endpoint allows you to retrieve all transactional templates."
  },
  "postTemplates": {
    "comment": "Create a transactional template.",
    "doc": "Create a transactional template.\n  This endpoint allows you to create a transactional template."
  },
  "deleteTemplatesTemplateId": {
    "comment": "Delete a template.",
    "doc": "Delete a template.\n  This endpoint allows you to delete a transactional template."
  },
  "getTemplatesTemplateId": {
    "comment": "Retrieve a single transactional template.",
    "doc": "Retrieve a single transactional template.\n  This endpoint allows you to retrieve a single transactional template."
  },
  "patchTemplatesTemplateId": {
    "comment": "Edit a transactional template.",
    "doc": "Edit a transactional template.\n  This endpoint allows you to edit the name of a transactional template.\n \n  To edit the template itself, [create a new transactional template version](https://sendgrid.api-docs.io/v3.0/transactional-templates-versions/create-a-new-transactional-template-version)."
  },
  "postTemplatesTemplateId": {
    "comment": "Duplicate a transactional template.",
    "doc": "Duplicate a transactional template.\n  This endpoint allows you to duplicate a transactional template."
  },
  "postTemplatesTemplateIdVersions": {
    "comment": "Create a new transactional template version.",
    "doc": "Create a new transactional template version.\n  This endpoint allows you to create a new version of a template."
  },
  "deleteTemplatesTemplateIdVersionsVersionId": {
    "comment": "Delete a transactional template version.",
    "doc": "Delete a transactional template version.\n  This endpoint allows you to delete a transactional template version."
  },
  "getTemplatesTemplateIdVersionsVersionId": {
    "comment": "Retrieve a specific transactional template version.",
    "doc": "Retrieve a specific transactional template version.\n  This endpoint allows you to retrieve a specific version of a template."
  },
  "patchTemplatesTemplateIdVersionsVersionId": {
    "comment": "Edit a transactional template version.",
    "doc": "Edit a transactional template version.\n  This endpoint allows you to edit the content of your template version."
  },
  "postTemplatesTemplateIdVersionsVersionIdActivate": {
    "comment": "Activate a transactional template version.",
    "doc": "Activate a transactional template version.\n  This endpoint allows you to activate a version of one of your templates."
  },
  "getTrackingSettings": {
    "comment": "Retrieve Tracking Settings",
    "doc": "Retrieve Tracking Settings\n  This endpoint allows you to retrieve a list of all tracking settings on your account."
  },
  "getTrackingSettingsClick": {
    "comment": "Retrieve Click Track Settings",
    "doc": "Retrieve Click Track Settings\n  This endpoint allows you to retrieve your current click tracking setting.\n \n  Click Tracking overrides all the links and URLs in your emails and points them to either SendGrid’s servers or the domain with which you branded your link. When a customer clicks a link, SendGrid tracks those [clicks](https://sendgrid.com/docs/glossary/clicks/).\n \n  Click tracking helps you understand how users are engaging with your communications. SendGrid can track up to 1000 links per email"
  },
  "patchTrackingSettingsClick": {
    "comment": "Update Click Tracking Settings",
    "doc": "Update Click Tracking Settings\n  This endpoint allows you to enable or disable your current click tracking setting.\n \n  Click Tracking overrides all the links and URLs in your emails and points them to either SendGrid’s servers or the domain with which you branded your link. When a customer clicks a link, SendGrid tracks those [clicks](https://sendgrid.com/docs/glossary/clicks/).\n \n  Click tracking helps you understand how users are engaging with your communications. SendGrid can track up to 1000 links per email"
  },
  "getTrackingSettingsGoogleAnalytics": {
    "comment": "Retrieve Google Analytics Settings",
    "doc": "Retrieve Google Analytics Settings\n  This endpoint allows you to retrieve your current setting for Google Analytics.\n \n \n  Google Analytics helps you understand how users got to your site and what they're doing there. For more information about using Google Analytics, please refer to [Google’s URL Builder](https://support.google.com/analytics/answer/1033867?hl=en) and their article on [\"Best Practices for Campaign Building\"](https://support.google.com/analytics/answer/1037445).\n \n  We default the settings to Google’s recommendations. For more information, see [Google Analytics Demystified](https://sendgrid.com/docs/ui/analytics-and-reporting/google-analytics/)."
  },
  "patchTrackingSettingsGoogleAnalytics": {
    "comment": "Update Google Analytics Settings",
    "doc": "Update Google Analytics Settings\n  This endpoint allows you to update your current setting for Google Analytics.\n \n  Google Analytics helps you understand how users got to your site and what they're doing there. For more information about using Google Analytics, please refer to [Google’s URL Builder](https://support.google.com/analytics/answer/1033867?hl=en) and their article on [\"Best Practices for Campaign Building\"](https://support.google.com/analytics/answer/1037445).\n \n  We default the settings to Google’s recommendations. For more information, see [Google Analytics Demystified](https://sendgrid.com/docs/ui/analytics-and-reporting/google-analytics/)."
  },
  "getTrackingSettingsOpen": {
    "comment": "Get Open Tracking Settings",
    "doc": "Get Open Tracking Settings\n  This endpoint allows you to retrieve your current settings for open tracking.\n \n  Open Tracking adds an invisible image at the end of the email which can track email opens.\n \n  If the email recipient has images enabled on their email client, a request to SendGrid’s server for the invisible image is executed and an open event is logged.\n \n  These events are logged in the Statistics portal, Email Activity interface, and are reported by the Event Webhook."
  },
  "patchTrackingSettingsOpen": {
    "comment": "Update Open Tracking Settings",
    "doc": "Update Open Tracking Settings\n  This endpoint allows you to update your current settings for open tracking.\n \n  Open Tracking adds an invisible image at the end of the email which can track email opens.\n \n  If the email recipient has images enabled on their email client, a request to SendGrid’s server for the invisible image is executed and an open event is logged.\n \n  These events are logged in the Statistics portal, Email Activity interface, and are reported by the Event Webhook."
  },
  "getTrackingSettingsSubscription": {
    "comment": "Retrieve Subscription Tracking Settings",
    "doc": "Retrieve Subscription Tracking Settings\n  This endpoint allows you to retrieve your current settings for subscription tracking.\n \n  Subscription tracking adds links to the bottom of your emails that allows your recipients to subscribe to, or unsubscribe from, your emails."
  },
  "patchTrackingSettingsSubscription": {
    "comment": "Update Subscription Tracking Settings",
    "doc": "Update Subscription Tracking Settings\n  This endpoint allows you to update your current settings for subscription tracking.\n \n  Subscription tracking adds links to the bottom of your emails that allows your recipients to subscribe to, or unsubscribe from, your emails."
  },
  "getUserAccount": {
    "comment": "Get a user's account information.",
    "doc": "Get a user's account information.\n  This endpoint allows you to retrieve your user account details.\n \n  Your user's account information includes the user's account type and reputation."
  },
  "getUserCredits": {
    "comment": "Retrieve your credit balance",
    "doc": "Retrieve your credit balance\n  This endpoint allows you to retrieve the current credit balance for your account.\n \n  Each account has a credit balance, which is a base number of emails it can send before receiving per-email charges. For more information about credits and billing, see [Billing and Plan details information](https://sendgrid.com/docs/ui/account-and-settings/billing/)."
  },
  "getUserEmail": {
    "comment": "Retrieve your account email address",
    "doc": "Retrieve your account email address\n  This endpoint allows you to retrieve the email address currently on file for your account."
  },
  "putUserEmail": {
    "comment": "Update your account email address",
    "doc": "Update your account email address\n  This endpoint allows you to update the email address currently on file for your account."
  },
  "putUserPassword": {
    "comment": "Update your password",
    "doc": "Update your password\n  This endpoint allows you to update your password."
  },
  "getUserProfile": {
    "comment": "Get a user's profile",
    "doc": "Get a user's profile"
  },
  "patchUserProfile": {
    "comment": "Update a user's profile",
    "doc": "Update a user's profile\n  This endpoint allows you to update your current profile details.\n \n  Any one or more of the parameters can be updated via the PATCH `/user/profile` endpoint. You must include at least one when you PATCH."
  },
  "getUserScheduledSends": {
    "comment": "Retrieve all scheduled sends",
    "doc": "Retrieve all scheduled sends\n  This endpoint allows you to retrieve all cancelled and paused scheduled send information.\n \n  This endpoint will return only the scheduled sends that are associated with a `batch_id`. If you have scheduled a send using the `/mail/send` endpoint and the `send_at` field but no `batch_id`, the send will be scheduled for delivery; however, it will not be returned by this endpoint. For this reason, you should assign a `batch_id` to any scheduled send you may need to pause or cancel in the future."
  },
  "postUserScheduledSends": {
    "comment": "Cancel or pause a scheduled send",
    "doc": "Cancel or pause a scheduled send\n  This endpoint allows you to cancel or pause a scheduled send associated with a `batch_id`.\n \n  Passing this endpoint a `batch_id` and status will cancel or pause the scheduled send.\n \n  Once a scheduled send is set to `pause` or `cancel` you must use the \"Update a scheduled send\" endpoint to change its status or the \"Delete a cancellation or pause from a scheduled send\" endpoint to remove the status. Passing a status change to a scheduled send that has already been paused or cancelled will result in a `400` level status code.\n \n  If the maximum number of cancellations/pauses are added to a send, a `400` level status code will be returned."
  },
  "deleteUserScheduledSendsBatchId": {
    "comment": "Delete a cancellation or pause from a scheduled send",
    "doc": "Delete a cancellation or pause from a scheduled send\n  This endpoint allows you to delete the cancellation/pause of a scheduled send.\n \n  Scheduled sends cancelled less than 10 minutes before the scheduled time are not guaranteed to be cancelled."
  },
  "getUserScheduledSendsBatchId": {
    "comment": "Retrieve scheduled send",
    "doc": "Retrieve scheduled send\n  This endpoint allows you to retrieve the cancel/paused scheduled send information for a specific `batch_id`."
  },
  "patchUserScheduledSendsBatchId": {
    "comment": "Update a scheduled send",
    "doc": "Update a scheduled send\n  This endpoint allows you to update the status of a scheduled send for the given `batch_id`.\n \n  If you have already set a `cancel` or `pause` status on a scheduled send using the \"Cancel or pause a scheduled send\" endpoint, you can update it's status using this endpoint. Attempting to update a status once it has been set with the \"Cancel or pause a scheduled send\" endpoint will result in a `400` error."
  },
  "getUserSettingsEnforcedTls": {
    "comment": "Retrieve current Enforced TLS settings.",
    "doc": "Retrieve current Enforced TLS settings.\n  This endpoint allows you to retrieve your current Enforced TLS settings.\n \n  The Enforced TLS settings specify whether or not the recipient is required to support TLS or have a valid certificate.\n \n  If either `require_tls` or `require_valid_cert` is set to `true`, the recipient must support TLS 1.1 or higher or have a valid certificate. If these conditions are not met, Twilio SendGrid will drop the message and send a block event with “TLS required but not supported” as the description."
  },
  "patchUserSettingsEnforcedTls": {
    "comment": "Update Enforced TLS settings",
    "doc": "Update Enforced TLS settings\n  This endpoint allows you to update your Enforced TLS settings.\n \n  To require TLS from recipients, set `require_tls` to `true`. If either `require_tls` or `require_valid_cert` is set to `true`, the recipient must support TLS 1.1 or higher or have a valid certificate. If these conditions are not met, Twilio SendGrid will drop the message and send a block event with “TLS required but not supported” as the description.\n \n  > Twilio SendGrid supports TLS 1.1 and higher and does not support older versions of TLS due to security vulnerabilities."
  },
  "getUserUsername": {
    "comment": "Retrieve your username",
    "doc": "Retrieve your username\n  This endpoint allows you to retrieve your current account username."
  },
  "putUserUsername": {
    "comment": "Update your username",
    "doc": "Update your username\n  This endpoint allows you to update the username for your account."
  },
  "getUserWebhooksEventSettings": {
    "comment": "Retrieve Event Webhook settings",
    "doc": "Retrieve Event Webhook settings\n  This endpoint allows you to retrieve your current event webhook settings.\n \n  If an event type is marked as `true`, then the event webhook will include information about that event.\n \n  SendGrid’s Event Webhook will notify a URL of your choice via HTTP POST with information about events that occur as SendGrid processes your email.\n \n  Common uses of this data are to remove unsubscribes, react to spam reports, determine unengaged recipients, identify bounced email addresses, or create advanced analytics of your email program."
  },
  "patchUserWebhooksEventSettings": {
    "comment": "Update Event Notification Settings",
    "doc": "Update Event Notification Settings\n  This endpoint allows you to update your current event webhook settings.\n \n  If an event type is marked as `true`, then the event webhook will include information about that event.\n \n  SendGrid’s Event Webhook will notify a URL of your choice via HTTP POST with information about events that occur as SendGrid processes your email.\n \n  Common uses of this data are to remove unsubscribes, react to spam reports, determine unengaged recipients, identify bounced email addresses, or create advanced analytics of your email program."
  },
  "getUserWebhooksEventSettingsSigned": {
    "comment": "Retrieve Signed Webhook Public Key",
    "doc": "Retrieve Signed Webhook Public Key\n  This endpoint allows you to retrieve your signed webhook's public key.\n \n  Once you have enabled signing of the Event Webhook, you will need the public key provided to verify the signatures on requests coming from Twilio SendGrid. You can retrieve the public key from this endpoint at any time.\n \n  For more information about cryptographically signing the Event Webhook, see [Getting Started with the Event Webhook Security Features](https://sendgrid.com/docs/for-developers/tracking-events/getting-started-event-webhook-security-features)."
  },
  "patchUserWebhooksEventSettingsSigned": {
    "comment": "Enable/Disable Signed Webhook",
    "doc": "Enable/Disable Signed Webhook\n  This endpoint allows you to enable or disable signing of the Event Webhook.\n \n  This endpoint takes a single boolean request parameter, `enabled`. You may either enable or disable signing of the Event Webhook using this endpoint. Once enabled, you can retrieve your public key using the `/webhooks/event/settings/signed` endpoint.\n \n  For more information about cryptographically signing the Event Webhook, see [Getting Started with the Event Webhook Security Features](https://sendgrid.com/docs/for-developers/tracking-events/getting-started-event-webhook-security-features)."
  },
  "postUserWebhooksEventTest": {
    "comment": "Test Event Notification Settings",
    "doc": "Test Event Notification Settings\n  This endpoint allows you to test your event webhook by sending a fake event notification post to the provided URL.\n \n  SendGrid’s Event Webhook will notify a URL of your choice via HTTP POST with information about events that occur as SendGrid processes your email.\n \n  Common uses of this data are to remove unsubscribes, react to spam reports, determine unengaged recipients, identify bounced email addresses, or create advanced analytics of your email program.\n \n  >Tip: Retry logic for this endpoint differs from other endpoints, which use a rolling 24-hour retry.\n \n  If your web server does not return a 2xx response type, we will retry a POST request until we receive a 2xx response or the maximum time of 10 minutes has expired."
  },
  "getUserWebhooksParseSettings": {
    "comment": "Retrieve all parse settings",
    "doc": "Retrieve all parse settings\n  This endpoint allows you to retrieve all of your current inbound parse settings."
  },
  "postUserWebhooksParseSettings": {
    "comment": "Create a parse setting",
    "doc": "Create a parse setting\n  This endpoint allows you to create a new inbound parse setting.\n \n  Creating an Inbound Parse setting requires two pieces of information: a `url` and a `hostname`.\n \n  The `hostname` must correspond to a domain authenticated by Twilio SendGrid on your account. If you need to complete domain authentication, you can use the [Twilio SendGrid App](https://app.sendgrid.com/settings/sender_auth) or the \"Authenticate a domain\" endpoint. See \"[How to Set Up Domain Authentication](https://sendgrid.com/docs/ui/account-and-settings/how-to-set-up-domain-authentication/)\" for instructions.\n \n  Any email received by the `hostname` will be parsed when you complete this setup. You must also add a Twilio SendGrid MX record to this domain's DNS records. See \"[Setting up the Inbound Parse Webhook](https://sendgrid.com/docs/for-developers/parsing-email/setting-up-the-inbound-parse-webhook/)\" for full instructions.\n \n  The `url` represents a location where the parsed message data will be delivered. Twilio SendGrid will make an HTTP POST request to this `url` with the message data. The `url` must be publicly reachable, and your application must return a `200` status code to signal that the message data has been received."
  },
  "deleteUserWebhooksParseSettingsHostname": {
    "comment": "Delete a parse setting",
    "doc": "Delete a parse setting\n  This endpoint allows you to delete a specific inbound parse setting by hostname.\n \n  You can retrieve all your Inbound Parse settings and their associated host names with the \"Retrieve all parse settings\" endpoint."
  },
  "getUserWebhooksParseSettingsHostname": {
    "comment": "Retrieve a specific parse setting",
    "doc": "Retrieve a specific parse setting\n  This endpoint allows you to retrieve a specific inbound parse setting by hostname.\n \n  You can retrieve all your Inbound Parse settings and their associated host names with the \"Retrieve all parse settings\" endpoint."
  },
  "patchUserWebhooksParseSettingsHostname": {
    "comment": "Update a parse setting",
    "doc": "Update a parse setting\n  This endpoint allows you to update a specific inbound parse setting by hostname.\n \n  You can retrieve all your Inbound Parse settings and their associated host names with the \"Retrieve all parse settings\" endpoint."
  },
  "getUserWebhooksParseStats": {
    "comment": "Retrieves Inbound Parse Webhook statistics.",
    "doc": "Retrieves Inbound Parse Webhook statistics.\n  This endpoint allows you to retrieve the statistics for your Parse Webhook useage.\n \n  SendGrid's Inbound Parse Webhook allows you to parse the contents and attachments of incomming emails. The Parse API can then POST the parsed emails to a URL that you specify. The Inbound Parse Webhook cannot parse messages greater than 30MB in size, including all attachments.\n \n  There are a number of pre-made integrations for the SendGrid Parse Webhook which make processing events easy. You can find these integrations in the [Library Index](https://sendgrid.com/docs/Integrate/libraries.html#-Webhook-Libraries)."
  },
  "postValidationsEmail": {
    "comment": "Validate an email",
    "doc": "Validate an email\n  This endpoint allows you to validate an email address."
  },
  "getVerifiedSenders": {
    "comment": "Get All Verified Senders",
    "doc": "Get All Verified Senders\n  This endpoint allows you to retrieve all the Sender Identities associated with an account.\n \n  This endpoint will return both verified and unverified senders.\n \n  You can limit the number of results returned using the `limit`, `lastSeenID`, and `id` query string parameters.\n \n   `limit` allows you to specify an exact number of Sender Identities to return.\n   `lastSeenID` will return senders with an ID number occuring after the passed in ID. In other words, the `lastSeenID` provides a starting point from which SendGrid will iterate to find Sender Identities associated with your account.\n   `id` will return information about only the Sender Identity passed in the request."
  },
  "postVerifiedSenders": {
    "comment": "Create Verified Sender Request",
    "doc": "Create Verified Sender Request\n  This endpoint allows you to create a new Sender Identify.\n \n  Upon successful submission of a `POST` request to this endpoint, an identity will be created, and a verification email will be sent to the address assigned to the `from_email` field. You must complete the verification process using the sent email to fully verify the sender.\n \n  If you need to resend the verification email, you can do so with the Resend Verified Sender Request, `/resend/{id}`, endpoint.\n \n  If you need to authenticate a domain rather than a Single Sender, see the [Domain Authentication API](https://sendgrid.api-docs.io/v3.0/domain-authentication/authenticate-a-domain)."
  },
  "getVerifiedSendersDomains": {
    "comment": "Domain Warn List",
    "doc": "Domain Warn List\n  This endpoint returns a list of domains known to implement DMARC and categorizes them by failure type — hard failure or soft failure.\n \n  Domains listed as hard failures will not deliver mail when used as a [Sender Identity](https://sendgrid.com/docs/for-developers/sending-email/sender-identity/) due to the domain's DMARC policy settings.\n \n  For example, using a `yahoo.com` email address as a Sender Identity will likely result in the rejection of your mail. For more information about DMARC, see [Everything about DMARC](https://sendgrid.com/docs/ui/sending-email/dmarc/)."
  },
  "postVerifiedSendersResendId": {
    "comment": "Resend Verified Sender Request",
    "doc": "Resend Verified Sender Request\n  This endpoint allows you to resend a verification email to a specified Sender Identity.\n \n  Passing the `id` assigned to a Sender Identity to this endpoint will resend a verification email to the `from_address` associated with the Sender Identity. This can be useful if someone loses their verification email or needs to have it resent for any other reason.\n \n  You can retrieve the IDs associated with Sender Identities by passing a \"Get All Verified Senders\" endpoint."
  },
  "getVerifiedSendersStepsCompleted": {
    "comment": "Completed Steps",
    "doc": "Completed Steps\n  This endpoint allows you to determine which of SendGrid’s verification processes have been completed for an account.\n \n  This endpoint returns boolean values, `true` and `false`, for [Domain Authentication](https://sendgrid.com/docs/for-developers/sending-email/sender-identity/#domain-authentication), `domain_verified`, and [Single Sender Verification](https://sendgrid.com/docs/for-developers/sending-email/sender-identity/#single-sender-verification), `sender_verified`, for the account.\n \n  An account may have one, both, or neither verification steps completed. If you need to authenticate a domain rather than a Single Sender, see the \"Authenticate a domain\" endpoint."
  },
  "getVerifiedSendersVerifyToken": {
    "comment": "Verify Sender Request",
    "doc": "Verify Sender Request\n  This endpoint allows you to verify a sender requests.\n \n  The token is generated by SendGrid and included in a verification email delivered to the address that's pending verification."
  },
  "deleteVerifiedSendersId": {
    "comment": "Delete Verified Sender",
    "doc": "Delete Verified Sender\n  This endpoint allows you to delete a Sender Identity.\n \n  Pass the `id` assigned to a Sender Identity to this endpoint to delete the Sender Identity from your account.\n \n  You can retrieve the IDs associated with Sender Identities using the \"Get All Verified Senders\" endpoint."
  },
  "patchVerifiedSendersId": {
    "comment": "Edit Verified Sender",
    "doc": "Edit Verified Sender\n  This endpoint allows you to update an existing Sender Identity.\n \n  Pass the `id` assigned to a Sender Identity to this endpoint as a path parameter. Include any fields you wish to update in the request body in JSON format.\n \n  You can retrieve the IDs associated with Sender Identities by passing a `GET` request to the Get All Verified Senders endpoint, `/verified_senders`.\n \n  Note: Unlike a `PUT` request, `PATCH` allows you to update only the fields you wish to edit. Fields that are not passed as part of a request will remain unaltered."
  },
  "postWhitelabelDnsEmail": {
    "comment": "Email DNS records to a co-worker",
    "doc": "Email DNS records to a co-worker\n  This endpoint is used to share DNS records with a colleagues\n \n  Use this endpoint to send SendGrid-generated DNS record information to a co-worker so they can enter it into your DNS provider to validate your domain and link branding.\n \n  What type of records are sent will depend on whether you have chosen Automated Security or not. When using Automated Security, SendGrid provides you with three CNAME records. If you turn Automated Security off, you are instead given TXT and MX records.\n \n  If you pass a `link_id` to this endpoint, the generated email will supply the DNS records necessary to complete [Link Branding](https://sendgrid.com/docs/ui/account-and-settings/how-to-set-up-link-branding/) setup. If you pass a `domain_id` to this endpoint, the generated email will supply the DNS records needed to complete [Domain Authentication](https://sendgrid.com/docs/ui/account-and-settings/how-to-set-up-domain-authentication/). Passing both IDs will generate an email with the records needed to complete both setup steps.\n \n  You can retrieve all your domain IDs from the returned `id` fields for each domain using the \"List all authenticated domains\" endpoint. You can retrieve all of your link IDs using the \"Retrieve all branded links\" endpoint."
  },
  "getWhitelabelDomains": {
    "comment": "List all authenticated domains",
    "doc": "List all authenticated domains\n  This endpoint allows you to retrieve a list of all domains you have authenticated."
  },
  "postWhitelabelDomains": {
    "comment": "Authenticate a domain",
    "doc": "Authenticate a domain\n  This endpoint allows you to authenticate a domain.\n \n  If you are authenticating a domain for a subuser, you have two options:\n  1. Use the \"username\" parameter. This allows you to authenticate a domain on behalf of your subuser. This means the subuser is able to see and modify the authenticated domain.\n  2. Use the Association workflow (see Associate Domain section). This allows you to authenticate a domain created by the parent to a subuser. This means the subuser will default to the assigned domain, but will not be able to see or modify that authenticated domain. However, if the subuser authenticates their own domain it will overwrite the assigned domain."
  },
  "getWhitelabelDomainsDefault": {
    "comment": "Get the default authentication",
    "doc": "Get the default authentication\n  This endpoint allows you to retrieve the default authentication for a domain.\n \n  When creating or updating a domain authentication, you can set the domain as a default. The default domain will be used to send all mail. If you have multiple authenticated domains, the authenticated domain matching the domain of the From address will be used, and the default will be overridden.\n \n  This endpoint will return a default domain and its details only if a default is set. You are not required to set a default. If you do not set a default domain, this endpoint will return general information about your domain authentication status."
  },
  "deleteWhitelabelDomainsSubuser": {
    "comment": "Disassociate an authenticated domain from a given user.",
    "doc": "Disassociate an authenticated domain from a given user.\n  This endpoint allows you to disassociate a specific authenticated domain from a subuser.\n \n  Authenticated domains can be associated with (i.e. assigned to) subusers from a parent account. This functionality allows subusers to send mail using their parent's domain authentication. To associate an authenticated domain with a subuser, the parent account must first authenticate and validate the domain. The parent may then associate the authenticated domain via the subuser management tools."
  },
  "getWhitelabelDomainsSubuser": {
    "comment": "List the authenticated domain associated with the given user.",
    "doc": "List the authenticated domain associated with the given user.\n  This endpoint allows you to retrieve all of the authenticated domains that have been assigned to a specific subuser.\n \n  Authenticated domains can be associated with (i.e. assigned to) subusers from a parent account. This functionality allows subusers to send mail using their parent's domain authentication. To associate an authenticated domain with a subuser, the parent account must first authenticate and validate the domain. The parent may then associate the authenticated domain via the subuser management tools."
  },
  "deleteWhitelabelDomainsDomainId": {
    "comment": "Delete an authenticated domain.",
    "doc": "Delete an authenticated domain.\n  This endpoint allows you to delete an authenticated domain."
  },
  "getWhitelabelDomainsDomainId": {
    "comment": "Retrieve an authenticated domain",
    "doc": "Retrieve an authenticated domain\n  This endpoint allows you to retrieve a specific authenticated domain."
  },
  "patchWhitelabelDomainsDomainId": {
    "comment": "Update an authenticated domain",
    "doc": "Update an authenticated domain\n  This endpoint allows you to update the settings for an authenticated domain."
  },
  "postWhitelabelDomainsDomainIdSubuser": {
    "comment": "Associate an authenticated domain with a given user.",
    "doc": "Associate an authenticated domain with a given user.\n  This endpoint allows you to associate a specific authenticated domain with a subuser.\n \n  Authenticated domains can be associated with (i.e. assigned to) subusers from a parent account. This functionality allows subusers to send mail using their parent's domain authentication. To associate an authenticated domain with a subuser, the parent account must first authenticate and validate the domain. The parent may then associate the authenticated domain via the subuser management tools."
  },
  "postWhitelabelDomainsIdIps": {
    "comment": "Add an IP to an authenticated domain",
    "doc": "Add an IP to an authenticated domain\n  This endpoint allows you to add an IP address to an authenticated domain."
  },
  "deleteWhitelabelDomainsIdIpsIp": {
    "comment": "Remove an IP from an authenticated domain.",
    "doc": "Remove an IP from an authenticated domain.\n  This endpoint allows you to remove an IP address from that domain's authentication."
  },
  "postWhitelabelDomainsIdValidate": {
    "comment": "Validate a domain authentication.",
    "doc": "Validate a domain authentication.\n  This endpoint allows you to validate an authenticated domain. If it fails, it will return an error message describing why the domain could not be validated."
  },
  "getWhitelabelIps": {
    "comment": "Retrieve all reverse DNS records",
    "doc": "Retrieve all reverse DNS records\n  This endpoint allows you to retrieve all of the Reverse DNS records created by this account.\n \n  You may include a search key by using the `ip` query string parameter. This enables you to perform a prefix search for a given IP segment (e.g., `?ip=\"192.\"`).\n \n  Use the `limit` query string parameter to reduce the number of records returned. All records will be returned if you have fewer records than the specified limit.\n \n  The `offset` query string parameter allows you to specify a non-zero index from which records will be returned. For example, if you have ten records, `?offset=5` will return the last five records (at indexes 5 through 9). The list starts at index zero."
  },
  "postWhitelabelIps": {
    "comment": "Set up reverse DNS",
    "doc": "Set up reverse DNS\n  This endpoint allows you to set up reverse DNS."
  },
  "deleteWhitelabelIpsId": {
    "comment": "Delete a reverse DNS record",
    "doc": "Delete a reverse DNS record\n  This endpoint allows you to delete a reverse DNS record.\n \n  A call to this endpoint will respond with a 204 status code if the deletion was successful.\n \n  You can retrieve the IDs associated with all your reverse DNS records using the \"Retrieve all reverse DNS records\" endpoint."
  },
  "getWhitelabelIpsId": {
    "comment": "Retrieve a reverse DNS record",
    "doc": "Retrieve a reverse DNS record\n  This endpoint allows you to retrieve a reverse DNS record.\n \n  You can retrieve the IDs associated with all your reverse DNS records using the \"Retrieve all reverse DNS records\" endpoint."
  },
  "postWhitelabelIpsIdValidate": {
    "comment": "Validate a reverse DNS record",
    "doc": "Validate a reverse DNS record\n  This endpoint allows you to validate a reverse DNS record.\n \n  Always check the `valid` property of the response’s `validation_results.a_record` object. This field will indicate whether it was possible to validate the reverse DNS record. If the `validation_results.a_record.valid` is `false`, this indicates only that Twilio SendGrid could not determine the validity your reverse DNS record — it may still be valid.\n \n  If validity couldn’t be determined, you can check the value of `validation_results.a_record.reason` to find out why.\n \n  You can retrieve the IDs associated with all your reverse DNS records using the \"Retrieve all reverse DNS records\" endpoint."
  },
  "getWhitelabelLinks": {
    "comment": "Retrieve all branded links",
    "doc": "Retrieve all branded links\n  This endpoint allows you to retrieve all branded links.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "postWhitelabelLinks": {
    "comment": "Create a branded link",
    "doc": "Create a branded link\n  This endpoint allows you to create a new branded link.\n \n  To create the link branding, supply the root domain and, optionally, the subdomain — these go into separate fields in your request body. The root domain should match your FROM email address. If you provide a  subdomain, it must be different from the subdomain you used for authenticating your domain.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "getWhitelabelLinksDefault": {
    "comment": "Retrieve the default branded link",
    "doc": "Retrieve the default branded link\n  This endpoint allows you to retrieve the default branded link.\n \n  The default branded link is the actual URL to be used when sending messages. If you have more than one branded link, the default is determined by the following order:\n \n   The validated branded link marked as `default` (set when you call the \"Create a branded link\" endpoint or by calling the \"Update a branded link\" endpoint on an existing link)\n   Legacy branded links (migrated from the whitelabel wizard)\n   Default SendGrid-branded links (i.e., `100.ct.sendgrid.net`)\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "deleteWhitelabelLinksSubuser": {
    "comment": "Disassociate a branded link from a subuser",
    "doc": "Disassociate a branded link from a subuser\n  This endpoint allows you to take a branded link away from a subuser.\n \n  Link branding can be associated with subusers from the parent account. This functionality allows subusers to send mail using their parent's link branding. To associate link branding, the parent account must first create a branded link and validate it. The parent may then associate that branded link with a subuser via the API or the [Subuser Management page of the Twilio SendGrid App](https://app.sendgrid.com/settings/subusers).\n \n  Your request will receive a response with a 204 status code if the disassociation was successful."
  },
  "getWhitelabelLinksSubuser": {
    "comment": "Retrieve a subuser's branded link",
    "doc": "Retrieve a subuser's branded link\n  This endpoint allows you to retrieve the branded link associated with a subuser.\n \n  Link branding can be associated with subusers from the parent account. This functionality allows subusers to send mail using their parent's link branding. To associate link branding, the parent account must first create a branded link and then validate it. The parent may then associate that branded link with a subuser via the API or the [Subuser Management page of the Twilio SendGrid App](https://app.sendgrid.com/settings/subusers)."
  },
  "deleteWhitelabelLinksId": {
    "comment": "Delete a branded link",
    "doc": "Delete a branded link\n  This endpoint allows you to delete a branded link.\n \n  Your request will receive a response with a 204 status code if the deletion was successful. The call does not return the link's details, so if you wish to record these make sure you call the  \"Retrieve a branded link\" endpoint before you request its deletion.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "getWhitelabelLinksId": {
    "comment": "Retrieve a branded link",
    "doc": "Retrieve a branded link\n  This endpoint allows you to retrieve a specific branded link by providing its ID.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "patchWhitelabelLinksId": {
    "comment": "Update a branded link",
    "doc": "Update a branded link\n  This endpoint allows you to update a specific branded link. You can use this endpoint to change a branded link's default status.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "postWhitelabelLinksIdValidate": {
    "comment": "Validate a branded link",
    "doc": "Validate a branded link\n  This endpoint allows you to validate a branded link.\n \n  You can submit this request as one of your subusers if you include their ID in the `on-behalf-of` header in the request."
  },
  "postWhitelabelLinksLinkIdSubuser": {
    "comment": "Associate a branded link with a subuser",
    "doc": "Associate a branded link with a subuser\n  This endpoint allows you to associate a branded link with a subuser account.\n \n  Link branding can be associated with subusers from the parent account. This functionality allows subusers to send mail using their parent's link branding. To associate link branding, the parent account must first create a branded link and validate it. The parent may then associate that branded link with a subuser via the API or the [Subuser Management page of the Twilio SendGrid App](https://app.sendgrid.com/settings/subusers)."
  }
}