export const comments = {
  "accounts": {
    "comment": "List sub accounts",
    "doc": "List sub accounts\n  List all the sub accounts that have been created by a master account.<br><br>Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts. Email the partner programs team at partner-success@zoom.us for more details.\n \n  <br>Prerequisites:<br>\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope: `account:read:admin`\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "accountCreate": {
    "comment": "Create a sub account",
    "doc": "Create a sub account\n  Create a sub account under a master account. Your account must be a master account in order to create sub accounts.\n  <br><br>Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts. Email the partner programs team at partner-success@zoom.us. for more details. Please note that the created account user will receive a confirmation email.<br><br>\n  <br>\n  Prerequisites:<br>\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope: `account:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "accountDisassociate": {
    "comment": "Disassociate a sub account",
    "doc": "Disassociate a sub account\n  Disassociate a sub account from its master account. This will leave the sub account intact but it will no longer be associated with the master account.<br>\n \n  Prerequisites:\n   Pro or a higher paid account with master account option enabled. <br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis).<br><br>\n \n \n  Scope: `account:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "account": {
    "comment": "Get sub account details",
    "doc": "Get sub account details\n  Get details of a sub account that is listed under a master account. Your account must be a master account in order to retrieve sub accounts' details. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and create sub accounts. Email the partner programs team at partner-success@zoom.us for more details.\n \n  Prerequisites:\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope: `account:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "accountBilling": {
    "comment": "Get billing information",
    "doc": "Get billing information\n  Get [billing information](https://support.zoom.us/hc/en-us/articles/201363263-About-Billing) of a sub account.<br><br>Only master accounts can use this API. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' billing information. Email the partner programs team at partner-success@zoom.us for more details.<br>\n \n  Prerequisites:\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope:`billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "accountBillingUpdate": {
    "comment": "Update billing information",
    "doc": "Update billing information\n  Update [billing information](https://support.zoom.us/hc/en-us/articles/201363263-About-Billing) of a sub account.<br><br>\n  This API can only be used by master accounts that pay all billiing charges of their associated sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' billing information. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n \n  Prerequisites:\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope:`billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "accountBillingInvoices": {
    "comment": "List billing invoices",
    "doc": "List billing invoices\n  List [invoices](https://support.zoom.us/hc/en-us/articles/207276556-Viewing-your-invoice-history#h_6710542f-23cc-4059-9cc7-ff02bec7314e) of a Zoom account.\n \n  To list a regular Zoom account's invoices or a master account's invoices, provide `me` as the value of the `accountId` path parameter. To list a sub account's invoices, provide the account ID of the sub account in the `accountId` path parameter.\n \n  Prerequisites:\n   Account must be enrolled in Pro or a higher plan.<br>\n \n  Scope:`billing:master`<br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Additional Rate Limit: You can make one API request per account(`accountId`) every five minutes until the daily limit is reached. This API has a daily limit of 6 requests per account(`accountId`)."
  },
  "getAccountBillingInvoice": {
    "comment": "Get invoice details",
    "doc": "Get invoice details\n  Get detailed information about a specific [invoice](https://support.zoom.us/hc/en-us/articles/207276556-Viewing-your-invoice-history#h_6710542f-23cc-4059-9cc7-ff02bec7314e). <br>To retrieve a regular Zoom account's invoice details or a master account's invoice details, provide `me` as the value of `accountId` path parameter. To list a sub account's invoice details, provide the account ID of the sub account in the `accountId` path parameter.\n \n  Prerequisites:\n   Account must be enrolled in Pro or a higher plan. <br>\n \n  Scope:`billing:master`<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Additional Rate Limit: You can make one API request every thirty minutes until the daily limit is reached. This API has a daily limit of 100 requests per account."
  },
  "getAccountLockSettings": {
    "comment": "Get locked settings",
    "doc": "Get locked settings\n  [Account Locked Settings](https://support.zoom.us/hc/en-us/articles/115005269866) allow you turn settings on or off for all users in your account. No user except the account admin or account owner can change these settings. With lock settings, you force the settings on for all users.\n  Use this API to retrieve an account's locked settings.\n \n  Note: This API can be used by Zoom Accounts that are on a Pro or a higher plan as well accounts that have master and sub accounts options enabled. <br><br>\n  Prerequisites:\n   Pro or a higher paid account. <br>\n \n  Scope: `account:read:admin`.\n  <br> [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n \n \n \n \n \n  Scope: account:read:admin"
  },
  "updateAccountLockSettings": {
    "comment": "Update locked settings",
    "doc": "Update locked settings\n  [Account Locked Settings](https://support.zoom.us/hc/en-us/articles/115005269866) allow you turn settings on or off for all users in your account. No user except the account admin or account owner can change these settings. With lock settings, you force the settings on for all users. Use this API to update an account's locked settings.\n \n  Note: This API can be used by Zoom Accounts that are on a Pro or a higher plan as well accounts that have master and sub accounts options enabled.<br><br>\n  Prerequisites:<br>\n   Pro or a higher paid account. <br>\n \n  Scope: `account:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "accountManagedDomain": {
    "comment": "Get managed domains",
    "doc": "Get managed domains\n  Get a sub account's [managed domains](https://support.zoom.us/hc/en-us/articles/203395207-What-is-Managed-Domain-).<br><br>\n \n  Note: This API can be used by Zoom Accounts that are on a Pro or a higher plan as well accounts that have master and sub accounts options enabled. <br><br>\n  To get managed domains of the master account, provide `me` as the value for accountId in the path parameter. Provide the sub account's Account ID as the value of accountId path parameter to get managed domains of the sub account.<br><br>\n  Prerequisites:<br>\n   Pro or a higher paid account with master account option enabled. <br>\n \n  Scope: `account:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "accountOptionsUpdate": {
    "comment": "Update options",
    "doc": "Update options\n  Update a sub account's options under the master account.<br> <aside>Your account must be a master account in order to update the options for sub accounts. Zoom only assigns this privilege to trusted partners. </aside>\n \n  Prerequisites:\n   Pro or a higher paid account with master account option enabled.\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis).<br><br>\n \n  Scope: `account:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "updateAccountOwner": {
    "comment": "Update the account owner",
    "doc": "Update the account owner\n  The current account owner can [change the owner of an account](https://support.zoom.us/hc/en-us/articles/115005686983-Change-Account-Owner) to another user on the same account.<br> Use this API to change the owner of a sub account.\n \n  Prerequisites: <br>\n   Account owner or admin permissions of an account.\n   The account making this API request must be on a pro or a hiigher plan with [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) privilege.<br><br>\n \n  Scopes:  `account:write:admin` or `account:master`<br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n \n \n  <br>"
  },
  "updatePhoneSettings": {
    "comment": "Update BYOC settings",
    "doc": "Update BYOC settings\n  Only [master account owners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) can use this API to enable BYOC(Bring your own carrier) option for a sub account.<br>\n \n  Scope:<br>\n   `phone:master` <br>\n \n  Prerequisites: <br>\n   Business or enterprise Account.<br>"
  },
  "setUpAccount": {
    "comment": "Set up a Zoom Phone account",
    "doc": "Set up a Zoom Phone account\n  After assigning a Zoom phone license to an account, an admin or account owner can proceed with the [initial Zoom phone set up](https://support.zoom.us/hc/en-us/articles/360001297663-Getting-started-with-Zoom-Phone-admin-#h_5ae26a3a-290c-4a8d-b3b0-6384ed267b13) using this API.\n \n  Scope:<br>\n   `phone:write:admin` `phone:write`\n \n  Prerequisites: <br>\n   Pro or a higher paid account with master account option enabled.\n \n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "postPhoneSipTrunk": {
    "comment": "Assign SIP trunks",
    "doc": "Assign SIP trunks\n  Using this API, a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) owner can assign SIP trunk(s) to a sub account.<br>\n \n  Scope:<br>\n   `phone:master` <br>\n \n  Prerequisites:<br>\n   Business or enterprise Account.<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "updatePhoneSipTrunk": {
    "comment": "Update SIP trunk details",
    "doc": "Update SIP trunk details\n  Update details of a SIP trunk that is assigned to a sub account.<br>\n \n  Scope:<br>\n   `phone:master` <br>\n \n  Prerequisites:<br>\n  Business or Enterprise Account.<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "accountPlans": {
    "comment": "Get plan Information",
    "doc": "Get plan Information\n  Get plan information of a sub account that is managed by a master account. <br><br>This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' billing information. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n  Scopes: `billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "accountPlanCreate": {
    "comment": "Subscribe plans",
    "doc": "Subscribe plans\n  Subscribe a sub account to a Zoom plan using your master account. This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n  Scopes: `billing:master`<br>"
  },
  "accountPlanAddonCreate": {
    "comment": "Subscribe additional plan",
    "doc": "Subscribe additional plan\n  Subscribe a sub account to a Zoom addon plan. This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n  <br>Prerequisites:<br>\n   Pro or a higher plan with master account option enabled.\n   The sub account must be a paid account. The billing charges for the sub account must be paid by its master account.<br><br>\n \n  Scopes: `billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "accountPlanAddonUpdate": {
    "comment": "Update an additional plan",
    "doc": "Update an additional plan\n  Update an additional plan for a sub account.\n \n  This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n  <br>Prerequisites:<br>\n   Pro or a higher plan with master account enabled.\n   The sub account must be a paid account. The billing charges for the sub account must be paid by the master account.<br><br>\n \n  Scopes: `billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "accountPlanAddonCancel": {
    "comment": "Cancel additional plans",
    "doc": "Cancel additional plans\n  [Cancel additional plan](https://support.zoom.us/hc/en-us/articles/203634215-How-Do-I-Cancel-My-Subscription-) of a sub account. The cancellation does not provide refund for the current subscription. The service remains active for the current session.\n \n  This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n \n  Prerequisites:<br>\n   Pro or a higher plan with master account option enabled.\n   The sub account must be a paid account.<br>\n  Scope: `billing:master`<br>"
  },
  "accountPlanBaseUpdate": {
    "comment": "Update a base plan",
    "doc": "Update a base plan\n  Update a base plan of a sub account.\n \n  This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n  Scopes: `billing:master`<br><br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   The sub account must have a Pro or a higher plan."
  },
  "accountPlanBaseDelete": {
    "comment": "Cancel a base plan",
    "doc": "Cancel a base plan\n  [Cancel a base plan](https://support.zoom.us/hc/en-us/articles/203634215-How-Do-I-Cancel-My-Subscription-) for a sub account.\n \n  This API can only be used by master accounts that pay all billiing charges of their associated Pro or higher sub accounts. Zoom allows only [approved partners](https://marketplace.zoom.us/docs/api-reference/master-account-apis) to use master APIs and manage sub accounts' subscriptions. Email the partner programs team at partner-success@zoom.us for more details.<br><br>\n \n  Scopes: `billing:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   The sub account must have a Pro or a higher plan."
  },
  "getPlanUsage": {
    "comment": "Get plan usage",
    "doc": "Get plan usage\n  Get information on usage of [plans](https://marketplace.zoom.us/docs/api-reference/other-references/plans) of an account. This API supports regular accounts as well as master and sub accounts. To get plan usage of a regular account, use the `account:read:admin` scope and provide “me” as the value of the  `accountId` path parameter.To get plan usage of a master account, provide the keyword \"me\" as the value of the `accountId` path parameter and use the `billing:master` scope. To get plan usage of a sub account, provide the actual account Id of the sub account as the value of the `accountId` path parameter and use the `billing:master` scope.\n \n  Prerequisite:<br>\n  Account type: master account on a paid Pro, Business or Enterprise plan.<br>\n  Scope: `billing:master` for master and sub accounts. `account:read:admin` for regular Zoom accounts.<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "getAccountCloudRecording": {
    "comment": "List recordings of an account",
    "doc": "List recordings of an account\n  List [Cloud Recordings](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording) available on an Account.\n \n  > To access a password protected cloud recording, add an \"access_token\" parameter to the download URL and provide [JWT](https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-jwt-app) as the value of the \"access_token\".\n  <br>\n  Prerequisites:<br>\n   A Pro or a higher paid plan with Cloud Recording option enabled.<br>\n  Scopes: `recording:read:admin` or `account:read:admin`\n \n  If the scope `recording:read:admin` is used, the Account ID of the Account must be provided in the `accountId` path parameter to list recordings that belong to the Account. This scope only works for sub accounts.\n \n  To list recordings of a master account, the scope must be `account:read:admin` and the value of `accountId` should be `me`.<br>  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "accountSettings": {
    "comment": "Get settings",
    "doc": "Get settings\n  Get the settings of an account.<br>\n  To get the settings of a master account, use `me` as the value for the `accountId` path parameter.<br><br>\n  Prerequisites:\n   The account must be a paid account.<br>\n  Scopes: `account:read:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "accountSettingsUpdate": {
    "comment": "Update settings",
    "doc": "Update settings\n  Update the settings of a sub account that is under a master account.<br> To update the settings of the master account, use `me` as the value of the `accountId` path parameter.<br><br>\n  Prerequisites:\n   The sub account must be a paid account.<br>\n  Scopes: `account:write:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "delVb": {
    "comment": "Delete virtual background files",
    "doc": "Delete virtual background files\n  Delete existing virtual background file(s) from an account.\n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `account:write:admin`<br> <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "uploadVb": {
    "comment": "Upload virtual background files",
    "doc": "Upload virtual background files\n  Use this API to [upload virtual background files](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_01EJF3YFEWGT8YA0ZJ079JEDQE) for all users on the account to use.\n \n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `account:write:admin`<br><br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "listInternalCalloutCountries": {
    "comment": "List internal call-out countries",
    "doc": "List internal call-out countries\n  Retrieve the list of internal [call-out](https://support.zoom.us/hc/en-us/articles/200942859-How-To-Use-Telephone-Call-Out-) countries of a master account or a sub account. To list call-out enabled countries of a sub account, provide the account ID of the sub account in the `accountId` path parameter. To list call-out enabled countries of a master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "addCalloutCountries": {
    "comment": "Add internal call-out countries",
    "doc": "Add internal call-out countries\n  Specify the list of [call-out](https://support.zoom.us/hc/en-us/articles/200942859-How-To-Use-Telephone-Call-Out-) countries for a master account or a sub account. To add call-out enabled countries to a sub account, provide the account ID of the sub account in the `accountId` path parameter. To add call-out enabled countries to a master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "deleteInternalCallOutCountry": {
    "comment": "Delete internal call-out country",
    "doc": "Delete internal call-out country\n  Delete a previously assigned [call-out](https://support.zoom.us/hc/en-us/articles/200942859-How-To-Use-Telephone-Call-Out-) country from a master account or a sub account. To remove call-out country from a sub account, provide the account ID of the sub account in the `accountId` path parameter. To remove call-out country from a master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "listInternalNumbers": {
    "comment": "List internal numbers",
    "doc": "List internal numbers\n  This API allows a master account with SIP Connected Audio plan to list internal phone numbers (i.e., numbers that are not provided by Zoom but are owned by the organization consuming the API) assigned to a master account or a sub account.<br><br>To list internal numbers of a sub account, provide the account ID of the sub account in the `accountId` path parameter. To list internal numbers of a  master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "addInternalNumbers": {
    "comment": "Add internal numbers",
    "doc": "Add internal numbers\n  This API allows a master account with SIP Connected Audio plan to assign internal phone numbers (i.e., numbers that are not provided by Zoom but are owned by the organization consuming the API) to a master account or a sub account.<br><br>To add internal numbers to a sub account, provide the account ID of the sub account in the `accountId` path parameter. To add internal numbers to a master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "deleteInternalNumber": {
    "comment": "Delete an internal number",
    "doc": "Delete an internal number\n  This API allows a master account with SIP Connected Audio plan to delete a previously assigned internal phone number from a master account or a sub account.<br><br>To delete an internal number from a sub account, provide the account ID of the sub account in the `accountId` path parameter. To delete an internal number from a master account, provide `me` as the value of the `accountId` path parameter.\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a [master account](https://marketplace.zoom.us/docs/api-reference/master-account-apis) with SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "deleteAllSipNumbers": {
    "comment": "Delete all numbers",
    "doc": "Delete all numbers\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers' IP telephony network, will be connected over this trunk rather than over the PSTN. <br><br>Use this API to delete all internal numbers assigned to a sub account.\n  Prerequisites:<br>\n \n   Pro or a higher account with SIP Connected Audio plan enabled.\n   The account must be a master account<br>\n  Scopes: `sip_trunk:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "assignSipTrunkNumbers": {
    "comment": "Assign numbers",
    "doc": "Assign numbers\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers' IP telephony network, will be connected over this trunk rather than over the PSTN. <br><br>Use this API to assign internal numbers to a sub account.\n \n  Prerequisites:<br>\n   Pro or a higher account with SIP Connected Audio plan enabled.\n   The account must be a master account<br>\n  Scopes: `sip_trunk:master`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "assignSipConfig": {
    "comment": "Assign SIP trunk configuration",
    "doc": "Assign SIP trunk configuration\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers' IP telephony network, will be connected over this trunk rather than over the PSTN. <br><br> Using this API, a master account owner can copy the SIP Connected Audio configurations applied on the master account and enable those configurations on a sub account. The owner can also disable the configuration in the sub account where it was previously enabled.\n  Prerequisites:<br>\n   Pro or a higher account with SIP Connected Audio plan enabled.\n   master account Owner<br>\n  Scopes: `sip_trunk:master`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listSipTrunks": {
    "comment": "List SIP trunks",
    "doc": "List SIP trunks\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers’ IP telephony network, will be connected over this trunk rather than over the PSTN.<br><br>\n  Use this API to list all the SIP trunks assigned to a master account or a sub account of the master account. To retrieve SIP trunks assigned to a sub account, provide the account ID of the sub account in the `accountId` path parameter. To retrieve SIP trunks of a master account, provide `me` as the value of the `accountId` path parameter. <br><br> Scope: `sip_trunk:read:admin`\n  <br><b>Prerequisites:</b><br>\n   The account must either be a master account or a sub account with [API Partner Plan](https://zoom.us/plan/api) and SIP Connected Audio Plan."
  },
  "assignSipTrunks": {
    "comment": "Assign SIP trunks",
    "doc": "Assign SIP trunks\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers’ IP telephony network, will be connected over this trunk rather than over the PSTN.<br><br>Use this API to assign SIP trunk(s) that are available on a master account to a sub account. <br><b>Prerequisites:</b><br>\n   The account making this API request must be a master account with [API Partner Plan](https://zoom.us/plan/api) and SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "deleteSipTrunk": {
    "comment": "Delete a SIP trunk",
    "doc": "Delete a SIP trunk\n  Use this API to remove existing SIP trunk of a sub account.<br>\n  <br><b>Prerequisites:</b><br>\n   The account making this API request must be a master account with [API Partner Plan](https://zoom.us/plan/api) and SIP Connected Audio Plan.<br><br>\n  Scope: `sip_trunk:master`"
  },
  "accountTrustedDomain": {
    "comment": "Get trusted domains",
    "doc": "Get trusted domains\n  Get trusted domains of a sub account. To get the trusted domains of a master account, use `me` as the value for the `accountId` path parameter.\n \n  Prerequisites:<br>\n   The sub account must be a paid account.<br>\n  Scope: `account:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "switchUserAccount": {
    "comment": "Switch a user's account",
    "doc": "Switch a user's account\n  Disassociate a user from one Account and move the user to another Account under the same master account.\n \n  With this API, a user under a master account or a sub account can be moved to another sub account within the same master account. To move a user from a master account to a sub account, use `me` as the value for `accountId`. In this scenario, \"me\" refers to the Account ID of the master account.\n \n  To move a user from one sub account to another sub account, provide the sub account's Account ID as the value for `accountId`.\n \n  Prerequisites:\n   The account should have Pro or a higher plan with master account option enabled.\n   The user whose account needs to be switched should not be an admin or an owner of that account.\n   The user should not have the same [managed domain](https://support.zoom.us/hc/en-us/articles/203395207-What-is-Managed-Domain-) as the account owner.\n \n  Scope: `user:master`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "downloadInvoicePdf": {
    "comment": "Download an invoice file",
    "doc": "Download an invoice file\n  Download a [billed](https://support.zoom.us/hc/en-us/articles/201363263-About-Billing) invoice file of a Zoom account in PDF format. To download a regular account's invoice or a  master account's invoice, provide `me` as the value of `accountId` path parameter. To download a sub account's invoice, provide the account ID of the sub account in the `accountId` path parameter.\n \n \n  Prerequisites:\n   Account must be enrolled in Pro or a higher plan.<br>\n \n  Scope:`billing:master`<br>\n  Rate Limit: You can make one request to this API every thirty minutes until the daily limit is reached. This API has a daily limit of 100 requests per account."
  },
  "listArchivedFiles": {
    "comment": "List archived files",
    "doc": "List archived files\n  Zoom’s [archiving solution](https://support.zoom.us/hc/en-us/articles/360050431572-Archiving-Meeting-and-Webinar-data) allows account administrators to set up an automated mechanism to record, collect and archive meeting data to a 3rd party platform of their choice and hence, satisfy FINRA and/ or other compliance requirements.<br><br>\n  Use this API to retrieve archived meeting or webinar files of an account.\n \n  Scope: `recording:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br><br>\n  Prerequisites: <br>\n   Enable cloud recording.\n   Follow the [enablement process](https://support.zoom.us/hc/en-us/articles/360050431572-Archiving-Meeting-and-Webinar-data#h_01ENPBD3WR68D7FAKTBY92SG45) to access the archiving feature."
  },
  "deleteUserLevelChannel": {
    "comment": "Delete a channel",
    "doc": "Delete a channel\n  Zoom chat [channels](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) allow users to communicate via chat in private or public groups. Use this API to delete a specific channel.\n \n  Scope: `chat_channel:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>"
  },
  "getUserLevelChannel": {
    "comment": "Get a channel",
    "doc": "Get a channel\n  Zoom chat [channels](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) allow users to communicate via chat in private or public groups. Use this API to get information about a specific channel.\n \n  Scope: `chat_channel:read`\t<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>"
  },
  "updateUserLevelChannel": {
    "comment": "Update a channel",
    "doc": "Update a channel\n  Zoom chat channels allow users to communicate via chat in private or public channels. Use this API to update the name of a specific channel that you created.\n \n  Scope: `chat_channel:write`\t<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>"
  },
  "leaveChannel": {
    "comment": "Leave a channel",
    "doc": "Leave a channel\n  If you're no longer interested in being a member of an existing channel, you can leave the channel at any time. Use this API to leave a specific channel. After leaving the channel, you can no longer access information from that channel.\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b>This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>\n \n  Scope: `chat_channel:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "joinChannel": {
    "comment": "Join a channel",
    "doc": "Join a channel\n  A [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) can have one or multiple members. Use this API to join a channel that is open for anyone in the same organization to join. You cannot use this API to join private channels that only allows invited members to be a part of it.\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b>This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>\n \n  Scope: `chat_channel:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "removeAuserLevelChannelMember": {
    "comment": "Remove a member",
    "doc": "Remove a member\n   A [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) can have one or multiple members. Use this API to remove a member from a chat channel.<br><br>\n  Scopes: `chat_channel:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>"
  },
  "getUserContacts": {
    "comment": "List user's contacts",
    "doc": "List user's contacts\n  A user under an organization’s Zoom account has internal users listed under Company Contacts in the Zoom Client. A Zoom user can also add another Zoom user as a [contact](https://support.zoom.us/hc/en-us/articles/115004055706-Managing-Contacts). Call this API to list all the contacts of a Zoom user. Zoom contacts are categorized into \"company contacts\" and \"external contacts\". You must specify the contact type in the `type` query parameter. If you do not specify, by default, the type will be set as company contact.\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>\n \n  Scope: `chat_contact:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getUserContact": {
    "comment": "Get user's contact details",
    "doc": "Get user's contact details\n  A user under an organization’s Zoom account has internal users listed under Company Contacts in the Zoom Client. A Zoom user can also add another Zoom user as a [contact](https://support.zoom.us/hc/en-us/articles/115004055706-Managing-Contacts). Call this API to get information on a specific contact of the Zoom user.\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b>This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>\n \n  Scope: `chat_contact:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getChannels": {
    "comment": "List user's channels",
    "doc": "List user's channels\n  Zoom chat [channels](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) allow users to communicate via chat in private or public groups. Use this API to list a user's chat channels.\n \n  Scope: `chat_channel:read` or `chat_channel:read:admin`<br>\n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API supports both user-managed apps and account-level apps. However, in an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, to list channels of another user in the same Zoom account, the user calling this API must have a <a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\">role</a> that has <b>View or Edit</b> permission for the Chat channels feature.</p><br>\n \n \n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "createChannel": {
    "comment": "Create a channel",
    "doc": "Create a channel\n  Zoom chat channels allow users to communicate via chat in private or public groups. Use this API to create a channel for a user.<br>\n  Scopes:`chat_channel:write` or `chat_channel:write:admin`<br>\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API supports both user-managed apps and account-level apps. However, in an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, to create a channel on behalf of another user in the same Zoom account, the user calling this API must have a <a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\">role</a> that has <b>Edit</b> permission for the Chat channels feature.</p><br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "deleteChannel": {
    "comment": "Delete a channel",
    "doc": "Delete a channel\n  Zoom chat [channels](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) allow users to communicate via chat in private or public groups. Use this API to delete a specific channel.\n \n  Scope: `chat_channel:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> This API only supports <b>user-managed</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>.</p><br>"
  },
  "getChannel": {
    "comment": "Get a channel",
    "doc": "Get a channel\n  Zoom chat [channels](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) allow users to communicate via chat in private or public groups. Use this API to get information about a specific channel.\n \n  Scope: `chat_channel:read:admin` <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium` <br>\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b> <a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a>  that has View or Edit permission for Chat Channels</b>.</p>"
  },
  "updateChannel": {
    "comment": "Update a channel",
    "doc": "Update a channel\n  Zoom chat channels allow users to communicate via chat in private or public channels. Use this API to update the name of a specific channel created by a user. <br><br>\n  Scope: `chat_channel:write:admin`\t<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b> <a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a>  that has Edit permission for Chat Channel</b>.</p>"
  },
  "listChannelMembers": {
    "comment": "List channel members",
    "doc": "List channel members\n  A [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) can have one or multiple members. List all the members of a channel using this API.\n \n  </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has View or Edit permission for Chat Channels</b>.</p>\n \n  Scopes: `chat_channel:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "inviteChannelMembers": {
    "comment": "Invite channel members",
    "doc": "Invite channel members\n  A [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) can have one or multiple members. Use this API to invite members that are in a user's contact list to a channel. The maximum number of members that can be added at once with this API is 5.\n \n  Scope: `chat_channel:write:admin` <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has Edit permission for Chat Channels</b>.</p>"
  },
  "removeAchannelMember": {
    "comment": "Remove a member",
    "doc": "Remove a member\n   A [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) can have one or multiple members. Use this API to remove a member from a chat channel.<br><br>\n \n  Scopes: `chat_channel:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium` <br>\n \n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has Edit permission for Chat Channels</b>.</p>"
  },
  "getChatMessages": {
    "comment": "List user's chat messages",
    "doc": "List user's chat messages\n  A Zoom user can have conversations with other Zoom users via chat. Use this API to list the current user's chat messages between the user and an individual contact or a chat channel.<br> In the query parameter, you must provide either of the following:<br>\n   `to_contact`: The email address of the contact with whom the user conversed by sending/receiving messages.\n   `to_channel`: The channel ID of the channel to/from which the user has sent and/or received messages.\n \n  <br> Specify a date in the `date` query parameter to view messages from that date. If a date is not provided, the default value for the query will be the current date.<br>\n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\">role</a> that has <b>View or Edit</b> permission for Chat Messages.</p><br>\n \n  <br>Scopes: `chat_message:read`, `chat_message:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "sendaChatMessage": {
    "comment": "Send a chat message",
    "doc": "Send a chat message\n  Send chat messages on Zoom to either an individual user who is in your contact list or to a [channel](https://support.zoom.us/hc/en-us/articles/200912909-Getting-Started-With-Channels-Group-Messaging-) of which you are a member. To send a message to a contact, provide the contact's email address in the `to_contact` field. Similary, to send a message to a channel, provide the Channel Id of the Channel in `to_channel` field.<br>\n  <br>Scopes: `chat_message:write`, `chat_message:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br> <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has Edit permission for Chat Messages</b>.</p>"
  },
  "deleteChatMessage": {
    "comment": "Delete a message",
    "doc": "Delete a message\n  Delete a chat message that you previously sent to a contact or a channel. In the query parameter, you must provide either of the following:<br>\n   `to_contact`: The email address of the contact to whom you sent the message. Use this parameter to delete a message sent to an individual contact in Zoom.\n   `to_channel`: The channel ID of the channel where you sent the message. Use this parameter to delete a message sent to a channel in Zoom.\n \n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has Edit permission for Chat Messages</b>.</p>\n \n  Scope: `chat_message:write`, `chat_message:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "editMessage": {
    "comment": "Update a message",
    "doc": "Update a message\n  Each chat message has a unique identifier. Use this API to edit a chat message that you previously sent to either a contact or a channel in Zoom by providing the ID of the message as the value of the `messageId` parameter. The ID can be retrieved from List User's Chat Messages API. Additionally, as a query parameter, you must provide either the email address of the contact or the Channel ID of the channel where the message was sent.\n \n  Scope: `chat_message:write`,`chat_message:write:admin`\t<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n \n  </b> For an<b> account-level</b> <a href=\"https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-oauth-app\">OAuth app</a>, this API can only be used on behalf of a user who is assigned with a <b><a href=\"https://support.zoom.us/hc/en-us/articles/115001078646-Using-role-management#:~:text=Each%20user%20in%20a%20Zoom,owner%2C%20administrator%2C%20or%20member.&text=Role%2Dbased%20access%20control%20enables,needs%20to%20view%20or%20edit.\"> role</a> that has Edit permission for Chat Messages</b>.</p>\n  Scope: `chat_message:write`, `chat_message:write:admin`<br>"
  },
  "searchCompanyContacts": {
    "comment": "Search company contacts",
    "doc": "Search company contacts\n  A user under an organization's Zoom account has internal users listed under Company Contacts in the Zoom Client. Use this API to search users that are in the company contacts of a Zoom account. Using the `search_key` query parameter, provide either first name, last name or the email address of the user that you would like to search for. Optionally, set `query_presence_status` to `true` in order to include the presence status of a contact. <br><br>\n \n  Scopes: `contact:read:admin`, `contact:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groups": {
    "comment": "List groups",
    "doc": "List groups\n  List [groups](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under an account.\n \n  Prerequisite: Pro or higher account.<br>\n  Scopes: `group:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groupCreate": {
    "comment": "Create a group",
    "doc": "Create a group\n  Create a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under an account.\n \n  You can add a maximum of 100 groups in one account per day. If you go over, you will get an error. You can add a maximum of 5000 groups in one account.\n \n  Prerequisite: Pro or higher account.<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "groupDelete": {
    "comment": "Delete a group",
    "doc": "Delete a group\n  Delete a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-).\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "group": {
    "comment": "Get a group",
    "doc": "Get a group\n  Get a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under an account.\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "groupUpdate": {
    "comment": "Update a group",
    "doc": "Update a group\n  Update a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under your account.\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getGroupLockSettings": {
    "comment": "Get locked settings",
    "doc": "Get locked settings\n  Retrieve a [group's](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) locked settings. If you lock a setting, the group members will not be able to modify it individually. <p style=\"background-color:#FEEFB3; color:#9F6000\"><br>Note:</b> The `force_pmi_jbh_password` field under meeting settings is planned to be deprecated on September 22, 2019. This field will be replaced by another field that will provide the same functionality.</p>\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groupLockedSettings": {
    "comment": "Update locked settings",
    "doc": "Update locked settings\n  Update a [group's](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) locked settings. If you lock a setting, the group members will not be able to modify it individually. <p style=\"background-color:#FEEFB3; color:#9F6000\"><br>Note:</b> The `force_pmi_jbh_password` field under meeting settings is planned to be deprecated on September 22, 2019. This field will be replaced by another field that will provide the same functionality.</p>\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groupMembers": {
    "comment": "List group members",
    "doc": "List group members\n  List the members of a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under your account.\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groupMembersCreate": {
    "comment": "Add group members",
    "doc": "Add group members\n  Add members to a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) under your account.\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "groupMembersDelete": {
    "comment": "Delete a group member",
    "doc": "Delete a group member\n  Delete a member from a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-) in a Zoom account.\n \n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateAgroupMember": {
    "comment": "Update a group member",
    "doc": "Update a group member\n  If a user is a member in multiple groups, you can [set a primary group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-#h_d07c7dcd-4fd8-485a-b5fe-a322e8d21c09) for the user. The group member will use the primary group's settings by default. However, if settings are locked in other groups, those settings will continue to be locked for that user. By default, the primary group is the first group that user is added to.<br><br>\n  Use this API to perform either of the following tasks:\n   Simultaneously remove a member from one group and move the member to a different group.\n   Set a primary group for the user<br><br>\n  Prerequisites:\n   Pro or higher account<br> Scopes: `group:write:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getGroupSettings": {
    "comment": "Get a group's settings",
    "doc": "Get a group's settings\n  Get settings for a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-).\n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateGroupSettings": {
    "comment": "Update a group's settings",
    "doc": "Update a group's settings\n  Update settings for a [group](https://support.zoom.us/hc/en-us/articles/204519819-Group-Management-).<p style=\"background-color:#FEEFB3; color:#9F6000\"><br>Note:</b> The `force_pmi_jbh_password` field under meeting settings is planned to be deprecated on September 22, 2019. This field will be replaced by another field that will provide the same functionality.</p>\n  Prerequisite: Pro, Business, or Education account<br>\n  Scopes: `group:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "delGroupVb": {
    "comment": "Delete virtual background files",
    "doc": "Delete virtual background files\n  Delete existing virtual background file(s) from an account.\n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `group:write:admin`<br><br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "uploadGroupVb": {
    "comment": "Upload virtual background files",
    "doc": "Upload virtual background files\n  Use this API to [upload virtual background files](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_01EJF3YFEWGT8YA0ZJ079JEDQE) for all users in a group to use.\n \n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `group:write:admin`<br><br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n \n \n  `"
  },
  "deviceList": {
    "comment": "List H.323/SIP devices",
    "doc": "List H.323/SIP devices\n  A H.323 or SIP device can make a video call to a [Room Connector](https://support.zoom.us/hc/en-us/articles/201363273-Getting-Started-With-H-323-SIP-Room-Connector) to join a Zoom cloud meeting. A Room Connector can also call out to a H.323 or SIP device to join a Zoom cloud meeting. Use this API to list all H.323/SIP Devices on a Zoom account.<br><br>\n  Scopes: `h323:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "deviceCreate": {
    "comment": "Create a H.323/SIP device",
    "doc": "Create a H.323/SIP device\n  A H.323 or SIP device can make a video call to a [Room Connector](https://support.zoom.us/hc/en-us/articles/201363273-Getting-Started-With-H-323-SIP-Room-Connector) to join a Zoom cloud meeting. A Room Connector can also call out to a H.323 or SIP device to join a Zoom cloud meeting. Use this API to add a H.323/SIP device to your Zoom account<br><br>\n  Scopes: `h323:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light` <br>"
  },
  "deviceDelete": {
    "comment": "Delete a H.323/SIP device",
    "doc": "Delete a H.323/SIP device\n  A H.323 or SIP device can make a video call to a [Room Connector](https://support.zoom.us/hc/en-us/articles/201363273-Getting-Started-With-H-323-SIP-Room-Connector) to join a Zoom cloud meeting. A Room Connector can also call out to a H.323 or SIP device to join a Zoom cloud meeting. Use this API to delete a H.323/SIP device from your Zoom account.<br><br>\n  Scopes: `h323:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "deviceUpdate": {
    "comment": "Update a H.323/SIP device",
    "doc": "Update a H.323/SIP device\n  A H.323 or SIP device can make a video call to a [Room Connector](https://support.zoom.us/hc/en-us/articles/201363273-Getting-Started-With-H-323-SIP-Room-Connector) to join a Zoom cloud meeting. A Room Connector can also call out to a H.323 or SIP device to join a Zoom cloud meeting. Use this API to edit information of a H.323/SIP device from your Zoom account.<br><br>\n  Scopes: `h323:write:admin`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "sendchatbot": {
    "comment": "Send chatbot messages",
    "doc": "Send chatbot messages\n  Send chatbot messages from your marketplace chatbot app.<br><br>\n  Scopes: `imchat:bot`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Authorization Flow: Client Credentials Flow<br><br>\n  To get authorized, make a POST request to `/oauth/token` endpoint with grant type as `client_credentials`. <br>Use `https://api.zoom.us/oauth/token?grant_type=client_credentials` as the endpoint for the request.\n  You will need to send your ClientID and Secret as a Basic base64 encoded AUthorization header. Ex. `Basic base64Encode({client_id}:{client_sceret})`<br><br> Next, use the token recieved (access_token) as a bearer token while making the POST /im/chat/messages request to send chatbot messages.<br><br>\n  Learn more about how to authorize chatbots in the [Chatbot Authorization](https://marketplace.zoom.us/docs/guides/chatbots/authorization) guide."
  },
  "deleteAchatbotMessage": {
    "comment": "Delete a chatbot message",
    "doc": "Delete a chatbot message\n  Delete a message that was sent by your chatbot app.<br><br> Scopes: `imchat:bot`<br> [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>Authorization Flow: Client Credentials Flow<br><br>To get authorized, make a POST request to `/oauth/token` endpoint with grant type as `client_credentials`. <br>Use `https://api.zoom.us/oauth/token?grant_type=client_credentials` as the endpoint for the request.\n  You will need to send your ClientID and Secret as a Basic base64 encoded AUthorization header. Ex. `Basic base64Encode({client_id}:{client_sceret})`<br><br> Next, use the token received (access_token) as a bearer token while making the DELETE /im/chat/messages/{message_id} request to delete a message.<br><br>\n  Learn more about how to authotize chatbots in the [Chatbot Authorization](https://marketplace.zoom.us/docs/guides/chatbots/authorization) guide."
  },
  "editChatbotMessage": {
    "comment": "Edit a chatbot message",
    "doc": "Edit a chatbot message\n  Edit a message that was [sent](https://marketplace.zoom.us/docs/api-reference/zoom-api/im-chat/sendchatbot) by your Chatbot app.<br> After sending a message using the Send Chatbot Message API, you must store the messageId returned in the response so that you can make edits to the associated message using this API.\n \n  Scope: `imchat:bot`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Authorization Flow: Client Credentials Flow<br><br>\n  To get authorized, make a POST request to `/oauth/token` endpoint with grant type as `client_credentials`. <br>Use `https://api.zoom.us/oauth/token?grant_type=client_credentials` as the endpoint for the request.\n  You will need to send your ClientID and Secret as a Basic base64 encoded AUthorization header. Ex. `Basic base64Encode({client_id}:{client_sceret})`<br><br> Next, use the token received (access_token) as a bearer token while making the PUT /im/chat/messages/{message_id} request to edit a chatbot message.<br><br>\n  Learn more about how to authotize chatbots in the [Chatbot Authorization](https://marketplace.zoom.us/docs/guides/chatbots/authorization) guide."
  },
  "imChatSessions": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get IM chat sessions\n  Retrieve IM Chat sessions for a specified period of time. <aside>Note: This API only supports Oauth2.</aside><br>\n \n  Scopes: `imchat:read, imchat:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`\n \n  Please see our [announcements page related to this deprecation](https://marketplace.zoom.us/docs/guides/stay-up-to-date/announcements#im-api-notice)."
  },
  "imChatMessages": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get IM chat messages\n  Retrieve IM chat messages for a specified period of time. <aside>Note: This API only supports oauth2.</aside><br><br>\n \n  Scopes: `imchat:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n \n  Please see our [announcements page related to this deprecation](https://marketplace.zoom.us/docs/guides/stay-up-to-date/announcements#im-api-notice)."
  },
  "imGroups": {
    "comment": "List IM directory groups",
    "doc": "List IM directory groups\n  List [IM directory groups](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management).<br><br>\n  Scopes: `imgroup:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "imGroupCreate": {
    "comment": "Create an IM directory group",
    "doc": "Create an IM directory group\n  Create an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under your account.<br><br>\n  Scopes: `imgroup:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "imGroupDelete": {
    "comment": "Delete an IM directory group",
    "doc": "Delete an IM directory group\n  Delete an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under your account.<br><br>\n  Scopes: `imgroup:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "imGroup": {
    "comment": "Retrieve an IM directory group",
    "doc": "Retrieve an IM directory group\n  Retrieve an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under your account.<br><br>\n  Scopes: `imgroup:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "imGroupUpdate": {
    "comment": "Update an IM directory group",
    "doc": "Update an IM directory group\n  Update an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under your account.<br><br>\n  Scopes: `imgroup:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "imGroupMembers": {
    "comment": "List IM directory group members",
    "doc": "List IM directory group members\n  List the members of an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management).<br><br>\n  Scope: `imgroup:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "imGroupMembersCreate": {
    "comment": "Add IM directory group members",
    "doc": "Add IM directory group members\n  Add members to an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under an account.<br><br>\n  Scope: `imgroup:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "imGroupMembersDelete": {
    "comment": "Delete an IM directory group member",
    "doc": "Delete an IM directory group member\n  Delete a member from an [IM directory group](https://support.zoom.us/hc/en-us/articles/203749815-IM-Management) under an account.<br><br>\n  Scopes: `imgroup:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "sendimmessages": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Send IM messages\n  Send chat message to a user. <aside>Note: This API only supports OAuth 2.0.</aside><br><br>Scope: `imchat:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listimmessages": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get user’s IM messages\n  Get IM Chat messages for a specified period of time. <aside>Note: This API only supports Oauth2.</aside><br><br>\n  Scopes: `imchat:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n \n  Please see the [announcements page related to this deprecation.](https://marketplace.zoom.us/docs/guides/stay-up-to-date/announcements#im-api-notice)"
  },
  "inMeetingRecordingControl": {
    "comment": "Use in-Meeting recording controls",
    "doc": "Use in-Meeting recording controls\n  Use this API to control the [in-meeting](https://support.zoom.us/hc/en-us/articles/360021921032-In-Meeting-Controls) recording features such as starting a recording, stopping a recording, pausing a recording, and resuming a recording. This API only works for Cloud Recordings and not for local recordings.\n \n \n  Prerequisite:\n   The meeting must be a live meeting.\n   Cloud Recording must be enabled.\n   The user using this API must either be the host or alternative host of the meeting.\n \n  Scopes: `meeting:write`, `meeting:write:admin`, `meeting:master`"
  },
  "meetingDelete": {
    "comment": "Delete a meeting",
    "doc": "Delete a meeting\n  Delete a meeting.<br><br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meeting": {
    "comment": "Get a meeting",
    "doc": "Get a meeting\n  Retrieve the details of a meeting.<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingUpdate": {
    "comment": "Update a meeting",
    "doc": "Update a meeting\n  Update the details of a meeting.<br>This API has a rate limit of 100 requests per day. Therefore, a meeting can only be updated for a maximum of 100 times within a 24 hour window.<br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "createBatchPolls": {
    "comment": "Perform batch poll creation",
    "doc": "Perform batch poll creation\n  Polls allow the meeting host to survey attendees. Use this API to create batch [polls](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings) for a meeting.<br><br>\n \n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Host user type must be Pro or higher plan.\n   Polling feature must be enabled in the host's account.\n   Meeting must be a scheduled meeting. Instant meetings do not have polling features enabled."
  },
  "meetingInvitation": {
    "comment": "Get meeting invitation",
    "doc": "Get meeting invitation\n  Retrieve the meeting invite note that was sent for a specific meeting.<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getLiveStreamDetails": {
    "comment": "Get live stream details",
    "doc": "Get live stream details\n  Zoom allows users to [live stream a meeting](https://support.zoom.us/hc/en-us/articles/115001777826-Live-Streaming-Meetings-or-Webinars-Using-a-Custom-Service) to a custom platform. Use this API to get a meeting's live stream configuration details such as Stream URL, Stream Key and Page URL.<br><br>\n  Prerequisites:<br>\n   Meeting host must be a licensed user with a Pro or higher plan.<br>\n   Live streaming details must have been [configured](https://support.zoom.us/hc/en-us/articles/115001777826-Live-Streaming-Meetings-or-Webinars-Using-a-Custom-Service#h_01589a6f-a40a-4e18-a448-cb746e52ebc5) for the meeting.<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingLiveStreamUpdate": {
    "comment": "Update a live stream",
    "doc": "Update a live stream\n  Zoom allows users to [live stream a meeting](https://support.zoom.us/hc/en-us/articles/115001777826-Live-Streaming-Meetings-or-Webinars-Using-a-Custom-Service) to a custom platform. Use this API to update a meeting's live stream information.<br><br>\n  Prerequisites:<br>\n   Meeting host must have a Pro license.<br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingLiveStreamStatusUpdate": {
    "comment": "Update Live Stream Status",
    "doc": "Update Live Stream Status\n  Zoom allows users to [live stream a meeting](https://support.zoom.us/hc/en-us/articles/115001777826-Live-Streaming-Meetings-or-Webinars-Using-a-Custom-Service) to a custom platform. Use this API to update the status of a meeting's live stream.<br><br>\n  Prerequisites:<br>\n   Meeting host must have a Pro license.<br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingPolls": {
    "comment": "List meeting polls",
    "doc": "List meeting polls\n  Polls allow the meeting host to survey attendees. Use this API to list [polls](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings) of a meeting.<br><br>\n \n  Scopes: `meeting:read:admin` `meeting:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Host user type must be Pro or higher plan.\n   Meeting must be a scheduled meeting. Instant meetings do not have polling features enabled."
  },
  "meetingPollCreate": {
    "comment": "Create a meeting poll",
    "doc": "Create a meeting poll\n  Polls allow the meeting host to survey attendees. Use this API to create a [poll](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings) for a meeting.<br><br>\n \n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Host user type must be Pro or higher plan.\n   Polling feature must be enabled in the host's account.\n   Meeting must be a scheduled meeting. Instant meetings do not have polling features enabled."
  },
  "meetingPollDelete": {
    "comment": "Delete a meeting poll",
    "doc": "Delete a meeting poll\n  Polls allow the meeting host to survey attendees. Use this API to delete a meeting [poll](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings).<br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light` <br>\n  Prerequisites:<br>\n   Host user type must be Pro.\n   Polling feature should be enabled in the host's account.\n   Meeting must be a scheduled meeting. Instant meetings do not have polling features enabled."
  },
  "meetingPollGet": {
    "comment": "Get a meeting poll",
    "doc": "Get a meeting poll\n  Polls allow the meeting host to survey attendees. Use this API to get information about a specific meeting [poll](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings).<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingPollUpdate": {
    "comment": "Update a meeting poll",
    "doc": "Update a meeting poll\n  Polls allow the meeting host to survey attendees. Use this API to update information of a specific meeting [poll](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings)<br><br>\n  Scopes: `meeting:write:admin` `meeting:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "recordingDelete": {
    "comment": "Delete meeting recordings",
    "doc": "Delete meeting recordings\n  Delete all recording files of a meeting.<br><br>\n \n  Scopes: `recording:write:admin` `recording:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Cloud Recording should be enabled on the user's account.<br>"
  },
  "recordingGet": {
    "comment": "Get meeting recordings",
    "doc": "Get meeting recordings\n  Get all the [recordings](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording#h_7420acb5-1897-4061-87b4-5b76e99c03b4) from a meeting or Webinar instance.<br><br> The recording files can be downloaded via the `download_url` property listed in the response.\n \n  > To access a password protected cloud recording, add an \"access_token\" parameter to the download URL and provide OAuth access token or [JWT](https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-jwt-app) as the value of the \"access_token\".\n  <br>\n \n  Scopes: `recording:read:admin` `recording:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingRecordingRegistrants": {
    "comment": "List recording registrants",
    "doc": "List recording registrants\n  Cloud Recordings of past Zoom Meetings can be made [on-demand](https://support.zoom.us/hc/en-us/articles/360000488283-On-demand-Recordings). Users should be [registered](https://marketplace.zoom.us/docs/api-reference/zoom-api/cloud-recording/meetingrecordingregistrantcreate) to view these recordings.\n \n  Use this API to list registrants of On-demand Cloud Recordings of a past meeting.<br>\n  Scopes: `recording:read:admin`, `recording:read`.<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "meetingRecordingRegistrantCreate": {
    "comment": "Create a recording registrant",
    "doc": "Create a recording registrant\n  Cloud Recordings of past Zoom Meetings can be made [on-demand](https://support.zoom.us/hc/en-us/articles/360000488283-On-demand-Recordings). Users should be [registered](https://marketplace.zoom.us/docs/api-reference/zoom-api/cloud-recording/meetingrecordingregistrantcreate) to view these recordings.\n \n  Use this API to register a user to gain access to On-demand Cloud Recordings of a past meeting.<br>\n  Scopes: `recording:write:admin`, `recording:write`.<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "recordingRegistrantsQuestionsGet": {
    "comment": "Get registration questions",
    "doc": "Get registration questions\n  For [on-demand](https://support.zoom.us/hc/en-us/articles/360000488283-On-demand-Recordings) meeting recordings, you can include fields with questions that will be shown to registrants when they register to view the recording.\n \n  Use this API to retrieve a list of questions that are displayed for users to complete when registering to view the recording of a specific meeting.<br>\n  Scopes: `recording:read:admin`, `recording:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "recordingRegistrantQuestionUpdate": {
    "comment": "Update registration questions",
    "doc": "Update registration questions\n  For [on-demand](https://support.zoom.us/hc/en-us/articles/360000488283-On-demand-Recordings) meeting recordings, you can include fields with questions that will be shown to registrants when they register to view the recording.\n \n  Use this API to update registration questions that are to be answered by users while registering to view a recording.<br>\n  Scopes: `recording:write:admin`, `recording:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "meetingRecordingRegistrantStatus": {
    "comment": "Update registrant's status",
    "doc": "Update registrant's status\n  A registrant can either be approved or denied from viewing the [on-demand](https://support.zoom.us/hc/en-us/articles/360000488283-On-demand-Recordings) recording.\n  Use this API to update a registrant's status.\n \n  Scopes: `recording:write:admin`, `recording:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "recordingSettingUpdate": {
    "comment": "Get meeting recording settings",
    "doc": "Get meeting recording settings\n  Retrieve settings applied to a meeting's [Cloud Recording](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording).<br><br>\n  Scopes: `recording:read:admin` `recording:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light` <br>"
  },
  "recordingSettingsUpdate": {
    "comment": "Update meeting recording settings",
    "doc": "Update meeting recording settings\n  Update settings applied to a meeting's [Cloud Recording](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording)<br><br>\n  Scopes: `recording:write:admin` `recording:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light` <br>"
  },
  "recordingStatusUpdate": {
    "comment": "Recover meeting recordings",
    "doc": "Recover meeting recordings\n  Zoom allows users to recover recordings from trash for up to 30 days from the deletion date. Use this API to recover all deleted [Cloud Recordings](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording) of a specific meeting.<br><br>\n  Scopes: `recording:write:admin` `recording:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   A Pro user with Cloud Recording enabled."
  },
  "recordingDeleteOne": {
    "comment": "Delete a meeting recording file",
    "doc": "Delete a meeting recording file\n  Delete a sprecific recording file from a meeting.<br><br>\n  Scopes: `recording:write:admin` `recording:write`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "recordingStatusUpdateOne": {
    "comment": "Recover a single recording",
    "doc": "Recover a single recording\n  Zoom allows users to recover recordings from trash for up to 30 days from the deletion date. Use this API to recover a single recording file from the meeting.<br>\n  Scopes: `recording:write:admin` `recording:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "meetingRegistrants": {
    "comment": "List meeting registrants",
    "doc": "List meeting registrants\n  A host or a user with admin permission can require [registration for a Zoom meeting](https://support.zoom.us/hc/en-us/articles/211579443-Registration-for-Meetings). Use this API to list users that have registered for a meeting.<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "meetingRegistrantCreate": {
    "comment": "Add meeting registrant",
    "doc": "Add meeting registrant\n  Register a participant for a meeting.<br><br> Note that there is a maximum limit of 4999 registrants per meeting and users will see an error if the capacity has reached.\n \n  Prerequisite:<br>\n   Host user type must be \"Licensed\".\n \n  Scopes: `meeting:write:admin` `meeting:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingRegistrantsQuestionsGet": {
    "comment": "List registration questions",
    "doc": "List registration questions\n  List registration questions that will be displayed to users while [registering for a meeting](https://support.zoom.us/hc/en-us/articles/211579443-Registration-for-Meetings).<br>\n \n  Scopes: `meeting:read`, `meeting:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingRegistrantQuestionUpdate": {
    "comment": "Update registration questions",
    "doc": "Update registration questions\n  Update registration questions that will be displayed to users while [registering for a meeting](https://support.zoom.us/hc/en-us/articles/211579443-Registration-for-Meetings).<br><br>\n  Scopes: `meeting:write`, `meeting:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingRegistrantStatus": {
    "comment": "Update registrant's status",
    "doc": "Update registrant's status\n  Update a meeting registrant's status by either approving, cancelling or denying a registrant from joining the meeting.<br><br>\n  Scopes: `meeting:write:admin` `meeting:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "meetingregistrantdelete": {
    "comment": "Delete a meeting registrant",
    "doc": "Delete a meeting registrant\n  Delete a meeting registrant.<br><br>\n  Scopes: `meeting:write:admin` `meeting:write`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "meetingStatus": {
    "comment": "Update meeting status",
    "doc": "Update meeting status\n  Update the status of a meeting.<br><br>\n  Scopes: `meeting:write:admin` `meeting:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "dashboardClientFeedback": {
    "comment": "List Zoom meetings client feedback",
    "doc": "List Zoom meetings client feedback\n  Retrieve survey results from [Zoom meetings client feedback](https://support.zoom.us/hc/en-us/articles/115005855266-End-of-Meeting-Feedback-Survey#h_e30d552b-6d8e-4e0a-a588-9ca8180c4dbf). <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.\n \n  Prerequisites:\n   Business or higher account\n   [Feedback to Zoom](https://support.zoom.us/hc/en-us/articles/115005838023) enabled.\n \n  Scope: `account:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "dashboardClientFeedbackDetail": {
    "comment": "Get zoom meetings client feedback",
    "doc": "Get zoom meetings client feedback\n  Retrieve detailed information on a [Zoom meetings client feedback](https://support.zoom.us/hc/en-us/articles/115005855266-End-of-Meeting-Feedback-Survey#h_e30d552b-6d8e-4e0a-a588-9ca8180c4dbf). <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.\n \n  Prerequisites:\n   Business or higher account\n   [Feedback to Zoom](https://support.zoom.us/hc/en-us/articles/115005838023) enabled.\n \n  Scope: `dashboard_home:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`\n \n  `"
  },
  "listMeetingSatisfaction": {
    "comment": "List client meeting satisfaction",
    "doc": "List client meeting satisfaction\n  If the [End of Meeting Feedback Survey](https://support.zoom.us/hc/en-us/articles/115005855266) option is enabled, attendees will be prompted with a survey window where they can tap either the Thumbs Up or Thumbs Down button that indicates their Zoom meeting experience. With this API, you can get information on the attendees' meeting satisfaction. Specify a monthly date range for the query using the from and to query parameters. The month should fall within the last six months.\n \n  To get information on the survey results with negative experiences (indicated by Thumbs Down), use the [Get Zoom Meetings Client Feedback API](https://marketplace.zoom.us/docs/api-reference/zoom-api/dashboards/dashboardclientfeedbackdetail).<br>\n  Scopes: `dashboard:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "dashboardCrc": {
    "comment": "Get CRC port usage",
    "doc": "Get CRC port usage\n  A Cloud Room Connector allows H.323/SIP endpoints to connect to a Zoom meeting.\n \n  Use this API to get the hour by hour CRC Port usage for a specified period of time. <aside class='notice'>We will provide the report for a maximum of one month. For example, if \"from\" is set to \"2017-08-05\" and \"to\" is set to \"2017-10-10\", we will adjust \"from\" to \"2017-09-10\".</aside><br><br>\n  Prerequisites:<br>\n   Business, Education or API Plan.\n   Room Connector must be enabled on the account.<br><br>\n  Scopes: `dashboard_crc:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "dashboardIm": {
    "comment": "Get IM metrics",
    "doc": "Get IM metrics\n  Get [metrics](https://support.zoom.us/hc/en-us/articles/204654719-Dashboard#h_cc7e9749-1c70-4afb-a9a2-9680654821e4) on how users are utilizing the Zoom Chat Client.<br><br> <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.\n  Scope: `dashboard_im:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Resource-intensive`<br>\n  Prerequisites:<br>\n   Business or a higher plan."
  },
  "dashboardIssueZoomRoom": {
    "comment": "Get top 25 Zoom Rooms with issues",
    "doc": "Get top 25 Zoom Rooms with issues\n  Get information on top 25 Zoom Rooms with issues in a month. The month specified with the \"from\" and \"to\" range should fall within the last six months.<br>\n  Scope: `dashboard_home:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Business or a higher plan.\n   Zoom Room must be enabled in the account."
  },
  "dashboardIssueDetailZoomRoom": {
    "comment": "Get issues of Zoom Rooms",
    "doc": "Get issues of Zoom Rooms\n  Get information about the issues that occured on the Top 25 Zoom Rooms with issues in an acount. <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.\n \n  Scope: `dashboard_home:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites: <br>\n   Business or a higher plan.\n   Zoom Room must be enabled in the account."
  },
  "dashboardMeetings": {
    "comment": "List meetings",
    "doc": "List meetings\n  List total live or past meetings that occurred during a specified period of time. This overview will show if features such as audio, video, screen sharing, and recording were being used in the meeting. You can also see the license types of each user on your account.<br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.<br>\n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Resource-intensive`<br><br>\n  Prerequisites: <br>\n   Business or a higher plan.<br><br>"
  },
  "dashboardMeetingDetail": {
    "comment": "Get meeting details",
    "doc": "Get meeting details\n  Get details on live or past meetings. This overview will show if features such as audio, video, screen sharing, and recording were being used in the meeting. You can also see the license types of each user on your account.<br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.  <br>\n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites: <br>\n   Business or a higher plan."
  },
  "dashboardMeetingParticipants": {
    "comment": "List meeting participants",
    "doc": "List meeting participants\n  Get a list of participants from live or past meetings.<br><br>\n  If you do not provide the `type` query parameter, the default value will be set to `live` and thus, you will only see metrics for participants in a live meeting, if any meeting is currently being conducted. To view metrics on past meeting participants, provide the appropriate value for `type`. <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.\n \n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites: Business or a higher plan."
  },
  "dashboardMeetingParticipantsQos": {
    "comment": "List meeting participants QoS",
    "doc": "List meeting participants QoS\n  Get a list of meeting participants from live or past meetings along with the quality of service they recieve during the meeting such as connection quality for sending/receiving video, audio, and shared content.<br>If you do not provide the `type` query parameter, the default value will be set to `live` and thus, you will only see metrics for participants in a live meeting, if any meeting is currently being conducted. To view metrics on past meeting participants, provide the appropriate value for `type`.<br> <br> You can specify a monthly date range for the dashboard data using the `from` and `to` query parameters. The month should fall within the last six months.<br><br>\n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites: <br>\n   Business or a higher plan."
  },
  "participantFeedback": {
    "comment": "Get post meeting feedback",
    "doc": "Get post meeting feedback\n  When a meeting ends, each attendee will be prompted to share their meeting experience by clicking either thumbs up or thumbs down. Use this API to retrieve the feedback submitted for a specific meeting. Note that this API only works for meetings scheduled after December 20, 2020.\n \n  Prerequisites:\n   [Feedback to Zoom](https://support.zoom.us/hc/en-us/articles/115005838023) setting must be enabled by the participant prior to the meeting.\n   The user making the API request must be enrolled in a Business or a higher plan.\n \n  <br> Scope: `dashboard_meetings:read:admiin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "dashboardMeetingParticipantShare": {
    "comment": "Get sharing/recording details",
    "doc": "Get sharing/recording details\n  Retrieve the sharing and recording details of participants from live or past meetings.<br>\n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites: <br>\n   Business or a higher plan."
  },
  "dashboardMeetingParticipantQos": {
    "comment": "Get meeting participant QoS",
    "doc": "Get meeting participant QoS\n  Retrieve the quality of service for participants from live or past meetings. This data indicates the connection quality for sending/receiving video, audio, and shared content. If nothing is being sent or received at that time, no information will be shown in the fields. <br><br>\n  Scopes: `dashboard_meetings:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "dashboardWebinars": {
    "comment": "List webinars",
    "doc": "List webinars\n  List all the live or past webinars from a specified period of time. <br><br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Resource-intensive`<br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Webinar add-on."
  },
  "dashboardWebinarDetail": {
    "comment": "Get webinar details",
    "doc": "Get webinar details\n  Retrieve details from live or past webinars.<br><br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Webinar add-on."
  },
  "dashboardWebinarParticipants": {
    "comment": "Get webinar participants",
    "doc": "Get webinar participants\n  Retrieve details on participants from live or past webinars.<br><br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Webinar add-on."
  },
  "dashboardWebinarParticipantsQos": {
    "comment": "List webinar participant QoS",
    "doc": "List webinar participant QoS\n  Retrieve a list of participants from live or past webinars and the quality of service they received.<br>This data indicates the connection quality for sending/receiving video, audio, and shared content. If nothing is being sent or received at that time, no information will be shown in the fields.<br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:\n   Business, Education or API Plan with Webinar add-on."
  },
  "participantWebinarFeedback": {
    "comment": "Get post webinar feedback",
    "doc": "Get post webinar feedback\n  When a Webinar ends, each attendee will be prompted to share their Webinar experience by clicking either thumbs up or thumbs down. Use this API to retrieve the feedback submitted for a specific webinar. Note that this API only works for meetings scheduled after December 20, 2020.\n \n  Prerequisites:\n   [Feedback to Zoom](https://support.zoom.us/hc/en-us/articles/115005838023) setting must be enabled by the participant prior to the meeting.\n   The user making the API request must be enrolled in a Business or a higher plan.\n \n \n  <br> Scope: `dashboard_webinars:read:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "dashboardWebinarParticipantShare": {
    "comment": "Get sharing/recording details",
    "doc": "Get sharing/recording details\n  Retrieve the sharing and recording details of participants from live or past webinars. <br><br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy` <br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Webinar add-on."
  },
  "dashboardWebinarParticipantQos": {
    "comment": "Get webinar participant QoS",
    "doc": "Get webinar participant QoS\n  Retrieve details on the quality of service that participants from live or past webinars recieved.<br>This data indicates the connection quality for sending/receiving video, audio, and shared content. If nothing is being sent or received at that time, no information will be shown in the fields.<br>\n  Scopes: `dashboard_webinars:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy` <br>\n  Prerequisites: <br>\n   Business, Education or API Plan with Zoom Rooms set up."
  },
  "dashboardZoomRooms": {
    "comment": "List Zoom Rooms",
    "doc": "List Zoom Rooms\n  List information on all Zoom Rooms in an account.<br><br>\n  Scopes: `dashboard_zr:read:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Resource-intensive`<br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Zoom Rooms set up."
  },
  "dashboardZoomRoomIssue": {
    "comment": "Get top 25 issues of Zoom Rooms",
    "doc": "Get top 25 issues of Zoom Rooms\n  Get top 25 issues of Zoom Rooms.<br>\n  Scopes: `dashboard_zr:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Business, Education or API Plan with Zoom Rooms set up."
  },
  "dashboardZoomRoom": {
    "comment": "Get Zoom Rooms details",
    "doc": "Get Zoom Rooms details\n  The Zoom Rooms dashboard metrics lets you know the type of configuration a Zoom room has and details on the meetings held in that room.\n \n  Use this API to retrieve information on a specific room.<br><br>\n  Scopes: `dashboard_zr:read:admin`<br> <br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`Prerequisites:<br>\n   Business, Education or API Plan with Zoom Rooms set up."
  },
  "listPastMeetingFiles": {
    "comment": "List past meeting's files",
    "doc": "List past meeting's files\n  Note: This API has been deprecated and is no longer supported due to GCM encryption updates for security purposes. To learn about saving the in-meeting chat files via Zoom Client, refer to the [Saving in-meeting chat](https://support.zoom.us/hc/en-us/articles/115004792763-Saving-in-meeting-chat) guide.\n \n  List files sent via in-meeting chat during a meeting. The in-meeting files are deleted after 24 hours of the meeting completion time.\n  <br><br>\n  Scope: `meeting:read`, `meeting:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "pastMeetings": {
    "comment": "List ended meeting instances",
    "doc": "List ended meeting instances\n  Get a list of ended meeting instances<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listPastMeetingPolls": {
    "comment": "List past meeting's poll results",
    "doc": "List past meeting's poll results\n  [Polls](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings) allow the meeting host to survey attendees. Use this API to list poll results of a meeting.<br><br>\n \n  Scopes: `meeting:read:admin`, `meeting:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium` <br>\n  Prerequisites:<br>\n   Host user type must be Pro.\n   Meeting must be a scheduled meeting. Instant meetings do not have polling features enabled."
  },
  "pastMeetingDetails": {
    "comment": "Get past meeting details",
    "doc": "Get past meeting details\n  Get details on a past meeting. <br><br>\n  Scopes: `meeting:read:admin` `meeting:read`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`\n  > Note: Please double encode your UUID when using this API if the UUID begins with a '/'or contains '//' in it."
  },
  "pastMeetingParticipants": {
    "comment": "Get past meeting participants",
    "doc": "Get past meeting participants\n  Retrieve information on participants from a past meeting. <br><br>\n  Scopes: `meeting:read:admin` `meeting:read`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n  Prerequisites:<br>\n   Paid account on a Pro or higher plan.\n \n  <br> <br>  Note: Please double encode your UUID when using this API if the UUID begins with a '/'or contains '//' in it."
  },
  "webinarAbsentees": {
    "comment": "Get webinar absentees",
    "doc": "Get webinar absentees\n  List absentees of a webinar.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "listPastWebinarFiles": {
    "comment": "List past webinar files",
    "doc": "List past webinar files\n  Note: This API has been deprecated and is no longer supported due to GCM encryption updates for security purposes.\n \n  List files sent via in-meeting chat during a meeting. The in-meeting files are deleted after 24 hours of the meeting completion time.\n  <br><br>\n  Scope: `webinar:read`, `webinar:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "pastWebinars": {
    "comment": "List past webinar instances",
    "doc": "List past webinar instances\n  List past webinar instances.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "listWebinarParticipants": {
    "comment": "List webinar participants",
    "doc": "List webinar participants\n  Use this API to list all the participants who attended a webinar hosted in the past. <br>\n \n  Prerequisites:\n   Pro or higher plan with a Webinar Add-on.<br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "listPastWebinarPollResults": {
    "comment": "List past webinar poll results",
    "doc": "List past webinar poll results\n  The polling feature for webinar allows you to create single choice or multiple choice polling questions for your webinars. Use this API to retrieve the results for Webinar Polls of a specific Webinar.\n \n  Prerequisites:<br>\n   [Webinar license](https://zoom.us/webinar)<br>\n  Scopes: `webinar:read:admin`, `webinar:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listPastWebinarQa": {
    "comment": "List Q&A of past webinar",
    "doc": "List Q&A of past webinar\n  The [Question & Answer (Q&A)](https://support.zoom.us/hc/en-us/articles/203686015-Getting-Started-with-Question-Answer) feature for Webinars allows attendees to ask questions during the Webinar and for the panelists, co-hosts and host to answer their questions.<br>\n  Use this API to list Q&A of a specific Webinar.\n \n  Prerequisites:<br>\n   [Webinar license](https://zoom.us/webinar)<br>\n  Scopes: `webinar:read:admin`, `webinar:read`<br>\n  <br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addAutoReceptionist": {
    "comment": "Add an auto receptionist",
    "doc": "Add an auto receptionist\n  Auto receptionists answer calls with a personalized recording and routes calls to a phone user, call queue, common area phone, voicemail or an IVR system. Use this API to add an [auto receptionist](https://support.zoom.us/hc/en-us/articles/360021121312-Managing-Auto-Receptionists-and-Interactive-Voice-Response-IVR-) to a Zoom Phone.<br>\n \n  Prerequisites:<br>\n   Pro or higher account with Zoom Phone license.<br>\n  Scopes: `phone:write:admin` <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateAutoReceptionist": {
    "comment": "Update auto receptionist details",
    "doc": "Update auto receptionist details\n  An auto receptionist answers calls with a personalized recording and routes calls to a phone user, call queue, common area phone, or voicemail. An auto receptionist can also be set up so that it routes calls to an interactive voice response (IVR) system to allow callers to select the routing options.<br>\n  Use this API to [change information](https://support.zoom.us/hc/en-us/articles/360021121312-Managing-Auto-Receptionists-and-Interactive-Voice-Response-IVR-#h_1d5ffc56-6ba3-4ce5-9d86-4a1a1ee743f3) such as display name and extension number assigned to the main auto receptionist.<br><br>\n  Prerequisites:<br>\n   Pro or higher account with Zoom Phone license.<br>\n  Scopes: `phone:write:admin` <br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unassignAllPhoneNumsAutoReceptionist": {
    "comment": "Unassign all phone numbers",
    "doc": "Unassign all phone numbers\n  Unassign all phone numbers that were previously assigned to an [auto receptionist](https://support.zoom.us/hc/en-us/articles/360021121312-Managing-Auto-Receptionists-and-Interactive-Voice-Response-IVR-).\n \n  Prerequisites:\n   Pro or higher account plan with Zoom Phone License\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "assignPhoneNumbersAutoReceptionist": {
    "comment": "Assign phone numbers",
    "doc": "Assign phone numbers\n  Assign available phone numbers to an [auto receptionist](https://support.zoom.us/hc/en-us/articles/360021121312-Managing-Auto-Receptionists-and-Interactive-Voice-Response-IVR-). The available numbers can be retrieved using the List Phone Numbers API with `type` query parameter set to \"unassigned\".\n \n  Prerequisites:\n   Pro or higher account plan with Zoom Phone License\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unassignAphoneNumAutoReceptionist": {
    "comment": "Unassign a phone number",
    "doc": "Unassign a phone number\n  Unassign a specific phone number that was previously assigned to an [auto receptionist](https://support.zoom.us/hc/en-us/articles/360021121312-Managing-Auto-Receptionists-and-Interactive-Voice-Response-IVR-).\n \n  Prerequisites:\n   Pro or higher account plan with Zoom Phone License\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listBlockedList": {
    "comment": "List blocked lists",
    "doc": "List blocked lists\n  A Zoom account owner or a user with admin privilege can block phone numbers for phone users in an account. Blocked numbers can be inbound (numbers will be blocked from calling in) and outbound (phone users in your account won't be able to dial those numbers). Blocked callers will hear a generic message stating that the person they are calling is not available.<br>Use this API to list all the blocked lists in an acccount.<br>\n  Prerequisites:\n   Pro or higher account plan with Zoom phone license<br>\n  Scope: `phone:read:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addAnumberToBlockedList": {
    "comment": "Create a blocked list",
    "doc": "Create a blocked list\n  A Zoom account owner or a user with admin privilege can block phone numbers for phone users in an account. Blocked numbers can be inbound (numbers will be blocked from calling in) and outbound (phone users in your account won't be able to dial those numbers). Blocked callers will hear a generic message stating that the person they are calling is not available.<br>Use this API to create a blocked list and add a number to that blocked list.<br>\n  Prerequisites:\n   Pro or higher account plan with Zoom phone license<br>\n  Scope: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAblockedList": {
    "comment": "Delete a blocked list",
    "doc": "Delete a blocked list\n  A Zoom account owner or a user with admin privilege can block phone numbers for phone users in an account. Blocked numbers can be inbound (numbers will be blocked from calling in) and outbound (phone users in your account won't be able to dial those numbers).\n  <br>Use this API to delete a blocked list and therefore removing the associated number from the blocked list. The number will be unblocked after the deletion.<br>\n  Prerequisites:\n   Pro or higher account plan with Zoom phone license<br>\n  Scope: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAblockedList": {
    "comment": "Get blocked list details",
    "doc": "Get blocked list details\n  A Zoom account owner or a user with admin privilege can block phone numbers for phone users in an account. Blocked numbers can be inbound (numbers will be blocked from calling in) and outbound (phone users in your account won't be able to dial those numbers). Blocked callers will hear a generic message stating that the person they are calling is not available.<br>Use this API to get information about a specific blocked list.<br>\n  Prerequisites:\n   Pro or higher account plan with Zoom phone license<br>\n  Scope: `phone:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateBlockedList": {
    "comment": "Update a blocked list",
    "doc": "Update a blocked list\n  A Zoom account owner or a user with admin privilege can block phone numbers for phone users in an account. Blocked numbers can be inbound (numbers will be blocked from calling in) and outbound (phone users in your account won't be able to dial those numbers). Blocked callers will hear a generic message stating that the person they are calling is not available.<br>Use this API to update information on the blocked list.<br>\n  Prerequisites:\n   Pro or higher account plan with Zoom phone license<br>\n  Scope: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "addByocNumber": {
    "comment": "Add BYOC phone numbers",
    "doc": "Add BYOC phone numbers\n  Use this API to add BYOC phone numbers(provided to you by your carrier) to Zoom.\n \n  Scope: `phone:write:admin` or `phone:write` or `phone:master`\n \n  Prerequisites:<br>\n   The account must hold a business or enterprise plan and Zoom Phone license.\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "accountCallLogs": {
    "comment": "Get account's call logs",
    "doc": "Get account's call logs\n  Retrieve [call logs](https://support.zoom.us/hc/en-us/articles/360021114452-Viewing-Call-Logs) for an account.\n \n  Scopes: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisite:<br>\n  1. Business or Enterprise account<br>\n  2. A Zoom Phone license<br>\n  3. Account Owner and a [role](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) with Zoom Phone Management<br>"
  },
  "listCallQueues": {
    "comment": "List call queues",
    "doc": "List call queues\n  Call queues allow you to route incoming calls to a group of users. For instance, you can use call queues to route calls to various departments in your organization such as sales, engineering, billing, customer service etc.<br> Use this API to list Call queues.<br><br>\n  Prerequisites:<br>\n   Pro, Business, or Education account\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:read:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "createCallQueue": {
    "comment": "Create a call queue",
    "doc": "Create a call queue\n  Call queues allow you to route incoming calls to a group of users. For instance, you can use call queues to route calls to various departments in your organization such as sales, engineering, billing, customer service etc.<br> Use this API to [create a call queue](https://support.zoom.us/hc/en-us/articles/360021524831-Managing-Call-Queues#h_e81faeeb-9184-429a-aaea-df49ff5ff413).<br> You can add phone users or common area phones to call queues.\n \n  Prerequisites:<br>\n   Pro, Business, or Education account\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAcallQueue": {
    "comment": "Delete a call queue",
    "doc": "Delete a call queue\n  Call queues allow you to route incoming calls to a group of users. For instance, you can use call queues to route calls to various departments in your organization such as sales, engineering, billing, customer service etc.<br> Use this API to delete a Call Queue.<br>\n  Prerequisites:<br>\n   Pro, Business, or Education account\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAcallQueue": {
    "comment": "Get call queue details",
    "doc": "Get call queue details\n  Call queues allow you to route incoming calls to a group of users. For instance, you can use call queues to route calls to various departments in your organization such as sales, engineering, billing, customer service etc.<br> Use this API to get information on a specific Call Queue.<br><br>\n  Prerequisites:<br>\n   Pro, Business, or Education account\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:read:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateCallQueue": {
    "comment": "Update call queue details",
    "doc": "Update call queue details\n  Call queues allow you to route incoming calls to a group of users. For instance, you can use call queues to route calls to various departments in your organization such as sales, engineering, billing, customer service etc.<br> Use this API to update information of a specific Call Queue.<br>\n  Prerequisites:<br>\n   Pro, Business, or Education account\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "changeCallQueueManager": {
    "comment": "Change call queue manager",
    "doc": "Change call queue manager\n  A call queue manager has the privileges to maanage the call queue's voicemail inbox and recordings, change all call queue settings and call queue policy settings.<br><br> Use this API to to set another phone user as the [call queue manager](https://support.zoom.us/hc/en-us/articles/360021524831-Managing-Call-Queues#h_db06854b-e6a3-4afe-ba15-baf58f31f90c).\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unassignAllMembers": {
    "comment": "Unassign all members",
    "doc": "Unassign all members\n  Use this API to remove all members from a Call Queue who were previously assigned to that Call Queue. The members could be phone users or [common area phones](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones).\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "addMembersToCallQueue": {
    "comment": "Add members to a call queue",
    "doc": "Add members to a call queue\n  Add phone users and/or [common area phones](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones) as members to a specific Call Queue.<br><br>\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unassignMemberFromCallQueue": {
    "comment": "Unassign a member",
    "doc": "Unassign a member\n  Use this API to remove a member from a Call Queue who was previously added to that Call Queue. The member could be a phone user or a [common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones). A member who is a Call Queue Manager cannot be unassigned from the Call Queue using this API.\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unassignAphoneNumCallQueue": {
    "comment": "Unassign all phone numbers",
    "doc": "Unassign all phone numbers\n  Use this API to unbind all phone numbers that are assigned to a [Call Queue](https://support.zoom.us/hc/en-us/articles/360021524831-Managing-Call-Queues) After successful unbinding, the numbers will appear in the [Unassigned tab](https://zoom.us/signin#/numbers/unassigned).<br> If you only need to unassign a specific phone number, use the Unassign a Phone Number API instead. <br>\n  Prerequisites:\n   Pro or higher account palan\n   Account owner or admin permissions\n   Zoom Phone license <br> Scopes: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "assignPhoneToCallQueue": {
    "comment": "Assign numbers to a call queue",
    "doc": "Assign numbers to a call queue\n  After [buying phone number(s)](https://support.zoom.us/hc/en-us/articles/360020808292#h_007ec8c2-0914-4265-8351-96ab23efa3ad), you can assign it, allowing callers to directly dial a number to reach a [call queue](https://support.zoom.us/hc/en-us/articles/360021524831-Managing-Call-Queues).<br><br>\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Account owner or admin permissions\n   Zoom Phone license<br>\n  Scopes: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "unAssignPhoneNumCallQueue": {
    "comment": "Unassign a phone number",
    "doc": "Unassign a phone number\n  After assigning a phone number, you can unbind it if you don't want it to be assigned to a [Call Queue](https://support.zoom.us/hc/en-us/articles/360021524831-Managing-Call-Queues). Use this API to unbind a phone number from a Call Queue. After successful unbinding, the number will appear in the [Unassigned tab](https://zoom.us/signin#/numbers/unassigned).<br><br>\n  Prerequisites:\n   Pro or higher account palan\n   Account owner or admin permissions\n   Zoom Phone license <br> Scopes: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getCallQueueRecordings": {
    "comment": "Get call queue recordings",
    "doc": "Get call queue recordings\n  Use this API to view [call recordings](https://support.zoom.us/hc/en-us/articles/360038521091#h_cbc9f2a3-e06c-4daa-83d4-ddbceef9c77b) from the call queue.<br><br>\n  Prerequisites:<br>\n   Pro or higher account with Zoom Phone license.\n   [Automatic call recordings](https://support.zoom.us/hc/en-us/articles/360033511872#h_fcb297bb-14e8-4094-91ca-dc61e1a18734) must be enabled in the Policy Settings for call queues. <br> Scope: `phone:read:admin`<br> [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listCallingPlans": {
    "comment": "List calling plans",
    "doc": "List calling plans\n  List all Zoom Phone [calling plans](https://marketplace.zoom.us/docs/api-reference/other-references/plans#zoom-phone-calling-plans) that are enabled for a Zoom account.<br><br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom phone license. <br>\n  Scope: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listCommonAreaPhones": {
    "comment": "List common area phones",
    "doc": "List common area phones\n  A common area phone can be provisioned by a Zoom account owner or a Zoom admin so that anyone in an organization can use it. For example, if your office has shared desks that don't belong to a specific employees, you could add a common area phone so that any person can use it.<br> Use this API to [list all common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones) in an account.<br><br>Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license.\n   Account owner or admin permissions.\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br><br>\n  Scope: `phone:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addCommonAreaPhone": {
    "comment": "Add a common area phone",
    "doc": "Add a common area phone\n  A common area phone can be provisioned by a Zoom account owner or a Zoom admin so that anyone in an organization can use it. For example, if your office has shared desks that don't belong to a specific employees, you could add a common area phone so that any person can use it.<br> Use this API to [add a common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones#h_2d0da347-c35a-4993-9771-e21aaa568deb).<br><br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license.\n   Account owner or admin permissions.\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br>\n  Scope: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteCommonAreaPhone": {
    "comment": "Delete a common area phone",
    "doc": "Delete a common area phone\n  A common area phone can be provisioned by a Zoom account owner or a Zoom admin so that anyone in an organization can use it. For example, if your office has shared desks that don't belong to a specific employees, you could add a common area phone so that any person can use it.<br> Use this API to remove the [common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones) from Zoom Phone System in an account.<br><br>Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license.\n   Account owner or admin permissions.\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAcommonAreaPhone": {
    "comment": "Get common area phone details",
    "doc": "Get common area phone details\n  A common area phone can be provisioned by a Zoom account owner or a Zoom admin so that anyone in an organization can use it. For example, if your office has shared desks that don't belong to a specific employees, you could add a common area phone so that any person can use it.<br> Use this API to get details on a specific [common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones) in an account.<br>For the `commonAreaPhoneId`, use the unique identifier or the Mac address of the common area phone. The Mac address can be hyphenated (00-04-f2-5e-ec-3c) or not hyphenated (0004f25eec3c).<br><br>Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license.\n   Account owner or admin permissions.\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br>\n  Scopes: `phone:read:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateCommonAreaPhone": {
    "comment": "Update common area phone",
    "doc": "Update common area phone\n  A common area phone can be provisioned by a Zoom account owner or a Zoom admin so that anyone in an organization can use it. For example, if your office has shared desks that don't belong to a specific employees, you could add a common area phone so that any person can use it.<br> Use this API to update details on a specific [common area phone](https://support.zoom.us/hc/en-us/articles/360028516231-Managing-Common-Area-Phones) in an account.<br><br>Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license.\n   Account owner or admin permissions.\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "changeMainCompanyNumber": {
    "comment": "Change main company number",
    "doc": "Change main company number\n  The [main company number](https://support.zoom.us/hc/en-us/articles/360028553691) can be used by external callers to reach your phone users (by dialing the main company number and the user's extension). It can also be used by phone users in your account as their caller ID while making calls.<br><br> Use this API to [change the main company number](https://support.zoom.us/hc/en-us/articles/360028553691#h_82414c34-9df2-428a-85a4-efcf7f9e0d72) of an account.<br><br>\n  Prerequisites:<br>\n   Pro or higher account plan.\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listPhoneDevices": {
    "comment": "List devices",
    "doc": "List devices\n  List all the [desk phone devices](https://support.zoom.us/hc/en-us/articles/360021119092) that are configured with Zoom Phone on an account. To view devices that have not yet been assigned to a user, set the value of the `type` query parameter as `unassigned` and to view devices that have been assigned, set the value as `assigned`.<br><br>\n  Scopes: `phone:read:admin`\n  <br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license\n   Account owner or admin permissions<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addPhoneDevice": {
    "comment": "Add a device",
    "doc": "Add a device\n  By default, all Zoom Phone users can make and receive calls using the Zoom desktop and mobile applications. Additionally, if a desk phone is required, use this API to [add a desk phone and assign it](https://support.zoom.us/hc/en-us/articles/360021119092#h_5ca07504-68a8-4c3d-ad0e-c1d3594436da) to a user.\n \n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license\n   Account owner or admin permissions\n   [Supported device](https://support.zoom.us/hc/en-us/articles/360001299063-Zoom-Voice-Supported-Devices)<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAdevice": {
    "comment": "Delete a device",
    "doc": "Delete a device\n  Remove a [desk phone device](https://support.zoom.us/hc/en-us/articles/360021119092) from the Zoom Phone System Management.<br><br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license\n   Account owner or admin permissions\n   Device must not have been assigned to a user.<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAdevice": {
    "comment": "Get device details",
    "doc": "Get device details\n  Get detailed information about a specific [desk phone device](https://support.zoom.us/hc/en-us/articles/360021119092).<br><br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateAdevice": {
    "comment": "Update a device",
    "doc": "Update a device\n  Update information of a [desk phone device](https://support.zoom.us/hc/en-us/articles/360021119092).<br><br>\n  Prerequisites:<br>\n   Pro or a higher account with Zoom Phone license\n   Account owner or admin permissions<br>\n  Scopes: `phone:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listCallLogsMetrics": {
    "comment": "List call logs",
    "doc": "List call logs\n  Call logs provide a record of all incoming and outgoing calls over Zoom Phone in an account.\n \n  Use this API to list monthly call logs metrics. You can use query parameters to filter the response by date, site and MOS(Mean Opinion Score) of the call.\n \n  Prerequisites:\n   Business, or Education account\n   Zoom Phone license <br><br>\n \n  Scopes: `phone:read:admin`, `phone:write:admin`<br>\n  Rate Limit Label: `Heavy`"
  },
  "getCallQoS": {
    "comment": "Get call QoS",
    "doc": "Get call QoS\n  Get call quality of service(QoS) data for a call made or received by a Zoom phone user in the account.\n \n  Prerequisites:\n   Business, or Education account\n   Zoom Phone license <br><br>\n  Scopes: `phone:read:admin`, `phone:write:admin`<br>\n  Rate Limit Label: `Light`"
  },
  "getCallLogMetricsDetails": {
    "comment": "Get call details from call log",
    "doc": "Get call details from call log\n  Call logs provide a record of all incoming and outgoing calls over Zoom Phone in an account.\n \n  Use this API to list call log details of a specific call.\n \n  Prerequisites:\n   Business, or Education account\n   Zoom Phone license <br><br>\n \n  Scopes: `phone:read:admin`, `phone:write:admin`<br>\n  Rate Limit Label: `Light`"
  },
  "listAccountPhoneNumbers": {
    "comment": "List phone numbers",
    "doc": "List phone numbers\n  A Zoom account owner or admin can purchase phone numbers and assign them to Zoom phone users. Use this API to list all Zoom Phone numbers in a Zoom account. You can filter the response based on your needs by using query parameters.\n \n  Prerequisites:<br>\n   Pro or higher plan with Zoom phone license<br>\n  Scope: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getPhoneNumberDetails": {
    "comment": "Get phone number details",
    "doc": "Get phone number details\n  A Zoom account owner or admin can purchase phone numbers and assign them to Zoom phone users. Use this API to get details on a specific Phone number in a Zoom account.<br><br>\n  Prerequisites:<br>\n   Pro or higher plan with Zoom phone license<br>\n  Scope: `phone:read:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updatePhoneNumberDetails": {
    "comment": "Update phone number details",
    "doc": "Update phone number details\n  Update phone number details.\n \n  Scopes:\n   `phone:write` `phone:write:admin`\n   `phone:master`\n \n  Prerequisite:\n   Paid account\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getPhoneRecordings": {
    "comment": "Get call recordings",
    "doc": "Get call recordings\n  List [call recordings](https://support.zoom.us/hc/en-us/articles/360038521091-Accessing-and-sharing-call-recordings) of an account.<br>\n \n  Scopes:<br>\n   `phone:read:admin` `phone:write:admin`\n \n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges."
  },
  "getPsOperationLogs": {
    "comment": "Get operation logs report",
    "doc": "Get operation logs report\n  The Phone System operation logs report allows account owners and admins to view monthly Zoom phone related admin operation details.\n \n  Use this API to retrieve the Phone System Operation Logs Report. Account owners and admins can also access this information by logging into their Zoom accounts and navigating to [Phone System Operation Logs](https://zoom.us/pbx/page/report/operations#/report/operation-logs).<br><br> Scopes: `phone:read:admin`, `phone:write:admin` <br> [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  <br> Prerequisites: <br>\n   Account must be enrollled in Pro or a higher plan\n   Account must be enrolled in a [Zoom Phone](https://zoom.us/pricing/zoom-phone) plan"
  },
  "listSettingTemplates": {
    "comment": "List setting templates",
    "doc": "List setting templates\n  This API lets you retrieve a list of all the phone template settings previously created.\n  <br>\n  Scope:<br>\n   `phone:read:admin` or `phone:read`\n  <br>Prerequisites: <br>\n  1. Business or enterprise Account\n  2. A Zoom Phone license\n \n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "addSettingTemplate": {
    "comment": "Add a setting template",
    "doc": "Add a setting template\n  This API lets you create a Zoom Phone setting template for an account. Template type includes User, Auto Receptionist, or Call Queue. Settings include profile, policy and user settings. After creating a phone template, the settings defined via this request will become the default settings for an account.\n  <br><br>\n  Scope:\n   `phone:write:admin` `phone:write`\n \n \n  Prerequisites:\n  1. Business or enterprise Zoom account\n  2. A Zoom Phone license\n \n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n \n \n  <br>"
  },
  "getSettingTemplate": {
    "comment": "Get setting template details",
    "doc": "Get setting template details\n  This API lets you retrieve a specific account phone template previously created. <br>\n \n  Scope: <br>\n   `phone:write:admin` or `phone:write`\n \n  Prerequisites: <br>\n  1. Business or Enterprise Account\n  2. A Zoom Phone license\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "updateSettingTemplate": {
    "comment": "Update a setting template",
    "doc": "Update a setting template\n  Use this API to update or modify profile settings for the phone template. Template type includes User, Auto Receptionist, or Call Queue. After you've modified a template, click User Settings to set up settings for Call Handling, Desk Phone, and Others. <br>\n \n  Scope:<br>\n   `phone:write:admin` or `phone:write`\n \n  Prerequisites: <br>\n  1. Business or Enterprise Account\n  2. A Zoom Phone license\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "listSharedLineGroups": {
    "comment": "List shared line groups",
    "doc": "List shared line groups\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. This gives members of the shared line group access to the group's direct phone number and voicemail. Use this API to list all the Shared Line Groups.\n \n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges  <br>\n \n  Scopes: `phone:read:admin`, `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "createAsharedLineGroup": {
    "comment": "Create a shared line group",
    "doc": "Create a shared line group\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. This gives members of the shared line group access to the group's direct phone number and voicemail. Use this API to create a shared line group.\n \n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAsharedLineGroup": {
    "comment": "Delete a shared line group",
    "doc": "Delete a shared line group\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. Use this API to delete a Shared Line Group.\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAsharedLineGroup": {
    "comment": "Get a shared line group",
    "doc": "Get a shared line group\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. This gives members of the shared line group access to the group's direct phone number and voicemail. Use this API to list all the Shared Line Groups.\n \n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges\n \n  Scopes: `phone:read:admin` or `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateAsharedLineGroup": {
    "comment": "Update a shared line group",
    "doc": "Update a shared line group\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. This gives members of the shared line group access to the group's direct phone number and voicemail. Use this API to update information of a Shared Line Group.\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteMembersOfSlg": {
    "comment": "Unassign members of a shared line group",
    "doc": "Unassign members of a shared line group\n  Members of the [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) have access to the group's phone number and voicemail. Use this API to unassign all the existing members from a Shared Line Group.\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   A valid Shared Line Group\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "addMembersToSharedLineGroup": {
    "comment": "Add members to a shared line group",
    "doc": "Add members to a shared line group\n  A [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) allows Zoom Phone admins to share a phone number and extension with a group of phone users or common area phones. This gives members of the shared line group access to the group's direct phone number and voicemail. Use this API to [add members](https://support.zoom.us/hc/en-us/articles/360038850792-Setting-up-shared-line-groups#h_7cb42370-48f6-4a8f-84f4-c6eee4d9f0ca) to a Shared Line Group. Note that a member can only be added to one shared line group.\n \n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   A valid Shared Line Group\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAmemberSlg": {
    "comment": "Unassign a member from a shared line group",
    "doc": "Unassign a member from a shared line group\n  Members of the [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792) have access to the group's phone number and voicemail. Use this API to unassign a specific member from a Shared Line Group.\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   A valid Shared Line Group\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "assignPhoneNumbersSlg": {
    "comment": "Assign phone numbers",
    "doc": "Assign phone numbers\n  Use this API to assign phone numbers to a shared line groups. These direct phone numbers will be shared among members of the [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792-Setting-up-shared-line-groups).\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   A valid Shared Line Group\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteAphoneNumberSlg": {
    "comment": "Unassign a phone number",
    "doc": "Unassign a phone number\n  Use this API to unassign a specific phone number that was assigned to the [shared line group](https://support.zoom.us/hc/en-us/articles/360038850792-Setting-up-shared-line-groups).\n  Prerequisties: <br>\n   Pro or higher account with Zoom Phone license.\n   A valid Shared Line Group\n   Account owner or admin privileges\n \n  Scopes: `phone:write:admin`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listByocsipTrunk": {
    "comment": "List BYOC SIP trunks",
    "doc": "List BYOC SIP trunks\n  List [BYOC SIP trunks](https://zoom.us/docs/doc/Zoom-Bring%20Your%20Own%20Carrier.pdf) that are assigned to an account.\n \n  Scopes:<br>\n   `phone:write:admin` or `phone:master`<br>\n \n  Prerequisites:<br>\n   Business or Enterprise Account\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "listPhoneSites": {
    "comment": "List phone sites",
    "doc": "List phone sites\n  Sites allow you to organize Zoom Phone users in your organization. Use this API to list all the [sites](https://support.zoom.us/hc/en-us/articles/360020809672) that have been created for an account.<br>\n  Prerequisites:<br>\n   Multiple Sites must be [enabled](https://support.zoom.us/hc/en-us/articles/360020809672-Managing-Multiple-Sites#h_05c88e35-1593-491f-b1a8-b7139a75dc15).\n   Pro or a higher account with Zoom Phone enabled.\n \n  Scope: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "createPhoneSite": {
    "comment": "Create a phone site",
    "doc": "Create a phone site\n  Sites allow you to organize Zoom Phone users in your organization. Use this API to create a [Site](https://support.zoom.us/hc/en-us/articles/360020809672).<br>\n  Prerequisites:<br>\n   Multiple Sites must be [enabled](https://support.zoom.us/hc/en-us/articles/360020809672-Managing-Multiple-Sites#h_05c88e35-1593-491f-b1a8-b7139a75dc15).\n   Pro or a higher account with Zoom Phone enabled.\n  Scope: `phone:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deletePhoneSite": {
    "comment": "Delete a phone site",
    "doc": "Delete a phone site\n  Sites allow you to organize Zoom Phone users in your organization. Use this API to delete a specific [site](https://support.zoom.us/hc/en-us/articles/360020809672) in a Zoom account. To delete a site, in the query parameter, you must provide the Site ID of another site where the assets of current site (users, numbers and phones) can be transferred to.  You cannot use this API to delete the main site.\n \n  Prerequisites: <br>\n   Account must have a Pro or a higher plan with Zoom Phone license.\n   [Multiple Sites](https://support.zoom.us/hc/en-us/articles/360020809672-Managing-Multiple-Sites) must be enabled.<br>\n  Scope: `phone:write:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getAsite": {
    "comment": "Get phone site details",
    "doc": "Get phone site details\n  Sites allow you to organize Zoom Phone users in your organization. Use this API to get information about a specific [site](https://support.zoom.us/hc/en-us/articles/360020809672).\n \n \n  Prerequisites: <br>\n   Account must have a Pro or a higher plan with Zoom Phone license.\n   Multiple Sites must be [enabled](https://support.zoom.us/hc/en-us/articles/360020809672-Managing-Multiple-Sites#h_05c88e35-1593-491f-b1a8-b7139a75dc15).<br>\n  Scope: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateSiteDetails": {
    "comment": "Update phone site details",
    "doc": "Update phone site details\n  Sites allow you to organize Zoom Phone users in your organization. Use this API to update information about a specific [site](https://support.zoom.us/hc/en-us/articles/360020809672).\n \n \n  Prerequisites: <br>\n   Account must have a Pro or a higher plan with Zoom Phone license.\n   Scope: `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listPhoneUsers": {
    "comment": "List phone users",
    "doc": "List phone users\n  List all the users on an account who have been assigned Zoom Phone licenses.<br><br>\n  Prerequisites:<br>\n   Pro or higher plan with Zoom phone license<br>\n  Scope: `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "phoneUser": {
    "comment": "Get user's profile",
    "doc": "Get user's profile\n  Retrieve a user's [zoom phone](https://support.zoom.us/hc/en-us/articles/360001297663-Quickstart-Guide-for-Zoom-Phone-Administrators) profile.\n \n  Scopes: `phone:read`, `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`\n \n \n  Prerequisites :\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "updateUserProfile": {
    "comment": "Update user's profile",
    "doc": "Update user's profile\n  Update a [Zoom Phone](https://support.zoom.us/hc/en-us/categories/360001370051-Zoom-Phone) user's profile.\n \n  Scopes: `phone:write` `phone:write:admin`  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "phoneUserCallLogs": {
    "comment": "Get user's call logs",
    "doc": "Get user's call logs\n  Retrieve a [zoom phone](https://support.zoom.us/hc/en-us/articles/360001297663-Quickstart-Guide-for-Zoom-Phone-Administrators) user's call logs.\n \n  Scopes: `phone:read`, `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "deleteCallLog": {
    "comment": "Delete a user's call log",
    "doc": "Delete a user's call log\n  Delete a user's [call log](https://support.zoom.us/hc/en-us/articles/360021114452-Viewing-and-identifying-logs).\n \n  Scopes: `phone:write`, `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n \n  Prerequisites:\n  1. User must belong to a Business or an Enterprise account.\n  2. User must hold a Zoom Phone license."
  },
  "assignCallingPlan": {
    "comment": "Assign calling plan to a user",
    "doc": "Assign calling plan to a user\n  Assign [calling plan](https://marketplace.zoom.us/docs/api-reference/other-references/plans#zoom-phone-calling-plans) to a [Zoom Phone](https://support.zoom.us/hc/en-us/categories/360001370051-Zoom-Phone) user.\n \n  Scopes: `phone:write` `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "unassignCallingPlan": {
    "comment": "Unassign user's calling plan",
    "doc": "Unassign user's calling plan\n  Unassign a [calling plan](https://marketplace.zoom.us/docs/api-reference/other-references/plans#zoom-phone-calling-plans) that was previously assigned to a [Zoom Phone](https://support.zoom.us/hc/en-us/categories/360001370051) user.\n \n  Scopes: `phone:write` `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "assignPhoneNumber": {
    "comment": "Assign phone number to user",
    "doc": "Assign phone number to user\n  Assign a [phone number](https://support.zoom.us/hc/en-us/articles/360020808292-Managing-Phone-Numbers) to a user who has already enabled Zoom Phone.\n \n  Scopes: `phone:write` `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "unassignPhoneNumber": {
    "comment": "Unassign phone number",
    "doc": "Unassign phone number\n  Unassign [phone number](https://support.zoom.us/hc/en-us/articles/360020808292-Managing-Phone-Numbers#h_38ba8b01-26e3-4b1b-a9b5-0717c00a7ca6) of a Zoom phone user. <br>\n \n  After assigning a phone number, you can remove it if you don't want it to be assigned to anyone.\n \n  Scopes: `phone:write` `phone:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license\n  3. User must have been previously assigned a Zoom Phone number."
  },
  "phoneUserRecordings": {
    "comment": "Get user's recordings",
    "doc": "Get user's recordings\n  Retrieve a user's zoom [phone recordings](https://support.zoom.us/hc/en-us/articles/360021336671-Viewing-Call-History-and-Recordings).\n  Scopes: `phone:read`, `phone:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "phoneUserSettings": {
    "comment": "Get user's settings",
    "doc": "Get user's settings\n  Retrieve a user's zoom phone profile [settings](https://support.zoom.us/hc/en-us/articles/360021325712-Configuring-Settings).\n \n  Scopes: `phone:read`, `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "deleteUserSetting": {
    "comment": "Remove shared access",
    "doc": "Remove shared access\n  Remove the shared voicemail access settings that were previously assigned to a user.\n \n  To view these settings in your Zoom web portal, navigate to Admin >Phone System Management> Users & Rooms. Click the Users tab and select User Settings. Scroll down to Voicemail & Call Recordings.<br>\n \n  Scope: `phone:write:admin`<br><br>\n  Prerequisites:<br>\n   Business or enterprise Account<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "updateUserSetting": {
    "comment": "Update shared access",
    "doc": "Update shared access\n  Phone users can access [shared voicemail inboxes](https://support.zoom.us/hc/en-us/articles/360033863991-Sharing-and-controlling-access-to-a-voicemail-inbox) in the Zoom desktop client, web portal, or provisioned desk phone. Use this API to update the voicemail access permissions of a user.\n \n  To view these settings in the Zoom web portal, navigate to Admin >Phone System Management> Users & Rooms. Click the Users tab and select User Settings. Scroll down to Voicemail & Call Recordings.<br>\n \n  Scope: <br>`phone:write:admin`<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n \n \n \n  Prerequisites:<br>\n  Business or Enterprise Account"
  },
  "addUserSetting": {
    "comment": "Set up shared access",
    "doc": "Set up shared access\n  Phone users can access [shared voicemail inboxes](https://support.zoom.us/hc/en-us/articles/360033863991-Sharing-and-controlling-access-to-a-voicemail-inbox) in the Zoom desktop client, web portal, or provisioned desk phone. Use this API to define the voicemail access permissions of a user.\n \n  To view these settings in the Zoom web portal, navigate to Admin >Phone System Management> Users & Rooms. Click the Users tab and select User Settings. Scroll down to Voicemail & Call Recordings.<br>\n \n  Scope:`phone:write:admin`<br>\n  <br>[Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n \n \n \n  Prerequisites: <br>\n  Business or Enterprise Account"
  },
  "phoneUserVoiceMails": {
    "comment": "Get user's voicemails",
    "doc": "Get user's voicemails\n  Retrieve a user's Zoom Phone voicemails.\n \n  Scopes: `phone:read`, `phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisite:\n  1. Business or Enterprise account\n  2. A Zoom Phone license"
  },
  "deleteVoicemail": {
    "comment": "Delete a voicemail",
    "doc": "Delete a voicemail\n  Delete a [voicemail message](https://support.zoom.us/hc/en-us/articles/360021400211-Managing-voicemail-messages) from a Zoom account.\n \n  Scope: `phone:write:admin` or `phone:write`\n \n \n  Prerequisite:\n   The account must have activted Zoom Phone license.\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "reportSignInSignOutActivities": {
    "comment": "Get sign In / sign out activity report",
    "doc": "Get sign In / sign out activity report\n  Retrieve a list of sign in / sign out activity logs [report](https://support.zoom.us/hc/en-us/articles/201363213-Getting-Started-with-Reports) of users under a Zoom account.<br>\n  Prerequisites<br>\n   Pro or higher plan.<br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "reportCloudRecording": {
    "comment": "Get cloud recording usage report",
    "doc": "Get cloud recording usage report\n  Retrieve cloud recording usage report for a specified period. You can only get cloud recording reports that is one day ealier than the current date and for the most recent period of 6 months. The date gap between from and to dates should be smaller or equal to 30 days. <br>\n  Prerequisites<br>\n   Pro or higher plan.<br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "reportDaily": {
    "comment": "Get daily usage report",
    "doc": "Get daily usage report\n  Retrieve daily report to access the account-wide usage of Zoom services for each day in a given month. It lists the number of new users, meetings, participants, and meeting minutes.<br>\n  Prerequisites<br>\n   Pro or higher plan.<br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`"
  },
  "reportMeetingDetails": {
    "comment": "Get meeting detail reports",
    "doc": "Get meeting detail reports\n  Get a detailed report for a past meeting. <br>\n  Scopes: `report:read:admin`<br>\n  \\\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan.<br>"
  },
  "reportMeetingParticipants": {
    "comment": "Get meeting participant reports",
    "doc": "Get meeting participant reports\n  Get participant report for a past meeting.<br><br>\n  Scopes: `report:read:admin`<br>\n  \\\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan.<br>"
  },
  "reportMeetingPolls": {
    "comment": "Get meeting poll reports",
    "doc": "Get meeting poll reports\n  Retrieve a report of [poll](https://support.zoom.us/hc/en-us/articles/213756303-Polling-for-Meetings) results for a past meeting. <br><br>\n  Scopes: `report:read:admin`<br>\n  \\\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan.<br>"
  },
  "reportOperationLogs": {
    "comment": "Get operation logs report",
    "doc": "Get operation logs report\n  The [Operations Logs](https://support.zoom.us/hc/en-us/articles/360032748331-Operation-Logs) report allows you to audit admin and user activity, such as adding a new user, changing account settings, and deleting recordings.<br>\n  Use this API to retrieve operation logs report for a specified period of time.<br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or higher plan."
  },
  "reportTelephone": {
    "comment": "Get telephone reports",
    "doc": "Get telephone reports\n  The [telephone report](https://support.zoom.us/hc/en-us/articles/206514816-Telephone-reports) allows you to view who dialed into meetings via phone (Audio Conferencing or SIP Connected Audio) and which number they dialed into and other details. Use this API to get telephone report for a specified period of time.\n \n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>Prerequisites:<br>\n   Pro or higher plan."
  },
  "reportUsers": {
    "comment": "Get active/inactive host reports",
    "doc": "Get active/inactive host reports\n  A user is considered to be an active host during the month specified in the \"from\" and \"to\" range, if the user has hosted at least one meeting during this period. If the user didn't host any meetings during this period, the user is considered to be inactive.<br>The Active Hosts report displays a list of meetings, participants, and meeting minutes for a specific time range, up to one month. The month should fall within the last six months.<br>The Inactive Hosts report pulls a list of users who were not active during a specific period of time.\n  Use this API to retrieve an active or inactive host report for a specified period of time. The time range for the report is limited to a month and the month should fall under the past six months. <br>You can specify the type of report and date range using the query parameters.<br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or higher plan."
  },
  "reportMeetings": {
    "comment": "Get meeting reports",
    "doc": "Get meeting reports\n  Retrieve [report](https://support.zoom.us/hc/en-us/articles/216378603-Meeting-Reporting) on a past meeting for a specified period of time. The time range for the report is limited to a month and the month should fall under the past six months.\n \n  Meetings will only be returned in the response if the meeting has two or more unique participants.  <br><br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or higher plan."
  },
  "reportWebinarDetails": {
    "comment": "Get webinar detail reports",
    "doc": "Get webinar detail reports\n  Retrieve a [report](https://support.zoom.us/hc/en-us/articles/201393719-Webinar-Reporting) containing past webinar details.  <br><br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or higher plan with Webinar add-on."
  },
  "reportWebinarParticipants": {
    "comment": "Get webinar participant reports",
    "doc": "Get webinar participant reports\n  Get detailed report on each attendee of a webinar.<br><br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan with Webinar add-on enabled."
  },
  "reportWebinarPolls": {
    "comment": "Get webinar poll reports",
    "doc": "Get webinar poll reports\n  Retrieve a report on past [webinar polls](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars).<br><br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan with Webinar add-on enabled."
  },
  "reportWebinarQa": {
    "comment": "Get webinar Q&A report",
    "doc": "Get webinar Q&A report\n  The Question & Answer (Q&A) feature for webinars allows attendees to ask questions during the webinar and for the panelists, co-hosts and host to answer their questions.\n \n  Use this API to retrieve a report on question and answers from past webinars. <br><br>\n  Scopes: `report:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>\n  Prerequisites:<br>\n   Pro or a higher plan with Webinar add-on enabled."
  },
  "roles": {
    "comment": "List roles",
    "doc": "List roles\n  List [roles](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) on your account\n \n  Scopes: `role:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites :\n    Pro or higher plan.\n    For setting the initial role, you must be the Account Owner.\n    For subsequent role management, you must be the Account Owner or user with role management permissions."
  },
  "createRole": {
    "comment": "Create a role",
    "doc": "Create a role\n  Each Zoom user automatically has a role which can either be owner, administrator, or a member.\n \n  Pre-requisite:<br>\n   Pro or higher plan.\n   For setting the initial role, you must be the Account Owner.<br>\n   For subsequent role management, you must be the Account Owner or user with role management permissions.<br>\n  Scopes: `role:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteRole": {
    "comment": "Delete a role",
    "doc": "Delete a role\n  Each Zoom user automatically has a role which can either be owner, administrator, or a member. Account Owners and users with edit privileges for Role management can add customized roles with a list.\n \n  Use this API to delete a role.<br>\n  Pre-requisite:<br>\n   A Pro or higher plan.<br>\n   For role management and updates, you must be the Account Owner or user with role management permissions.\n \n  Scopes: `role:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getRoleInformation": {
    "comment": "Get role information",
    "doc": "Get role information\n  Each Zoom user automatically has a role which can either be owner, administrator, or a member. Account Owners and users with edit privileges for Role management can add customized roles with a list of privileges.\n \n  Use this API to get information including specific privileges assigned to a [role](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control).<br>\n  Pre-requisite:<br>\n   A Pro or higher plan.<br>\n   For role management and updates, you must be the Account Owner or user with role management permissions.\n \n  Scopes: `role:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateRole": {
    "comment": "Update role information",
    "doc": "Update role information\n  Each Zoom user automatically has a [role](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) which can either be owner, administrator, or a member. Account Owners and users with edit privileges for Role management can add customized roles with a list.\n \n  Use this API to change the privileges, name and description of a specific role.<br>\n  Pre-requisite:<br>\n   A Pro or higher plan.<br>\n   For role management and updates, you must be the Account Owner or user with role management permissions.<br>Scopes: `role:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "roleMembers": {
    "comment": "List members in a role",
    "doc": "List members in a role\n  User [roles](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) can have a set of permissions that allows access only to the pages a user needs to view or edit. Use this API to list all the members that are assigned a specific role.\n \n  Scope: `role:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>Prerequisites:<br>\n   A Pro or a higher plan."
  },
  "addRoleMembers": {
    "comment": "Assign a role",
    "doc": "Assign a role\n  User [roles](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) can have a set of permissions that allows access only to the pages a user needs to view or edit. Use this API to [assign a role](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control#h_748b6fd8-5057-4cf4-bbfd-787909c09db0) to members.\n \n  Scopes: `role:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites:<br>\n   A Pro or a higher plan."
  },
  "roleMemberDelete": {
    "comment": "Unassign a role",
    "doc": "Unassign a role\n  User [roles](https://support.zoom.us/hc/en-us/articles/115001078646-Role-Based-Access-Control) can have a set of permissions that allows access only to the pages a user needs to view or edit. Use this API to unassign a user's role.\n \n  Scope: `role:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   A Pro or a higher plan."
  },
  "listZoomRooms": {
    "comment": "List Zoom Rooms",
    "doc": "List Zoom Rooms\n  Zoom Rooms is a software-based room system that provides an integrated experience for audio conferencing, wireless screen sharing and video conferencing. Use this API to list all the existing [Zoom Rooms](https://support.zoom.us/hc/en-us/articles/207483343-Getting-Started-with-Zoom-Rooms) in a Zoom account.<br><br>\n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addAroom": {
    "comment": "Add a Zoom Room",
    "doc": "Add a Zoom Room\n  Use this API to [add a Zoom Room](https://support.zoom.us/hc/en-us/articles/202822279-Add-Zoom-Rooms-on-Web-Portal) to a Zoom account.<br><br>\n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getZrAccountProfile": {
    "comment": "Get Zoom Room account profile",
    "doc": "Get Zoom Room account profile\n  Get details on the account profile of a Zoom Room. This information can only by accessed either by the Zoom Room Account Owner or a user with Zoom Rooms admin permission. To get information on an individual Room Profile, use [Get Zoom Room Profile API](https://marketplace.zoom.us/docs/api-reference/zoom-api/rooms/getzrprofile) instead.\n \n  Prerequisites:<br>\n   Zoom account owner or Zoom Rooms admin permissions<br>\n \n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateZrAccProfile": {
    "comment": "Update Zoom Room account profile",
    "doc": "Update Zoom Room account profile\n  Update information on the account profile of a Zoom Room. This information can only by accessed either by the Zoom Room Account Owner or a user with Zoom Rooms admin permission. To update information on an individual Room Profile, use [Update Zoom Room Profile API](https://marketplace.zoom.us/docs/api-reference/zoom-api/rooms/updatezrprofile) instead.\n \n  Prerequisites:<br>\n   Zoom account owner or Zoom Rooms admin permissions<br>\n \n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getZrAccountSettings": {
    "comment": "Get Zoom Room account settings",
    "doc": "Get Zoom Room account settings\n  Get details on Account Settings of a Zoom Room. With this API, you can view either the Account Meeting Settings or the Alert Settings (Client Alert Settings and Notfication Settings) of the Zoom Rooms account. By default, only Account Meeting Settings are returned. To view only Alert Settings, specify `alert` as the value of the `setting_type` query parameter.<br><br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:read:admin`<br><br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateZoomRoomAccSettings": {
    "comment": "Update Zoom Room account settings",
    "doc": "Update Zoom Room account settings\n  Update account settings applied for Zoom Rooms in a Zoom account. With this API, you can update either the Account Meeting Settings or the Alert Settings (Client Alert Settings and Notfication Settings) of the Zoom Rooms account by specifying the required setting type in the `setting_type` parameter. To update only Alert Settings, specify `alert` as the value of the `setting_type` query parameter and to update only Account Meeting Settings, specify `meeting` as the value of the `setting_type` query parameter.<br><br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listDigitalSignageContent": {
    "comment": "List digital signage contents",
    "doc": "List digital signage contents\n  List information about existing [Zoom Rooms digital signage](https://support.zoom.us/hc/en-us/articles/360000030683-Zoom-Rooms-digital-signage) content in a Zoom account.<br> You can also access this information by logging into your Zoom account in the Zoom web portal and visiting the [Digital Signage Content](https://zoom.us/digitalsignage#/) page listed under Room Management.\n \n  Prerequisites:\n   Pro or a higher account with Zoom Rooms.\n   Existing content files or folder in [Digital Signage Content](https://zoom.us/digitalsignage#/) page."
  },
  "manageE911Signage": {
    "comment": "Update E911 digital signage",
    "doc": "Update E911 digital signage\n  Display or hide E911 emergency alert text content from [Zoom Rooms digital signage](https://support.zoom.us/hc/en-us/articles/360000030683-Zoom-Rooms-digital-signage).\n \n  Scope: `room:write:admin`\n \n  Prerequisites:<br>\n   [Zoom Rooms](https://zoom.us/zoomrooms/software) 5.3.0 or higher\n   Zoom Rooms digital signage must be [enabled](https://support.zoom.us/hc/en-us/articles/360000030683-Zoom-Rooms-Digital-Signage#h_767fbb33-82a8-45a8-8392-a1bfa9687edd)"
  },
  "listZrLocations": {
    "comment": "List Zoom Room locations",
    "doc": "List Zoom Room locations\n  A Zoom account owner or a Zoom Room administrator can establish a [location hierarchy](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) to help manage Zoom Rooms that are spread among a variety of locations. Use this API to list the different location types used for Zoom Rooms in an account.<br><br>\n  Prerequisites:\n   Account owner or admin permissions.\n   Zoom Rooms Version 4.0 or higher<br><br>\n  Scopes: `room:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "addAzrLocation": {
    "comment": "Add a location",
    "doc": "Add a location\n  Add a location to the [location hierarchial structure(s)](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) of Zoom Rooms in an account.\n \n  Prerequisites:\n   Account owner or admin permissions.\n   Zoom Rooms Version 4.0 or higher<br><br>\n  Scopes: `room:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getZrLocationStructure": {
    "comment": "Get Zoom Room location structure",
    "doc": "Get Zoom Room location structure\n  Get the [location hierarchial structure(s)](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) applied on the Zoom Rooms in an account.<br><br>\n  Prerequisites:<br>\n   Zoom Rooms version 4.0 or higher\n   Account owner or admin permissions<br>\n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateZoomRoomsLocationStructure": {
    "comment": "Update Zoom Rooms location structure",
    "doc": "Update Zoom Rooms location structure\n  Update the [location hierarchial structure(s)](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) applied on the Zoom Rooms in an account.<br><br>\n  Prerequisites:<br>\n   Zoom Rooms version 4.0 or higher\n   Account owner or admin permissions<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getZrLocationProfile": {
    "comment": "Get Zoom Room location profile",
    "doc": "Get Zoom Room location profile\n  Each location type of the [Zoom Rooms location hierarchy](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) has a profile page that includes information such as name of the location, address, support email, etc. Use this API to retrieve information about a specific Zoom Rooms location type such as information about the city where the Zoom Rooms is located.\n \n  Prerequisite:<br>\n   Account owner or admin permission\n   Zoom Rooms version 4.0 or higher<br>\n  Scopes: `room:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateZrLocationProfile": {
    "comment": "Update Zoom Room location profile",
    "doc": "Update Zoom Room location profile\n  Each location type of the [Zoom Rooms location hierarchy](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) has a profile page that includes information such as name of the location, address, support email, etc. Use this API to update information about a specific Zoom Rooms location type such as information about the city where the Zoom Rooms is located.\n \n  Prerequisite:<br>\n   Account owner or admin permission\n   Zoom Rooms version 4.0 or higher<br>\n  Scopes: `room:write:admin`<br>\n \n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "changeParentLocation": {
    "comment": "Change the assigned parent location",
    "doc": "Change the assigned parent location\n  An account owner of a Zoom account can establish a [Zoom Rooms Location Hierarchy](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) to better organize Zoom Rooms spread accross various location. The location can be structured in a hierarchy with Country being the top-level location, followed by city, campus, building, and floor. The location in the lower level in the hierarchy is considered as a child of the location that is a level above in the hierarchy. Use this API to change the parent location of a child location. <br><br> For instance, if the location hierarchy is structured in a way where there are two campuses (Campus 1, and Campus 2) in a City and Campus 1 consists of a building named Building 1 with a floor where Zoom Rooms are located, and you would like to rearrange the structure so that Building 1 along with its child locations (floor and Zoom Rooms) are relocated directly under Campus 2 instead of Campus 1, you must provide the location ID of Building 1 in the path parameter of this request and the location ID of Campus 2 as the value of `parent_location_id` in the  request body.<br><br>\n  Prerequisite:<br>\n   Account owner or admin permission\n   Zoom Rooms version 4.0 or higher<br>\n  Scopes: `room:write:admin`<br><br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "getZrLocationSettings": {
    "comment": "Get location settings",
    "doc": "Get location settings\n  Get information on meeting or alert settings applied to Zoom Rooms located in a specific location. By default, only Meeting Settings are returned. To view only Alert Settings, specify `alert` as the value of the `setting_type` query parameter.<br><br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateZrLocationSettings": {
    "comment": "Update location settings",
    "doc": "Update location settings\n  Update information on either meeting or alert settings applied to Zoom Rooms located in a specific location. To update Alert Settings, specify `alert` as the value of the `setting_type` query parameter. Similarly, to update Meeting Settings, specify `meeting` as the value of the `setting_type` query parameter.<br><br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "checkInRooms": {
    "comment": "Check-in or check-out of a Zoom Room",
    "doc": "Check-in or check-out of a Zoom Room\n  The Zoom Rooms check-in feature helps maximize your room utilization. Use this API to either check in and confirm that you are utilizing the room reservation or to check out of the room so that the room gets released from the scheduled meeting and will be made available for others to use. Learn more from the [Using the Zoom Rooms check-in feature](https://support.zoom.us/hc/en-us/articles/360001147163-Using-the-Zoom-Rooms-check-in-feature) guide.\n \n  Prerequisites:\n   [Zoom Rooms](https://support.zoom.us/hc/en-us/articles/207483343-Getting-started-with-Zoom-Rooms#:~:text=Zoom%20Rooms%20is%20a%20software,or%20from%20their%20mobile%20device) must have been set up for use for the account and must be online.\n   You must have access to the Calendar Integration APIs (either Microsoft Exchange or Google Calendar APIs) to get calendar information associated with the Room.\n \n  Scope: `room:write:admin`"
  },
  "deleteAzoomRoom": {
    "comment": "Delete a Zoom Room",
    "doc": "Delete a Zoom Room\n  [Remove](https://support.zoom.us/hc/en-us/articles/360033432032-Zoom-Room-Device-Profiles#h_e55b2092-c418-4b02-819f-44de51448900) a specific Zoom Room profile from a Zoom account.<br><br>\n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getZrProfile": {
    "comment": "Get Zoom Room profile",
    "doc": "Get Zoom Room profile\n \n  Zoom Rooms is a software-based room system that provides an integrated experience for audio conferencing, wireless screen sharing and video conferencing. Use this API to get detailed information on a specific Zoom Room in a Zoom account.\n \n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updateRoomProfile": {
    "comment": "Update a Zoom Room profile",
    "doc": "Update a Zoom Room profile\n  Update basic information on a specific Zoom Room in a Zoom account.<br>\n \n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listZrDevices": {
    "comment": "List Zoom Room devices",
    "doc": "List Zoom Room devices\n  List information about the devices that are being used for a specific [Zoom Room](https://support.zoom.us/hc/en-us/articles/207483343-Getting-Started-with-Zoom-Rooms) in an account.\n \n  Prerequisites:<br>\n   Pro or a higher plan with [Zoom Room](https://zoom.us/zoomrooms) license.<br>\n   Account owner or admin permissions.\n  Scopes: `room:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "changeZoomRoomsAppVersion": {
    "comment": "Change Zoom Rooms' app version",
    "doc": "Change Zoom Rooms' app version\n  [Upgrade](https://support.zoom.us/hc/en-us/articles/204675449-Upgrade-or-Downgrade-Zoom-Rooms-Software#h_1751c48a-644e-4a60-b96a-31ec77c616e6) or [downgrade](https://support.zoom.us/hc/en-us/articles/204675449-Upgrade-or-Downgrade-Zoom-Rooms-Software#h_d97349d6-9253-484c-af80-350475026524) the version of Zoom Rooms App installed in your Mac or Windows device.\n \n  Prerequisites:<br>\n   Pro or a higher account with Zoom Rooms.\n   Zoom Rooms software must be installed either on a Mac or a Windows device. This API does not support other devices."
  },
  "changeZrLocation": {
    "comment": "Change a Zoom Room's location",
    "doc": "Change a Zoom Room's location\n  An account owner of a Zoom account can establish a [Zoom Rooms Location Hierarchy](https://support.zoom.us/hc/en-us/articles/115000342983-Zoom-Rooms-Location-Hierarchy) to better organize Zoom Rooms spread accress various location. The location can be structured in a hierarchy with Country being the top-level location, followed by city, campus, building, and floor. Use this API to assign a new location for a Zoom Room. Note that the Zoom Room can be assigned only to the lowest level location available in the hierarchy.\n  Prerequisite:<br>\n   Account owner or admin permission\n   Zoom Rooms version 4.0 or higher<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "getZrSettings": {
    "comment": "Get Zoom Room settings",
    "doc": "Get Zoom Room settings\n  Get information on meeting or alert settings applied to a specific Zoom Room. By default, only Meeting Settings are returned. To view only Alert Settings, specify `alert` as the value of the `setting_type` query parameter.<br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:read:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "updateZrSettings": {
    "comment": "Update Zoom Room settings",
    "doc": "Update Zoom Room settings\n  Update either meeting or alert settings applied to a specific Zoom Room. To update Alert Settings, specify `alert` as the value of the `setting_type` query parameter. To update Meeting Settings, specify `meeting` as the value of the `setting_type` query parameter.<br>\n  Prerequisites:<br>\n   Zoom Room licenses\n   Owner or Admin privileges on the Zoom Account.<br>\n  Scopes: `room:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "listSipPhones": {
    "comment": "List SIP phones",
    "doc": "List SIP phones\n  Zoom’s Phone System Integration (PSI), also referred as SIP phones, enables an organization to leverage the Zoom client to complete a softphone registration to supported premise based PBX system. End users will have the ability to have softphone functionality within a single client while maintaining a comparable interface to Zoom Phone. Use this API to list SIP phones on an account.<br><br>\n  Prerequisites:\n   Currently only supported on Cisco and Avaya PBX systems.\n   User must enable SIP Phone Integration by contacting the [Sales](https://zoom.us/contactsales) team.<br> Scope: `sip_phone:read:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "createSipPhone": {
    "comment": "Enable SIP phone",
    "doc": "Enable SIP phone\n  Zoom’s Phone System Integration (PSI), also referred as SIP phones, enables an organization to leverage the Zoom client to complete a softphone registration to supported premise based PBX system. End users will have the ability to have softphone functionality within a single client while maintaining a comparable interface to Zoom Phone. Use this API to enable a user to use SIP phone.<br><br>\n  Prerequisites:\n   Currently only supported on Cisco and Avaya PBX systems.\n   The account owner or account admin must first enable SIP Phone Integration by contacting the [Sales](https://zoom.us/contactsales) team.<br> Scope: `sip_phone:write:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "deleteSipPhone": {
    "comment": "Delete SIP phone",
    "doc": "Delete SIP phone\n  Zoom’s Phone System Integration (PSI), also referred as SIP phones, enables an organization to leverage the Zoom client to complete a softphone registration to supported premise based PBX system. End users will have the ability to have softphone functionality within a single client while maintaining a comparable interface to Zoom Phone. Use this API to delete a specific SIP phone on a Zoom account.<br><br>\n  Prerequisites:\n   Currently only supported on Cisco and Avaya PBX systems.\n   User must enable SIP Phone Integration by contacting the [Sales](https://zoom.us/contactsales) team.<br> Scope: `sip_phone:read:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "updateSipPhone": {
    "comment": "Update SIP phone",
    "doc": "Update SIP phone\n  Zoom’s Phone System Integration (PSI), also referred as SIP phones, enables an organization to leverage the Zoom client to complete a softphone registration to supported premise based PBX system. End users will have the ability to have softphone functionality within a single client while maintaining a comparable interface to Zoom Phone. Use this API to update information of a specific SIP Phone on a Zoom account.<br><br>\n  Prerequisites:\n   Currently only supported on Cisco and Avaya PBX systems.\n   The account owner or account admin must first enable SIP Phone Integration by contacting the [Sales](https://zoom.us/contactsales) team.<br> Scope: `sip_phone:write:admin`\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listSipTrunkNumbers": {
    "comment": "List SIP trunk numbers",
    "doc": "List SIP trunk numbers\n  With SIP-connected audio, Zoom establishes a SIP trunk (a network connection specifically designed to make and deliver phone calls) over a direct and private connection between the customer’s network and the Zoom cloud. Meeting participants that dial into a meeting or have the meeting call them, and are On-Net from the perspective of the customers' IP telephony network, will be connected over this trunk rather than over the PSTN. <br><br>Use this API to list all the numbers that are configured for SIP Connected Audio in a Zoom Account.\n \n  Prerequisites:<br>\n   Pro or a higher account with SIP Connected Audio plan enabled.\n   The account must be a master account<br>\n  Scopes: `sip_trunk:master`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "trackingfieldList": {
    "comment": "List tracking fields",
    "doc": "List tracking fields\n  [Tracking fields](https://support.zoom.us/hc/en-us/articles/115000293426-Scheduling-Tracking-Fields) allow you to analyze usage by various fields within an organization.<br> Use this API to list all the tracking fields on your Zoom account.<br><br>\n  Scopes: `trackingfield:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites:\n   Business, Education, API or higher plan"
  },
  "trackingfieldCreate": {
    "comment": "Create a tracking field",
    "doc": "Create a tracking field\n  [Tracking fields](https://support.zoom.us/hc/en-us/articles/115000293426-Scheduling-Tracking-Fields) allow you to analyze usage by various fields within an organization.<br> Use this API to create a new tracking field.<br><br>\n  Scope: `trackingfield:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Business, Education, API or higher plan"
  },
  "trackingfieldDelete": {
    "comment": "Delete a tracking field",
    "doc": "Delete a tracking field\n  [Tracking fields](https://support.zoom.us/hc/en-us/articles/115000293426-Scheduling-Tracking-Fields) allow you to analyze usage by various fields within an organization.<br> Use this API to delete a tracking field.<br><br>\n  Scope: `trackingfield:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Business, Education, API or higher plan"
  },
  "trackingfieldGet": {
    "comment": "Get a tracking field",
    "doc": "Get a tracking field\n  [Tracking fields](https://support.zoom.us/hc/en-us/articles/115000293426-Scheduling-Tracking-Fields) allow you to analyze usage by various fields within an organization.<br><br> When scheduling a meeting, the tracking field will be included in the meeting options.<br>Use this API to get information on a tracking field.<br><br>\n  Scopes: `trackingfield:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Business, Education, API or higher plan"
  },
  "trackingfieldUpdate": {
    "comment": "Update a tracking field",
    "doc": "Update a tracking field\n  [Tracking fields](https://support.zoom.us/hc/en-us/articles/115000293426-Scheduling-Tracking-Fields) allow you to analyze usage by various fields within an organization.<br> Use this API to update a tracking field.<br><br>\n  Scope: `trackingfield:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Business, Education, API or higher plan"
  },
  "tsp": {
    "comment": "Get account's TSP information",
    "doc": "Get account's TSP information\n  Get information on Telephony Service Provider on an account level.<br><br>\n  Scopes: `tsp:read:admin` <br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`\n \n  Prerequisites:<br>\n   A Pro or a higher plan."
  },
  "tspUpdate": {
    "comment": "Update account's TSP information",
    "doc": "Update account's TSP information\n  Update information of the Telephony Service Provider set up on an account.<br>\n  Prerequisites:<br>\n  TSP account option should be enabled.<br>\n  Scopes: `tsp:write:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "users": {
    "comment": "List users",
    "doc": "List users\n  A Zoom account can have one or more users. Use this API to list users on your account.<br><br>\n  Scopes: `user:read:admin`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userCreate": {
    "comment": "Create users",
    "doc": "Create users\n  A Zoom account can have one or more users. Use this API to add a new user to your account.<br><br>\n  Prerequisites:<br>\n   Pro or higher plan<br><br>\n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userEmail": {
    "comment": "Check a user email",
    "doc": "Check a user email\n  Verify if a user's email is registered with Zoom.<br><br>\n \n  <b>Note: </b>You can successfully check if a user is a registered Zoom user only if the user signed up for Zoom via email and is within your account. If you provide an email address of a user who is not in your account, the value of \"existed_email\" parameter will be \"false\" irrespective of whether or not the user is registered with Zoom. The response of this API call will not include users who joined Zoom using options such as \"Sign in with SSO\", \"Sign in with Google\" or \"Sign in with Facebook\" even if they are in the same account as yours.\n \n  Scopes: `user:read:admin` `user:read`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userZak": {
    "comment": "Get user's ZAK",
    "doc": "Get user's ZAK\n  Get User’s Zoom Access Token (ZAK). You can use a ZAK to enable a non-login user to join a meeting on your app. Non-login users do not need to enter their username and password to join meetings.\n \n  Scope: `user_zak:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userVanityName": {
    "comment": "Check a user's PM room",
    "doc": "Check a user's PM room\n  A personal meeting room is a virtual meeting room that can be permanently assigned to a user.\n  Use this API to check if a personal meeting room with the given name exists or not.<br><br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userDelete": {
    "comment": "Delete a user",
    "doc": "Delete a user\n  Deleting a user permanently removes the user and their data from Zoom. Users can create a new Zoom account using the same email address. An account owner or an account admin can transfer meetings, webinars and cloud recordings to another Zoom user account before deleting.<br><br>\n \n  This API disassociates (unlinks) a user from the associated Zoom account and provides the user their own basic free Zoom account, and the user can purchase their own licenses. You can transfer the user's data (meetings, webinars and cloud recordings) to another user before disassociation.<br> To permanently delete a user, specify \"delete\" as the value of the `action` query parameter.\n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "user": {
    "comment": "Get a user",
    "doc": "Get a user\n  A Zoom account can have one or more users. Use this API to view information of a specific user on a Zoom account.<br><br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`\n  <p style=\"background-color:#e1f5fe; color:#01579b; padding:8px\"> <b>Note: </b>If a user's status is pending, only `id` and `created_at` fields will be returned. The value of `created_at` will be the time at which the API call was made until the user activates their account.</p>"
  },
  "userUpdate": {
    "comment": "Update a user",
    "doc": "Update a user\n  Update information on a user's Zoom [profile](https://support.zoom.us/hc/en-us/articles/201363203-My-Profile).<br><br>\n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userAssistantsDelete": {
    "comment": "Delete user assistants",
    "doc": "Delete user assistants\n  Delete all assistants of the current user.<br> Assistants are the users to whom the current user has assigned [scheduling privilege](https://support.zoom.us/hc/en-us/articles/201362803-Scheduling-Privilege). These assistants can schedule meeting on behalf of the current user as well as manage and act as an alternative host for all meetings if the admin has enabled [Co-host option](https://zoom.us/account/setting) on the account.<br>\n  Prerequisite:\n   The user as well as the assistant must have Licensed or an On-prem license.\n   Assistants must be under the current user's account.<br>\n  Scopes: `user:write:admin` `user:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userAssistants": {
    "comment": "List user assistants",
    "doc": "List user assistants\n  List a user's assistants.\n \n  Assistants are the users to whom the current user has assigned [scheduling privilege](https://support.zoom.us/hc/en-us/articles/201362803-Scheduling-Privilege). These assistants can schedule meeting on behalf of the current user as well as manage and act as an alternative host for all meetings if the admin has enabled [Co-host option](https://zoom.us/account/setting) on the account.<br><br>\n  Prerequisites: <br>\n   Current user as well as the assistant must have Licensed or an On-prem license.\n   Assistants must be under the current user's account.<br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userAssistantCreate": {
    "comment": "Add assistants",
    "doc": "Add assistants\n  Assistants are the users to whom the current user has assigned [scheduling privilege](https://support.zoom.us/hc/en-us/articles/201362803-Scheduling-Privilege). These assistants can schedule meeting on behalf of the current user as well as manage and act as an alternative host for all meetings if the admin has enabled [Co-host option](https://zoom.us/account/setting) on the account.<br>Use this API to assign assistants to a user. <br> In the request body, provide either the User ID or the email address of the user.<br><br>\n  Prerequisite:\n   The user as well as the assistant must have Licensed or an On-prem license.\n   Assistants must be under the current user's account.<br>\n  Scopes: `user:write:admin` `user:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userAssistantDelete": {
    "comment": "Delete a user assistant",
    "doc": "Delete a user assistant\n  Delete a specific assistant of a user.\n  Assistants are the users to whom the current user has assigned [scheduling privilege](https://support.zoom.us/hc/en-us/articles/201362803-Scheduling-Privilege). These assistants can schedule meeting on behalf of the current user as well as manage and act as an alternative host for all meetings if the admin has enabled [Co-host option](https://zoom.us/account/setting) on the account.<br><br>\n  Prerequisites:\n   The user as well as the assistant must have Licensed or an On-prem license.\n   Assistants must be under the current user's account.<br>\n  Scopes: `user:write:admin` `user:write`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userEmailUpdate": {
    "comment": "Update a user's email",
    "doc": "Update a user's email\n  Change a user's [email address](https://support.zoom.us/hc/en-us/articles/201362563-How-Do-I-Change-the-Email-on-My-Account-) on a Zoom account that has managed domain set up.<br>If the Zoom Account in which the user belongs, has multiple [managed domains](https://support.zoom.us/hc/en-us/articles/203395207-What-is-Managed-Domain-), the email to be updated must match one of the managed domains.<br>\n  Scopes: `user:write:admin` `user:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  >  Note: A user's email address can only be changed for a maximum of 3 times in a day(24 hours).\n  Prerequisite:<br>\n   Managed domain must be enabled in the account.\n   The new email address should not already exist in Zoom."
  },
  "listMeetingTemplates": {
    "comment": "List meeting templates",
    "doc": "List meeting templates\n  Use this API to list [meeting templates](https://support.zoom.us/hc/en-us/articles/360036559151-Meeting-templates) that are available to be used by a user.\n \n  Scope: `meeting:read` or `meeting:read:admin`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "meetings": {
    "comment": "List meetings",
    "doc": "List meetings\n  List all the meetings that were scheduled for a user (meeting host). This API only supports scheduled meetings and thus, details on instant meetings are not returned via this API.<br><br>\n  Scopes: `meeting:read:admin` `meeting:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "meetingCreate": {
    "comment": "Create a meeting",
    "doc": "Create a meeting\n  [Create a meeting](https://support.zoom.us/hc/en-us/articles/201362413-Scheduling-meetings) for a user. <br>This API has a daily rate limit of 100 requests per day. Therefore, only 100 Create a Meeting API requests are permitted within a 24 hour window for a user.<br>\n \n  <aside>The <code>start_url</code> of a meeting is a URL using which a host or an alternative host can start a meeting. The expiration time for the <code>start_url</code> field is two hours for all regular users.\n \n  For custCreate meeting hosts( i.e., users created using the <code>custCreate</code> option via the [Create Users](https://marketplace.zoom.us/docs/api-reference/zoom-api/users/usercreate) API), the expiration time of the <code>start_url</code> field is 90 days from the generation of the <code>start_url</code>.\n \n  For security reasons, the recommended way to retrieve the updated value for the <code>start_url</code> field programmatically (after expiry) is by calling the [Retrieve a Meeting API](https://marketplace.zoom.us/docs/api-reference/zoom-api/meetings/meeting) and referring to the value of the <code>start_url</code> field in the response.</aside><br><br>\n  Scopes: `meeting:write:admin` `meeting:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userPaCs": {
    "comment": "List a user's PAC accounts",
    "doc": "List a user's PAC accounts\n  [Personal Audio Conference](https://support.zoom.us/hc/en-us/articles/204517069-Getting-Started-with-Personal-Audio-Conference) (PAC) allows Pro or higher account holders to host meetings through PSTN (phone dial-in) only.<br>Use this API to list a user's PAC accounts.<br><br>\n  Scopes: `pac:read:admin` `pac:read`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   A Pro or higher plan with [Premium Audio Conferencing](https://support.zoom.us/hc/en-us/articles/204517069-Getting-Started-with-Personal-Audio-Conference) add-on.\n   Personal Audio Conference must be enabled in the user's profile."
  },
  "userPassword": {
    "comment": "Update a user's password",
    "doc": "Update a user's password\n  Update the [password](https://support.zoom.us/hc/en-us/articles/206344385-Change-a-User-s-Password) of a user using which the user can login to Zoom.<br> After this request is processed successfully, an email notification will be sent to the user stating that the password was changed.<br>\n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n  Prerequisites:<br>\n   Owner or admin of the Zoom account."
  },
  "userPermission": {
    "comment": "Get user permissions",
    "doc": "Get user permissions\n  Users can be assigned a set of permissions that allows them to access only the pages/information that a user needs to view or edit.<br>\n \n  Use this API to get permissions that have been granted to the user.<br><br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userPicture": {
    "comment": "Upload a user's profile picture",
    "doc": "Upload a user's profile picture\n  Upload a user's profile picture.<br><br>\n \n  Provide `multipart/form-data` as the value of the `content-type` header for this request. This API supports JPEG and PNG file formats.\n \n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "updatePresenceStatus": {
    "comment": "Update a user's presence status",
    "doc": "Update a user's presence status\n  Users in the Zoom desktop client and mobile apps are assigned with a [presence status](https://support.zoom.us/hc/en-us/articles/360032554051-Status-Icons). The presence status informs users of their contact's availability. Users can also change their own presence status to be either \"Away\", \"Do not disturb\", or \"Available\".\n \n  Use this API to update a user's presence status. A user's status can not be updated more than once per minute, i.e., you can only submit a maximum of 1 update request/minute for a single user.<br>Note that a user's presence status can not be updated using this API if the user is not logged in to the Zoom client.\n \n  Scopes: `user:write`, `user:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "recordingsList": {
    "comment": "List all recordings",
    "doc": "List all recordings\n  When a user records a meeting or a webinar by choosing the Record to the Cloud option, the video, audio, and chat text are recorded in the Zoom cloud.\n \n  Use this API to list all [Cloud recordings](https://support.zoom.us/hc/en-us/articles/203741855-Cloud-Recording) of a user.<br>\n  > To access a user's password protected cloud recording, add an \"access_token\" parameter to the download URL and provide either the [JWT](https://marketplace.zoom.us/docs/guides/getting-started/app-types/create-jwt-app) or the user's OAuth access token as the value of the \"access_token\" parameter.\n  <br>\n \n  Scopes: `recording:read:admin` `recording:read`  <br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites:\n   Pro or a higher plan.\n   Cloud Recording must be enabled on the user's account."
  },
  "userSchedulersDelete": {
    "comment": "Delete user schedulers",
    "doc": "Delete user schedulers\n  Delete all of a user's schedulers. Schedulers are users on whose behalf the current user (assistant) can schedule meetings for. By calling this API, the current user will no longer be a scheduling assistant of any user.\n \n  Prerequisite: Current user (assistant) must be under the same account as the scheduler.<br>\n  Scopes: `user:write:admin` `user:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userSchedulers": {
    "comment": "List user schedulers",
    "doc": "List user schedulers\n  List all the schedulers of a user. Schedulers in this context are the users for whom the current user can schedule meetings for.\n \n  For instance, if the current user (i.e., the user whose userId was passed in the path parameter of this API call) is user A, the response of this API will contain a list of user(s), for whom user A can schedule and manage meetings. User A is the assistant of these users and thus has scheduling privilege for these user(s).\n \n  Prerequisites:\n   Current user must be under the same account as the scheduler.<br>\n  Scopes: `user:read:admin` `user:read`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userSchedulerDelete": {
    "comment": "Delete a scheduler",
    "doc": "Delete a scheduler\n  Delete a Scheduler.\n \n  Schedulers are users on whose behalf the current user (assistant) can schedule meetings for. By calling this API, the current user will no longer be a scheduling assistant of this scheduler.\n \n  Prerequisite: Current user must be under the same account as the scheduler.<br>\n  Scopes: `user:write:admin` `user:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userSettings": {
    "comment": "Get user settings",
    "doc": "Get user settings\n  Retrieve a user's settings.<br><br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userSettingsUpdate": {
    "comment": "Update user settings",
    "doc": "Update user settings\n  Update a user's settings.<br><br>\n  Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "delUserVb": {
    "comment": "Delete virtual background files",
    "doc": "Delete virtual background files\n  Delete existing virtual background file(s) of a user.\n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `user:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "uploadVbuser": {
    "comment": "Upload virtual background files",
    "doc": "Upload virtual background files\n  Use this API to [upload virtual background files](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background) for a user.\n \n  Prerequisites:<br>\n   Virtual background feature must be [enabled](https://support.zoom.us/hc/en-us/articles/210707503-Virtual-Background#h_2ef28080-fce9-4ac2-b567-dc958afab1b7) on the account.\n  <br> Scope: `user:write:admin`\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "userStatus": {
    "comment": "Update user status",
    "doc": "Update user status\n  An account owner or admins can deactivate as well as activate a user in a Zoom account. Deactivating a user will remove all licenses associated with a user. It will prevent the deactivated user from logging into their Zoom account. A deactivated user can be reactivated. Reactivating a user grants the user access to login to their Zoom account.<br> Use this API to either [deactivate](https://support.zoom.us/hc/en-us/articles/115005269946-Remove-User-from-your-Account#h_6a9bc1c3-d739-4945-b1f2-00b3b88fb5cc) an active user or to [reactivate](https://support.zoom.us/hc/en-us/articles/115005269946-Remove-User-from-your-Account#h_16319724-d120-4be6-af5d-31582d134ea0) a deactivated user .<br><br>Scopes: `user:write:admin` `user:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userSsoTokenDelete": {
    "comment": "Revoke a user's SSO token",
    "doc": "Revoke a user's SSO token\n  Revoke a user's SSO token.<br><br> After calling this API, the SSO user will be logged out of their current Zoom session.<br>\n  Scopes: `user:write:admin` `user:write`\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userToken": {
    "comment": "Get a user token",
    "doc": "Get a user token\n  Retrieve a user's token.<br><br> This token is used for starting meetings with the Client SDK.<br>\n  Scopes: `user:read:admin` `user:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`\n  If a user signed into Zoom using Google or Facebook, a null value will be returned for the token. To get the token with this API, ask the user to sign into Zoom using their email and password instead."
  },
  "userTsPs": {
    "comment": "List user's TSP accounts",
    "doc": "List user's TSP accounts\n  A user can have a maximum of two TSP accounts. Use this API to list all TSP accounts of a user.<br><br>\n  Scopes: `tsp:read:admin` `tsp:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`"
  },
  "userTspCreate": {
    "comment": "Add a user's TSP account",
    "doc": "Add a user's TSP account\n  Add a user's TSP account.<br><br>\n  Scopes: `tsp:write:admin` `tsp:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "tspUrlUpdate": {
    "comment": "Set global dial-in URL for a TSP user",
    "doc": "Set global dial-in URL for a TSP user\n  A global dial-in page can provide a list of global access numbers using which audio conferencing can be conducted. By calling this API, you can set the url for the global dial-in page of a user whose Zoom account has TSP and special TSP with third-party audio conferencing options enabled. <p></p>\n  Scopes:`tsp:write:admin` `tsp:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userTspDelete": {
    "comment": "Delete a user's TSP account",
    "doc": "Delete a user's TSP account\n  Delete a user's TSP account.<br><br>\n  Scopes: `tsp:write:admin` `tsp:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userTsp": {
    "comment": "Get a user's TSP account",
    "doc": "Get a user's TSP account\n  Each user can have a maximum of two TSP accounts. Use this API to retrieve details of a specific TSP account enabled for a specific user.<br><br>\n  Scopes: `tsp:read:admin` `tsp:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "userTspUpdate": {
    "comment": "Update a TSP account",
    "doc": "Update a TSP account\n  Update a user's TSP account.<br><br>\n  Scopes: `tsp:write:admin` `tsp:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "listWebinarTemplates": {
    "comment": "List webinar templates",
    "doc": "List webinar templates\n  When you schedule a webinar, you can save the settings for that webinar as a template for scheduling future webinars. <br><br>Use this API to list a user's existing [Webinar templates'](https://support.zoom.us/hc/en-us/articles/115001079746-Webinar-Templates) information.\n \n  Prerequisites:\n   Pro or a higher account with Webinar plan enabled."
  },
  "webinars": {
    "comment": "List webinars",
    "doc": "List webinars\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees.<br> Use this API to list all the webinars that are scheduled by or on-behalf a user (Webinar host).<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br> <br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`\n  Prerequisites:\n   Pro or higher plan with a Webinar Add-on."
  },
  "webinarCreate": {
    "comment": "Create a webinar",
    "doc": "Create a webinar\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees.<br>Use this API to schedule a Webinar for a user (host).<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Pro or higher plan with a Webinar Add-on."
  },
  "webinarDelete": {
    "comment": "Delete a webinar",
    "doc": "Delete a webinar\n  Delete a Webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Pro or higher plan with a Webinar Add-on."
  },
  "webinar": {
    "comment": "Get a webinar",
    "doc": "Get a webinar\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees.<br>Use this API to get details of a scheduled webinar.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>Prerequisites:\n   Pro or higher plan with a Webinar Add-on."
  },
  "webinarUpdate": {
    "comment": "Update a webinar",
    "doc": "Update a webinar\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees.<br>\n  Use this API to make updates to a scheduled Webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Pro or higher plan with a Webinar Add-on."
  },
  "addBatchWebinarRegistrants": {
    "comment": "Perform batch registration",
    "doc": "Perform batch registration\n  Use this API to register up to 30 registrants at once for a scheduled webinar that requires [registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-webinar-with-registration). <br>\n \n  Prerequisites:<br>\n   The webinar host must be a Licensed user.\n   The webinar should be of type `5`, i.e., it should be a scheduled webinar. Other types of webinars are not supported by this API.<br><br>\n  Scope: `webinar:write`, `webinar:write:admin`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Heavy`<br>"
  },
  "webinarPanelistsDelete": {
    "comment": "Remove panelists",
    "doc": "Remove panelists\n  Remove all the panelists from a Webinar.<br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   Pro or a higher plan with [Webinar Add-on](https://zoom.us/webinar).<br>"
  },
  "webinarPanelists": {
    "comment": "List panelists",
    "doc": "List panelists\n  Panelists in a Webinar can view and send video, screen share, annotate, etc and do much more compared to attendees in a Webinar.\n \n  Use this API to list all the panelists of a Webinar.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites:<br>\n   Pro or a higher plan with [Webinar Add-on](https://zoom.us/webinar).<br>"
  },
  "webinarPanelistCreate": {
    "comment": "Add panelists",
    "doc": "Add panelists\n  Panelists in a Webinar can view and send video, screen share, annotate, etc and do much more compared to attendees in a webinar.<br>Use this API to [add panelists](https://support.zoom.us/hc/en-us/articles/115005657826-Inviting-Panelists-to-a-Webinar#h_7550d59e-23f5-4703-9e22-e76bded1ed70) to a scheduled webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n \n \n  Prerequisites:\n   Pro or a higher plan with [Webinar Add-on](https://zoom.us/webinar).<br>"
  },
  "webinarPanelistDelete": {
    "comment": "Remove a panelist",
    "doc": "Remove a panelist\n  [Remove](https://support.zoom.us/hc/en-us/articles/115005657826-Inviting-Panelists-to-a-Webinar#h_de31f237-a91c-4fb2-912b-ecfba8ec5ffb) a single panelist from a webinar.<br> You can retrieve the `panelistId` by calling List Panelists API.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n \n \n  Prerequisites:<br>\n   Pro or a higher plan with [Webinar Add-on](https://zoom.us/webinar).<br>"
  },
  "webinarPolls": {
    "comment": "List a webinar's polls",
    "doc": "List a webinar's polls\n  List all the [polls](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars) of a Webinar.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarPollCreate": {
    "comment": "Create a webinar's poll",
    "doc": "Create a webinar's poll\n  Create a [poll](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars) for a webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarPollDelete": {
    "comment": "Delete a webinar poll",
    "doc": "Delete a webinar poll\n  Delete a webinar's [poll](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars).<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarPollGet": {
    "comment": "Get a webinar poll",
    "doc": "Get a webinar poll\n  Get a webinar's [poll](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars) details.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarPollUpdate": {
    "comment": "Update a webinar poll",
    "doc": "Update a webinar poll\n  Update a webinar's [poll](https://support.zoom.us/hc/en-us/articles/203749865-Polling-for-Webinars).<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarRegistrants": {
    "comment": "List webinar registrants",
    "doc": "List webinar registrants\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees. Scheduling a [Webinar with registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-Webinar-with-Registration) requires your registrants to complete a brief form before receiving the link to join the Webinar.<br>\n  Use this API to list all the users that have registered for a webinar.<br><br>\n  Prerequisites:\n   Pro or higher plan with a Webinar Add-on.<br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "webinarRegistrantCreate": {
    "comment": "Add a webinar registrant",
    "doc": "Add a webinar registrant\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees. Scheduling a [Webinar with registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-Webinar-with-Registration) requires your registrants to complete a brief form before receiving the link to join the Webinar.<br>Use this API to create and submit the registration of a user for a webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:\n   Pro or higher plan with a Webinar Add-on."
  },
  "webinarRegistrantsQuestionsGet": {
    "comment": "List registration questions",
    "doc": "List registration questions\n  Scheduling a [Webinar with registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-Webinar-with-Registration) requires your registrants to complete a brief form with fields and questions before they can receive the link to join the Webinar.<br>Use this API to list registration questions and fields that are to be answered by users while registering for a Webinar.<br>\n  Prerequisites:<br>\n   Pro or higher plan with a Webinar Add-on.\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>"
  },
  "webinarRegistrantQuestionUpdate": {
    "comment": "Update registration questions",
    "doc": "Update registration questions\n  Scheduling a [Webinar with registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-Webinar-with-Registration) requires your registrants to complete a brief form with fields and questions before they can receive the link to join the Webinar.<br>Use this API to update registration questions and fields of a scheduled Webinar that are to be answered by users while registering for a Webinar.<br><br>\n  Prerequisites:<br>\n   Pro or higher plan with a Webinar Add-on.\n   Registration option for Webinar should be set as required to use this API.\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "webinarRegistrantStatus": {
    "comment": "Update registrant's status",
    "doc": "Update registrant's status\n  Update a webinar registrant's status. Using this API, you can specify whether you want to approve a registration, deny a registration or cancel a previously approved registration.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>"
  },
  "deleteWebinarRegistrant": {
    "comment": "Delete a webinar registrant",
    "doc": "Delete a webinar registrant\n  Delete a webinar registrant.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n  <br>\n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`"
  },
  "webinarRegistrantGet": {
    "comment": "Get a webinar registrant",
    "doc": "Get a webinar registrant\n  Zoom users with a [Webinar Plan](https://zoom.us/webinar) have access to creating and managing Webinars. Webinar allows a host to broadcast a Zoom meeting to up to 10,000 attendees. Scheduling a [Webinar with registration](https://support.zoom.us/hc/en-us/articles/204619915-Scheduling-a-Webinar-with-Registration) requires your registrants to complete a brief form before receiving the link to join the Webinar.<br>Use this API to get details on a specific user who has registered for the Webinar.<br><br>\n  Scopes: `webinar:read:admin` `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   The account must have a Webinar plan."
  },
  "webinarStatus": {
    "comment": "Update webinar status",
    "doc": "Update webinar status\n  Update a webinar's status. Use this API to end an ongoing webinar.<br><br>\n  Scopes: `webinar:write:admin` `webinar:write`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Light`<br>\n  Prerequisites:<br>\n   The account must hold a valid [Webinar plan](https://zoom.us/webinar)."
  },
  "getTrackingSources": {
    "comment": "Get webinar tracking sources",
    "doc": "Get webinar tracking sources\n  [Webinar Registration Tracking Sources](https://support.zoom.us/hc/en-us/articles/360000315683-Webinar-Registration-Source-Tracking) allow you to see where your registrants are coming from if you share the webinar registration page in multiple platforms. You can then use the source tracking to see the number of registrants generated from each platform.<br> Use this API to list information on all the tracking sources of a Webinar.<br>\n  Scopes: `webinar:read:admin`, `webinar:read`<br>\n \n  [Rate Limit Label](https://marketplace.zoom.us/docs/api-reference/rate-limits#rate-limits): `Medium`<br>\n  Prerequisites:<br>\n   [Webinar license](https://zoom.us/webinar).\n   Registration must be required for the Webinar."
  }
}