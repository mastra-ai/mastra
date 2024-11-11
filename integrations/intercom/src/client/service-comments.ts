export const comments = {
  "identifyAdmin": {
    "comment": "Identify an admin",
    "doc": "Identify an admin\n \n  You can view the currently authorised admin along with the embedded app object (a \"workspace\" in legacy terminology).\n \n  > 🚧 Single Sign On\n  >\n  > If you are building a custom \"Log in with Intercom\" flow for your site, and you call the `/me` endpoint to identify the logged-in user, you should not accept any sign-ins from users with unverified email addresses as it poses a potential impersonation security risk."
  },
  "setAwayAdmin": {
    "comment": "Set an admin to away",
    "doc": "Set an admin to away\n  You can set an Admin as away for the Inbox."
  },
  "listActivityLogs": {
    "comment": "List all activity logs",
    "doc": "List all activity logs\n  You can get a log of activities by all admins in an app."
  },
  "listAdmins": {
    "comment": "List all admins",
    "doc": "List all admins\n  You can fetch a list of admins for a given workspace."
  },
  "retrieveAdmin": {
    "comment": "Retrieve an admin",
    "doc": "Retrieve an admin\n  You can retrieve the details of a single admin."
  },
  "listArticles": {
    "comment": "List all articles",
    "doc": "List all articles\n  You can fetch a list of all articles by making a GET request to `https://api.intercom.io/articles`.\n \n  > 📘 How are the articles sorted and ordered?\n  >\n  > Articles will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated articles first."
  },
  "createArticle": {
    "comment": "Create an article",
    "doc": "Create an article\n  You can create a new article by making a POST request to `https://api.intercom.io/articles`."
  },
  "retrieveArticle": {
    "comment": "Retrieve an article",
    "doc": "Retrieve an article\n  You can fetch the details of a single article by making a GET request to `https://api.intercom.io/articles/<id>`."
  },
  "updateArticle": {
    "comment": "Update an article",
    "doc": "Update an article\n  You can update the details of a single article by making a PUT request to `https://api.intercom.io/articles/<id>`."
  },
  "deleteArticle": {
    "comment": "Delete an article",
    "doc": "Delete an article\n  You can delete a single article by making a DELETE request to `https://api.intercom.io/articles/<id>`."
  },
  "listAllCollections": {
    "comment": "List all collections",
    "doc": "List all collections\n  You can fetch a list of all collections by making a GET request to `https://api.intercom.io/help_center/collections`.\n \n  Collections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated collections first."
  },
  "createCollection": {
    "comment": "Create a collection",
    "doc": "Create a collection\n  You can create a new collection by making a POST request to `https://api.intercom.io/help_center/collections.`"
  },
  "retrieveCollection": {
    "comment": "Retrieve a collection",
    "doc": "Retrieve a collection\n  You can fetch the details of a single collection by making a GET request to `https://api.intercom.io/help_center/collections/<id>`."
  },
  "updateCollection": {
    "comment": "Update a collection",
    "doc": "Update a collection\n  You can update the details of a single collection by making a PUT request to `https://api.intercom.io/collections/<id>`."
  },
  "deleteCollection": {
    "comment": "Delete a collection",
    "doc": "Delete a collection\n  You can delete a single collection by making a DELETE request to `https://api.intercom.io/collections/<id>`."
  },
  "retrieveHelpCenter": {
    "comment": "Retrieve a Help Center",
    "doc": "Retrieve a Help Center\n  You can fetch the details of a single Help Center by making a GET request to `https://api.intercom.io/help_center/help_center/<id>`."
  },
  "listHelpCenters": {
    "comment": "List all Help Centers",
    "doc": "List all Help Centers\n  You can list all Help Centers by making a GET request to `https://api.intercom.io/help_center/help_centers`."
  },
  "listAllSections": {
    "comment": "List all sections",
    "doc": "List all sections\n  You can fetch a list of all sections by making a GET request to `https://api.intercom.io/help_center/sections`.\n  > 📘 How are the sections sorted and ordered?\n  >\n  > Sections will be returned in descending order on the `updated_at` attribute. This means if you need to iterate through results then we'll show the most recently updated sections first."
  },
  "createSection": {
    "comment": "Create a section",
    "doc": "Create a section\n  You can create a new section by making a POST request to `https://api.intercom.io/help_center/sections.`"
  },
  "retrieveSection": {
    "comment": "Retrieve a section",
    "doc": "Retrieve a section\n  You can fetch the details of a single section by making a GET request to `https://api.intercom.io/help_center/sections/<id>`."
  },
  "updateSection": {
    "comment": "Update a section",
    "doc": "Update a section\n  You can update the details of a single section by making a PUT request to `https://api.intercom.io/sections/<id>`."
  },
  "deleteSection": {
    "comment": "Delete a section",
    "doc": "Delete a section\n  You can delete a single section by making a DELETE request to `https://api.intercom.io/sections/<id>`."
  },
  "createOrUpdateCompany": {
    "comment": "Create or Update a company",
    "doc": "Create or Update a company\n  You can create or update a company.\n \n  Companies will be only visible in Intercom when there is at least one associated user.\n \n  Companies are looked up via `company_id` in a `POST` request, if not found via `company_id`, the new company will be created, if found, that company will be updated.\n \n  {% admonition type=\"attention\" name=\"Using `company_id`\" %}\n  You can set a unique `company_id` value when creating a company. However, it is not possible to update `company_id`. Be sure to set a unique value once upon creation of the company.\n  {% /admonition %}"
  },
  "retrieveCompany": {
    "comment": "Retrieve companies",
    "doc": "Retrieve companies\n  You can fetch a single company by passing in `company_id` or `name`.\n \n  `https://api.intercom.io/companies?name={name}`\n \n  `https://api.intercom.io/companies?company_id={company_id}`\n \n  You can fetch all companies and filter by `segment_id` or `tag_id` as a query parameter.\n \n  `https://api.intercom.io/companies?tag_id={tag_id}`\n \n  `https://api.intercom.io/companies?segment_id={segment_id}`"
  },
  "retrieveAcompanyById": {
    "comment": "Retrieve a company by ID",
    "doc": "Retrieve a company by ID\n  You can fetch a single company."
  },
  "updateCompany": {
    "comment": "Update a company",
    "doc": "Update a company\n  You can update a single company using the Intercom provisioned `id`.\n \n  {% admonition type=\"attention\" name=\"Using `company_id`\" %}\n  When updating a company it is not possible to update `company_id`. This can only be set once upon creation of the company.\n  {% /admonition %}"
  },
  "deleteCompany": {
    "comment": "Delete a company",
    "doc": "Delete a company\n  You can delete a single company."
  },
  "listAttachedContacts": {
    "comment": "List attached contacts",
    "doc": "List attached contacts\n  You can fetch a list of all contacts that belong to a company."
  },
  "listAttachedSegmentsForCompanies": {
    "comment": "List attached segments for companies",
    "doc": "List attached segments for companies\n  You can fetch a list of all segments that belong to a company."
  },
  "listAllCompanies": {
    "comment": "List all companies",
    "doc": "List all companies\n  You can list companies. The company list is sorted by the `last_request_at` field and by default is ordered descending, most recently requested first.\n \n  Note that the API does not include companies who have no associated users in list responses.\n \n  When using the Companies endpoint and the pages object to iterate through the returned companies, there is a limit of 10,000 Companies that can be returned. If you need to list or iterate on more than 10,000 Companies, please use the [Scroll API](https://developers.intercom.com/reference#iterating-over-all-companies).\n  {% admonition type=\"warning\" name=\"Pagination\" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n  {% /admonition %}"
  },
  "scrollOverAllCompanies": {
    "comment": "Scroll over all companies",
    "doc": "Scroll over all companies\n        The `list all companies` functionality does not work well for huge datasets, and can result in errors and performance problems when paging deeply. The Scroll API provides an efficient mechanism for iterating over all companies in a dataset.\n \n  - Each app can only have 1 scroll open at a time. You'll get an error message if you try to have more than one open per app.\n  - If the scroll isn't used for 1 minute, it expires and calls with that scroll param will fail\n  - If the end of the scroll is reached, \"companies\" will be empty and the scroll parameter will expire\n \n  {% admonition type=\"info\" name=\"Scroll Parameter\" %}\n  You can get the first page of companies by simply sending a GET request to the scroll endpoint.\n  For subsequent requests you will need to use the scroll parameter from the response.\n  {% /admonition %}\n  {% admonition type=\"danger\" name=\"Scroll network timeouts\" %}\n  Since scroll is often used on large datasets network errors such as timeouts can be encountered. When this occurs you will see a HTTP 500 error with the following message:\n  \"Request failed due to an internal network error. Please restart the scroll operation.\"\n  If this happens, you will need to restart your scroll query: It is not possible to continue from a specific point when using scroll.\n  {% /admonition %}"
  },
  "attachContactToAcompany": {
    "comment": "Attach a Contact to a Company",
    "doc": "Attach a Contact to a Company\n  You can attach a company to a single contact."
  },
  "listCompaniesForAcontact": {
    "comment": "List attached companies for contact",
    "doc": "List attached companies for contact\n  You can fetch a list of companies that are associated to a contact."
  },
  "detachContactFromAcompany": {
    "comment": "Detach a contact from a company",
    "doc": "Detach a contact from a company\n  You can detach a company from a single contact."
  },
  "listNotes": {
    "comment": "List all notes",
    "doc": "List all notes\n  You can fetch a list of notes that are associated to a contact."
  },
  "createNote": {
    "comment": "Create a note",
    "doc": "Create a note\n  You can add a note to a single contact."
  },
  "listSegmentsForAcontact": {
    "comment": "List attached segments for contact",
    "doc": "List attached segments for contact\n  You can fetch a list of segments that are associated to a contact."
  },
  "listSubscriptionsForAcontact": {
    "comment": "List subscriptions for a contact",
    "doc": "List subscriptions for a contact\n  You can fetch a list of subscription types that are attached to a contact. These can be subscriptions that a user has 'opted-in' to or has 'opted-out' from, depending on the subscription type.\n  This will return a list of Subscription Type objects that the contact is associated with.\n \n  The data property will show a combined list of:\n \n  1.Opt-out subscription types that the user has opted-out from.\n  2.Opt-in subscription types that the user has opted-in to receiving."
  },
  "attachSubscriptionTypeToContact": {
    "comment": "Add subscription to a contact",
    "doc": "Add subscription to a contact\n  You can add a specific subscription to a contact. In Intercom, we have two different subscription types based on user consent - opt-out and opt-in:\n \n  1.Attaching a contact to an opt-out subscription type will opt that user out from receiving messages related to that subscription type.\n \n  2.Attaching a contact to an opt-in subscription type will opt that user in to receiving messages related to that subscription type.\n \n  This will return a subscription type model for the subscription type that was added to the contact."
  },
  "detachSubscriptionTypeToContact": {
    "comment": "Remove subscription from a contact",
    "doc": "Remove subscription from a contact\n  You can remove a specific subscription from a contact. This will return a subscription type model for the subscription type that was removed from the contact."
  },
  "listTagsForAcontact": {
    "comment": "List tags attached to a contact",
    "doc": "List tags attached to a contact\n  You can fetch a list of all tags that are attached to a specific contact."
  },
  "attachTagToContact": {
    "comment": "Add tag to a contact",
    "doc": "Add tag to a contact\n  You can tag a specific contact. This will return a tag object for the tag that was added to the contact."
  },
  "detachTagFromContact": {
    "comment": "Remove tag from a contact",
    "doc": "Remove tag from a contact\n  You can remove tag from a specific contact. This will return a tag object for the tag that was removed from the contact."
  },
  "updateContact": {
    "comment": "Update a contact",
    "doc": "Update a contact\n  You can update an existing contact (ie. user or lead)."
  },
  "showContact": {
    "comment": "Get a contact",
    "doc": "Get a contact\n  You can fetch the details of a single contact."
  },
  "deleteContact": {
    "comment": "Delete a contact",
    "doc": "Delete a contact\n  You can delete a single contact."
  },
  "mergeContact": {
    "comment": "Merge a lead and a user",
    "doc": "Merge a lead and a user\n  You can merge a contact with a `role` of `lead` into a contact with a `role` of `user`."
  },
  "searchContacts": {
    "comment": "Search contacts",
    "doc": "Search contacts\n  You can search for multiple contacts by the value of their attributes in order to fetch exactly who you want.\n \n  To search for contacts, you need to send a `POST` request to `https://api.intercom.io/contacts/search`.\n \n  This will accept a query object in the body which will define your filters in order to search for contacts.\n \n  {% admonition type=\"warning\" name=\"Optimizing search queries\" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n  {% /admonition %}\n  ### Contact Creation Delay\n \n  If a contact has recently been created, there is a possibility that it will not yet be available when searching. This means that it may not appear in the response. This delay can take a few minutes. If you need to be instantly notified it is recommended to use webhooks and iterate to see if they match your search filters.\n \n  ### Nesting & Limitations\n \n  You can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\n  There are some limitations to the amount of multiple's there can be:\n   There's a limit of max 2 nested filters\n   There's a limit of max 15 filters for each AND or OR group\n \n  ### Searching for Timestamp Fields\n \n  All timestamp fields (created_at, updated_at etc.) are indexed as Dates for Contact Search queries; Datetime queries are not currently supported. This means you can only query for timestamp fields by day - not hour, minute or second.\n  For example, if you search for all Contacts with a created_at value greater (>) than 1577869200 (the UNIX timestamp for January 1st, 2020 9:00 AM), that will be interpreted as 1577836800 (January 1st, 2020 12:00 AM). The search results will then include Contacts created from January 2nd, 2020 12:00 AM onwards.\n  If you'd like to get contacts created on January 1st, 2020 you should search with a created_at value equal (=) to 1577836800 (January 1st, 2020 12:00 AM).\n  This behaviour applies only to timestamps used in search queries. The search results will still contain the full UNIX timestamp and be sorted accordingly.\n \n  ### Accepted Fields\n \n  Most key listed as part of the Contacts Model are searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `\"foorbar\"`).\n \n  | Field                              | Type                           |\n  | ---------------------------------- | ------------------------------ |\n  | id                                 | String                         |\n  | role                               | String<br>Accepts user or lead |\n  | name                               | String                         |\n  | avatar                             | String                         |\n  | owner_id                           | Integer                        |\n  | email                              | String                         |\n  | email_domain                       | String                         |\n  | phone                              | String                         |\n  | formatted_phone                    | String                         |\n  | external_id                        | String                         |\n  | created_at                         | Date (UNIX Timestamp)          |\n  | signed_up_at                       | Date (UNIX Timestamp)          |\n  | updated_at                         | Date (UNIX Timestamp)          |\n  | last_seen_at                       | Date (UNIX Timestamp)          |\n  | last_contacted_at                  | Date (UNIX Timestamp)          |\n  | last_replied_at                    | Date (UNIX Timestamp)          |\n  | last_email_opened_at               | Date (UNIX Timestamp)          |\n  | last_email_clicked_at              | Date (UNIX Timestamp)          |\n  | language_override                  | String                         |\n  | browser                            | String                         |\n  | browser_language                   | String                         |\n  | os                                 | String                         |\n  | location.country                   | String                         |\n  | location.region                    | String                         |\n  | location.city                      | String                         |\n  | unsubscribed_from_emails           | Boolean                        |\n  | marked_email_as_spam               | Boolean                        |\n  | has_hard_bounced                   | Boolean                        |\n  | ios_last_seen_at                   | Date (UNIX Timestamp)          |\n  | ios_app_version                    | String                         |\n  | ios_device                         | String                         |\n  | ios_app_device                     | String                         |\n  | ios_os_version                     | String                         |\n  | ios_app_name                       | String                         |\n  | ios_sdk_version                    | String                         |\n  | android_last_seen_at               | Date (UNIX Timestamp)          |\n  | android_app_version                | String                         |\n  | android_device                     | String                         |\n  | android_app_name                   | String                         |\n  | andoid_sdk_version                 | String                         |\n  | segment_id                         | String                         |\n  | tag_id                             | String                         |\n  | custom_attributes.{attribute_name} | String                         |\n \n  ### Accepted Operators\n \n  {% admonition type=\"attention\" name=\"Searching based on `created_at`\" %}\n  You cannot use the `<=` or `>=` operators to search by `created_at`.\n  {% /admonition %}\n \n  The table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`\"=\"`). The operator has to be compatible with the field's type (eg. you cannot search with `>` for a given string value as it's only compatible for integer's and dates).\n \n  | Operator | Valid Types                      | Description                                                      |\n  | :------- | :------------------------------- | :--------------------------------------------------------------- |\n  | =        | All                              | Equals                                                           |\n  | !=       | All                              | Doesn't Equal                                                    |\n  | IN       | All                              | In<br>Shortcut for `OR` queries<br>Values must be in Array       |\n  | NIN      | All                              | Not In<br>Shortcut for `OR !` queries<br>Values must be in Array |\n  | >        | Integer<br>Date (UNIX Timestamp) | Greater than                                                     |\n  | <       | Integer<br>Date (UNIX Timestamp) | Lower than                                                       |\n  | ~        | String                           | Contains                                                         |\n  | !~       | String                           | Doesn't Contain                                                  |\n  | ^        | String                           | Starts With                                                      |\n  | $        | String                           | Ends With                                                        |"
  },
  "listContacts": {
    "comment": "List all contacts",
    "doc": "List all contacts\n  You can fetch a list of all contacts (ie. users or leads) in your workspace.\n  {% admonition type=\"warning\" name=\"Pagination\" %}\n  You can use pagination to limit the number of results returned. The default is `50` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n  {% /admonition %}"
  },
  "createContact": {
    "comment": "Create contact",
    "doc": "Create contact\n  You can create a new contact (ie. user or lead)."
  },
  "archiveContact": {
    "comment": "Archive contact",
    "doc": "Archive contact\n  You can archive a single contact."
  },
  "unarchiveContact": {
    "comment": "Unarchive contact",
    "doc": "Unarchive contact\n  You can unarchive a single contact."
  },
  "attachTagToConversation": {
    "comment": "Add tag to a conversation",
    "doc": "Add tag to a conversation\n  You can tag a specific conversation. This will return a tag object for the tag that was added to the conversation."
  },
  "detachTagFromConversation": {
    "comment": "Remove tag from a conversation",
    "doc": "Remove tag from a conversation\n  You can remove tag from a specific conversation. This will return a tag object for the tag that was removed from the conversation."
  },
  "listConversations": {
    "comment": "List all conversations",
    "doc": "List all conversations\n  You can fetch a list of all conversations.\n \n  You can optionally request the result page size and the cursor to start after to fetch the result.\n  {% admonition type=\"warning\" name=\"Pagination\" %}\n  You can use pagination to limit the number of results returned. The default is `20` results per page.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#pagination-for-list-apis) for more details on how to use the `starting_after` param.\n  {% /admonition %}"
  },
  "createConversation": {
    "comment": "Creates a conversation",
    "doc": "Creates a conversation\n  You can create a conversation that has been initiated by a contact (ie. user or lead).\n  The conversation can be an in-app message only.\n \n  {% admonition type=\"info\" name=\"Sending for visitors\" %}\n  You can also send a message from a visitor by specifying their `user_id` or `id` value in the `from` field, along with a `type` field value of `contact`.\n  This visitor will be automatically converted to a contact with a lead role once the conversation is created.\n  {% /admonition %}\n \n  This will return the Message model that has been created."
  },
  "retrieveConversation": {
    "comment": "Retrieve a conversation",
    "doc": "Retrieve a conversation\n \n  You can fetch the details of a single conversation.\n \n  This will return a single Conversation model with all its conversation parts.\n \n  {% admonition type=\"warning\" name=\"Hard limit of 500 parts\" %}\n  The maximum number of conversation parts that can be returned via the API is 500. If you have more than that we will return the 500 most recent conversation parts.\n  {% /admonition %}\n \n  For AI agent conversation metadata, please note that you need to have the agent enabled in your workspace, which is a [paid feature](https://www.intercom.com/help/en/articles/8205718-fin-resolutions#h_97f8c2e671)."
  },
  "updateConversation": {
    "comment": "Update a conversation",
    "doc": "Update a conversation\n \n  You can update an existing conversation.\n \n  {% admonition type=\"info\" name=\"Replying and other actions\" %}\n  If you want to reply to a coveration or take an action such as assign, unassign, open, close or snooze, take a look at the reply and manage endpoints.\n  {% /admonition %}"
  },
  "searchConversations": {
    "comment": "Search conversations",
    "doc": "Search conversations\n  You can search for multiple conversations by the value of their attributes in order to fetch exactly which ones you want.\n \n  To search for conversations, you need to send a `POST` request to `https://api.intercom.io/conversations/search`.\n \n  This will accept a query object in the body which will define your filters in order to search for conversations.\n  {% admonition type=\"warning\" name=\"Optimizing search queries\" %}\n  Search queries can be complex, so optimizing them can help the performance of your search.\n  Use the `AND` and `OR` operators to combine multiple filters to get the exact results you need and utilize\n  pagination to limit the number of results returned. The default is `20` results per page and maximum is `150`.\n  See the [pagination section](https://developers.intercom.com/docs/build-an-integration/learn-more/rest-apis/pagination/#example-search-conversations-request) for more details on how to use the `starting_after` param.\n  {% /admonition %}\n \n  ### Nesting & Limitations\n \n  You can nest these filters in order to get even more granular insights that pinpoint exactly what you need. Example: (1 OR 2) AND (3 OR 4).\n  There are some limitations to the amount of multiple's there can be:\n  - There's a limit of max 2 nested filters\n  - There's a limit of max 15 filters for each AND or OR group\n \n  ### Accepted Fields\n \n  Most keys listed as part of the The conversation model is searchable, whether writeable or not. The value you search for has to match the accepted type, otherwise the query will fail (ie. as `created_at` accepts a date, the `value` cannot be a string such as `\"foorbar\"`).\n  The `source.body` field is unique as the search will not be performed against the entire value, but instead against every element of the value separately. For example, when searching for a conversation with a `\"I need support\"` body - the query should contain a `=` operator with the value `\"support\"` for such conversation to be returned. A query with a `=` operator and a `\"need support\"` value will not yield a result.\n \n  | Field                                     | Type                                                                                                                                                   |\n  | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |\n  | id                                        | String                                                                                                                                                 |\n  | created_at                                | Date (UNIX timestamp)                                                                                                                                  |\n  | updated_at                                | Date (UNIX timestamp)                                                                                                                                  |\n  | source.type                               | String<br>Accepted fields are `conversation`, `email`, `facebook`, `instagram`, `phone_call`, `phone_switch`, `push`, `sms`, `twitter` and `whatsapp`. |\n  | source.id                                 | String                                                                                                                                                 |\n  | source.delivered_as                       | String                                                                                                                                                 |\n  | source.subject                            | String                                                                                                                                                 |\n  | source.body                               | String                                                                                                                                                 |\n  | source.author.id                          | String                                                                                                                                                 |\n  | source.author.type                        | String                                                                                                                                                 |\n  | source.author.name                        | String                                                                                                                                                 |\n  | source.author.email                       | String                                                                                                                                                 |\n  | source.url                                | String                                                                                                                                                 |\n  | contact_ids                               | String                                                                                                                                                 |\n  | teammate_ids                              | String                                                                                                                                                 |\n  | admin_assignee_id                         | String                                                                                                                                                 |\n  | team_assignee_id                          | String                                                                                                                                                 |\n  | channel_initiated                         | String                                                                                                                                                 |\n  | open                                      | Boolean                                                                                                                                                |\n  | read                                      | Boolean                                                                                                                                                |\n  | state                                     | String                                                                                                                                                 |\n  | waiting_since                             | Date (UNIX timestamp)                                                                                                                                  |\n  | snoozed_until                             | Date (UNIX timestamp)                                                                                                                                  |\n  | tag_ids                                   | String                                                                                                                                                 |\n  | priority                                  | String                                                                                                                                                 |\n  | statistics.time_to_assignment             | Integer                                                                                                                                                |\n  | statistics.time_to_admin_reply            | Integer                                                                                                                                                |\n  | statistics.time_to_first_close            | Integer                                                                                                                                                |\n  | statistics.time_to_last_close             | Integer                                                                                                                                                |\n  | statistics.median_time_to_reply           | Integer                                                                                                                                                |\n  | statistics.first_contact_reply_at         | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.first_assignment_at            | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.first_admin_reply_at           | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.first_close_at                 | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_assignment_at             | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_assignment_admin_reply_at | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_contact_reply_at          | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_admin_reply_at            | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_close_at                  | Date (UNIX timestamp)                                                                                                                                  |\n  | statistics.last_closed_by_id              | String                                                                                                                                                 |\n  | statistics.count_reopens                  | Integer                                                                                                                                                |\n  | statistics.count_assignments              | Integer                                                                                                                                                |\n  | statistics.count_conversation_parts       | Integer                                                                                                                                                |\n  | conversation_rating.requested_at          | Date (UNIX timestamp)                                                                                                                                  |\n  | conversation_rating.replied_at            | Date (UNIX timestamp)                                                                                                                                  |\n  | conversation_rating.score                 | Integer                                                                                                                                                |\n  | conversation_rating.remark                | String                                                                                                                                                 |\n  | conversation_rating.contact_id            | String                                                                                                                                                 |\n  | conversation_rating.admin_d               | String                                                                                                                                                 |\n  | ai_agent_participated                     | Boolean                                                                                                                                                |\n  | ai_agent.resolution_state                 | String                                                                                                                                                 |\n  | ai_agent.last_answer_type                 | String                                                                                                                                                 |\n  | ai_agent.rating                           | Integer                                                                                                                                                |\n  | ai_agent.rating_remark                    | String                                                                                                                                                 |\n  | ai_agent.source_type                      | String                                                                                                                                                 |\n  | ai_agent.source_title                     | String                                                                                                                                                 |\n \n  ### Accepted Operators\n \n  The table below shows the operators you can use to define how you want to search for the value.  The operator should be put in as a string (`\"=\"`). The operator has to be compatible with the field's type  (eg. you cannot search with `>` for a given string value as it's only compatible for integer's and dates).\n \n  | Operator | Valid Types                    | Description                                                  |\n  | :------- | :----------------------------- | :----------------------------------------------------------- |\n  | =        | All                            | Equals                                                       |\n  | !=       | All                            | Doesn't Equal                                                |\n  | IN       | All                            | In  Shortcut for `OR` queries  Values most be in Array       |\n  | NIN      | All                            | Not In  Shortcut for `OR !` queries  Values must be in Array |\n  | >        | Integer  Date (UNIX Timestamp) | Greater (or equal) than                                      |\n  | <       | Integer  Date (UNIX Timestamp) | Lower (or equal) than                                        |\n  | ~        | String                         | Contains                                                     |\n  | !~       | String                         | Doesn't Contain                                              |\n  | ^        | String                         | Starts With                                                  |\n  | $        | String                         | Ends With                                                    |"
  },
  "replyConversation": {
    "comment": "Reply to a conversation",
    "doc": "Reply to a conversation\n  You can reply to a conversation with a message from an admin or on behalf of a contact, or with a note for admins."
  },
  "manageConversation": {
    "comment": "Manage a conversation",
    "doc": "Manage a conversation\n  For managing conversations you can:\n  - Close a conversation\n  - Snooze a conversation to reopen on a future date\n  - Open a conversation which is `snoozed` or `closed`\n  - Assign a conversation to an admin and/or team."
  },
  "autoAssignConversation": {
    "comment": "Run Assignment Rules on a conversation",
    "doc": "Run Assignment Rules on a conversation\n  You can let a conversation be automatically assigned following assignment rules.\n  {% admonition type=\"attention\" name=\"When using workflows\" %}\n  It is not possible to use this endpoint with Workflows.\n  {% /admonition %}"
  },
  "attachContactToConversation": {
    "comment": "Attach a contact to a conversation",
    "doc": "Attach a contact to a conversation\n  You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n \n  {% admonition type=\"attention\" name=\"Contacts without an email\" %}\n  If you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n  {% /admonition %}"
  },
  "detachContactFromConversation": {
    "comment": "Detach a contact from a group conversation",
    "doc": "Detach a contact from a group conversation\n  You can add participants who are contacts to a conversation, on behalf of either another contact or an admin.\n \n  {% admonition type=\"attention\" name=\"Contacts without an email\" %}\n  If you add a contact via the email parameter and there is no user/lead found on that workspace with he given email, then we will create a new contact with `role` set to `lead`.\n  {% /admonition %}"
  },
  "redactConversation": {
    "comment": "Redact a conversation part",
    "doc": "Redact a conversation part\n  You can redact a conversation part or the source message of a conversation (as seen in the source object).\n \n  {% admonition type=\"info\" name=\"Redacting parts and messages\" %}\n  If you are redacting a conversation part, it must have a `body`. If you are redacting a source message, it must have been created by a contact. We will return a `conversation_part_not_redactable` error if these criteria are not met.\n  {% /admonition %}"
  },
  "lisDataAttributes": {
    "comment": "List all data attributes",
    "doc": "List all data attributes\n  You can fetch a list of all data attributes belonging to a workspace for contacts, companies or conversations."
  },
  "createDataAttribute": {
    "comment": "Create a data attribute",
    "doc": "Create a data attribute\n  You can create a data attributes for a `contact` or a `company`."
  },
  "updateDataAttribute": {
    "comment": "Update a data attribute",
    "doc": "Update a data attribute\n \n  You can update a data attribute.\n \n  > 🚧 Updating the data type is not possible\n  >\n  > It is currently a dangerous action to execute changing a data attribute's type via the API. You will need to update the type via the UI instead."
  },
  "createDataEvent": {
    "comment": "Submit a data event",
    "doc": "Submit a data event\n \n  You will need an Access Token that has write permissions to send Events. Once you have a key you can submit events via POST to the Events resource, which is located at https://api.intercom.io/events, or you can send events using one of the client libraries. When working with the HTTP API directly a client should send the event with a `Content-Type` of `application/json`.\n \n  When using the JavaScript API, [adding the code to your app](http://docs.intercom.io/configuring-Intercom/tracking-user-events-in-your-app) makes the Events API available. Once added, you can submit an event using the `trackEvent` method. This will associate the event with the Lead or currently logged-in user or logged-out visitor/lead and send it to Intercom. The final parameter is a map that can be used to send optional metadata about the event.\n \n  With the Ruby client you pass a hash describing the event to `Intercom::Event.create`, or call the `track_user` method directly on the current user object (e.g. `user.track_event`).\n \n  NB: For the JSON object types, please note that we do not currently support nested JSON structure.\n \n  | Type            | Description                                                                                                                                                                                                     | Example                                                                           |\n  | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |\n  | String          | The value is a JSON String                                                                                                                                                                                      | `\"source\":\"desktop\"`                                                              |\n  | Number          | The value is a JSON Number                                                                                                                                                                                      | `\"load\": 3.67`                                                                    |\n  | Date            | The key ends with the String `_date` and the value is a [Unix timestamp](http://en.wikipedia.org/wiki/Unix_time), assumed to be in the [UTC](http://en.wikipedia.org/wiki/Coordinated_Universal_Time) timezone. | `\"contact_date\": 1392036272`                                                      |\n  | Link            | The value is a HTTP or HTTPS URI.                                                                                                                                                                               | `\"article\": \"https://example.org/ab1de.html\"`                                     |\n  | Rich Link       | The value is a JSON object that contains `url` and `value` keys.                                                                                                                                                | `\"article\": {\"url\": \"https://example.org/ab1de.html\", \"value\":\"the dude abides\"}` |\n  | Monetary Amount | The value is a JSON object that contains `amount` and `currency` keys. The `amount` key is a positive integer representing the amount in cents. The price in the example to the right denotes €349.99.          | `\"price\": {\"amount\": 34999, \"currency\": \"eur\"}`                                   |\n \n  Lead Events\n \n  When submitting events for Leads, you will need to specify the Lead's `id`.\n \n  Metadata behaviour\n \n  - We currently limit the number of tracked metadata keys to 10 per event. Once the quota is reached, we ignore any further keys we receive. The first 10 metadata keys are determined by the order in which they are sent in with the event.\n  - It is not possible to change the metadata keys once the event has been sent. A new event will need to be created with the new keys and you can archive the old one.\n  - There might be up to 24 hrs delay when you send a new metadata for an existing event.\n \n  Event de-duplication\n \n  The API may detect and ignore duplicate events. Each event is uniquely identified as a combination of the following data - the Workspace identifier, the Contact external identifier, the Data Event name and the Data Event created time. As a result, it is strongly recommended to send a second granularity Unix timestamp in the `created_at` field.\n \n  Duplicated events are responded to using the normal `202 Accepted` code - an error is not thrown, however repeat requests will be counted against any rate limit that is in place.\n \n  ### HTTP API Responses\n \n  - Successful responses to submitted events return `202 Accepted` with an empty body.\n  - Unauthorised access will be rejected with a `401 Unauthorized` or `403 Forbidden` response code.\n  - Events sent about users that cannot be found will return a `404 Not Found`.\n  - Event lists containing duplicate events will have those duplicates ignored.\n  - Server errors will return a `500` response code and may contain an error message in the body."
  },
  "lisDataEvents": {
    "comment": "List all data events",
    "doc": "List all data events\n \n  > 🚧\n  >\n  > Please note that you can only 'list' events that are less than 90 days old. Event counts and summaries will still include your events older than 90 days but you cannot 'list' these events individually if they are older than 90 days\n \n  The events belonging to a customer can be listed by sending a GET request to `https://api.intercom.io/events` with a user or lead identifier along with a `type` parameter. The identifier parameter can be one of `user_id`, `email` or `intercom_user_id`. The `type` parameter value must be `user`.\n \n  - `https://api.intercom.io/events?type=user&user_id={user_id}`\n  - `https://api.intercom.io/events?type=user&email={email}`\n  - `https://api.intercom.io/events?type=user&intercom_user_id={id}` (this call can be used to list leads)\n \n  The `email` parameter value should be [url encoded](http://en.wikipedia.org/wiki/Percent-encoding) when sending.\n \n  You can optionally define the result page size as well with the `per_page` parameter."
  },
  "dataEventSummaries": {
    "comment": "Create event summaries",
    "doc": "Create event summaries\n  Create event summaries for a user. Event summaries are used to track the number of times an event has occurred, the first time it occurred and the last time it occurred."
  },
  "createDataExport": {
    "comment": "Create content data export",
    "doc": "Create content data export\n  To create your export job, you need to send a `POST` request to the export endpoint `https://api.intercom.io/export/content/data`.\n \n  The only parameters you need to provide are the range of dates that you want exported.\n \n  >🚧 Limit of one active job\n  >\n  > You can only have one active job per workspace. You will receive a HTTP status code of 429 with the message Exceeded rate limit of 1 pending message data export jobs if you attempt to create a second concurrent job.\n \n  >❗️ Updated_at not included\n  >\n  > It should be noted that the timeframe only includes messages sent during the time period and not messages that were only updated during this period. For example, if a message was updated yesterday but sent two days ago, you would need to set the created_at_after date before the message was sent to include that in your retrieval job.\n \n  >📘 Date ranges are inclusive\n  >\n  > Requesting data for 2018-06-01 until 2018-06-30 will get all data for those days including those specified - e.g. 2018-06-01 00:00:00 until 2018-06-30 23:59:99."
  },
  "getDataExport": {
    "comment": "Show content data export",
    "doc": "Show content data export\n  You can view the status of your job by sending a `GET` request to the URL\n  `https://api.intercom.io/export/content/data/{job_identifier}` - the `{job_identifier}` is the value returned in the response when you first created the export job. More on it can be seen in the Export Job Model.\n \n  > 🚧 Jobs expire after two days\n  > All jobs that have completed processing (and are thus available to download from the provided URL) will have an expiry limit of two days from when the export ob completed. After this, the data will no longer be available."
  },
  "cancelDataExport": {
    "comment": "Cancel content data export",
    "doc": "Cancel content data export\n  You can cancel your job"
  },
  "downloadDataExport": {
    "comment": "Download content data export",
    "doc": "Download content data export\n  When a job has a status of complete, and thus a filled download_url, you can download your data by hitting that provided URL, formatted like so: https://api.intercom.io/download/content/data/xyz1234.\n \n  Your exported message data will be streamed continuously back down to you in a gzipped CSV format.\n \n  > 📘 Octet header required\n  >\n  > You will have to specify the header Accept: `application/octet-stream` when hitting this endpoint."
  },
  "createMessage": {
    "comment": "Create a message",
    "doc": "Create a message\n  You can create a message that has been initiated by an admin. The conversation can be either an in-app message or an email.\n \n  > 🚧 Sending for visitors\n  >\n  > There can be a short delay between when a contact is created and when a contact becomes available to be messaged through the API. A 404 Not Found error will be returned in this case.\n \n  This will return the Message model that has been created.\n \n  > 🚧 Retrieving Associated Conversations\n  >\n  > As this is a message, there will be no conversation present until the contact responds. Once they do, you will have to search for a contact's conversations with the id of the message."
  },
  "listNewsItems": {
    "comment": "List all news items",
    "doc": "List all news items\n  You can fetch a list of all news items"
  },
  "createNewsItem": {
    "comment": "Create a news item",
    "doc": "Create a news item\n  You can create a news item"
  },
  "retrieveNewsItem": {
    "comment": "Retrieve a news item",
    "doc": "Retrieve a news item\n  You can fetch the details of a single news item."
  },
  "updateNewsItem": {
    "comment": "Update a news item",
    "doc": "Update a news item"
  },
  "deleteNewsItem": {
    "comment": "Delete a news item",
    "doc": "Delete a news item\n  You can delete a single news item."
  },
  "listLiveNewsfeedItems": {
    "comment": "List all live newsfeed items",
    "doc": "List all live newsfeed items\n  You can fetch a list of all news items that are live on a given newsfeed"
  },
  "listNewsfeeds": {
    "comment": "List all newsfeeds",
    "doc": "List all newsfeeds\n  You can fetch a list of all newsfeeds"
  },
  "retrieveNewsfeed": {
    "comment": "Retrieve a newsfeed",
    "doc": "Retrieve a newsfeed\n  You can fetch the details of a single newsfeed"
  },
  "retrieveNote": {
    "comment": "Retrieve a note",
    "doc": "Retrieve a note\n  You can fetch the details of a single note."
  },
  "listSegments": {
    "comment": "List all segments",
    "doc": "List all segments\n  You can fetch a list of all segments."
  },
  "retrieveSegment": {
    "comment": "Retrieve a segment",
    "doc": "Retrieve a segment\n  You can fetch the details of a single segment."
  },
  "listSubscriptionTypes": {
    "comment": "List subscription types",
    "doc": "List subscription types\n  You can list all subscription types. A list of subscription type objects will be returned."
  },
  "createPhoneSwitch": {
    "comment": "Create a phone Switch",
    "doc": "Create a phone Switch\n  You can use the API to deflect phone calls to the Intercom Messenger.\n  Calling this endpoint will send an SMS with a link to the Messenger to the phone number specified.\n \n  If custom attributes are specified, they will be added to the user or lead's custom data attributes."
  },
  "listTags": {
    "comment": "List all tags",
    "doc": "List all tags\n  You can fetch a list of all tags for a given workspace."
  },
  "createTag": {
    "comment": "Create or update a tag, Tag or untag companies, Tag contacts",
    "doc": "Create or update a tag, Tag or untag companies, Tag contacts\n  You can use this endpoint to perform the following operations:\n \n  1. Create a new tag: You can create a new tag by passing in the tag name as specified in \"Create or Update Tag Request Payload\" described below.\n \n  2. Update an existing tag: You can update an existing tag by passing the id of the tag as specified in \"Create or Update Tag Request Payload\" described below.\n \n  3. Tag Companies: You can tag single company or a list of companies. You can tag a company by passing in the tag name and the company details as specified in \"Tag Company Request Payload\" described below. Also, if the tag doesn't exist then a new one will be created automatically.\n \n  4. Untag Companies: You can untag a single company or a list of companies. You can untag a company by passing in the tag id and the company details as specified in \"Untag Company Request Payload\" described below.\n \n  5. Tag Multiple Users: You can tag a list of users. You can tag the users by passing in the tag name and the user details as specified in \"Tag Users Request Payload\" described below.\n \n  Each operation will return a tag object."
  },
  "findTag": {
    "comment": "Find a specific tag",
    "doc": "Find a specific tag\n  You can fetch the details of tags that are on the workspace by their id.\n  This will return a tag object."
  },
  "deleteTag": {
    "comment": "Delete tag",
    "doc": "Delete tag\n  You can delete the details of tags that are on the workspace by passing in the id."
  },
  "listTeams": {
    "comment": "List all teams",
    "doc": "List all teams\n  This will return a list of team objects for the App."
  },
  "retrieveTeam": {
    "comment": "Retrieve a team",
    "doc": "Retrieve a team\n  You can fetch the details of a single team, containing an array of admins that belong to this team."
  },
  "createTicketTypeAttribute": {
    "comment": "Create a new attribute for a ticket type",
    "doc": "Create a new attribute for a ticket type\n  You can create a new attribute for a ticket type."
  },
  "updateTicketTypeAttribute": {
    "comment": "Update an existing attribute for a ticket type",
    "doc": "Update an existing attribute for a ticket type\n  You can update an existing attribute for a ticket type."
  },
  "listTicketTypes": {
    "comment": "List all ticket types",
    "doc": "List all ticket types\n  You can get a list of all ticket types for a workspace."
  },
  "createTicketType": {
    "comment": "Create a ticket type",
    "doc": "Create a ticket type\n  You can create a new ticket type.\n  > 📘 Creating ticket types.\n  >\n  > Every ticket type will be created with two default attributes: _default_title_ and _default_description_.\n  > For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)"
  },
  "getTicketType": {
    "comment": "Retrieve a ticket type",
    "doc": "Retrieve a ticket type\n  You can fetch the details of a single ticket type."
  },
  "updateTicketType": {
    "comment": "Update a ticket type",
    "doc": "Update a ticket type\n \n  You can update a ticket type.\n \n  > 📘 Updating a ticket type.\n  >\n  > For the `icon` propery, use an emoji from [Twemoji Cheatsheet](https://twemoji-cheatsheet.vercel.app/)"
  },
  "replyTicket": {
    "comment": "Reply to a ticket",
    "doc": "Reply to a ticket\n  You can reply to a ticket with a note from an admin."
  },
  "createTicket": {
    "comment": "Create a ticket",
    "doc": "Create a ticket\n  You can create a new ticket."
  },
  "updateTicket": {
    "comment": "Update a ticket",
    "doc": "Update a ticket\n  You can update a ticket."
  },
  "getTicket": {
    "comment": "Retrieve a ticket",
    "doc": "Retrieve a ticket\n  You can fetch the details of a single ticket."
  },
  "updateVisitor": {
    "comment": "Update a visitor",
    "doc": "Update a visitor\n  Sending a PUT request to `/visitors` will result in an update of an existing Visitor.\n \n  Option 1. You can update a visitor by passing in the `user_id` of the visitor in the Request body.\n \n  Option 2. You can update a visitor by passing in the `id` of the visitor in the Request body."
  },
  "retrieveVisitorWithUserId": {
    "comment": "Retrieve a visitor with User ID",
    "doc": "Retrieve a visitor with User ID\n  You can fetch the details of a single visitor."
  },
  "convertVisitor": {
    "comment": "Convert a visitor",
    "doc": "Convert a visitor\n  You can merge a Visitor to a Contact of role type `lead` or `user`.\n \n  > 📘 What happens upon a visitor being converted?\n  >\n  > If the User exists, then the Visitor will be merged into it, the Visitor deleted and the User returned. If the User does not exist, the Visitor will be converted to a User, with the User identifiers replacing it's Visitor identifiers."
  }
}