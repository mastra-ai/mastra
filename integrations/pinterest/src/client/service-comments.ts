export const comments = {
  "adAccountsList": {
    "comment": "List ad accounts",
    "doc": "List ad accounts\n  Get a list of the ad_accounts that the \"operation user_account\" has access to.\n  - This includes ad_accounts they own and ad_accounts that are owned by others who have granted them <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>."
  },
  "adAccountsCreate": {
    "comment": "Create ad account",
    "doc": "Create ad account\n  Create a new ad account. Different ad accounts can support different currencies, payment methods, etc.\n  An ad account is needed to create campaigns, ad groups, and ads; other accounts (your employees or partners) can be assigned business access and appropriate roles to access an ad account. <p/>\n  You can set up up to 50 ad accounts per user. (The user must have a business account to create an ad account.) <p/>\n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/create-an-advertiser-account\">Create an advertiser account</a>."
  },
  "adAccountsGet": {
    "comment": "Get ad account",
    "doc": "Get ad account\n  Get an ad account"
  },
  "adGroupsList": {
    "comment": "List ad groups",
    "doc": "List ad groups\n  List ad groups based on provided campaign IDs or ad group IDs.(campaign_ids or ad_group_ids). <p/>\n  <strong>Note:</strong><p/>\n  Provide only campaign_id or ad_group_id. Do not provide both."
  },
  "adGroupsCreate": {
    "comment": "Create ad groups",
    "doc": "Create ad groups\n  Create multiple new ad groups. All ads in a given ad group will have the same budget, bid, run dates, targeting, and placement (search, browse, other). For more information, <a href=\"https://help.pinterest.com/en/business/article/campaign-structure\" target=\"_blank\"> click here</a>.</p>\n  <strong>Note:</strong>\n  - 'bid_in_micro_currency' and 'budget_in_micro_currency' should be expressed in microcurrency amounts based on the currency field set in the advertiser's profile.<p/>\n  <p>Microcurrency is used to track very small transactions, based on the currency set in the advertiser’s profile.</p>\n  <p>A microcurrency unit is 10^(-6) of the standard unit of currency selected in the advertiser’s profile.</p>\n  <p><strong>Equivalency equations</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>$1 = 1,000,000 microdollars</li>\n  <li>1 microdollar = $0.000001 </li>\n  </ul>\n  <p><strong>To convert between currency and microcurrency</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>To convert dollars to microdollars, mutiply dollars by 1,000,000</li>\n  <li>To convert microdollars to dollars, divide microdollars by 1,000,000</li>\n  </ul>\n  - Ad groups belong to ad campaigns. Some types of campaigns (e.g. budget optimization) have limits on the number of ad groups they can hold. If you exceed those limits, you will get an error message.\n  - Start and end time cannot be set for ad groups that belong to CBO campaigns. Currently, campaigns with the following objective types: TRAFFIC, AWARENESS, WEB_CONVERSIONS, and CATALOG_SALES will default to CBO."
  },
  "adGroupsUpdate": {
    "comment": "Update ad groups",
    "doc": "Update ad groups\n  Update multiple existing ad groups."
  },
  "adGroupsAnalytics": {
    "comment": "Get ad group analytics",
    "doc": "Get ad group analytics\n  Get analytics for the specified ad groups in the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "adGroupsTargetingAnalyticsGet": {
    "comment": "Get targeting analytics for ad groups",
    "doc": "Get targeting analytics for ad groups\n  Get targeting analytics for one or more ad groups.\n  For the requested ad group(s) and metrics, the response will include the requested metric information\n  (e.g. SPEND_IN_DOLLAR) for the requested target type (e.g. \"age_bucket\") for applicable values (e.g. \"45-49\"). <p/>\n  - The token's user_account must either be the Owner of the specified ad account, or have one\n  of the necessary roles granted to them via\n  <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "adGroupsAudienceSizing": {
    "comment": "Get audience sizing",
    "doc": "Get audience sizing\n  Get potential audience size for an ad group with given targeting criteria.\n  Potential audience size estimates the number of people you may be able to reach per month with your campaign.\n  It is based on historical advertising data and the targeting criteria you select.\n  It does not guarantee results or take into account factors such as bid, budget, schedule, seasonality or product experiments."
  },
  "adGroupsGet": {
    "comment": "Get ad group",
    "doc": "Get ad group\n  Get a specific ad given the ad ID. If your pin is rejected, rejected_reasons will\n  contain additional information from the Ad Review process.\n  For more information about our policies and rejection reasons see the <a href=\"https://www.pinterest.com/_/_/policy/advertising-guidelines/\" target=\"_blank\">Pinterest advertising standards</a>."
  },
  "adPreviewsCreate": {
    "comment": "Create ad preview with pin or image",
    "doc": "Create ad preview with pin or image\n  Create an ad preview given an ad account ID and either an existing organic pin ID or the URL for an image to be used to create the Pin and the ad. <p/>\n  If you are creating a preview from an existing Pin, that Pin must be promotable: that is, it must have a clickthrough link and meet other requirements. (See <a href=\"https://help.pinterest.com/en/business/article/promoted-pins-overview\" target=\"_blank\">Ads Overview</a>.) <p/>\n  You can view the returned preview URL on a webpage or iframe for 7 days, after which the URL expires. Collection ads are not currently supported ad preview."
  },
  "adsList": {
    "comment": "List ads",
    "doc": "List ads\n  List ads that meet the filters provided:\n  - Listed campaign ids or ad group ids or ad ids\n  - Listed entity statuses <p/>\n  If no filter is provided, all ads in the ad account are returned. <p/>\n  <strong>Note:</strong><p/>\n  Provide only campaign_id or ad_group_id or ad_id. Do not provide more than one type. <p/>\n  Review status is provided for each ad; if review_status is REJECTED, the rejected_reasons field will contain additional information.\n  For more, see <a href=\"https://policy.pinterest.com/en/advertising-guidelines\">Pinterest advertising standards</a>."
  },
  "adsCreate": {
    "comment": "Create ads",
    "doc": "Create ads\n  Create multiple new ads. Request must contain ad_group_id, creative_type, and the source Pin pin_id."
  },
  "adsUpdate": {
    "comment": "Update ads",
    "doc": "Update ads\n  Update multiple existing ads"
  },
  "adsAnalytics": {
    "comment": "Get ad analytics",
    "doc": "Get ad analytics\n  Get analytics for the specified ads in the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - The request must contain either ad_ids or both campaign_ids and pin_ids.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "adsCreditsDiscountsGet": {
    "comment": "Get ads credit discounts",
    "doc": "Get ads credit discounts\n  Returns the list of discounts applied to the account.\n \n  <strong>This endpoint might not be available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adsCreditRedeem": {
    "comment": "Redeem ad credits",
    "doc": "Redeem ad credits\n  Redeem ads credit on behalf of the ad account id and apply it towards billing.\n \n  <strong>This endpoint might not be available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adTargetingAnalyticsGet": {
    "comment": "Get targeting analytics for ads",
    "doc": "Get targeting analytics for ads\n  Get targeting analytics for one or more ads. For the requested ad(s) and metrics,\n  the response will include the requested metric information (e.g. SPEND_IN_DOLLAR) for the requested target type\n  (e.g. \"age_bucket\") for applicable values (e.g. \"45-49\"). <p/>\n  - The token's user_account must either be the Owner of the specified ad account, or have one\n  of the necessary roles granted to them via\n  <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "adsGet": {
    "comment": "Get ad",
    "doc": "Get ad\n  Get a specific ad given the ad ID. If your pin is rejected, rejected_reasons will\n  contain additional information from the Ad Review process.\n  For more information about our policies and rejection reasons see the <a href=\"https://www.pinterest.com/_/_/policy/advertising-guidelines/\" target=\"_blank\">Pinterest advertising standards</a>."
  },
  "adAccountAnalytics": {
    "comment": "Get ad account analytics",
    "doc": "Get ad account analytics\n  Get analytics for the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time."
  },
  "audienceInsightsGet": {
    "comment": "Get audience insights",
    "doc": "Get audience insights\n  Get Audience Insights for an ad account. The response will return insights for 3 types of audiences: the\n  ad account's engaged audience on Pinterest, the ad account's total audience on Pinterest and Pinterest's\n  total audience.<p/>\n  <a href=\"https://help.pinterest.com/en/business/article/audience-insights\" target=\"_blank\">Learn more about Audience Insights</a>."
  },
  "audiencesList": {
    "comment": "List audiences",
    "doc": "List audiences\n  Get list of audiences for the ad account."
  },
  "audiencesCreate": {
    "comment": "Create audience",
    "doc": "Create audience\n  Create an audience you can use in targeting for specific ad groups. Targeting combines customer information with\n  the ways users interact with Pinterest to help you reach specific groups of users; you can include or exclude\n  specific audience_ids when you create an ad group. <p/>\n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/audience-targeting\" target=\"_blank\">Audience targeting</a>."
  },
  "audiencesGet": {
    "comment": "Get audience",
    "doc": "Get audience\n  Get a specific audience given the audience ID."
  },
  "audiencesUpdate": {
    "comment": "Update audience",
    "doc": "Update audience\n  Update (edit or remove) an existing targeting audience."
  },
  "audiencesCreateCustom": {
    "comment": "Create custom audience",
    "doc": "Create custom audience\n  Create a custom audience and find the audiences you want your ads to reach."
  },
  "adAccountsAudiencesSharedAccountsList": {
    "comment": "List accounts with access to an audience owned by an ad account",
    "doc": "List accounts with access to an audience owned by an ad account\n  List all ad accounts and/or businesses that have access to a specific audience. The audience must be owned by the requesting ad account."
  },
  "updateAdAccountToAdAccountSharedAudience": {
    "comment": "Update audience sharing between ad accounts",
    "doc": "Update audience sharing between ad accounts\n  From an ad account, share a specific audience with another ad account, or revoke access to a previously shared audience. Only the audience owner account can share the audience. The recipient ad account(s) must be in the same <a href='https://help.pinterest.com/en/business/article/create-and-manage-accounts'>Pinterest Business Hierarchy</a> as the business owner of the ad account.<br> This endpoint is not available to all apps.<a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>."
  },
  "updateAdAccountToBusinessSharedAudience": {
    "comment": "Update audience sharing from an ad account to businesses",
    "doc": "Update audience sharing from an ad account to businesses\n  From an ad account, share a specific audience with a business account, or revoke access to a previously shared audience. Only the audience owner account can share the audience. The recipient business account must be in the same business hierarchy as the business owner of the ad account.<br> This endpoint is not available to all apps.<a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>."
  },
  "adGroupsBidFloorGet": {
    "comment": "Get bid floors",
    "doc": "Get bid floors\n  List bid floors for your campaign configuration. Bid floors are given in microcurrency values based on the currency in the bid floor specification. <p/>\n  <p>Microcurrency is used to track very small transactions, based on the currency set in the advertiser’s profile.</p>\n  <p>A microcurrency unit is 10^(-6) of the standard unit of currency selected in the advertiser’ s profile.</p>\n  <p><strong>Equivalency equations</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>$1 = 1,000,000 microdollars</li>\n  <li>1 microdollar = $0.000001 </li>\n  </ul>\n  <p><strong>To convert between currency and microcurrency</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>To convert dollars to microdollars, mutiply dollars by 1,000,000</li>\n  <li>To convert microdollars to dollars, divide microdollars by 1,000,000</li>\n  </ul>\n  For more on bid floors see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/set-your-bid\"> Set your bid</a>."
  },
  "billingProfilesGet": {
    "comment": "Get billing profiles",
    "doc": "Get billing profiles\n  Get billing profiles in the advertiser account.\n \n  <strong>This endpoint might not be available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "bulkDownloadCreate": {
    "comment": "Get advertiser entities in bulk",
    "doc": "Get advertiser entities in bulk\n  Create an asynchronous report that may include information on campaigns, ad groups, product groups, ads,\n  and/or keywords; can filter by campaigns. Though the entities may be active, archived, or paused,\n  only active entities will return data."
  },
  "bulkUpsertCreate": {
    "comment": "Create/update ad entities in bulk",
    "doc": "Create/update ad entities in bulk\n  Either create or update any combination of campaigns, ad groups, product groups, ads, or keywords.\n  Note that this request will be processed asynchronously; the response will include a <code>request_id</code>\n  that can be used to obtain the status of the request."
  },
  "bulkRequestGet": {
    "comment": "Download advertiser entities in bulk",
    "doc": "Download advertiser entities in bulk\n  Get the status of a bulk request by <code>request_id</code>, along with a download URL that will allow you to download the\n  new or updated entity data (campaigns, ad groups, product groups, ads, or keywords)."
  },
  "campaignsList": {
    "comment": "List campaigns",
    "doc": "List campaigns\n  Get a list of the campaigns in the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager."
  },
  "campaignsCreate": {
    "comment": "Create campaigns",
    "doc": "Create campaigns\n  Create multiple new campaigns. Every campaign has its own campaign_id and houses one or more ad groups, which contain one or more ads.\n  For more, see <a href=\"https://help.pinterest.com/en/business/article/set-up-your-campaign/\">Set up your campaign</a>. <p/>\n  <strong>Note:</strong>\n  - The values for 'lifetime_spend_cap' and 'daily_spend_cap' are microcurrency amounts based on the currency field set in the advertiser's profile. (e.g. USD) <p/>\n  <p>Microcurrency is used to track very small transactions, based on the currency set in the advertiser’s profile.</p>\n  <p>A microcurrency unit is 10^(-6) of the standard unit of currency selected in the advertiser’s profile.</p>\n  <p><strong>Equivalency equations</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>$1 = 1,000,000 microdollars</li>\n  <li>1 microdollar = $0.000001 </li>\n  </ul>\n  <p><strong>To convert between currency and microcurrency</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>To convert dollars to microdollars, mutiply dollars by 1,000,000</li>\n  <li>To convert microdollars to dollars, divide microdollars by 1,000,000</li>\n  </ul>"
  },
  "campaignsUpdate": {
    "comment": "Update campaigns",
    "doc": "Update campaigns\n  Update multiple ad campaigns based on campaign_ids. <p/>\n  <strong>Note:</strong><p/>\n  - <p>The values for 'lifetime_spend_cap' and 'daily_spend_cap' are microcurrency amounts based on the currency field set in the advertiser's profile. (e.g. USD) <p/>\n  <p>Microcurrency is used to track very small transactions, based on the currency set in the advertiser’s profile.</p>\n  <p>A microcurrency unit is 10^(-6) of the standard unit of currency selected in the advertiser’ s profile.</p>\n  <p><strong>Equivalency equations</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>$1 = 1,000,000 microdollars</li>\n  <li>1 microdollar = $0.000001 </li>\n  </ul>\n  <p><strong>To convert between currency and microcurrency</strong>, using dollars as an example currency:</p>\n  <ul>\n  <li>To convert dollars to microdollars, mutiply dollars by 1,000,000</li>\n  <li>To convert microdollars to dollars, divide microdollars by 1,000,000</li>\n  </ul>"
  },
  "campaignsAnalytics": {
    "comment": "Get campaign analytics",
    "doc": "Get campaign analytics\n  Get analytics for the specified campaigns in the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "campaignTargetingAnalyticsGet": {
    "comment": "Get targeting analytics for campaigns",
    "doc": "Get targeting analytics for campaigns\n  Get targeting analytics for one or more campaigns.\n  For the requested account and metrics, the response will include the requested metric information\n  (e.g. SPEND_IN_DOLLAR) for the requested target type (e.g. \"age_bucket\") for applicable values (e.g. \"45-49\"). <p/>\n  - The token's user_account must either be the Owner of the specified ad account, or have one\n  of the necessary roles granted to them via\n  <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "campaignsGet": {
    "comment": "Get campaign",
    "doc": "Get campaign\n  Get a specific campaign given the campaign ID."
  },
  "conversionTagsList": {
    "comment": "Get conversion tags",
    "doc": "Get conversion tags\n  List conversion tags associated with an ad account."
  },
  "conversionTagsCreate": {
    "comment": "Create conversion tag",
    "doc": "Create conversion tag\n  Create a conversion tag, also known as <a href=\"https://help.pinterest.com/en/business/article/set-up-the-pinterest-tag\" target=\"_blank\">Pinterest tag</a>, with the option to enable enhanced match.<p/>\n  The Pinterest Tag tracks actions people take on the ad account’ s website after they view the ad account's ad on Pinterest. The advertiser needs to customize this tag to track conversions.<p/>\n  For more information, see:<p/>\n  <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/set-up-the-pinterest-tag\">Set up the Pinterest tag</a><p/>\n  <a class=\"reference external\" href=\"/docs/api-features/pinterest-tag/\">Pinterest Tag</a><p/>\n  <a class=\"reference external\" href=\"/docs/api-features/pinterest-tag/#enhanced-match\">Enhanced match</a>"
  },
  "ocpmEligibleConversionTagsGet": {
    "comment": "Get Ocpm eligible conversion tags",
    "doc": "Get Ocpm eligible conversion tags\n  Get Ocpm eligible conversion tag events for an ad account."
  },
  "pageVisitConversionTagsGet": {
    "comment": "Get page visit conversion tags",
    "doc": "Get page visit conversion tags\n  Get all page visit conversion tag events for an ad account."
  },
  "conversionTagsGet": {
    "comment": "Get conversion tag",
    "doc": "Get conversion tag\n  Get information about an existing conversion tag."
  },
  "customerListsCreate": {
    "comment": "Create customer lists",
    "doc": "Create customer lists\n  <p>Create a customer list from your records(hashed or plain-text email addresses, or hashed MAIDs or IDFAs).</p>\n  <p>A customer list is one of the four types of Pinterest audiences: for more information, see <a href=\"https://help.pinterest.com/en/business/article/audience-targeting\" target=\"_blank\">Audience targeting</a>\n  or the <a href=\"/docs/api-features/targeting-overview/\" target=\"_blank\">Audiences</a> section of the ads management guide.<p/>\n  <p><b>Please review our <u><a href=\"https://help.pinterest.com/en/business/article/audience-targeting#section-13341\" target=\"_blank\">requirements</a></u> for what type of information is allowed when uploading a customer list.</b></p>\n  <p>When you create a customer list, the system scans the list for existing Pinterest accounts;\n  the list must include at least 100 Pinterest accounts. Your original list will be deleted when the matching process\n  is complete. The filtered list – containing only the Pinterest accounts that were included in your starting\n  list – is what will be used to create the audience.</p>\n  <p>Note that once you have created your customer list, you must convert it into an audience (of the “ CUSTOMER_LIST” type)\n  using the <a href=\"#operation/create_audience_handler\">create audience endpoint</a> before it can be used.</p>"
  },
  "customerListsList": {
    "comment": "Get customer lists",
    "doc": "Get customer lists\n  <p>Get a set of customer lists including id and name based on the filters provided.</p>\n  <p>(Customer lists are a type of audience.) For more information, see\n  <a href=\"https://help.pinterest.com/en/business/article/audience-targeting\" target=\"_blank\">Audience targeting</a>\n  or the <a href=\"/docs/api-features/targeting-overview/\" target=\"_blank\">Audiences</a>\n  section of the ads management guide.</p>"
  },
  "customerListsGet": {
    "comment": "Get customer list",
    "doc": "Get customer list\n  Gets a specific customer list given the customer list ID."
  },
  "customerListsUpdate": {
    "comment": "Update customer list",
    "doc": "Update customer list\n  <p>Append or remove records to/from an existing customer list. (A customer list is one of the four types of Pinterest audiences.)</p>\n  <p>When you add records to an existing customer list, the system scans the additions for existing Pinterest\n  accounts; those are the records that will be added to your “CUSTOMER_LIST” audience. Your original list of records\n  to add will be deleted when the matching process is complete.</p>\n  <p>For more information, see <a href=\"https://help.pinterest.com/en/business/article/audience-targeting\" target=\"_blank\">Audience targeting</a>\n  or the <a href=\"/docs/api-features/targeting-overview/\" target=\"_blank\">Audiences</a>\n  section of the ads management guide.</p>"
  },
  "eventsCreate": {
    "comment": "Send conversions",
    "doc": "Send conversions\n  The Pinterest API offers advertisers a way to send Pinterest their conversion information (including web conversions, in-app conversions, or even offline conversions) based on their <code>ad_account_id</code>. The request body should be a JSON object.\n  - This endpoint requires an <code>access_token</code> be generated through Ads Manager. Review the <a href=\"/docs/api-features/conversion-overview/\">Conversions Guide</a> for more details. (Note that the authorization header required is <code>Authorization: Bearer &lt;access_token&gt;</code>).\n  - The token's <code>user_account</code> must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Audience, Campaign. (Note that the token can be used across multiple ad accounts under an user ID.)\n  - This endpoint has a rate limit of 5,000 calls per minute per ad account.\n  - If the merchant is submitting this information using both Pinterest conversion tags and the Pinterest API, Pinterest will remove duplicate information before reporting. (Note that events that took place offline cannot be deduplicated.)"
  },
  "audienceInsightsScopeAndTypeGet": {
    "comment": "Get audience insights scope and type",
    "doc": "Get audience insights scope and type\n  Get the scope and type of available audiences, which along with a date, is an audience that has recently had an interaction (referred to here as a type) on pins. Interacted pins can belong to at least the most common partner or Pinterest scopes. This means that user interactions made on advertiser or partner pins will have the partner scope. You can also have user interactions performed in general on Pinterest with the Pinterest scope. In that case, you can then use the returned type and scope values together on requests to other endpoints to retrieve insight metrics for a desired audience."
  },
  "keywordsGet": {
    "comment": "Get keywords",
    "doc": "Get keywords\n  <p>Get a list of keywords based on the filters provided. If no filter is provided, it will default to the ad_account_id filter, which means it will only return keywords that specifically have parent_id set to the ad_account_id. Note: Keywords can have ad_account_ids, campaign_ids, and ad_group_ids set as their parent_ids. Keywords created through Ads Manager will have their parent_id set to an ad_group_id, not ad_account_id.</p>\n  <p>For more information, see <a target=\"_blank\" href=\"https://help.pinterest.com/en/business/article/keyword-targeting\">Keyword targeting</a>.</p>\n  <p><b>Notes:</b></p> <ul style=\"list-style-type: square;\"> <li>Advertisers and campaigns can only be assigned keywords with excluding ('_NEGATIVE').</li> <li>All keyword match types are available for ad groups.</li> </ul> <p>For more information on match types, see <a target=\"_blank\" href=\"/docs/api-features/targeting-overview/\">match type enums</a>.</p>\n  <p><b>Returns:</b></p> <ul style=\"list-style-type: square;\"> <li><p>A successful call returns an object containing an array of new keyword objects and an empty &quot;errors&quot; object array.</p></li> <li><p>An unsuccessful call returns an empty keywords array, and, instead, inserts the entire object with nulled/negated properties into the &quot;errors&quot; object array:</p> <pre class=\"last literal-block\"> { \"keywords\": [], \"errors\": [ { \"data\": { \"archived\": null, \"match_type\": \"EXACT\", \"parent_type\": null, \"value\": \"foobar\", \"parent_id\": null, \"type\": \"keyword\", \"id\": null }, \"error_messages\": [ \"Advertisers and Campaigns only accept excluded targeting attributes.\" ] } } </pre></li> </ul>"
  },
  "keywordsCreate": {
    "comment": "Create keywords",
    "doc": "Create keywords\n  <p>Create keywords for following entity types(advertiser, campaign, ad group or ad).</p> <p>For more information, see <a target=\"_blank\" href=\"https://help.pinterest.com/en/business/article/keyword-targeting\">Keyword targeting</a>.</p>\n  <p><b>Notes:</b></p> <ul style=\"list-style-type: square;\"> <li>Advertisers and campaigns can only be assigned keywords with excluding ('_NEGATIVE').</li> <li>All keyword match types are available for ad groups.</li> </ul> <p>For more information on match types, see <a  target=\"_blank\" href=\"/docs/api-features/targeting-overview/\">match type enums</a>.</p>\n  <p><b>Returns:</b></p> <ul style=\"list-style-type: square;\"> <li><p>A successful call returns an object containing an array of new keyword objects and an empty &quot;errors&quot; object array.</p></li> <li><p>An unsuccessful call returns an empty keywords array, and, instead, inserts the entire object with nulled/negated properties into the &quot;errors&quot; object array:</p> <pre class=\"last literal-block\"> { \"keywords\": [], \"errors\": [ { \"data\": { \"archived\": null, \"match_type\": \"EXACT\", \"parent_type\": null, \"value\": \"foobar\", \"parent_id\": null, \"type\": \"keyword\", \"id\": null }, \"error_messages\": [ \"Advertisers and Campaigns only accept excluded targeting attributes.\" ] } } </pre></li> </ul>\n  <p><b>Rate limit</b>: <a href=\"/docs/reference/rate-limits/\">WRITE</a>.</p>"
  },
  "keywordsUpdate": {
    "comment": "Update keywords",
    "doc": "Update keywords\n  <p>Update one or more keywords' bid and archived fields.</p> <p>Archiving a keyword effectively deletes it - keywords no longer receive metrics and no longer visible within the parent entity's keywords list.</p>"
  },
  "countryKeywordsMetricsGet": {
    "comment": "Get country's keyword metrics",
    "doc": "Get country's keyword metrics\n  See keyword metrics for a specified country, aggregated across all of Pinterest.\n  (Definitions are available from the \"Get delivery metrics definitions\"\n  <a href=\"/docs/api/v5/#operation/delivery_metrics/get\">API endpoint</a>)."
  },
  "leadFormsList": {
    "comment": "List lead forms",
    "doc": "List lead forms\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  List lead forms associated with an ad account ID.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "leadFormsCreate": {
    "comment": "Create lead forms",
    "doc": "Create lead forms\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  Create lead forms. Lead forms are used in lead ads and allow you to control what text appears on the lead form’ s description, questions and confirmation sections.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "leadFormsUpdate": {
    "comment": "Update lead forms",
    "doc": "Update lead forms\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  Update lead forms. Lead ads help you reach people who are actively looking for, and interested in, your goods and services. The lead form can be associated with an ad to allow people to fill out the form.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "leadFormGet": {
    "comment": "Get lead form by id",
    "doc": "Get lead form by id\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  Gets a lead form given it's ID. It must also be associated with the provided ad account ID.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "leadFormTestCreate": {
    "comment": "Create lead form test data",
    "doc": "Create lead form test data\n  Create lead form test data based on the list of answers provided as part of the body.\n  - List of answers should follow the questions creation order.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adAccountsSubscriptionsPost": {
    "comment": "Create lead ads subscription",
    "doc": "Create lead ads subscription\n  Create a lead ads webhook subscription.\n  Subscriptions allow Pinterest to deliver lead data from Ads Manager directly to the subscriber. Subscriptions can exist for a specific lead form or at ad account level.\n  - Only requests for the OWNER or ADMIN of the ad_account will be allowed.\n  - Advertisers can set up multiple integrations using ad_account_id + lead_form_id but only one integration per unique records.\n  - For data security, egress lead data is encrypted with AES-256-GCM.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adAccountsSubscriptionsGetList": {
    "comment": "Get lead ads subscriptions",
    "doc": "Get lead ads subscriptions\n  Get the advertiser's list of lead ads subscriptions.\n  - Only requests for the OWNER or ADMIN of the ad_account will be allowed.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adAccountsSubscriptionsGetById": {
    "comment": "Get lead ads subscription",
    "doc": "Get lead ads subscription\n  Get a specific lead ads subscription record.\n  - Only requests for the OWNER or ADMIN of the ad_account will be allowed.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "adAccountsSubscriptionsDelById": {
    "comment": "Delete lead ads subscription",
    "doc": "Delete lead ads subscription\n  Delete an existing lead ads webhook subscription by ID.\n  - Only requests for the OWNER or ADMIN of the ad_account will be allowed.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "leadsExportCreate": {
    "comment": "Create a request to export leads collected from a lead ad",
    "doc": "Create a request to export leads collected from a lead ad\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  Create an export of leads collected from a lead ad. This returns a lead_export_id  token that you can use to download the export when it is ready.\n \n  Note: Lead ad data will be available up to 30 days after the lead has been submitted.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "leadsExportGet": {
    "comment": "Get the lead export from the lead export create call",
    "doc": "Get the lead export from the lead export create call\n  <strong>This feature is currently in beta and not available to all apps, if you're interested in joining the beta, please reach out to your Pinterest account manager.</strong>\n \n  Get the export of leads collected from a lead ad. This returns a URL to a list of lead export given a lead_export_id token returned from the create a lead export call. You can use the URL to download the report.\n \n  Note: Lead ad data will be available up to 30 days after the lead has been submitted.\n \n  For more, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/lead-ads\">Lead ads</a>."
  },
  "analyticsGetMmmReport": {
    "comment": "Get advertiser Marketing Mix Modeling (MMM) report.",
    "doc": "Get advertiser Marketing Mix Modeling (MMM) report.\n  Get an mmm report for an ad account. This returns a URL to an mmm metrics report given a token returned from the\n  create mmm report endpoint."
  },
  "analyticsCreateMmmReport": {
    "comment": "Create a request for a Marketing Mix Modeling (MMM) report",
    "doc": "Create a request for a Marketing Mix Modeling (MMM) report\n  This creates an asynchronous mmm report based on the given request. It returns a token that you can use to download\n  the report when it is ready. NOTE: An additional limit of 5 queries per minute per advertiser applies to this endpoint while it's in beta release."
  },
  "orderLinesList": {
    "comment": "Get order lines",
    "doc": "Get order lines\n  List existing order lines associated with an ad account."
  },
  "orderLinesGet": {
    "comment": "Get order line",
    "doc": "Get order line\n  Get a specific existing order line associated with an ad account."
  },
  "productGroupPromotionsCreate": {
    "comment": "Create product group promotions",
    "doc": "Create product group promotions\n  Add one or more product groups from your catalog to an existing ad group. (Product groups added to an ad group are a 'product group promotion.')"
  },
  "productGroupPromotionsUpdate": {
    "comment": "Update product group promotions",
    "doc": "Update product group promotions\n  Update multiple existing Product Group Promotions (by product_group_id)"
  },
  "productGroupPromotionsList": {
    "comment": "Get product group promotions",
    "doc": "Get product group promotions\n  List existing product group promotions associated with an ad account.\n \n  Include either ad_group_id or product_group_promotion_ids in your request.\n \n  <b>Note:</b> ad_group_ids and product_group_promotion_ids are mutually exclusive parameters.\n  Only provide one. If multiple options are provided, product_group_promotion_ids takes precedence over ad_group_ids. If none are provided, the endpoint returns an error."
  },
  "productGroupPromotionsGet": {
    "comment": "Get a product group promotion by id",
    "doc": "Get a product group promotion by id\n  Get a product group promotion by id"
  },
  "productGroupsAnalytics": {
    "comment": "Get product group analytics",
    "doc": "Get product group analytics\n  Get analytics for the specified product groups in the specified <code>ad_account_id</code>, filtered by the specified options.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "analyticsGetReport": {
    "comment": "Get the account analytics report created by the async call",
    "doc": "Get the account analytics report created by the async call\n  This returns a URL to an analytics report given a token returned from the post request report creation call. You can use the URL to download the report. The link is valid for five minutes and the report is valid for one hour.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager."
  },
  "analyticsCreateReport": {
    "comment": "Create async request for an account analytics report",
    "doc": "Create async request for an account analytics report\n  This returns a token that you can use to download the report when it is ready. Note that this endpoint requires the parameters to be passed as JSON-formatted in the request body. This endpoint does not support URL query parameters.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 914 days before the current date in UTC time and the max time range supported is 186 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days.\n  - If level is PRODUCT_ITEM, the furthest back you can are allowed to pull data is 92 days before the current date in UTC time and the max time range supported is 31 days.\n  - If level is PRODUCT_ITEM, ad_ids and ad_statuses parameters are not allowed. Any columns related to pin promotion and ad is not allowed either."
  },
  "sandboxDelete": {
    "comment": "Delete ads data for ad account in API Sandbox",
    "doc": "Delete ads data for ad account in API Sandbox\n  Delete an ad account and all the ads data associated with that account.\n  A string message is returned indicating the status of the delete operation.\n \n  Note: This endpoint is only allowed in the Pinterest API Sandbox (https://api-sandbox.pinterest.com/v5).\n  Go to /docs/developer-tools/sandbox/ for more information."
  },
  "ssioAccountsGet": {
    "comment": "Get Salesforce account details including bill-to information.",
    "doc": "Get Salesforce account details including bill-to information.\n  Get Salesforce account details including bill-to information to be used in insertion orders process for <code>ad_account_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "ssioInsertionOrderCreate": {
    "comment": "Create insertion order through SSIO.",
    "doc": "Create insertion order through SSIO.\n  Create insertion order through SSIO for <code>ad_account_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "ssioInsertionOrderEdit": {
    "comment": "Edit insertion order through SSIO.",
    "doc": "Edit insertion order through SSIO.\n  Edit insertion order through SSIO for <code>ad_account_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "ssioInsertionOrdersStatusGetByAdAccount": {
    "comment": "Get insertion order status by ad account id.",
    "doc": "Get insertion order status by ad account id.\n  Get insertion order status for account id <code>ad_account_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "ssioInsertionOrdersStatusGetByPinOrderId": {
    "comment": "Get insertion order status by pin order id.",
    "doc": "Get insertion order status by pin order id.\n  Get insertion order status for pin order id <code>pin_order_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "ssioOrderLinesGetByAdAccount": {
    "comment": "Get Salesforce order lines by ad account id.",
    "doc": "Get Salesforce order lines by ad account id.\n  Get Salesforce order lines for account id <code>ad_account_id</code>.\n  - The token's user_account must either be the Owner of the specified ad account, or have one of the necessary roles granted to them via <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Finance, Campaign."
  },
  "adAccountTargetingAnalyticsGet": {
    "comment": "Get targeting analytics for an ad account",
    "doc": "Get targeting analytics for an ad account\n  Get targeting analytics for an ad account.\n  For the requested account and metrics, the response will include the requested metric information\n  (e.g. SPEND_IN_DOLLAR) for the requested target type (e.g. \"age_bucket\") for applicable values (e.g. \"45-49\"). <p/>\n  - The token's user_account must either be the Owner of the specified ad account, or have one\n  of the necessary roles granted to them via\n  <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a>: Admin, Analyst, Campaign Manager.\n  - If granularity is not HOUR, the furthest back you can are allowed to pull data is 90 days before the current date in UTC time and the max time range supported is 90 days.\n  - If granularity is HOUR, the furthest back you can are allowed to pull data is 8 days before the current date in UTC time and the max time range supported is 3 days."
  },
  "targetingTemplateList": {
    "comment": "List targeting templates",
    "doc": "List targeting templates\n  Get a list of the targeting templates in the specified <code>ad_account_id</code>"
  },
  "targetingTemplateCreate": {
    "comment": "Create targeting templates",
    "doc": "Create targeting templates\n  <p>Targeting templates allow advertisers to save a set of targeting details including audience lists,\n  keywords & interest, demographics, and placements to use more than once during the campaign creation process.</p>\n  <p>Templates can be used to build out basic targeting criteria that you plan to use across campaigns and to reuse\n  performance targeting from prior campaigns for new campaigns.</p>"
  },
  "targetingTemplateUpdate": {
    "comment": "Update targeting templates",
    "doc": "Update targeting templates\n  <p>Update the targeting template given advertiser ID and targeting template ID</p>"
  },
  "templatesList": {
    "comment": "List templates",
    "doc": "List templates\n  Gets all Templates associated with an ad account ID."
  },
  "analyticsCreateTemplateReport": {
    "comment": "Create async request for an analytics report using a template",
    "doc": "Create async request for an analytics report using a template\n  This takes a template ID and an optional custom timeframe and constructs an asynchronous report based on the\n  template. It returns a token that you can use to download the report when it is ready."
  },
  "termsOfServiceGet": {
    "comment": "Get terms of service",
    "doc": "Get terms of service\n  Get the text of the terms of service and see whether the advertiser has accepted the terms of service."
  },
  "advancedAuctionItemsGetPost": {
    "comment": "Get item bid options (POST)",
    "doc": "Get item bid options (POST)\n  Get the bid options for a batch of retail catalog items.\n \n  The catalog must be owned by the \"operation user_account\". <a href=\"/docs/api-features/shopping-overview/#Update%20items%20in%20batch\" target=\"_blank\">See detailed documentation here.</a> By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: `Owner`, `Admin`.\n \n  This endpoint is not available to all users."
  },
  "advancedAuctionItemsSubmitPost": {
    "comment": "Operate on item level bid options",
    "doc": "Operate on item level bid options\n  This endpoint supports multiple operations on a set of one or more bid options (bid price and bid adjustments for targeting categories) for retail catalog items. These advanced auction settings are applied in campaigns using objective_type `CATALOG_SALES` and ad groups using bid_strategy_type `MAX_BID`.\n \n  The catalog must be owned by the \"operation user_account\". <a href=\"/docs/api-features/modify-items-in-batch/\" target=\"_blank\">See detailed documentation here.</a> By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: `Owner`, `Admin`.\n \n  This endpoint is not available to all users."
  },
  "boardsList": {
    "comment": "List boards",
    "doc": "List boards\n  Get a list of the boards owned by the \"operation user_account\" + group boards where this account is a collaborator\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  Optional: Specify a privacy type (public, protected, or secret) to indicate which boards to return.\n  - If no privacy is specified, all boards that can be returned (based on the scopes of the token and ad_account role if applicable) will be returned."
  },
  "boardsCreate": {
    "comment": "Create board",
    "doc": "Create board\n  Create a board owned by the \"operation user_account\".\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardsGet": {
    "comment": "Get board",
    "doc": "Get board\n  Get a board owned by the operation user_account - or a group board that has been shared with this account.\n  - Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardsUpdate": {
    "comment": "Update board",
    "doc": "Update board\n  Update a board owned by the \"operating user_account\".\n  - Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardsDelete": {
    "comment": "Delete board",
    "doc": "Delete board\n  Delete a board owned by the \"operation user_account\".\n  - Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardsListPins": {
    "comment": "List Pins on board",
    "doc": "List Pins on board\n  Get a list of the Pins on a board owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  - Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardSectionsList": {
    "comment": "List board sections",
    "doc": "List board sections\n  Get a list of all board sections from a board owned by the \"operation user_account\" - or a group board that has been shared with this account.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardSectionsCreate": {
    "comment": "Create board section",
    "doc": "Create board section\n  Create a board section on a board owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardSectionsUpdate": {
    "comment": "Update board section",
    "doc": "Update board section\n  Update a board section on a board owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardSectionsDelete": {
    "comment": "Delete board section",
    "doc": "Delete board section\n  Delete a board section on a board owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "boardSectionsListPins": {
    "comment": "List Pins on board section",
    "doc": "List Pins on board section\n  Get a list of the Pins on a board section of a board owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account."
  },
  "getBusinessEmployers": {
    "comment": "List business employers for user",
    "doc": "List business employers for user\n  Get all of the viewing user's business employers."
  },
  "respondBusinessAccessInvites": {
    "comment": "Accept or decline an invite/request",
    "doc": "Accept or decline an invite/request\n  Accept or decline invites or requests."
  },
  "businessAssetMembersGet": {
    "comment": "Get members with access to asset",
    "doc": "Get members with access to asset\n  Get all the members the requesting business has granted access to on the given asset."
  },
  "businessAssetPartnersGet": {
    "comment": "Get partners with access to asset",
    "doc": "Get partners with access to asset\n  Get all the partners the requesting business has granted access to on the given asset.\n  Note: If the asset has been shared with you, an empty array will be returned. This is because an asset shared with\n  you cannot be shared with a different partner."
  },
  "createAssetInvites": {
    "comment": "Update invite/request with an asset permission",
    "doc": "Update invite/request with an asset permission\n  Assign asset permissions information to an existing invite/request. Can be used to:\n  - Request access to a partner's asset. Note: This is only for when no existing partnership exists. If an existing\n  partnership exists, use \"Create a request to access an existing partner's assets\" to request access to your\n  partner's assets.\n  - invite_type=\"PARTNER_REQUEST\"\n  - Invite a partner to access your business assets. Note: This is only for when there is no existing partnership.\n  If there is an existing partnership, use \"Assign/Update partner asset permissions\" to assign a partner access to\n  new assets.\n  - invite_type=\"PARTNER_INVITE\"\n  - Invite a member to access your business assets. Note: This is only for when there is no existing membership.\n  If there is an existing membership, use \"Assign/Update member asset permissions\" to assign a member access to new\n  assets.\n  - invite_type=\"MEMBER_INVITE\"\n \n  To learn more about permission levels, visit https://help.pinterest.com/en/business/article/business-manager-overview."
  },
  "assetAccessRequestsCreate": {
    "comment": "Create a request to access an existing partner's assets.",
    "doc": "Create a request to access an existing partner's assets.\n  Create a request to access an existing partner's assets with the specified permissions. The request will be sent to the partner for approval. The assets that can be requested are ad accounts and profiles."
  },
  "getBusinessMembers": {
    "comment": "Get business members",
    "doc": "Get business members\n  Get all members of the specified business.\n  The return response will include the member's business_role and assets they have access to if assets_summary=TRUE"
  },
  "updateBusinessMemberships": {
    "comment": "Update member's business role",
    "doc": "Update member's business role\n  Update a member's business role within the business."
  },
  "deleteBusinessMembership": {
    "comment": "Terminate business memberships",
    "doc": "Terminate business memberships\n  Terminate memberships between the specified members and your business."
  },
  "businessAssetsGet": {
    "comment": "List business assets",
    "doc": "List business assets\n  Get all the assets the requesting business has access to. This includes assets the business owns and assets the business has access to through partnerships."
  },
  "businessMemberAssetsGet": {
    "comment": "Get assets assigned to a member",
    "doc": "Get assets assigned to a member\n  Get assets on which you assigned asset permissions to the given member. Can be used to:\n  - get all assets, regardless of asset type or\n  - get assets of one asset type by using the asset_type query.\n  The return response will include the permissions the member has to that asset and the asset type."
  },
  "businessMembersAssetAccessUpdate": {
    "comment": "Assign/Update member asset permissions",
    "doc": "Assign/Update member asset permissions\n  Grant multiple members access to assets and/or update multiple member's exisiting permissions to an asset.\n  Note: Not all listed permissions are applicable to each asset type. For example, PROFILE_PUBLISHER would not be applicable to an asset of type AD_ACCOUNT. The permission level PROFILE_PUBLISHER is only available to an asset of the type PROFILE."
  },
  "businessMembersAssetAccessDelete": {
    "comment": "Delete member access to asset",
    "doc": "Delete member access to asset\n  Terminate multiple members' access to an asset."
  },
  "getInvites": {
    "comment": "Get invites/requests",
    "doc": "Get invites/requests\n  Get the membership/partnership invites and/or requests for the authorized user."
  },
  "createMembershipOrPartnershipInvites": {
    "comment": "Create invites or requests",
    "doc": "Create invites or requests\n  Create batch invites or requests. Can create batch invites or requests as described below.\n  - Invite members to join the business. This would required specifying the following:\n  - invite_type=\"MEMBER_INVITE\"\n  - business_role=\"EMPLOYEE\" OR business_role=\"BIZ_ADMIN\" (To learn more about business roles, visit\n  https://help.pinterest.com/en/business/article/profile-permissions-in-business-access.)\n  - members\n  - Invite partners to access your business assets. This would require specifying the following:\n  - invite_type=\"PARTNER_INVITE\"\n  - business_role=\"PARTNER\"\n  - partners\n  - Request to be a partner so you can access their assets. This would require specifying the following:\n  - invite_type=\"PARTNER_REQUEST\"\n  - business_role=\"PARTNER\"\n  - partners"
  },
  "cancelInvitesOrRequests": {
    "comment": "Cancel invites/requests",
    "doc": "Cancel invites/requests\n  Cancel membership/partnership invites and/or requests."
  },
  "updatePartnerAssetAccessHandlerImpl": {
    "comment": "Assign/Update partner asset permissions",
    "doc": "Assign/Update partner asset permissions\n  Grant multiple partners access to assets and/or update multiple partner's exisiting permissions to an asset.\n  If your partner already had permissions on the asset, they will be overriden with the new permissions you assign to them.\n  To learn more about permission levels, visit https://help.pinterest.com/en/business/article/business-manager-overview\n \n  Note: Not all listed permissions are applicable to each asset type. For example, PROFILE_PUBLISHER would not be\n  applicable to an asset of type AD_ACCOUNT. The permission level PROFILE_PUBLISHER is only available to an asset of\n  the type PROFILE."
  },
  "deletePartnerAssetAccessHandlerImpl": {
    "comment": "Delete partner access to asset",
    "doc": "Delete partner access to asset\n  Terminate multiple partners' access to an asset. If\n  - partner_type=INTERNAL: You will terminate a partner's asset access to your business assets.\n  - partner_type=EXTERNAL: You will terminate your own access to your partner's business assets."
  },
  "businessPartnerAssetAccessGet": {
    "comment": "Get assets assigned to a partner or assets assigned by a partner",
    "doc": "Get assets assigned to a partner or assets assigned by a partner\n  Can be used to get the business assets your partner has granted you access to or the business assets you have\n  granted your partner access to. If you specify:\n  - partner_type=INTERNAL, you will retrieve your business assets that the partner has access to.\n  - partner_type=EXTERNAL, you will retrieve the partner's business assets that the partner has granted you access to."
  },
  "getBusinessPartners": {
    "comment": "Get business partners",
    "doc": "Get business partners\n  Get all partners of the specified business.\n \n  If the assets_summary=TRUE and:\n  - partner_type=INTERNAL, the business assets returned are your business assets the partner has access to.\n  - partner_type=EXTERNAL, the business assets returned are your partner's business assets the partner has granted you\n  access to."
  },
  "deleteBusinessPartners": {
    "comment": "Terminate business partnerships",
    "doc": "Terminate business partnerships\n  Terminate partnerships between the specified partners and your business.\n  Note: You may only batch terminate partners of the same partner type."
  },
  "sharedAudiencesForBusinessList": {
    "comment": "List received audiences for a business",
    "doc": "List received audiences for a business\n  Get a list of received audiences for the given business."
  },
  "businessAccountAudiencesSharedAccountsList": {
    "comment": "List accounts with access to an audience owned by a business",
    "doc": "List accounts with access to an audience owned by a business\n  List all ad accounts and/or businesses that have access to a specific audience.\n  The audience must either be owned by an ad account in the requesting business, or it must have been shared with the requesting business.\n  If the requesting business is not the owner of the audience, only ad accounts owned by the requesting business will be returned."
  },
  "updateBusinessToAdAccountSharedAudience": {
    "comment": "Update audience sharing from a business to ad accounts",
    "doc": "Update audience sharing from a business to ad accounts\n  From a business, share a specific audience with other ad account(s), or revoke access to a previously shared audience. <ul> <li>If the business is the owner of the audience, it can share with any ad account within the same business hierarchy.</li> <li>If the business is the recipient of the audience, it can share with any of its owned ad accounts.</li> </ul> This endpoint is not available to all apps.<a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>."
  },
  "updateBusinessToBusinessSharedAudience": {
    "comment": "Update audience sharing between businesses",
    "doc": "Update audience sharing between businesses\n  From a business, share a specific audience with another business account, or revoke access to a previously shared audience. Only the audience owner can share the audience with other businesses, and the recipient business must be within the same business hierarchy.<br> This endpoint is not available to all apps.<a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>."
  },
  "assetGroupCreate": {
    "comment": "Create a new asset group.",
    "doc": "Create a new asset group.\n  Create a new asset group with the specified parameters.\n  - An <a href=\"https://help.pinterest.com/en/business/article/asset-groups\">asset group</a> is a custom group of assets based on how you’d like to manage your accounts."
  },
  "assetGroupUpdate": {
    "comment": "Update asset groups.",
    "doc": "Update asset groups.\n  Update a batch of asset groups with the specified parameters."
  },
  "assetGroupDelete": {
    "comment": "Delete asset groups.",
    "doc": "Delete asset groups.\n  Delete a batch of asset groups."
  },
  "catalogsList": {
    "comment": "List catalogs",
    "doc": "List catalogs\n  Fetch catalogs owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsCreate": {
    "comment": "Create catalog",
    "doc": "Create catalog\n  Create a new catalog owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>\n \n  Note: this API only supports the catalog type of HOTEL for now."
  },
  "feedsList": {
    "comment": "List feeds",
    "doc": "List feeds\n  Fetch feeds owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  For Retail partners, refer to <a href='https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs'>Before you get started with Catalogs</a>. For Hotel parterns, refer to <a href='/docs/api-features/shopping-overview/'>Pinterest API for shopping</a>."
  },
  "feedsCreate": {
    "comment": "Create feed",
    "doc": "Create feed\n  Create a new feed owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Please, be aware that \"default_country\"\n  and \"default_locale\" are not required in the spec for forward compatibility\n  but for now the API will not accept requests without those fields.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  For Retail partners, refer to <a href='https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs'>Before you get started with Catalogs</a>. For Hotel parterns, refer to <a href='/docs/api-features/shopping-overview/'>Pinterest API for shopping</a>.\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "feedsGet": {
    "comment": "Get feed",
    "doc": "Get feed\n  Get a single feed owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  For Retail partners, refer to <a href='https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs'>Before you get started with Catalogs</a>. For Hotel parterns, refer to <a href='/docs/api-features/shopping-overview/'>Pinterest API for shopping</a>."
  },
  "feedsUpdate": {
    "comment": "Update feed",
    "doc": "Update feed\n  Update a feed owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  For Retail partners, refer to <a href='https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs'>Before you get started with Catalogs</a>. For Hotel parterns, refer to <a href='/docs/api-features/shopping-overview/'>Pinterest API for shopping</a>.\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "feedsDelete": {
    "comment": "Delete feed",
    "doc": "Delete feed\n  Delete a feed owned by the \"operating user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  For Retail partners, refer to <a href='https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs'>Before you get started with Catalogs</a>. For Hotel parterns, refer to <a href='/docs/api-features/shopping-overview/'>Pinterest API for shopping</a>."
  },
  "feedsIngest": {
    "comment": "Ingest feed items",
    "doc": "Ingest feed items\n  Ingest items for a given feed owned by the \"operation user_account\".\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>\n \n  Note: This endpoint is restricted to a specific group of users. If you require access, please reach out to your partner manager."
  },
  "feedProcessingResultsList": {
    "comment": "List feed processing results",
    "doc": "List feed processing results\n  Fetch a feed processing results owned by the \"operation user_account\". Please note that for now the bookmark parameter is not functional and only the first page will be available until it is implemented in some release in the near future.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "itemsIssuesList": {
    "comment": "List item issues",
    "doc": "List item issues\n  List item validation issues for a given feed processing result owned by the \"operation user_account\". Up to 20 random samples of affected items are returned for each error and warning code. Please note that for now query parameters 'item_numbers' and 'item_validation_issue' cannot be used simultaneously until it is implemented in some release in the future.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  Note: To get a list of all affected items instead of sampled issues, please refer to <a href='/docs/api/v5/#operation/reports/create'>Build catalogs report</a> and <a href='/docs/api/v5/#operation/reports/get'>Get catalogs report</a> endpoints. Moreover, they support multiple types of catalogs.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "itemsGet": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get catalogs items\n  Get the items of the catalog owned by the \"operation user_account\". <a href=\"/docs/api-features/shopping-overview/#Update%20items%20in%20batch\" target=\"_blank\">See detailed documentation here.</a>\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  Note: this endpoint is deprecated and will be deleted soon. Please use <a href='/docs/api/v5/#operation/items/post'>Get catalogs items (POST)</a> instead."
  },
  "itemsPost": {
    "comment": "Get catalogs items (POST)",
    "doc": "Get catalogs items (POST)\n  Get the items of the catalog owned by the \"operation user_account\". <a href=\"/docs/api-features/shopping-overview/#Update%20items%20in%20batch\" target=\"_blank\">See detailed documentation here.</a>\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "itemsBatchPost": {
    "comment": "Operate on item batch",
    "doc": "Operate on item batch\n  This endpoint supports multiple operations on a set of one or more catalog items owned by the \"operation user_account\". <a href=\"/docs/api-features/shopping-overview/#Update%20items%20in%20batch\" target=\"_blank\">See detailed documentation here.</a>\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  Note:\n  - Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager.\n  - The item UPSERT operation is restricted to users without a feed data source. If you plan to migrate item ingestion from feeds to the API, please reach out to your partner manager to get assistance."
  },
  "itemsBatchGet": {
    "comment": "Get item batch status",
    "doc": "Get item batch status\n  Get a single catalogs items batch owned by the \"operating user_account\". <a href=\"/docs/api-features/shopping-overview/#Update%20items%20in%20batch\" target=\"_blank\">See detailed documentation here.</a>\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager."
  },
  "catalogsProductGroupsDeleteMany": {
    "comment": "Delete product groups",
    "doc": "Delete product groups\n  Delete product groups owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsProductGroupsCreateMany": {
    "comment": "Create product groups",
    "doc": "Create product groups\n  Create product group to use in Catalogs owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "catalogsProductGroupsList": {
    "comment": "List product groups",
    "doc": "List product groups\n  Get a list of product groups for a given Catalogs Feed Id owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsProductGroupsCreate": {
    "comment": "Create product group",
    "doc": "Create product group\n  Create product group to use in Catalogs owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "catalogsProductGroupsGet": {
    "comment": "Get product group",
    "doc": "Get product group\n  Get a singe product group for a given Catalogs Product Group Id owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsProductGroupsDelete": {
    "comment": "Delete product group",
    "doc": "Delete product group\n  Delete a product group owned by the \"operation user_account\" from being in use in Catalogs.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsProductGroupsUpdate": {
    "comment": "Update single product group",
    "doc": "Update single product group\n  Update product group owned by the \"operation user_account\" to use in Catalogs.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>\n \n  Note: Access to the Creative Assets catalog type is restricted to a specific group of users.\n  If you require access, please reach out to your partner manager."
  },
  "catalogsProductGroupsProductCountsGet": {
    "comment": "Get product counts",
    "doc": "Get product counts\n  Get a product counts for a given Catalogs Product Group owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "catalogsProductGroupPinsList": {
    "comment": "List products by product group",
    "doc": "List products by product group\n  Get a list of product pins for a given Catalogs Product Group Id owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "productsByProductGroupFilterList": {
    "comment": "List products by filter",
    "doc": "List products by filter\n  List products Pins owned by the \"operation user_account\" that meet the criteria specified in the Catalogs Product Group Filter given in the request.\n  - This endpoint has been implemented in POST to allow for complex filters. This specific POST endpoint is designed to be idempotent.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager.\n \n  Note: This endpoint only supports RETAIL catalog at the moment.\n \n  <a href='/docs/api-features/shopping-overview/'>Learn more</a>"
  },
  "reportsCreate": {
    "comment": "Build catalogs report",
    "doc": "Build catalogs report\n  Async request to create a report of the catalog owned by the \"operation user_account\". This endpoint generates a report upon receiving the first approved request of the day. Any following requests with identical parameters will yield the same report even if data has changed.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager."
  },
  "reportsGet": {
    "comment": "Get catalogs report",
    "doc": "Get catalogs report\n  This returns a URL to a report given a token returned from <a href='/docs/api/v5/#operation/reports/create'>Build catalogs report</a>. You can use the URL to download the report.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager."
  },
  "reportsStats": {
    "comment": "List report stats",
    "doc": "List report stats\n  List aggregated numbers of issues for a catalog owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account: Owner, Admin, Catalogs Manager."
  },
  "integrationsCommercePost": {
    "comment": "Create commerce integration",
    "doc": "Create commerce integration\n  Create commerce integration metadata to link an external business ID with a Pinterest merchant & ad account.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsCommerceGet": {
    "comment": "Get commerce integration",
    "doc": "Get commerce integration\n  Get commerce integration metadata associated with the given external business ID.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsCommercePatch": {
    "comment": "Update commerce integration",
    "doc": "Update commerce integration\n  Update commerce integration metadata for the given external business ID.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsCommerceDel": {
    "comment": "Delete commerce integration",
    "doc": "Delete commerce integration\n  Delete commerce integration metadata for the given external business ID.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsLogsPost": {
    "comment": "Receives batched logs from integration applications.",
    "doc": "Receives batched logs from integration applications.\n  This endpoint receives batched logs from integration applications on partner platforms.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsGetList": {
    "comment": "Get integration metadata list",
    "doc": "Get integration metadata list\n  Get integration metadata list.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "integrationsGetById": {
    "comment": "Get integration metadata",
    "doc": "Get integration metadata\n  Get integration metadata by ID.\n  Note: If you're interested in joining the beta, please reach out to your Pinterest account manager."
  },
  "mediaList": {
    "comment": "List media uploads",
    "doc": "List media uploads\n  List media uploads filtered by given parameters.\n \n  <strong><a href='/docs/api-features/creating-boards-and-pins/#creating-video-pins'>Learn more</a></strong> about video Pin creation."
  },
  "mediaCreate": {
    "comment": "Register media upload",
    "doc": "Register media upload\n  Register your intent to upload media\n \n  The response includes all of the information needed to upload the media\n  to Pinterest.\n \n  To upload the media, make an HTTP POST request (using <tt>curl</tt>, for\n  example) to <tt>upload_url</tt> using the <tt>Content-Type</tt> header\n  value. Send the media file's contents as the request's <tt>file</tt>\n  parameter and also include all of the parameters from\n  <tt>upload_parameters</tt>.\n \n  <strong><a href='/docs/api-features/creating-boards-and-pins/#creating-video-pins'>Learn more</a></strong> about video Pin creation."
  },
  "mediaGet": {
    "comment": "Get media upload details",
    "doc": "Get media upload details\n  Get details for a registered media upload, including its current status.\n \n  <strong><a href='/docs/api-features/creating-boards-and-pins/#creating-video-pins'>Learn more</a></strong> about video Pin creation."
  },
  "oauthToken": {
    "comment": "Generate OAuth access token",
    "doc": "Generate OAuth access token\n  Generate an OAuth access token by using an authorization code or a refresh token.\n \n  IMPORTANT: You need to start the OAuth flow via www.pinterest.com/oauth before calling this endpoint (or have an existing refresh token).\n \n  See <a href='/docs/getting-started/authentication-and-scopes/'>Authentication</a> for more.\n \n  <strong>Parameter <i>refresh_on</i> and its corresponding response type <i>everlasting_refresh</i> are now available to all apps! Later this year, continuous refresh will become the default behavior (ie you will no longer need to send this parameter). <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>\n \n  <strong>Grant type <i>client_credentials</i> and its corresponding response type are not fully available. You will likely get a default error if you attempt to use this grant_type.</strong>"
  },
  "pinsList": {
    "comment": "List Pins",
    "doc": "List Pins\n  Get a list of the Pins owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n  - All Pins owned by the \"operation user_account\" are included, regardless of who owns the board they are on.\n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\".\n \n  Disclaimer: there are known performance issues when filtering by field <code>creative_type</code> and including protected pins. If your\n  request is timing out in this scenario we encourage you to use <a href='/docs/api/v5/#operation/boards/list_pins'>GET List Pins on Board</a>."
  },
  "pinsCreate": {
    "comment": "Create Pin",
    "doc": "Create Pin\n  Create a Pin on a board or board section owned by the \"operation user_account\".\n \n  Note: If the current \"operation user_account\" (defined by the access token) has access to another user's Ad Accounts via Pinterest Business Access, you can modify your request to make use of the current operation_user_account's permissions to those Ad Accounts by including the ad_account_id in the path parameters for the request (e.g. .../?ad_account_id=12345&...).\n \n  - This function is intended solely for publishing new content created by the user. If you are interested in saving content created by others to your Pinterest boards, sometimes called 'curated content', please use our <a href='/docs/web-features/add-ons-overview/'>Save button</a> instead. For more tips on creating fresh content for Pinterest, review our <a href='/docs/api-features/content-overview/'>Content App Solutions Guide</a>.\n \n  <strong><a href='/docs/api-features/creating-boards-and-pins/#creating-video-pins'>Learn more</a></strong> about video Pin creation."
  },
  "pinsGet": {
    "comment": "Get Pin",
    "doc": "Get Pin\n  Get a Pin owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Owner, Admin, Analyst, Campaign Manager.\n  - For Pins on secret boards: Owner, Admin."
  },
  "pinsDelete": {
    "comment": "Delete Pin",
    "doc": "Delete Pin\n  Delete a Pins owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Owner, Admin, Analyst, Campaign Manager.\n  - For Pins on secret boards: Owner, Admin."
  },
  "pinsUpdate": {
    "comment": "Update Pin",
    "doc": "Update Pin\n  Update a pin owned by the \"operating user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Owner, Admin, Analyst, Campaign Manager.\n  - For Pins on secret boards: Owner, Admin.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "pinsAnalytics": {
    "comment": "Get Pin analytics",
    "doc": "Get Pin analytics\n  Get analytics for a Pin owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href=\"/docs/api/v5/#operation/ad_accounts/list\">List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Admin, Analyst.\n  - For Pins on secret boards: Admin.\n \n  If Pin was created before <code>2023-03-20</code> lifetime metrics will only be available for Video and Idea Pin formats. Lifetime metrics are available for all Pin formats since then."
  },
  "multiPinsAnalytics": {
    "comment": "Get multiple Pin analytics",
    "doc": "Get multiple Pin analytics\n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>\n \n  Get analytics for multiple pins owned by the \"operation user_account\" - or on a group board that has been shared with this account.\n  - The maximum number of pins supported in a single request is 100.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href=\"/docs/api/v5/#operation/ad_accounts/list\">List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Admin, Analyst.\n  - For Pins on secret boards: Admin.\n \n  If Pin was created before <code>2023-03-20</code> lifetime metrics will only be available for Video and Idea Pin formats. Lifetime metrics are available for all Pin formats since then."
  },
  "pinsSave": {
    "comment": "Save Pin",
    "doc": "Save Pin\n  Save a Pin on a board or board section owned by the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n  Optional: Business Access: Specify an <code>ad_account_id</code> (obtained via <a href='/docs/api/v5/#operation/ad_accounts/list'>List ad accounts</a>) to use the owner of that ad_account as the \"operation user_account\". In order to do this, the token user_account must have one of the following <a href=\"https://help.pinterest.com/en/business/article/share-and-manage-access-to-your-ad-accounts\">Business Access</a> roles on the ad_account:\n \n  - For Pins on public or protected boards: Owner, Admin, Analyst, Campaign Manager.\n  - For Pins on secret boards: Owner, Admin.\n \n  - Any Pin type can be saved: image Pin, video Pin, Idea Pin, product Pin, etc.\n  - Any public Pin can be saved given a pin ID."
  },
  "adAccountCountriesGet": {
    "comment": "Get ad accounts countries",
    "doc": "Get ad accounts countries\n  Get Ad Accounts countries"
  },
  "deliveryMetricsGet": {
    "comment": "Get available metrics' definitions",
    "doc": "Get available metrics' definitions\n  Get the definitions for ads and organic metrics available across both synchronous and asynchronous report endpoints.\n  The `display_name` attribute will match how the metric is named in our native tools like Ads Manager.\n  See <a href='/docs/api-features/analytics-overview/'>Organic Analytics</a> and <a href='/docs/api-features/ads-reporting/'>Ads Analytics</a> for more information."
  },
  "leadFormQuestionsGet": {
    "comment": "Get lead form questions",
    "doc": "Get lead form questions\n  Get a list of all lead form question type names. Some questions might not be used.\n \n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>"
  },
  "metricsReadyStateGet": {
    "comment": "Get metrics ready state",
    "doc": "Get metrics ready state\n  Learn whether conversion or non-conversion metrics are finalized and ready to query."
  },
  "interestTargetingOptionsGet": {
    "comment": "Get interest details",
    "doc": "Get interest details\n  <p>Get details of a specific interest given interest ID.</p> <p>Click <a href=\"https://docs.google.com/spreadsheets/d/1HxL-0Z3p2fgxis9YBP2HWC3tvPrs1hAuHDRtH-NJTIM/edit#gid=118370875\" target=\"_blank\">here</a> for a spreadsheet listing interests and their IDs.</p>"
  },
  "targetingOptionsGet": {
    "comment": "Get targeting options",
    "doc": "Get targeting options\n  <p>You can use targeting values in ads placement to define your intended audience. </p> <p>Targeting metrics are organized around targeting specifications.</p> <p>For more information on ads targeting, see <a class=\"reference external\" href=\"https://help.pinterest.com/en/business/article/audience-targeting\" target=\"_blank\">Audience targeting</a>.</p>\n  <p><b>Sample return:</b></p> <pre class=\"literal-block\"> [{&quot;36313&quot;: &quot;Australia: Moreton Bay - North&quot;, &quot;124735&quot;: &quot;Canada: North Battleford&quot;, &quot;36109&quot;: &quot;Australia: Murray&quot;, &quot;36108&quot;: &quot;Australia: Mid North Coast&quot;, &quot;36101&quot;: &quot;Australia: Capital Region&quot;, &quot;811&quot;: &quot;U.S.: Reno&quot;, &quot;36103&quot;: &quot;Australia: Central West&quot;, &quot;36102&quot;: &quot;Australia: Central Coast&quot;, &quot;36105&quot;: &quot;Australia: Far West and Orana&quot;, &quot;36104&quot;: &quot;Australia: Coffs Harbour - Grafton&quot;, &quot;36107&quot;: &quot;Australia: Illawarra&quot;, &quot;36106&quot;: &quot;Australia: Hunter Valley Exc Newcastle&quot;, &quot;554017&quot;: &quot;New Zealand: Wanganui&quot;, &quot;554016&quot;: &quot;New Zealand: Marlborough&quot;, &quot;554015&quot;: &quot;New Zealand: Gisborne&quot;, &quot;554014&quot;: &quot;New Zealand: Tararua&quot;, &quot;554013&quot;: &quot;New Zealand: Invercargill&quot;, &quot;GR&quot;: &quot;Greece&quot;, &quot;554011&quot;: &quot;New Zealand: Whangarei&quot;, &quot;554010&quot;: &quot;New Zealand: Far North&quot;, &quot;717&quot;: &quot;U.S.: Quincy-Hannibal-Keokuk&quot;, &quot;716&quot;: &quot;U.S.: Baton Rouge&quot;,...}] </pre>"
  },
  "searchUserBoardsGet": {
    "comment": "Search user's boards",
    "doc": "Search user's boards\n  Search for boards for the \"operation user_account\". This includes boards of all board types.\n  - By default, the \"operation user_account\" is the token user_account.\n \n  If using Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\". See <a href='/docs/getting-started/using-business-access/'>Understanding Business Access</a> for more information."
  },
  "searchUserPinsList": {
    "comment": "Search user's Pins",
    "doc": "Search user's Pins\n  Search for pins for the \"operation user_account\".\n  - By default, the \"operation user_account\" is the token user_account.\n \n  If using Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\". See <a href='/docs/getting-started/using-business-access/'>Understanding Business Access</a> for more information."
  },
  "searchPartnerPins": {
    "comment": "Search pins by a given search term",
    "doc": "Search pins by a given search term\n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>\n \n  Get the top 10 Pins by a given search term."
  },
  "termsRelatedList": {
    "comment": "List related terms",
    "doc": "List related terms\n  Get a list of terms logically related to each input term. <p/>\n  Example: the term 'workout' would list related terms like 'one song workout', 'yoga workout', 'workout motivation', etc."
  },
  "termsSuggestedList": {
    "comment": "List suggested terms",
    "doc": "List suggested terms\n  Get popular search terms that begin with your input term. <p/>\n  Example: 'sport' would return popular terms like 'sports bar' and 'sportswear', but not 'motor sports' since the phrase does not begin with the given term."
  },
  "trendingKeywordsList": {
    "comment": "List trending keywords",
    "doc": "List trending keywords\n  <p>Get the top trending search keywords among the Pinterest user audience.</p> <p>Trending keywords can be used to inform ad targeting, budget strategy, and creative decisions about which products and Pins will resonate with your audience.</p> <p>Geographic, demographic and interest-based filters are available to narrow down to the top trends among a specific audience. Multiple trend types are supported that can be used to identify newly-popular, evergreen or seasonal keywords.</p> <p>For an interactive way to explore this data, please visit <a href=\"https://trends.pinterest.com\">trends.pinterest.com</a>."
  },
  "userAccountGet": {
    "comment": "Get user account",
    "doc": "Get user account\n  Get account information for the \"operation user_account\"\n  - By default, the \"operation user_account\" is the token user_account.\n \n  If using Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\". See <a href='/docs/getting-started/using-business-access/'>Understanding Business Access</a> for more information."
  },
  "userAccountAnalytics": {
    "comment": "Get user account analytics",
    "doc": "Get user account analytics\n  Get analytics for the \"operation user_account\"\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\"."
  },
  "userAccountAnalyticsTopPins": {
    "comment": "Get user account top pins analytics",
    "doc": "Get user account top pins analytics\n  Gets analytics data about a user's top pins (limited to the top 50).\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\"."
  },
  "userAccountAnalyticsTopVideoPins": {
    "comment": "Get user account top video pins analytics",
    "doc": "Get user account top video pins analytics\n  Gets analytics data about a user's top video pins (limited to the top 50).\n  - By default, the \"operation user_account\" is the token user_account.\n \n  Optional: Business Access: Specify an ad_account_id to use the owner of that ad_account as the \"operation user_account\"."
  },
  "linkedBusinessAccountsGet": {
    "comment": "List linked businesses",
    "doc": "List linked businesses\n  Get a list of your linked business accounts."
  },
  "followersList": {
    "comment": "List followers",
    "doc": "List followers\n  Get a list of your followers."
  },
  "userFollowingGet": {
    "comment": "List following",
    "doc": "List following\n  Get a list of who a certain user follows."
  },
  "boardsUserFollowsList": {
    "comment": "List following boards",
    "doc": "List following boards\n  Get a list of the boards a user follows. The request returns a board summary object array."
  },
  "followUserUpdate": {
    "comment": "Follow user",
    "doc": "Follow user\n  <strong>This endpoint is currently in beta and not available to all apps. <a href='/docs/getting-started/beta-and-advanced-access/'>Learn more</a>.</strong>\n \n  Use this request, as a signed-in user, to follow another user."
  },
  "verifyWebsiteUpdate": {
    "comment": "Verify website",
    "doc": "Verify website\n  Verify a website as a signed-in user."
  },
  "userWebsitesGet": {
    "comment": "Get user websites",
    "doc": "Get user websites\n  Get user websites, claimed or not"
  },
  "unverifyWebsiteDelete": {
    "comment": "Unverify website",
    "doc": "Unverify website\n  Unverifu a website verified by the signed-in user."
  },
  "websiteVerificationGet": {
    "comment": "Get user verification code for website claiming",
    "doc": "Get user verification code for website claiming\n  Get verification code for user to install on the website to claim it."
  },
  "userAccountFollowedInterests": {
    "comment": "List following interests",
    "doc": "List following interests\n  Get a list of a user's following interests in one place."
  }
}