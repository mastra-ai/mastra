export const comments = {
  "getRoot": {
    "comment": "List api root resources",
    "doc": "List api root resources\n  Get links to all other resources available in the API."
  },
  "getAccountExports": {
    "comment": "List account exports",
    "doc": "List account exports\n  Get a list of account exports for a given account."
  },
  "postAccountExport": {
    "comment": "Add export",
    "doc": "Add export\n  Create a new account export in your Mailchimp account."
  },
  "getAccountExportId": {
    "comment": "Get account export info",
    "doc": "Get account export info\n  Get information about a specific account export."
  },
  "getActivityFeedChimpChatter": {
    "comment": "Get latest chimp chatter",
    "doc": "Get latest chimp chatter\n  Return the Chimp Chatter for this account ordered by most recent."
  },
  "getAuthorizedApps": {
    "comment": "List authorized apps",
    "doc": "List authorized apps\n  Get a list of an account's registered, connected applications."
  },
  "getAuthorizedAppsId": {
    "comment": "Get authorized app info",
    "doc": "Get authorized app info\n  Get information about a specific authorized application."
  },
  "getAutomations": {
    "comment": "List automations",
    "doc": "List automations\n  Get a summary of an account's classic automations."
  },
  "postAutomations": {
    "comment": "Add automation",
    "doc": "Add automation\n  Create a new classic automation in your Mailchimp account."
  },
  "getAutomationsId": {
    "comment": "Get automation info",
    "doc": "Get automation info\n  Get a summary of an individual classic automation workflow's settings and content. The `trigger_settings` object returns information for the first email in the workflow."
  },
  "archiveAutomations": {
    "comment": "Archive automation",
    "doc": "Archive automation\n  Archiving will permanently end your automation and keep the report data. You’ll be able to replicate your archived automation, but you can’t restart it."
  },
  "postAutomationsIdActionsPauseAllEmails": {
    "comment": "Pause automation emails",
    "doc": "Pause automation emails\n  Pause all emails in a specific classic automation workflow."
  },
  "postAutomationsIdActionsStartAllEmails": {
    "comment": "Start automation emails",
    "doc": "Start automation emails\n  Start all emails in a classic automation workflow."
  },
  "getAutomationsIdEmails": {
    "comment": "List automated emails",
    "doc": "List automated emails\n  Get a summary of the emails in a classic automation workflow."
  },
  "deleteAutomationsIdEmailsId": {
    "comment": "Delete workflow email",
    "doc": "Delete workflow email\n  Removes an individual classic automation workflow email. Emails from certain workflow types, including the Abandoned Cart Email (abandonedCart) and Product Retargeting Email (abandonedBrowse) Workflows, cannot be deleted."
  },
  "getAutomationsIdEmailsId": {
    "comment": "Get workflow email info",
    "doc": "Get workflow email info\n  Get information about an individual classic automation workflow email."
  },
  "patchAutomationEmailWorkflowId": {
    "comment": "Update workflow email",
    "doc": "Update workflow email\n  Update settings for a classic automation workflow email.  Only works with workflows of type: abandonedBrowse, abandonedCart, emailFollowup, or singleWelcome."
  },
  "postAutomationsIdEmailsIdActionsPause": {
    "comment": "Pause automated email",
    "doc": "Pause automated email\n  Pause an automated email."
  },
  "postAutomationsIdEmailsIdActionsStart": {
    "comment": "Start automated email",
    "doc": "Start automated email\n  Start an automated email."
  },
  "getAutomationsIdEmailsIdQueue": {
    "comment": "List automated email subscribers",
    "doc": "List automated email subscribers\n  Get information about a classic automation email queue."
  },
  "postAutomationsIdEmailsIdQueue": {
    "comment": "Add subscriber to workflow email",
    "doc": "Add subscriber to workflow email\n  Manually add a subscriber to a workflow, bypassing the default trigger settings. You can also use this endpoint to trigger a series of automated emails in an API 3.0 workflow type."
  },
  "getAutomationsIdEmailsIdQueueId": {
    "comment": "Get automated email subscriber",
    "doc": "Get automated email subscriber\n  Get information about a specific subscriber in a classic automation email queue."
  },
  "getAutomationsIdRemovedSubscribers": {
    "comment": "List subscribers removed from workflow",
    "doc": "List subscribers removed from workflow\n  Get information about subscribers who were removed from a classic automation workflow."
  },
  "postAutomationsIdRemovedSubscribers": {
    "comment": "Remove subscriber from workflow",
    "doc": "Remove subscriber from workflow\n  Remove a subscriber from a specific classic automation workflow. You can remove a subscriber at any point in an automation workflow, regardless of how many emails they've been sent from that workflow. Once they're removed, they can never be added back to the same workflow."
  },
  "getAutomationsIdRemovedSubscribersId": {
    "comment": "Get subscriber removed from workflow",
    "doc": "Get subscriber removed from workflow\n  Get information about a specific subscriber who was removed from a classic automation workflow."
  },
  "getBatchWebhooks": {
    "comment": "List batch webhooks",
    "doc": "List batch webhooks\n  Get all webhooks that have been configured for batches."
  },
  "postBatchWebhooks": {
    "comment": "Add batch webhook",
    "doc": "Add batch webhook\n  Configure a webhook that will fire whenever any batch request completes processing.  You may only have a maximum of 20 batch webhooks."
  },
  "deleteBatchWebhookId": {
    "comment": "Delete batch webhook",
    "doc": "Delete batch webhook\n  Remove a batch webhook. Webhooks will no longer be sent to the given URL."
  },
  "getBatchWebhook": {
    "comment": "Get batch webhook info",
    "doc": "Get batch webhook info\n  Get information about a specific batch webhook."
  },
  "patchBatchWebhooks": {
    "comment": "Update batch webhook",
    "doc": "Update batch webhook\n  Update a webhook that will fire whenever any batch request completes processing."
  },
  "getBatches": {
    "comment": "List batch requests",
    "doc": "List batch requests\n  Get a summary of batch requests that have been made."
  },
  "postBatches": {
    "comment": "Start batch operation",
    "doc": "Start batch operation\n  Begin processing a batch operations request."
  },
  "deleteBatchesId": {
    "comment": "Delete batch request",
    "doc": "Delete batch request\n  Stops a batch request from running. Since only one batch request is run at a time, this can be used to cancel a long running request. The results of any completed operations will not be available after this call."
  },
  "getBatchesId": {
    "comment": "Get batch operation status",
    "doc": "Get batch operation status\n  Get the status of a batch request."
  },
  "getCampaignFolders": {
    "comment": "List campaign folders",
    "doc": "List campaign folders\n  Get all folders used to organize campaigns."
  },
  "postCampaignFolders": {
    "comment": "Add campaign folder",
    "doc": "Add campaign folder\n  Create a new campaign folder."
  },
  "deleteCampaignFoldersId": {
    "comment": "Delete campaign folder",
    "doc": "Delete campaign folder\n  Delete a specific campaign folder, and mark all the campaigns in the folder as 'unfiled'."
  },
  "getCampaignFoldersId": {
    "comment": "Get campaign folder",
    "doc": "Get campaign folder\n  Get information about a specific folder used to organize campaigns."
  },
  "patchCampaignFoldersId": {
    "comment": "Update campaign folder",
    "doc": "Update campaign folder\n  Update a specific folder used to organize campaigns."
  },
  "getCampaigns": {
    "comment": "List campaigns",
    "doc": "List campaigns\n  Get all campaigns in an account."
  },
  "postCampaigns": {
    "comment": "Add campaign",
    "doc": "Add campaign\n  Create a new Mailchimp campaign."
  },
  "deleteCampaignsId": {
    "comment": "Delete campaign",
    "doc": "Delete campaign\n  Remove a campaign from your Mailchimp account."
  },
  "getCampaignsId": {
    "comment": "Get campaign info",
    "doc": "Get campaign info\n  Get information about a specific campaign."
  },
  "patchCampaignsId": {
    "comment": "Update campaign settings",
    "doc": "Update campaign settings\n  Update some or all of the settings for a specific campaign."
  },
  "postCampaignsIdActionsCancelSend": {
    "comment": "Cancel campaign",
    "doc": "Cancel campaign\n  Cancel a Regular or Plain-Text Campaign after you send, before all of your recipients receive it. This feature is included with Mailchimp Pro."
  },
  "postCampaignsIdActionsCreateResend": {
    "comment": "Resend campaign",
    "doc": "Resend campaign\n  Creates a Resend to Non-Openers version of this campaign. We will also check if this campaign meets the criteria for Resend to Non-Openers campaigns."
  },
  "postCampaignsIdActionsPause": {
    "comment": "Pause rss campaign",
    "doc": "Pause rss campaign\n  Pause an RSS-Driven campaign."
  },
  "postCampaignsIdActionsReplicate": {
    "comment": "Replicate campaign",
    "doc": "Replicate campaign\n  Replicate a campaign in saved or send status."
  },
  "postCampaignsIdActionsResume": {
    "comment": "Resume rss campaign",
    "doc": "Resume rss campaign\n  Resume an RSS-Driven campaign."
  },
  "postCampaignsIdActionsSchedule": {
    "comment": "Schedule campaign",
    "doc": "Schedule campaign\n  Schedule a campaign for delivery. If you're using Multivariate Campaigns to test send times or sending RSS Campaigns, use the send action instead."
  },
  "postCampaignsIdActionsSend": {
    "comment": "Send campaign",
    "doc": "Send campaign\n  Send a Mailchimp campaign. For RSS Campaigns, the campaign will send according to its schedule. All other campaigns will send immediately."
  },
  "postCampaignsIdActionsTest": {
    "comment": "Send test email",
    "doc": "Send test email\n  Send a test email."
  },
  "postCampaignsIdActionsUnschedule": {
    "comment": "Unschedule campaign",
    "doc": "Unschedule campaign\n  Unschedule a scheduled campaign that hasn't started sending."
  },
  "getCampaignsIdContent": {
    "comment": "Get campaign content",
    "doc": "Get campaign content\n  Get the the HTML and plain-text content for a campaign."
  },
  "putCampaignsIdContent": {
    "comment": "Set campaign content",
    "doc": "Set campaign content\n  Set the content for a campaign."
  },
  "getCampaignsIdFeedback": {
    "comment": "List campaign feedback",
    "doc": "List campaign feedback\n  Get team feedback while you're working together on a Mailchimp campaign."
  },
  "postCampaignsIdFeedback": {
    "comment": "Add campaign feedback",
    "doc": "Add campaign feedback\n  Add feedback on a specific campaign."
  },
  "deleteCampaignsIdFeedbackId": {
    "comment": "Delete campaign feedback message",
    "doc": "Delete campaign feedback message\n  Remove a specific feedback message for a campaign."
  },
  "getCampaignsIdFeedbackId": {
    "comment": "Get campaign feedback message",
    "doc": "Get campaign feedback message\n  Get a specific feedback message from a campaign."
  },
  "patchCampaignsIdFeedbackId": {
    "comment": "Update campaign feedback message",
    "doc": "Update campaign feedback message\n  Update a specific feedback message for a campaign."
  },
  "getCampaignsIdSendChecklist": {
    "comment": "Get campaign send checklist",
    "doc": "Get campaign send checklist\n  Review the send checklist for a campaign, and resolve any issues before sending."
  },
  "getConnectedSites": {
    "comment": "List connected sites",
    "doc": "List connected sites\n  Get all connected sites in an account."
  },
  "postConnectedSites": {
    "comment": "Add connected site",
    "doc": "Add connected site\n  Create a new Mailchimp connected site."
  },
  "deleteConnectedSitesId": {
    "comment": "Delete connected site",
    "doc": "Delete connected site\n  Remove a connected site from your Mailchimp account."
  },
  "getConnectedSitesId": {
    "comment": "Get connected site",
    "doc": "Get connected site\n  Get information about a specific connected site."
  },
  "postConnectedSitesIdActionsVerifyScriptInstallation": {
    "comment": "Verify connected site script",
    "doc": "Verify connected site script\n  Verify that the connected sites script has been installed, either via the script URL or fragment."
  },
  "getConversations": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  List conversations\n  Get a list of conversations for the account. Conversations has been deprecated in favor of Inbox and these endpoints don't include Inbox data. Past Conversations are still available via this endpoint, but new campaign replies and other Inbox messages aren’t available using this endpoint."
  },
  "getConversationsId": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get conversation\n  Get details about an individual conversation. Conversations has been deprecated in favor of Inbox and these endpoints don't include Inbox data. Past Conversations are still available via this endpoint, but new campaign replies and other Inbox messages aren’t available using this endpoint."
  },
  "getConversationsIdMessages": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  List messages\n  Get messages from a specific conversation. Conversations has been deprecated in favor of Inbox and these endpoints don't include Inbox data. Past Conversations are still available via this endpoint, but new campaign replies and other Inbox messages aren’t available using this endpoint."
  },
  "getConversationsIdMessagesId": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get message\n  Get an individual message in a conversation. Conversations has been deprecated in favor of Inbox and these endpoints don't include Inbox data. Past Conversations are still available via this endpoint, but new campaign replies and other Inbox messages aren’t available using this endpoint."
  },
  "postCustomerJourneysJourneysIdStepsIdActionsTrigger": {
    "comment": "Customer Journeys API trigger for a contact",
    "doc": "Customer Journeys API trigger for a contact\n  A step trigger in a Customer Journey. To use it, create a starting point or step from the Customer Journey builder in the app using the Customer Journeys API condition. We’ll provide a url during the process that includes the {journey_id} and {step_id}. You’ll then be able to use this endpoint to trigger the condition for the posted contact."
  },
  "getEcommerceOrders": {
    "comment": "List account orders",
    "doc": "List account orders\n  Get information about an account's orders."
  },
  "getEcommerceStores": {
    "comment": "List stores",
    "doc": "List stores\n  Get information about all stores in the account."
  },
  "postEcommerceStores": {
    "comment": "Add store",
    "doc": "Add store\n  Add a new store to your Mailchimp account."
  },
  "deleteEcommerceStoresId": {
    "comment": "Delete store",
    "doc": "Delete store\n  Delete a store. Deleting a store will also delete any associated subresources, including Customers, Orders, Products, and Carts."
  },
  "getEcommerceStoresId": {
    "comment": "Get store info",
    "doc": "Get store info\n  Get information about a specific store."
  },
  "patchEcommerceStoresId": {
    "comment": "Update store",
    "doc": "Update store\n  Update a store."
  },
  "getEcommerceStoresIdCarts": {
    "comment": "List carts",
    "doc": "List carts\n  Get information about a store's carts."
  },
  "postEcommerceStoresIdCarts": {
    "comment": "Add cart",
    "doc": "Add cart\n  Add a new cart to a store."
  },
  "deleteEcommerceStoresIdCartsId": {
    "comment": "Delete cart",
    "doc": "Delete cart\n  Delete a cart."
  },
  "getEcommerceStoresIdCartsId": {
    "comment": "Get cart info",
    "doc": "Get cart info\n  Get information about a specific cart."
  },
  "patchEcommerceStoresIdCartsId": {
    "comment": "Update cart",
    "doc": "Update cart\n  Update a specific cart."
  },
  "getEcommerceStoresIdCartsIdLines": {
    "comment": "List cart line items",
    "doc": "List cart line items\n  Get information about a cart's line items."
  },
  "postEcommerceStoresIdCartsIdLines": {
    "comment": "Add cart line item",
    "doc": "Add cart line item\n  Add a new line item to an existing cart."
  },
  "deleteEcommerceStoresIdCartsLinesId": {
    "comment": "Delete cart line item",
    "doc": "Delete cart line item\n  Delete a specific cart line item."
  },
  "getEcommerceStoresIdCartsIdLinesId": {
    "comment": "Get cart line item",
    "doc": "Get cart line item\n  Get information about a specific cart line item."
  },
  "patchEcommerceStoresIdCartsIdLinesId": {
    "comment": "Update cart line item",
    "doc": "Update cart line item\n  Update a specific cart line item."
  },
  "getEcommerceStoresIdCustomers": {
    "comment": "List customers",
    "doc": "List customers\n  Get information about a store's customers."
  },
  "postEcommerceStoresIdCustomers": {
    "comment": "Add customer",
    "doc": "Add customer\n  Add a new customer to a store."
  },
  "deleteEcommerceStoresIdCustomersId": {
    "comment": "Delete customer",
    "doc": "Delete customer\n  Delete a customer from a store."
  },
  "getEcommerceStoresIdCustomersId": {
    "comment": "Get customer info",
    "doc": "Get customer info\n  Get information about a specific customer."
  },
  "patchEcommerceStoresIdCustomersId": {
    "comment": "Update customer",
    "doc": "Update customer\n  Update a customer."
  },
  "putEcommerceStoresIdCustomersId": {
    "comment": "Add or update customer",
    "doc": "Add or update customer\n  Add or update a customer."
  },
  "getEcommerceStoresIdOrders": {
    "comment": "List orders",
    "doc": "List orders\n  Get information about a store's orders."
  },
  "postEcommerceStoresIdOrders": {
    "comment": "Add order",
    "doc": "Add order\n  Add a new order to a store."
  },
  "deleteEcommerceStoresIdOrdersId": {
    "comment": "Delete order",
    "doc": "Delete order\n  Delete an order."
  },
  "getEcommerceStoresIdOrdersId": {
    "comment": "Get order info",
    "doc": "Get order info\n  Get information about a specific order."
  },
  "patchEcommerceStoresIdOrdersId": {
    "comment": "Update order",
    "doc": "Update order\n  Update a specific order."
  },
  "getEcommerceStoresIdOrdersIdLines": {
    "comment": "List order line items",
    "doc": "List order line items\n  Get information about an order's line items."
  },
  "postEcommerceStoresIdOrdersIdLines": {
    "comment": "Add order line item",
    "doc": "Add order line item\n  Add a new line item to an existing order."
  },
  "deleteEcommerceStoresIdOrdersIdLinesId": {
    "comment": "Delete order line item",
    "doc": "Delete order line item\n  Delete a specific order line item."
  },
  "getEcommerceStoresIdOrdersIdLinesId": {
    "comment": "Get order line item",
    "doc": "Get order line item\n  Get information about a specific order line item."
  },
  "patchEcommerceStoresIdOrdersIdLinesId": {
    "comment": "Update order line item",
    "doc": "Update order line item\n  Update a specific order line item."
  },
  "getEcommerceStoresIdProducts": {
    "comment": "List product",
    "doc": "List product\n  Get information about a store's products."
  },
  "postEcommerceStoresIdProducts": {
    "comment": "Add product",
    "doc": "Add product\n  Add a new product to a store."
  },
  "deleteEcommerceStoresIdProductsId": {
    "comment": "Delete product",
    "doc": "Delete product\n  Delete a product."
  },
  "getEcommerceStoresIdProductsId": {
    "comment": "Get product info",
    "doc": "Get product info\n  Get information about a specific product."
  },
  "patchEcommerceStoresIdProductsId": {
    "comment": "Update product",
    "doc": "Update product\n  Update a specific product."
  },
  "getEcommerceStoresIdProductsIdImages": {
    "comment": "List product images",
    "doc": "List product images\n  Get information about a product's images."
  },
  "postEcommerceStoresIdProductsIdImages": {
    "comment": "Add product image",
    "doc": "Add product image\n  Add a new image to the product."
  },
  "deleteEcommerceStoresIdProductsIdImagesId": {
    "comment": "Delete product image",
    "doc": "Delete product image\n  Delete a product image."
  },
  "getEcommerceStoresIdProductsIdImagesId": {
    "comment": "Get product image info",
    "doc": "Get product image info\n  Get information about a specific product image."
  },
  "patchEcommerceStoresIdProductsIdImagesId": {
    "comment": "Update product image",
    "doc": "Update product image\n  Update a product image."
  },
  "getEcommerceStoresIdProductsIdVariants": {
    "comment": "List product variants",
    "doc": "List product variants\n  Get information about a product's variants."
  },
  "postEcommerceStoresIdProductsIdVariants": {
    "comment": "Add product variant",
    "doc": "Add product variant\n  Add a new variant to the product."
  },
  "deleteEcommerceStoresIdProductsIdVariantsId": {
    "comment": "Delete product variant",
    "doc": "Delete product variant\n  Delete a product variant."
  },
  "getEcommerceStoresIdProductsIdVariantsId": {
    "comment": "Get product variant info",
    "doc": "Get product variant info\n  Get information about a specific product variant."
  },
  "patchEcommerceStoresIdProductsIdVariantsId": {
    "comment": "Update product variant",
    "doc": "Update product variant\n  Update a product variant."
  },
  "putEcommerceStoresIdProductsIdVariantsId": {
    "comment": "Add or update product variant",
    "doc": "Add or update product variant\n  Add or update a product variant."
  },
  "getEcommerceStoresIdPromorules": {
    "comment": "List promo rules",
    "doc": "List promo rules\n  Get information about a store's promo rules."
  },
  "postEcommerceStoresIdPromorules": {
    "comment": "Add promo rule",
    "doc": "Add promo rule\n  Add a new promo rule to a store."
  },
  "deleteEcommerceStoresIdPromorulesId": {
    "comment": "Delete promo rule",
    "doc": "Delete promo rule\n  Delete a promo rule from a store."
  },
  "getEcommerceStoresIdPromorulesId": {
    "comment": "Get promo rule",
    "doc": "Get promo rule\n  Get information about a specific promo rule."
  },
  "patchEcommerceStoresIdPromorulesId": {
    "comment": "Update promo rule",
    "doc": "Update promo rule\n  Update a promo rule."
  },
  "getEcommerceStoresIdPromocodes": {
    "comment": "List promo codes",
    "doc": "List promo codes\n  Get information about a store's promo codes."
  },
  "postEcommerceStoresIdPromocodes": {
    "comment": "Add promo code",
    "doc": "Add promo code\n  Add a new promo code to a store."
  },
  "deleteEcommerceStoresIdPromocodesId": {
    "comment": "Delete promo code",
    "doc": "Delete promo code\n  Delete a promo code from a store."
  },
  "getEcommerceStoresIdPromocodesId": {
    "comment": "Get promo code",
    "doc": "Get promo code\n  Get information about a specific promo code."
  },
  "patchEcommerceStoresIdPromocodesId": {
    "comment": "Update promo code",
    "doc": "Update promo code\n  Update a promo code."
  },
  "getAllFacebookAds": {
    "comment": "List facebook ads",
    "doc": "List facebook ads\n  Get list of Facebook ads."
  },
  "getFacebookAdsId": {
    "comment": "Get facebook ad info",
    "doc": "Get facebook ad info\n  Get details of a Facebook ad."
  },
  "getFileManagerFiles": {
    "comment": "List stored files",
    "doc": "List stored files\n  Get a list of available images and files stored in the File Manager for the account."
  },
  "postFileManagerFiles": {
    "comment": "Add file",
    "doc": "Add file\n  Upload a new image or file to the File Manager."
  },
  "deleteFileManagerFilesId": {
    "comment": "Delete file",
    "doc": "Delete file\n  Remove a specific file from the File Manager."
  },
  "getFileManagerFilesId": {
    "comment": "Get file",
    "doc": "Get file\n  Get information about a specific file in the File Manager."
  },
  "patchFileManagerFilesId": {
    "comment": "Update file",
    "doc": "Update file\n  Update a file in the File Manager."
  },
  "getFileManagerFolders": {
    "comment": "List folders",
    "doc": "List folders\n  Get a list of all folders in the File Manager."
  },
  "postFileManagerFolders": {
    "comment": "Add folder",
    "doc": "Add folder\n  Create a new folder in the File Manager."
  },
  "deleteFileManagerFoldersId": {
    "comment": "Delete folder",
    "doc": "Delete folder\n  Delete a specific folder in the File Manager."
  },
  "getFileManagerFoldersId": {
    "comment": "Get folder",
    "doc": "Get folder\n  Get information about a specific folder in the File Manager."
  },
  "patchFileManagerFoldersId": {
    "comment": "Update folder",
    "doc": "Update folder\n  Update a specific File Manager folder."
  },
  "getFileManagerFoldersFiles": {
    "comment": "List stored files",
    "doc": "List stored files\n  Get a list of available images and files stored in this folder."
  },
  "getAllLandingPages": {
    "comment": "List landing pages",
    "doc": "List landing pages\n  Get all landing pages."
  },
  "postAllLandingPages": {
    "comment": "Add landing page",
    "doc": "Add landing page\n  Create a new Mailchimp landing page."
  },
  "deleteLandingPageId": {
    "comment": "Delete landing page",
    "doc": "Delete landing page\n  Delete a landing page."
  },
  "getLandingPageId": {
    "comment": "Get landing page info",
    "doc": "Get landing page info\n  Get information about a specific page."
  },
  "patchLandingPageId": {
    "comment": "Update landing page",
    "doc": "Update landing page\n  Update a landing page."
  },
  "postLandingPageIdActionsPublish": {
    "comment": "Publish landing page",
    "doc": "Publish landing page\n  Publish a landing page that is in draft, unpublished, or has been previously published and edited."
  },
  "postLandingPageIdActionsUnpublish": {
    "comment": "Unpublish landing page",
    "doc": "Unpublish landing page\n  Unpublish a landing page that is in draft or has been published."
  },
  "getLandingPageIdContent": {
    "comment": "Get landing page content",
    "doc": "Get landing page content\n  Get the the HTML for your landing page."
  },
  "getLists": {
    "comment": "Get lists info",
    "doc": "Get lists info\n  Get information about all lists in the account."
  },
  "postLists": {
    "comment": "Add list",
    "doc": "Add list\n  Create a new list in your Mailchimp account."
  },
  "deleteListsId": {
    "comment": "Delete list",
    "doc": "Delete list\n  Delete a list from your Mailchimp account. If you delete a list, you'll lose the list history—including subscriber activity, unsubscribes, complaints, and bounces. You’ll also lose subscribers’ email addresses, unless you exported and backed up your list."
  },
  "getListsId": {
    "comment": "Get list info",
    "doc": "Get list info\n  Get information about a specific list in your Mailchimp account. Results include list members who have signed up but haven't confirmed their subscription yet and unsubscribed or cleaned."
  },
  "patchListsId": {
    "comment": "Update lists",
    "doc": "Update lists\n  Update the settings for a specific list."
  },
  "postListsId": {
    "comment": "Batch subscribe or unsubscribe",
    "doc": "Batch subscribe or unsubscribe\n  Batch subscribe or unsubscribe list members."
  },
  "getListsIdAbuseReports": {
    "comment": "List abuse reports",
    "doc": "List abuse reports\n  Get all abuse reports for a specific list."
  },
  "getListsIdAbuseReportsId": {
    "comment": "Get abuse report",
    "doc": "Get abuse report\n  Get details about a specific abuse report."
  },
  "getListsIdActivity": {
    "comment": "List recent activity",
    "doc": "List recent activity\n  Get up to the previous 180 days of daily detailed aggregated activity stats for a list, not including Automation activity."
  },
  "getListsIdClients": {
    "comment": "List top email clients",
    "doc": "List top email clients\n  Get a list of the top email clients based on user-agent strings."
  },
  "getListsIdGrowthHistory": {
    "comment": "List growth history data",
    "doc": "List growth history data\n  Get a month-by-month summary of a specific list's growth activity."
  },
  "getListsIdGrowthHistoryId": {
    "comment": "Get growth history by month",
    "doc": "Get growth history by month\n  Get a summary of a specific list's growth activity for a specific month and year."
  },
  "getListsIdInterestCategories": {
    "comment": "List interest categories",
    "doc": "List interest categories\n  Get information about a list's interest categories."
  },
  "postListsIdInterestCategories": {
    "comment": "Add interest category",
    "doc": "Add interest category\n  Create a new interest category."
  },
  "deleteListsIdInterestCategoriesId": {
    "comment": "Delete interest category",
    "doc": "Delete interest category\n  Delete a specific interest category."
  },
  "getListsIdInterestCategoriesId": {
    "comment": "Get interest category info",
    "doc": "Get interest category info\n  Get information about a specific interest category."
  },
  "patchListsIdInterestCategoriesId": {
    "comment": "Update interest category",
    "doc": "Update interest category\n  Update a specific interest category."
  },
  "getListsIdInterestCategoriesIdInterests": {
    "comment": "List interests in category",
    "doc": "List interests in category\n  Get a list of this category's interests."
  },
  "postListsIdInterestCategoriesIdInterests": {
    "comment": "Add interest in category",
    "doc": "Add interest in category\n  Create a new interest or 'group name' for a specific category."
  },
  "deleteListsIdInterestCategoriesIdInterestsId": {
    "comment": "Delete interest in category",
    "doc": "Delete interest in category\n  Delete interests or group names in a specific category."
  },
  "getListsIdInterestCategoriesIdInterestsId": {
    "comment": "Get interest in category",
    "doc": "Get interest in category\n  Get interests or 'group names' for a specific category."
  },
  "patchListsIdInterestCategoriesIdInterestsId": {
    "comment": "Update interest in category",
    "doc": "Update interest in category\n  Update interests or 'group names' for a specific category."
  },
  "getListsIdLocations": {
    "comment": "List locations",
    "doc": "List locations\n  Get the locations (countries) that the list's subscribers have been tagged to based on geocoding their IP address."
  },
  "getListsIdMembers": {
    "comment": "List members info",
    "doc": "List members info\n  Get information about members in a specific Mailchimp list."
  },
  "postListsIdMembers": {
    "comment": "Add member to list",
    "doc": "Add member to list\n  Add a new member to the list."
  },
  "deleteListsIdMembersId": {
    "comment": "Archive list member",
    "doc": "Archive list member\n  Archive a list member. To permanently delete, use the delete-permanent action."
  },
  "getListsIdMembersId": {
    "comment": "Get member info",
    "doc": "Get member info\n  Get information about a specific list member, including a currently subscribed, unsubscribed, or bounced member."
  },
  "patchListsIdMembersId": {
    "comment": "Update list member",
    "doc": "Update list member\n  Update information for a specific list member."
  },
  "putListsIdMembersId": {
    "comment": "Add or update list member",
    "doc": "Add or update list member\n  Add or update a list member."
  },
  "postListsIdMembersHashActionsDeletePermanent": {
    "comment": "Delete list member",
    "doc": "Delete list member\n  Delete all personally identifiable information related to a list member, and remove them from a list. This will make it impossible to re-import the list member."
  },
  "getListsIdMembersIdActivity": {
    "comment": "View recent activity 50",
    "doc": "View recent activity 50\n  Get the last 50 events of a member's activity on a specific list, including opens, clicks, and unsubscribes."
  },
  "getListsIdMembersIdActivityFeed": {
    "comment": "View recent activity",
    "doc": "View recent activity\n  Get a member's activity on a specific list, including opens, clicks, and unsubscribes."
  },
  "getListsIdMembersIdEvents": {
    "comment": "List member events",
    "doc": "List member events\n  Get events for a contact."
  },
  "postListMemberEvents": {
    "comment": "Add event",
    "doc": "Add event\n  Add an event for a list member."
  },
  "getListsIdMembersIdGoals": {
    "comment": "List member goal events",
    "doc": "List member goal events\n  Get the last 50 Goal events for a member on a specific list."
  },
  "getListsIdMembersIdNotes": {
    "comment": "List recent member notes",
    "doc": "List recent member notes\n  Get recent notes for a specific list member."
  },
  "postListsIdMembersIdNotes": {
    "comment": "Add member note",
    "doc": "Add member note\n  Add a new note for a specific subscriber."
  },
  "deleteListsIdMembersIdNotesId": {
    "comment": "Delete note",
    "doc": "Delete note\n  Delete a specific note for a specific list member."
  },
  "getListsIdMembersIdNotesId": {
    "comment": "Get member note",
    "doc": "Get member note\n  Get a specific note for a specific list member."
  },
  "patchListsIdMembersIdNotesId": {
    "comment": "Update note",
    "doc": "Update note\n  Update a specific note for a specific list member."
  },
  "getListMemberTags": {
    "comment": "List member tags",
    "doc": "List member tags\n  Get the tags on a list member."
  },
  "postListMemberTags": {
    "comment": "Add or remove member tags",
    "doc": "Add or remove member tags\n  Add or remove tags from a list member. If a tag that does not exist is passed in and set as 'active', a new tag will be created."
  },
  "getListsIdMergeFields": {
    "comment": "List merge fields",
    "doc": "List merge fields\n  Get a list of all merge fields for an audience."
  },
  "postListsIdMergeFields": {
    "comment": "Add merge field",
    "doc": "Add merge field\n  Add a new merge field for a specific audience."
  },
  "deleteListsIdMergeFieldsId": {
    "comment": "Delete merge field",
    "doc": "Delete merge field\n  Delete a specific merge field."
  },
  "getListsIdMergeFieldsId": {
    "comment": "Get merge field",
    "doc": "Get merge field\n  Get information about a specific merge field."
  },
  "patchListsIdMergeFieldsId": {
    "comment": "Update merge field",
    "doc": "Update merge field\n  Update a specific merge field."
  },
  "previewAsegment": {
    "comment": "List segments",
    "doc": "List segments\n  Get information about all available segments for a specific list."
  },
  "postListsIdSegments": {
    "comment": "Add segment",
    "doc": "Add segment\n  Create a new segment in a specific list."
  },
  "deleteListsIdSegmentsId": {
    "comment": "Delete segment",
    "doc": "Delete segment\n  Delete a specific segment in a list."
  },
  "getListsIdSegmentsId": {
    "comment": "Get segment info",
    "doc": "Get segment info\n  Get information about a specific segment."
  },
  "patchListsIdSegmentsId": {
    "comment": "Update segment",
    "doc": "Update segment\n  Update a specific segment in a list."
  },
  "postListsIdSegmentsId": {
    "comment": "Batch add or remove members",
    "doc": "Batch add or remove members\n  Batch add/remove list members to static segment"
  },
  "getListsIdSegmentsIdMembers": {
    "comment": "List members in segment",
    "doc": "List members in segment\n  Get information about members in a saved segment."
  },
  "postListsIdSegmentsIdMembers": {
    "comment": "Add member to segment",
    "doc": "Add member to segment\n  Add a member to a static segment."
  },
  "deleteListsIdSegmentsIdMembersId": {
    "comment": "Remove list member from segment",
    "doc": "Remove list member from segment\n  Remove a member from the specified static segment."
  },
  "getListsIdSignupForms": {
    "comment": "List signup forms",
    "doc": "List signup forms\n  Get signup forms for a specific list."
  },
  "postListsIdSignupForms": {
    "comment": "Customize signup form",
    "doc": "Customize signup form\n  Customize a list's default signup form."
  },
  "getListsIdSurveys": {
    "comment": "Get information about all surveys for a list",
    "doc": "Get information about all surveys for a list\n  Get information about all available surveys for a specific list."
  },
  "getListsIdSurveysId": {
    "comment": "Get survey",
    "doc": "Get survey\n  Get details about a specific survey."
  },
  "postListsIdSurveysIdActionsCreateEmail": {
    "comment": "Create a Survey Campaign",
    "doc": "Create a Survey Campaign\n  Utilize the List ID and Survey ID to generate a Campaign that links to your survey."
  },
  "postListsIdSurveysIdActionsPublish": {
    "comment": "Publish a Survey",
    "doc": "Publish a Survey\n  Publish a survey that is in draft, unpublished, or has been previously published and edited."
  },
  "postListsIdSurveysIdActionsUnpublish": {
    "comment": "Unpublish a Survey",
    "doc": "Unpublish a Survey\n  Unpublish a survey that has been published."
  },
  "searchTagsByName": {
    "comment": "Search for tags on a list by name.",
    "doc": "Search for tags on a list by name.\n  Search for tags on a list by name. If no name is provided, will return all tags on the list."
  },
  "getListsIdWebhooks": {
    "comment": "List webhooks",
    "doc": "List webhooks\n  Get information about all webhooks for a specific list."
  },
  "postListsIdWebhooks": {
    "comment": "Add webhook",
    "doc": "Add webhook\n  Create a new webhook for a specific list."
  },
  "deleteListsIdWebhooksId": {
    "comment": "Delete webhook",
    "doc": "Delete webhook\n  Delete a specific webhook in a list."
  },
  "getListsIdWebhooksId": {
    "comment": "Get webhook info",
    "doc": "Get webhook info\n  Get information about a specific webhook."
  },
  "patchListsIdWebhooksId": {
    "comment": "Update webhook",
    "doc": "Update webhook\n  Update the settings for an existing webhook."
  },
  "getPing": {
    "comment": "Ping",
    "doc": "Ping\n  A health check for the API that won't return any account-specific information."
  },
  "getReportingFacebookAds": {
    "comment": "List facebook ads reports",
    "doc": "List facebook ads reports\n  Get reports of Facebook ads."
  },
  "getReportingFacebookAdsId": {
    "comment": "Get facebook ad report",
    "doc": "Get facebook ad report\n  Get report of a Facebook ad."
  },
  "getReportingFacebookAdsIdEcommerceProductActivity": {
    "comment": "List facebook ecommerce report",
    "doc": "List facebook ecommerce report\n  Get breakdown of product activity for an outreach."
  },
  "getReportingLandingPages": {
    "comment": "List landing pages reports",
    "doc": "List landing pages reports\n  Get reports of landing pages."
  },
  "getReportingLandingPagesId": {
    "comment": "Get landing page report",
    "doc": "Get landing page report\n  Get report of a landing page."
  },
  "getReportingSurveys": {
    "comment": "List survey reports",
    "doc": "List survey reports\n  Get reports for surveys."
  },
  "getReportingSurveysId": {
    "comment": "Get survey report",
    "doc": "Get survey report\n  Get report for a survey."
  },
  "getReportingSurveysIdQuestions": {
    "comment": "List survey question reports",
    "doc": "List survey question reports\n  Get reports for survey questions."
  },
  "getReportingSurveysIdQuestionsId": {
    "comment": "Get survey question report",
    "doc": "Get survey question report\n  Get report for a survey question."
  },
  "getReportingSurveysIdQuestionsIdAnswers": {
    "comment": "List answers for question",
    "doc": "List answers for question\n  Get answers for a survey question."
  },
  "getReportingSurveysIdResponses": {
    "comment": "List survey responses",
    "doc": "List survey responses\n  Get responses to a survey."
  },
  "getReportingSurveysIdResponsesId": {
    "comment": "Get survey response",
    "doc": "Get survey response\n  Get a single survey response."
  },
  "getReports": {
    "comment": "List campaign reports",
    "doc": "List campaign reports\n  Get campaign reports."
  },
  "getReportsId": {
    "comment": "Get campaign report",
    "doc": "Get campaign report\n  Get report details for a specific sent campaign."
  },
  "getReportsIdAbuseReportsId": {
    "comment": "List abuse reports",
    "doc": "List abuse reports\n  Get a list of abuse complaints for a specific campaign."
  },
  "getReportsIdAbuseReportsIdId": {
    "comment": "Get abuse report",
    "doc": "Get abuse report\n  Get information about a specific abuse report for a campaign."
  },
  "getReportsIdAdvice": {
    "comment": "List campaign feedback",
    "doc": "List campaign feedback\n  Get feedback based on a campaign's statistics. Advice feedback is based on campaign stats like opens, clicks, unsubscribes, bounces, and more."
  },
  "getReportsIdClickDetails": {
    "comment": "List campaign details",
    "doc": "List campaign details\n  Get information about clicks on specific links in your Mailchimp campaigns."
  },
  "getReportsIdClickDetailsId": {
    "comment": "Get campaign link details",
    "doc": "Get campaign link details\n  Get click details for a specific link in a campaign."
  },
  "getReportsIdClickDetailsIdMembers": {
    "comment": "List clicked link subscribers",
    "doc": "List clicked link subscribers\n  Get information about list members who clicked on a specific link in a campaign."
  },
  "getReportsIdClickDetailsIdMembersId": {
    "comment": "Get clicked link subscriber",
    "doc": "Get clicked link subscriber\n  Get information about a specific subscriber who clicked a link in a specific campaign."
  },
  "getReportsIdDomainPerformance": {
    "comment": "List domain performance stats",
    "doc": "List domain performance stats\n  Get statistics for the top-performing email domains in a campaign."
  },
  "getReportsIdEcommerceProductActivity": {
    "comment": "List campaign product activity",
    "doc": "List campaign product activity\n  Get breakdown of product activity for a campaign"
  },
  "getReportsIdEepurl": {
    "comment": "List EepURL activity",
    "doc": "List EepURL activity\n  Get a summary of social activity for the campaign, tracked by EepURL."
  },
  "getReportsIdEmailActivity": {
    "comment": "List email activity",
    "doc": "List email activity\n  Get a list of member's subscriber activity in a specific campaign."
  },
  "getReportsIdEmailActivityId": {
    "comment": "Get subscriber email activity",
    "doc": "Get subscriber email activity\n  Get a specific list member's activity in a campaign including opens, clicks, and bounces."
  },
  "getReportsIdLocations": {
    "comment": "List top open activities",
    "doc": "List top open activities\n  Get top open locations for a specific campaign."
  },
  "getReportsIdOpenDetails": {
    "comment": "List campaign open details",
    "doc": "List campaign open details\n  Get detailed information about any campaign emails that were opened by a list member."
  },
  "getReportsIdOpenDetailsIdMembersId": {
    "comment": "Get opened campaign subscriber",
    "doc": "Get opened campaign subscriber\n  Get information about a specific subscriber who opened a campaign."
  },
  "getReportsIdSentTo": {
    "comment": "List campaign recipients",
    "doc": "List campaign recipients\n  Get information about campaign recipients."
  },
  "getReportsIdSentToId": {
    "comment": "Get campaign recipient info",
    "doc": "Get campaign recipient info\n  Get information about a specific campaign recipient."
  },
  "getReportsIdSubReportsId": {
    "comment": "List child campaign reports",
    "doc": "List child campaign reports\n  Get a list of reports with child campaigns for a specific parent campaign."
  },
  "getReportsIdUnsubscribed": {
    "comment": "List unsubscribed members",
    "doc": "List unsubscribed members\n  Get information about members who have unsubscribed from a specific campaign."
  },
  "getReportsIdUnsubscribedId": {
    "comment": "Get unsubscribed member",
    "doc": "Get unsubscribed member\n  Get information about a specific list member who unsubscribed from a campaign."
  },
  "getSearchCampaigns": {
    "comment": "Search campaigns",
    "doc": "Search campaigns\n  Search all campaigns for the specified query terms."
  },
  "getSearchMembers": {
    "comment": "Search members",
    "doc": "Search members\n  Search for list members. This search can be restricted to a specific list, or can be used to search across all lists in an account."
  },
  "getTemplateFolders": {
    "comment": "List template folders",
    "doc": "List template folders\n  Get all folders used to organize templates."
  },
  "postTemplateFolders": {
    "comment": "Add template folder",
    "doc": "Add template folder\n  Create a new template folder."
  },
  "deleteTemplateFoldersId": {
    "comment": "Delete template folder",
    "doc": "Delete template folder\n  Delete a specific template folder, and mark all the templates in the folder as 'unfiled'."
  },
  "getTemplateFoldersId": {
    "comment": "Get template folder",
    "doc": "Get template folder\n  Get information about a specific folder used to organize templates."
  },
  "patchTemplateFoldersId": {
    "comment": "Update template folder",
    "doc": "Update template folder\n  Update a specific folder used to organize templates."
  },
  "getTemplates": {
    "comment": "List templates",
    "doc": "List templates\n  Get a list of an account's available templates."
  },
  "postTemplates": {
    "comment": "Add template",
    "doc": "Add template\n  Create a new template for the account. Only Classic templates are supported."
  },
  "deleteTemplatesId": {
    "comment": "Delete template",
    "doc": "Delete template\n  Delete a specific template."
  },
  "getTemplatesId": {
    "comment": "Get template info",
    "doc": "Get template info\n  Get information about a specific template."
  },
  "patchTemplatesId": {
    "comment": "Update template",
    "doc": "Update template\n  Update the name, HTML, or `folder_id` of an existing template."
  },
  "getTemplatesIdDefaultContent": {
    "comment": "View default content",
    "doc": "View default content\n  Get the sections that you can edit in a template, including each section's default content."
  },
  "getVerifiedDomains": {
    "comment": "List sending domains",
    "doc": "List sending domains\n  Get all of the sending domains on the account."
  },
  "createVerifiedDomain": {
    "comment": "Add domain to account",
    "doc": "Add domain to account\n  Add a domain to the account."
  },
  "deleteVerifiedDomain": {
    "comment": "Delete domain",
    "doc": "Delete domain\n  Delete a verified domain from the account."
  },
  "getVerifiedDomain": {
    "comment": "Get domain info",
    "doc": "Get domain info\n  Get the details for a single domain on the account."
  },
  "verifyDomain": {
    "comment": "Verify domain",
    "doc": "Verify domain\n  Verify a domain for sending."
  }
}