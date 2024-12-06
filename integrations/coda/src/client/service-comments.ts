export const comments = {
  listCategories: {
    comment: 'Get doc categories',
    doc: 'Get doc categories\n  Gets all available doc categories.',
  },
  listDocs: {
    comment: 'List available docs',
    doc: 'List available docs\n  Returns a list of Coda docs accessible by the user. These are returned in the same order as on the docs page: reverse chronological by the latest event relevant to the user (last viewed, edited, or shared).',
  },
  createDoc: {
    comment: 'Create doc',
    doc: 'Create doc\n  Creates a new Coda doc, optionally copying an existing doc. Note that creating a doc requires you to be a Doc Maker in the applicable workspace (or be auto-promoted to one).',
  },
  getDoc: {
    comment: 'Get info about a doc',
    doc: 'Get info about a doc\n  Returns metadata for the specified doc.',
  },
  deleteDoc: {
    comment: 'Delete doc',
    doc: 'Delete doc\n  Deletes a doc.',
  },
  updateDoc: {
    comment: 'Update doc',
    doc: 'Update doc\n  Updates metadata for a doc. Note that updating a doc title requires you to be a Doc Maker in the applicable workspace.',
  },
  getSharingMetadata: {
    comment: 'Get sharing metadata',
    doc: 'Get sharing metadata\n  Returns metadata associated with sharing for this Coda doc.',
  },
  getPermissions: {
    comment: 'List permissions',
    doc: 'List permissions\n  Returns a list of permissions for this Coda doc.',
  },
  addPermission: {
    comment: 'Add permission',
    doc: 'Add permission\n  Adds a new permission to the doc.',
  },
  deletePermission: {
    comment: 'Delete permission',
    doc: 'Delete permission\n  Deletes an existing permission.',
  },
  searchPrincipals: {
    comment: 'Search principals',
    doc: 'Search principals\n  Searches for user and group principals matching the query that this doc can be shared with.\n  At most 20 results will be returned for both users and groups. If no query is given then no results are returned.',
  },
  getAclSettings: {
    comment: 'Get ACL settings',
    doc: 'Get ACL settings\n  Returns settings associated with ACLs for this Coda doc.',
  },
  updateAclSettings: {
    comment: 'Update ACL settings',
    doc: 'Update ACL settings\n  Update settings associated with ACLs for this Coda doc.',
  },
  publishDoc: {
    comment: 'Publish doc',
    doc: 'Publish doc\n  Update publish settings for a doc.',
  },
  unpublishDoc: {
    comment: 'Unpublish doc',
    doc: 'Unpublish doc\n  Unpublishes a doc.',
  },
  listPages: {
    comment: 'List pages',
    doc: 'List pages\n  Returns a list of pages in a Coda doc.',
  },
  createPage: {
    comment: 'Create a page',
    doc: 'Create a page\n  Create a new page in a doc. Note that creating a page requires you to be a Doc Maker in the applicable workspace.',
  },
  getPage: {
    comment: 'Get a page',
    doc: 'Get a page\n  Returns details about a page.',
  },
  updatePage: {
    comment: 'Update a page',
    doc: 'Update a page\n  Update properties for a page. Note that updating a page title or icon requires you to be a Doc Maker in the applicable workspace.',
  },
  deletePage: {
    comment: 'Delete a page',
    doc: 'Delete a page\n  Deletes the specified page.',
  },
  beginPageContentExport: {
    comment: 'Begin content export',
    doc: 'Begin content export\n  Initiate an export of content for the given page.',
  },
  getPageContentExportStatus: {
    comment: 'Content export status',
    doc: 'Content export status\n  Check the status of a page content export',
  },
  listTables: {
    comment: 'List tables',
    doc: 'List tables\n  Returns a list of tables in a Coda doc.',
  },
  getTable: {
    comment: 'Get a table',
    doc: 'Get a table\n  Returns details about a specific table or view.',
  },
  listColumns: {
    comment: 'List columns',
    doc: 'List columns\n  Returns a list of columns in a table.',
  },
  listRows: {
    comment: 'List table rows',
    doc: 'List table rows\n  Returns a list of rows in a table.\n  ### Value results\n  The `valueFormat` parameter dictates in what format the API should return values for individual cells.\n   `simple` (default): Returns cell values as the following JSON values: `string`, `number`, or `boolean`. Array values (like multiselects) are returned as comma-delimited strings.\n   `simpleWithArrays`: Singleton values are returned as `simple`. Array values are returned as JSON arrays and the values within are `simple` values (including nested arrays).\n   `rich`: If applicable, returns many values with further encoding, allowing API users to have lossless access to data in Coda.\n   For `text` values, returns data in Markdown syntax. If the text field is simple text (e.g. has no formatting),\n  the field will be fully escaped with triple-ticks. E.g\n  `\n  ```This is plain text```\n  `\n   For `currency`, `lookup`, `image`, `person` and `hyperlink` values, the value will be encoded in [JSON-LD](https://json-ld.org/) format.\n \n  ```\n  // Currency\n  {\n  "@context": "http://schema.org",\n  "@type": "MonetaryAmount",\n  "currency": "USD",\n  "amount": 42.42\n  }\n \n  // Lookup\n  {\n  "@context": "http://schema.org",\n  "@type": "StructuredValue",\n  "additionalType": "row",\n  "name": "Row Name",\n  "rowId": "i-123456789",\n  "tableId": "grid-123456789",\n  "tableUrl": "https://coda.io/d/_d123456789/grid-123456789",\n  "url": "https://coda.io/d/_d123456789/grid-123456789#_r42",\n  }\n \n  // Hyperlink\n  {\n  "@context": "http://schema.org",\n  "@type": "WebPage",\n  "name": "Coda",\n  "url": "https://coda.io"\n  }\n \n  // Image\n  {\n  "@context": "http://schema.org",\n  "@type": "ImageObject",\n  "name": "Coda logo",\n  "url": "https://coda.io/logo.jpg"\n  }\n \n  // People\n  {\n  "@context": "http://schema.org",\n  "@type": "Person",\n  "name": "Art Vandalay",\n  "email": "art@vandalayindustries.com"\n  }\n  ```',
  },
  upsertRows: {
    comment: 'Insert/upsert rows',
    doc: 'Insert/upsert rows\n  Inserts rows into a table, optionally updating existing rows if any upsert key columns are provided. This endpoint will always return a 202, so long as the doc and table exist and are accessible (and the update is structurally valid). Row inserts/upserts are generally processed within several seconds. Note: this endpoint only works for base tables, not views.\n  When upserting, if multiple rows match the specified key column(s), they will all be updated with the specified value.',
  },
  deleteRows: {
    comment: 'Delete multiple rows',
    doc: 'Delete multiple rows\n  Deletes the specified rows from the table or view. This endpoint will always return a 202. Row deletions are generally processed within several seconds.',
  },
  getRow: {
    comment: 'Get a row',
    doc: 'Get a row\n  Returns details about a row in a table.',
  },
  updateRow: {
    comment: 'Update row',
    doc: 'Update row\n  Updates the specified row in the table. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row updates are generally processed within several seconds. When updating using a name as opposed to an ID, an arbitrary row will be affected.',
  },
  deleteRow: {
    comment: 'Delete row',
    doc: 'Delete row\n  Deletes the specified row from the table or view. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row deletions are generally processed within several seconds. When deleting using a name as opposed to an ID, an arbitrary row will be removed.',
  },
  pushButton: {
    comment: 'Push a button',
    doc: 'Push a button\n  Pushes a button on a row in a table.\n  Authorization note: This action is available to API tokens that are authorized to write to the table. However, the underlying button can perform any action on the document, including writing to other tables and performing Pack actions.',
  },
  getColumn: {
    comment: 'Get a column',
    doc: 'Get a column\n  Returns details about a column in a table.',
  },
  listFormulas: {
    comment: 'List formulas',
    doc: 'List formulas\n  Returns a list of named formulas in a Coda doc.',
  },
  getFormula: {
    comment: 'Get a formula',
    doc: 'Get a formula\n  Returns info on a formula.',
  },
  listControls: {
    comment: 'List controls',
    doc: 'List controls\n  Returns a list of controls in a Coda doc.',
  },
  getControl: {
    comment: 'Get a control',
    doc: 'Get a control\n  Returns info on a control.',
  },
  listCustomDocDomains: {
    comment: 'List custom doc domains',
    doc: 'List custom doc domains\n  List all custom domains for a published doc.',
  },
  addCustomDocDomain: {
    comment: 'Add custom domain',
    doc: 'Add custom domain\n  Add a custom domain to a published doc.',
  },
  deleteCustomDocDomain: {
    comment: 'Deletes a custom domain',
    doc: 'Deletes a custom domain\n  Deletes a custom domain from a published doc.',
  },
  updateCustomDocDomain: {
    comment: 'Updates a custom domain',
    doc: "Updates a custom domain\n  Updates properties of a document's custom domain.",
  },
  getCustomDocDomainProvider: {
    comment: 'Gets custom doc domains providers',
    doc: 'Gets custom doc domains providers\n  Gets the provider (ie. GoDaddy) of a custom domain.',
  },
  whoami: {
    comment: 'Get user info',
    doc: 'Get user info\n  Returns basic info about the current user.',
  },
  resolveBrowserLink: {
    comment: 'Resolve browser link',
    doc: 'Resolve browser link\n  Given a browser link to a Coda object, attempts to find it and return metadata that can be used to get more info on it. Returns a 400 if the URL does not appear to be a Coda URL or a 404 if the resource cannot be located with the current credentials.',
  },
  getMutationStatus: {
    comment: 'Get mutation status',
    doc: 'Get mutation status\n  Get the status for an asynchronous mutation to know whether or not it has been completed. Each API endpoint that mutates a document will return a request id that you can pass to this endpoint to check the completion status. Status information is not guaranteed to be available for more than one day after the mutation was completed. It is intended to be used shortly after the request was made.',
  },
  triggerWebhookAutomation: {
    comment: 'Trigger automation',
    doc: 'Trigger automation\n  Triggers webhook-invoked automation',
  },
  listDocAnalytics: {
    comment: 'List doc analytics',
    doc: 'List doc analytics\n  Returns analytics data for available docs per day.',
  },
  listPageAnalytics: {
    comment: 'List page analytics',
    doc: 'List page analytics\n  Returns analytics data for a given doc within the day.\n  This method will return a 401 if the given doc is not in an Enterprise workspace.',
  },
  listDocAnalyticsSummary: {
    comment: 'Get doc analytics summary',
    doc: 'Get doc analytics summary\n  Returns summarized analytics data for available docs.',
  },
  listPackAnalytics: {
    comment: 'List Pack analytics',
    doc: 'List Pack analytics\n  Returns analytics data for Packs the user can edit.',
  },
  listPackAnalyticsSummary: {
    comment: 'Get Pack analytics summary',
    doc: 'Get Pack analytics summary\n  Returns summarized analytics data for Packs the user can edit.',
  },
  listPackFormulaAnalytics: {
    comment: 'List Pack formula analytics',
    doc: 'List Pack formula analytics\n  Returns analytics data for Pack formulas.',
  },
  getAnalyticsLastUpdated: {
    comment: 'Get analytics last updated day',
    doc: 'Get analytics last updated day\n  Returns days based on Pacific Standard Time when analytics were last updated.',
  },
  listWorkspaceMembers: {
    comment: 'List workspace users',
    doc: 'List workspace users\n  Returns a list of members in the given workspace. This list will be ordered with the requesting user first and then ordered by role.',
  },
  changeUserRole: {
    comment: 'Updates user role',
    doc: 'Updates user role\n  Updates the workspace user role of a user that matches the parameters. Only succeeds if the requesting user has admin permissions in the workspace.',
  },
  listWorkspaceRoleActivity: {
    comment: 'List workspace roles',
    doc: 'List workspace roles\n  Returns a list of the counts of users over time by role for the workspace.',
  },
  listPacks: {
    comment: 'List Packs',
    doc: 'List Packs\n  Get the list of accessible Packs.',
  },
  createPack: {
    comment: 'Create Pack',
    doc: 'Create Pack\n  Creates a new Pack, essentially registering a new Pack ID. The contents of the Pack will be uploaded separately.',
  },
  getPack: {
    comment: 'Get a single Pack',
    doc: 'Get a single Pack\n  Returns a single Pack.',
  },
  updatePack: {
    comment: 'Update Pack',
    doc: 'Update Pack\n  Update an existing Pack for non-versioned fields.',
  },
  deletePack: {
    comment: 'Delete Pack',
    doc: 'Delete Pack\n  Delete a given Pack.',
  },
  getPackConfigurationSchema: {
    comment: 'Gets the JSON Schema for Pack configuration.',
    doc: 'Gets the JSON Schema for Pack configuration.\n  Returns a JSON Schema applicable for customizing the pack using Pack configurations.',
  },
  listPackVersions: {
    comment: 'List the versions for a Pack.',
    doc: 'List the versions for a Pack.\n  Get the list of versions of a Pack.',
  },
  getNextPackVersion: {
    comment: 'Get the next valid version for a Pack.',
    doc: 'Get the next valid version for a Pack.\n  Get the next valid version based on the proposed metadata.',
  },
  getPackVersionDiffs: {
    comment: 'Get the difference between two pack versions.',
    doc: 'Get the difference between two pack versions.\n  Gets information about the difference between the specified previous version and next version of a Pack.',
  },
  registerPackVersion: {
    comment: 'Register Pack version',
    doc: 'Register Pack version\n  Registers a new Pack version. This simply returns a signed URL to use for uploading the Pack version definition. Following the completion of the upload, POST to /apis/v1/packs/{packId}/versions/{packVersion} trigger the rest of the creation process.',
  },
  packVersionUploadComplete: {
    comment: 'Pack version upload complete',
    doc: 'Pack version upload complete\n  Note the completion of the upload of a Pack version bundle in order to create that Pack version.',
  },
  createPackRelease: {
    comment: 'Create a new Pack release.',
    doc: 'Create a new Pack release.\n  Creates a new Pack release based on an existing Pack version.',
  },
  listPackReleases: {
    comment: 'List the releases for a Pack.',
    doc: 'List the releases for a Pack.\n  Get the list of releases of a Pack.',
  },
  updatePackRelease: {
    comment: 'Update an existing Pack release.',
    doc: 'Update an existing Pack release.\n  Update details of a Pack release.',
  },
  setPackOauthConfig: {
    comment: 'Set the OAuth configurations of the Pack.',
    doc: 'Set the OAuth configurations of the Pack.\n  Set the OAuth configurations of the Pack, including client id and secret.',
  },
  getPackOauthConfig: {
    comment: 'Retrieve the OAuth configuration of the Pack.',
    doc: 'Retrieve the OAuth configuration of the Pack.\n  Retrieve the OAuth configuration of the Pack for display purpose. Secrets will be returned with masks.',
  },
  setPackSystemConnection: {
    comment: 'Set the system connection credentials of the Pack.',
    doc: 'Set the system connection credentials of the Pack.\n  Set the system connection credentials of the Pack.',
  },
  patchPackSystemConnection: {
    comment: 'Patch the system connection credentials of the Pack.',
    doc: 'Patch the system connection credentials of the Pack.\n  Patch the system connection credentials of the Pack.',
  },
  getPackSystemConnection: {
    comment: 'Retrieve the system connection metadata of the Pack.',
    doc: 'Retrieve the system connection metadata of the Pack.\n  Retrieve the system connection metadata of the Pack.',
  },
  getPackPermissions: {
    comment: 'List permissions for a Pack',
    doc: 'List permissions for a Pack\n  Get user, workspace, and/or global permissions for a given Pack.',
  },
  addPackPermission: {
    comment: 'Add a permission for Pack',
    doc: 'Add a permission for Pack\n  Create or modify user, workspace, or global permissions for a given Pack.',
  },
  deletePackPermission: {
    comment: 'Delete a permission for Pack',
    doc: 'Delete a permission for Pack\n  Delete user, workspace, or global permissions for a given Pack.',
  },
  listPackMakers: {
    comment: 'List makers for Pack',
    doc: 'List makers for Pack\n  List makers for a given pack.',
  },
  addPackMaker: {
    comment: 'Add a maker for Pack',
    doc: 'Add a maker for Pack\n  Set a maker for a given Pack. Used to display makers for a pack in the corresponding packs page.',
  },
  deletePackMaker: {
    comment: 'Delete a maker for Pack',
    doc: 'Delete a maker for Pack\n  Delete a maker for a given Pack, who will not be displayed in the corresponding packs page.',
  },
  listPackCategories: {
    comment: 'List categories for Pack',
    doc: 'List categories for Pack\n  List publishing categories for a given pack.',
  },
  addPackCategory: {
    comment: 'Add a category for Pack',
    doc: 'Add a category for Pack\n  Add a publishing category for a given pack.',
  },
  deletePackCategory: {
    comment: 'Delete a category for Pack',
    doc: 'Delete a category for Pack\n  Delete a publishing category for a given pack.',
  },
  uploadPackAsset: {
    comment: 'Upload a Pack asset.',
    doc: 'Upload a Pack asset.\n  Request a signed s3 URL to upload your Pack asset.',
  },
  uploadPackSourceCode: {
    comment: 'Upload Pack source code.',
    doc: 'Upload Pack source code.\n  Request a signed s3 URL to upload your Pack source code.',
  },
  packAssetUploadComplete: {
    comment: 'Pack asset upload complete',
    doc: 'Pack asset upload complete\n  Note the completion of the upload of a Pack asset.',
  },
  packSourceCodeUploadComplete: {
    comment: 'Pack source code upload complete',
    doc: 'Pack source code upload complete\n  Note the completion of the upload of a Pack source code.',
  },
  getPackSourceCode: {
    comment: 'get the source code for a Pack version.',
    doc: 'get the source code for a Pack version.\n  Get temporary links used to download the source code for the given packId and version',
  },
  listPackListings: {
    comment: 'List the Pack listings accessible to a user.',
    doc: 'List the Pack listings accessible to a user.\n  Get listings of public Packs and Packs created by you.',
  },
  getPackListing: {
    comment: 'Get detailed listing information for a Pack.',
    doc: 'Get detailed listing information for a Pack.\n  Get detailed listing information for a Pack.',
  },
  listPackLogs: {
    comment: 'Retrieve the logs of a Pack.',
    doc: 'Retrieve the logs of a Pack.\n  Retrieve the logs of a Pack for debugging purpose.',
  },
  listIngestionLogs: {
    comment: 'Retrieve the logs of a Ingestion.',
    doc: 'Retrieve the logs of a Ingestion.\n  Retrieve the logs of a Ingestion for debugging purpose.',
  },
  listGroupedPackLogs: {
    comment: 'Retrieve the grouped logs of a Pack.',
    doc: 'Retrieve the grouped logs of a Pack.\n  Retrieve the grouped logs of a Pack for debugging purpose.',
  },
  listGroupedIngestionLogs: {
    comment: 'Retrieve the grouped logs of a Pack for a specific ingestionExecutionId.',
    doc: 'Retrieve the grouped logs of a Pack for a specific ingestionExecutionId.\n  Retrieve the grouped logs of a Pack for debugging purpose.',
  },
  listIngestionExecutions: {
    comment: 'Retrieve a list of ingestion execution ids for the given root ingestion id.',
    doc: 'Retrieve a list of ingestion execution ids for the given root ingestion id.\n  Retrieve the ingestion execution ids of a root ingestion for debugging purpose.',
  },
  listPackFeaturedDocs: {
    comment: 'List featured docs for a Pack',
    doc: 'List featured docs for a Pack\n  Returns a list of featured doc ids for a Pack.',
  },
  updatePackFeaturedDocs: {
    comment: 'Update featured docs for a Pack',
    doc: 'Update featured docs for a Pack\n  Create or replace the featured docs for a Pack.',
  },
};
