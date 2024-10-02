export const comments = {
  "getBanner": {
    "comment": "Get announcement banner configuration",
    "doc": "Get announcement banner configuration\n  Returns the current announcement banner configuration.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setBanner": {
    "comment": "Update announcement banner configuration",
    "doc": "Update announcement banner configuration\n  Updates the announcement banner configuration.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getCustomFieldsConfigurations": {
    "comment": "Bulk get custom field configurations",
    "doc": "Bulk get custom field configurations\n  Returns a [paginated](#pagination) list of configurations for list of custom fields of a [type](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/) created by a [Forge app](https://developer.atlassian.com/platform/forge/).\n \n  The result can be filtered by one of these criteria:\n \n    `id`.\n    `fieldContextId`.\n    `issueId`.\n    `projectKeyOrId` and `issueTypeId`.\n \n  Otherwise, all configurations for the provided list of custom fields are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the Forge app that provided the custom field type."
  },
  "updateMultipleCustomFieldValues": {
    "comment": "Update custom fields",
    "doc": "Update custom fields\n  Updates the value of one or more custom fields on one or more issues. Combinations of custom field and issue should be unique within the request.\n \n  Apps can only perform this operation on [custom fields](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field/) and [custom field types](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/) declared in their own manifests.\n \n  [Permissions](#permissions) required: Only the app that owns the custom field or custom field type can update its values with this operation.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "getCustomFieldConfiguration": {
    "comment": "Get custom field configurations",
    "doc": "Get custom field configurations\n  Returns a [paginated](#pagination) list of configurations for a custom field of a [type](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/) created by a [Forge app](https://developer.atlassian.com/platform/forge/).\n \n  The result can be filtered by one of these criteria:\n \n    `id`.\n    `fieldContextId`.\n    `issueId`.\n    `projectKeyOrId` and `issueTypeId`.\n \n  Otherwise, all configurations are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the Forge app that provided the custom field type."
  },
  "updateCustomFieldConfiguration": {
    "comment": "Update custom field configurations",
    "doc": "Update custom field configurations\n  Update the configuration for contexts of a custom field of a [type](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/) created by a [Forge app](https://developer.atlassian.com/platform/forge/).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the Forge app that created the custom field type."
  },
  "updateCustomFieldValue": {
    "comment": "Update custom field value",
    "doc": "Update custom field value\n  Updates the value of a custom field on one or more issues.\n \n  Apps can only perform this operation on [custom fields](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field/) and [custom field types](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/) declared in their own manifests.\n \n  [Permissions](#permissions) required: Only the app that owns the custom field or custom field type can update its values with this operation.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "getApplicationProperty": {
    "comment": "Get application property",
    "doc": "Get application property\n  Returns all application properties or an application property.\n \n  If you specify a value for the `key` parameter, then an application property is returned as an object (not in an array). Otherwise, an array of all editable application properties is returned. See [Set application property](#api-rest-api-3-application-properties-id-put) for descriptions of editable properties.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAdvancedSettings": {
    "comment": "Get advanced settings",
    "doc": "Get advanced settings\n  Returns the application properties that are accessible on the Advanced Settings page. To navigate to the Advanced Settings page in Jira, choose the Jira icon > Jira settings > System, General Configuration and then click Advanced Settings (in the upper right).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setApplicationProperty": {
    "comment": "Set application property",
    "doc": "Set application property\n  Changes the value of an application property. For example, you can change the value of the `jira.clone.prefix` from its default value of CLONE - to Clone - if you prefer sentence case capitalization. Editable properties are described below along with their default values.\n \n  #### Advanced settings ####\n \n  The advanced settings below are also accessible in [Jira](https://confluence.atlassian.com/x/vYXKM).\n \n  | Key | Description | Default value |\n  | -- | -- | -- |\n  | `jira.clone.prefix` | The string of text prefixed to the title of a cloned issue. | `CLONE -` |\n  | `jira.date.picker.java.format` | The date format for the Java (server-side) generated dates. This must be the same as the `jira.date.picker.javascript.format` format setting. | `d/MMM/yy` |\n  | `jira.date.picker.javascript.format` | The date format for the JavaScript (client-side) generated dates. This must be the same as the `jira.date.picker.java.format` format setting. | `%e/%b/%y` |\n  | `jira.date.time.picker.java.format` | The date format for the Java (server-side) generated date times. This must be the same as the `jira.date.time.picker.javascript.format` format setting. | `dd/MMM/yy h:mm a` |\n  | `jira.date.time.picker.javascript.format` | The date format for the JavaScript (client-side) generated date times. This must be the same as the `jira.date.time.picker.java.format` format setting. | `%e/%b/%y %I:%M %p` |\n  | `jira.issue.actions.order` | The default order of actions (such as Comments or Change history) displayed on the issue view. | `asc` |\n  | `jira.view.issue.links.sort.order` | The sort order of the list of issue links on the issue view. | `type, status, priority` |\n  | `jira.comment.collapsing.minimum.hidden` | The minimum number of comments required for comment collapsing to occur. A value of `0` disables comment collapsing. | `4` |\n  | `jira.newsletter.tip.delay.days` | The number of days before a prompt to sign up to the Jira Insiders newsletter is shown. A value of `-1` disables this feature. | `7` |\n \n \n  #### Look and feel ####\n \n  The settings listed below adjust the [look and feel](https://confluence.atlassian.com/x/VwCLLg).\n \n  | Key | Description | Default value |\n  | -- | -- | -- |\n  | `jira.lf.date.time` | The [ time format](https://docs.oracle.com/javase/6/docs/api/index.html?java/text/SimpleDateFormat.html). | `h:mm a` |\n  | `jira.lf.date.day` | The [ day format](https://docs.oracle.com/javase/6/docs/api/index.html?java/text/SimpleDateFormat.html). | `EEEE h:mm a` |\n  | `jira.lf.date.complete` | The [ date and time format](https://docs.oracle.com/javase/6/docs/api/index.html?java/text/SimpleDateFormat.html). | `dd/MMM/yy h:mm a` |\n  | `jira.lf.date.dmy` | The [ date format](https://docs.oracle.com/javase/6/docs/api/index.html?java/text/SimpleDateFormat.html). | `dd/MMM/yy` |\n  | `jira.date.time.picker.use.iso8061` | When enabled, sets Monday as the first day of the week in the date picker, as specified by the ISO8601 standard. | `false` |\n  | `jira.lf.logo.url` | The URL of the logo image file. | `/images/icon-jira-logo.png` |\n  | `jira.lf.logo.show.application.title` | Controls the visibility of the application title on the sidebar. | `false` |\n  | `jira.lf.favicon.url` | The URL of the favicon. | `/favicon.ico` |\n  | `jira.lf.favicon.hires.url` | The URL of the high-resolution favicon. | `/images/64jira.png` |\n  | `jira.lf.navigation.bgcolour` | The background color of the sidebar. | `#0747A6` |\n  | `jira.lf.navigation.highlightcolour` | The color of the text and logo of the sidebar. | `#DEEBFF` |\n  | `jira.lf.hero.button.base.bg.colour` | The background color of the hero button. | `#3b7fc4` |\n  | `jira.title` | The text for the application title. The application title can also be set in General settings. | `Jira` |\n  | `jira.option.globalsharing` | Whether filters and dashboards can be shared with anyone signed into Jira. | `true` |\n  | `xflow.product.suggestions.enabled` | Whether to expose product suggestions for other Atlassian products within Jira. | `true` |\n \n \n  #### Other settings ####\n \n  | Key | Description | Default value |\n  | -- | -- | -- |\n  | `jira.issuenav.criteria.autoupdate` | Whether instant updates to search criteria is active. | `true` |\n \n \n  Note: Be careful when changing [application properties and advanced settings](https://confluence.atlassian.com/x/vYXKM).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllApplicationRoles": {
    "comment": "Get all application roles",
    "doc": "Get all application roles\n  Returns all application roles. In Jira, application roles are managed using the [Application access configuration](https://confluence.atlassian.com/x/3YxjL) page.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getApplicationRole": {
    "comment": "Get application role",
    "doc": "Get application role\n  Returns an application role.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAttachmentContent": {
    "comment": "Get attachment content",
    "doc": "Get attachment content\n  Returns the contents of an attachment. A `Range` header can be set to define a range of bytes within the attachment to download. See the [HTTP Range header standard](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range) for details.\n \n  To return a thumbnail of the attachment, use [Get attachment thumbnail](#api-rest-api-3-attachment-thumbnail-id-get).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: For the issue containing the attachment:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getAttachmentMeta": {
    "comment": "Get Jira attachment settings",
    "doc": "Get Jira attachment settings\n  Returns the attachment settings, that is, whether attachments are enabled and the maximum attachment size allowed.\n \n  Note that there are also [project permissions](https://confluence.atlassian.com/x/yodKLg) that restrict whether users can create and delete attachments.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAttachmentThumbnail": {
    "comment": "Get attachment thumbnail",
    "doc": "Get attachment thumbnail\n  Returns the thumbnail of an attachment.\n \n  To return the attachment contents, use [Get attachment content](#api-rest-api-3-attachment-content-id-get).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: For the issue containing the attachment:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "removeAttachment": {
    "comment": "Delete attachment",
    "doc": "Delete attachment\n  Deletes an attachment from an issue.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: For the project holding the issue containing the attachment:\n \n    Delete own attachments [project permission](https://confluence.atlassian.com/x/yodKLg) to delete an attachment created by the calling user.\n    Delete all attachments [project permission](https://confluence.atlassian.com/x/yodKLg) to delete an attachment created by any user."
  },
  "getAttachment": {
    "comment": "Get attachment metadata",
    "doc": "Get attachment metadata\n  Returns the metadata for an attachment. Note that the attachment itself is not returned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "expandAttachmentForHumans": {
    "comment": "Get all metadata for an expanded attachment",
    "doc": "Get all metadata for an expanded attachment\n  Returns the metadata for the contents of an attachment, if it is an archive, and metadata for the attachment itself. For example, if the attachment is a ZIP archive, then information about the files in the archive is returned and metadata for the ZIP archive. Currently, only the ZIP archive format is supported.\n \n  Use this operation to retrieve data that is presented to the user, as this operation returns the metadata for the attachment itself, such as the attachment's ID and name. Otherwise, use [ Get contents metadata for an expanded attachment](#api-rest-api-3-attachment-id-expand-raw-get), which only returns the metadata for the attachment's contents.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: For the issue containing the attachment:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "expandAttachmentForMachines": {
    "comment": "Get contents metadata for an expanded attachment",
    "doc": "Get contents metadata for an expanded attachment\n  Returns the metadata for the contents of an attachment, if it is an archive. For example, if the attachment is a ZIP archive, then information about the files in the archive is returned. Currently, only the ZIP archive format is supported.\n \n  Use this operation if you are processing the data without presenting it to the user, as this operation only returns the metadata for the contents of the attachment. Otherwise, to retrieve data to present to the user, use [ Get all metadata for an expanded attachment](#api-rest-api-3-attachment-id-expand-human-get) which also returns the metadata for the attachment itself, such as the attachment's ID and name.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: For the issue containing the attachment:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getAuditRecords": {
    "comment": "Get audit records",
    "doc": "Get audit records\n  Returns a list of audit records. The list can be filtered to include items:\n \n    where each item in `filter` has at least one match in any of these fields:\n \n    `summary`\n    `category`\n    `eventSource`\n    `objectItem.name` If the object is a user, account ID is available to filter.\n    `objectItem.parentName`\n    `objectItem.typeName`\n    `changedValues.changedFrom`\n    `changedValues.changedTo`\n    `remoteAddress`\n \n  For example, if `filter` contains man ed, an audit record containing `summary\": \"User added to group\"` and `\"category\": \"group management\"` is returned.\n    created on or after a date and time.\n    created or or before a date and time.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllSystemAvatars": {
    "comment": "Get system avatars by type",
    "doc": "Get system avatars by type\n  Returns a list of system avatar details by owner type, where the owner types are issue type, project, user or priority.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getBulkEditableFields": {
    "comment": "Get bulk editable fields",
    "doc": "Get bulk editable fields\n  Use this API to get a list of fields visible to the user to perform bulk edit operations. You can pass single or multiple issues in the query to get eligible editable fields. This API uses pagination to return responses, delivering 50 fields at a time.\n \n  [Permissions](#permissions) required:\n \n    Global bulk change [permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/).\n    Browse [project permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in all projects that contain the selected issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Depending on the field, any field-specific permissions required to edit it."
  },
  "submitBulkEdit": {
    "comment": "Bulk edit issues",
    "doc": "Bulk edit issues\n  Use this API to submit a bulk edit request and simultaneously edit multiple issues. There are limits applied to the number of issues and fields that can be edited. A single request can accommodate a maximum of 1000 issues (including subtasks) and 200 fields.\n \n  [Permissions](#permissions) required:\n \n    Global bulk change [permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/).\n    Browse [project permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in all projects that contain the selected issues.\n    Edit [issues permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in all projects that contain the selected issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "submitBulkMove": {
    "comment": "Bulk move issues",
    "doc": "Bulk move issues\n  Use this API to submit a bulk issue move request. You can move multiple issues, but they must all be moved to and from a single project, issue type, and parent. You can't move more than 1000 issues (including subtasks) at once.\n \n  #### Scenarios: ####\n \n  This is an early version of the API and it doesn't have full feature parity with the Bulk Move UI experience.\n \n    Moving issue of type A to issue of type B in the same project or a different project: `SUPPORTED`\n    Moving multiple issues of type A in one project to multiple issues of type B in the same project or a different project: `SUPPORTED`\n    Moving a standard parent issue of type A with its multiple subtask issue types in one project to standard issue of type B and multiple subtask issue types in the same project or a different project: `SUPPORTED`\n    Moving an epic issue with its child issues to a different project without losing their relation: `NOT SUPPORTED`\n  (Workaround: Move them individually and stitch the relationship back with the Bulk Edit API)\n \n  #### Limits applied to bulk issue moves: ####\n \n  When using the bulk move, keep in mind that there are limits on the number of issues and fields you can include.\n \n    You can move up to 1,000 issues in a single operation, including any subtasks.\n    All issues must originate from the same project and share the same issue type and parent.\n    The total combined number of fields across all issues must not exceed 1,500,000. For example, if each issue includes 15,000 fields, then the maximum number of issues that can be moved is 100.\n \n  [Permissions](#permissions) required:\n \n    Global bulk change [permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/).\n    Move [issues permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in source projects.\n    Create [issues permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in destination projects.\n    Browse [project permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) in destination projects, if moving subtasks only.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getBulkOperationProgress": {
    "comment": "Get bulk issue operation progress",
    "doc": "Get bulk issue operation progress\n  Use this to get the progress state for the specified bulk operation `taskId`.\n \n  [Permissions](#permissions) required:\n \n    Global bulk change [permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/).\n    Administer Jira [global permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/), or be the creator of the task.\n \n  If the task is running, this resource will return:\n \n  {\"taskId\":\"10779\",\"status\":\"RUNNING\",\"progressPercent\":65,\"submittedBy\":{\"accountId\":\"5b10a2844c20165700ede21g\"},\"created\":1690180055963,\"started\":1690180056206,\"updated\":169018005829}\n \n  If the task has completed, then this resource will return:\n \n  {\"processedAccessibleIssues\":[10001,10002],\"created\":1709189449954,\"progressPercent\":100,\"started\":1709189450154,\"status\":\"COMPLETE\",\"submittedBy\":{\"accountId\":\"5b10a2844c20165700ede21g\"},\"invalidOrInaccessibleIssueCount\":0,\"taskId\":\"10000\",\"totalIssueCount\":2,\"updated\":1709189450354}\n \n  Note: You can view task progress for up to 14 days from creation."
  },
  "getAllUserDataClassificationLevels": {
    "comment": "Get all classification levels",
    "doc": "Get all classification levels\n  Returns all classification levels.\n \n  [Permissions](#permissions) required: None."
  },
  "getCommentsByIds": {
    "comment": "Get comments by IDs",
    "doc": "Get comments by IDs\n  Returns a [paginated](#pagination) list of comments specified by a list of comment IDs.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Comments are returned where the user:\n \n    has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the comment.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "getCommentPropertyKeys": {
    "comment": "Get comment property keys",
    "doc": "Get comment property keys\n  Returns the keys of all the properties of a comment.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "deleteCommentProperty": {
    "comment": "Delete comment property",
    "doc": "Delete comment property\n  Deletes a comment property.\n \n  [Permissions](#permissions) required: either of:\n \n    Edit All Comments [project permission](https://confluence.atlassian.com/x/yodKLg) to delete a property from any comment.\n    Edit Own Comments [project permission](https://confluence.atlassian.com/x/yodKLg) to delete a property from a comment created by the user.\n \n  Also, when the visibility of a comment is restricted to a role or group the user must be a member of that role or group."
  },
  "getCommentProperty": {
    "comment": "Get comment property",
    "doc": "Get comment property\n  Returns the value of a comment property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "setCommentProperty": {
    "comment": "Set comment property",
    "doc": "Set comment property\n  Creates or updates the value of a property for a comment. Use this resource to store custom data against a comment.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  [Permissions](#permissions) required: either of:\n \n    Edit All Comments [project permission](https://confluence.atlassian.com/x/yodKLg) to create or update the value of a property on any comment.\n    Edit Own Comments [project permission](https://confluence.atlassian.com/x/yodKLg) to create or update the value of a property on a comment created by the user.\n \n  Also, when the visibility of a comment is restricted to a role or group the user must be a member of that role or group."
  },
  "findComponentsForProjects": {
    "comment": "Find components for projects",
    "doc": "Find components for projects\n  Returns a [paginated](#pagination) list of all components in a project, including global (Compass) components when applicable.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "createComponent": {
    "comment": "Create component",
    "doc": "Create component\n  Creates a component. Use components to provide containers for issues within a project. Use components to provide containers for issues within a project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project in which the component is created or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteComponent": {
    "comment": "Delete component",
    "doc": "Delete component\n  Deletes a component.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the component or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getComponent": {
    "comment": "Get component",
    "doc": "Get component\n  Returns a component.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for project containing the component."
  },
  "updateComponent": {
    "comment": "Update component",
    "doc": "Update component\n  Updates a component. Any fields included in the request are overwritten. If `leadAccountId` is an empty string (\"\") the component lead is removed.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the component or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getComponentRelatedIssues": {
    "comment": "Get component issues count",
    "doc": "Get component issues count\n  Returns the counts of issues assigned to the component.\n \n  This operation can be accessed anonymously.\n \n  Deprecation notice: The required OAuth 2.0 scopes will be updated on June 15, 2024.\n \n    Classic: `read:jira-work`\n    Granular: `read:field:jira`, `read:project.component:jira`\n \n  [Permissions](#permissions) required: None."
  },
  "getConfiguration": {
    "comment": "Get global settings",
    "doc": "Get global settings\n  Returns the [global settings](https://confluence.atlassian.com/x/qYXKM) in Jira. These settings determine whether optional features (for example, subtasks, time tracking, and others) are enabled. If time tracking is enabled, this operation also returns the time tracking configuration.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getSelectedTimeTrackingImplementation": {
    "comment": "Get selected time tracking provider",
    "doc": "Get selected time tracking provider\n  Returns the time tracking provider that is currently selected. Note that if time tracking is disabled, then a successful but empty response is returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "selectTimeTrackingImplementation": {
    "comment": "Select time tracking provider",
    "doc": "Select time tracking provider\n  Selects a time tracking provider.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAvailableTimeTrackingImplementations": {
    "comment": "Get all time tracking providers",
    "doc": "Get all time tracking providers\n  Returns all time tracking providers. By default, Jira only has one time tracking provider: JIRA provided time tracking. However, you can install other time tracking providers via apps from the Atlassian Marketplace. For more information on time tracking providers, see the documentation for the [ Time Tracking Provider](https://developer.atlassian.com/cloud/jira/platform/modules/time-tracking-provider/) module.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getSharedTimeTrackingConfiguration": {
    "comment": "Get time tracking settings",
    "doc": "Get time tracking settings\n  Returns the time tracking settings. This includes settings such as the time format, default time unit, and others. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setSharedTimeTrackingConfiguration": {
    "comment": "Set time tracking settings",
    "doc": "Set time tracking settings\n  Sets the time tracking settings.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getCustomFieldOption": {
    "comment": "Get custom field option",
    "doc": "Get custom field option\n  Returns a custom field option. For example, an option in a select list.\n \n  Note that this operation only works for issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource, it cannot be used with issue field select list options created by Connect apps.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The custom field option is returned as follows:\n \n    if the user has the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    if the user has the Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for at least one project the custom field is used in, and the field is visible in at least one layout the user has permission to view."
  },
  "getAllDashboards": {
    "comment": "Get all dashboards",
    "doc": "Get all dashboards\n  Returns a list of dashboards owned by or shared with the user. The list may be filtered to include only favorite or owned dashboards.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "createDashboard": {
    "comment": "Create dashboard",
    "doc": "Create dashboard\n  Creates a dashboard.\n \n  [Permissions](#permissions) required: None."
  },
  "bulkEditDashboards": {
    "comment": "Bulk edit dashboards",
    "doc": "Bulk edit dashboards\n  Bulk edit dashboards. Maximum number of dashboards to be edited at the same time is 100.\n \n  [Permissions](#permissions) required: None\n \n  The dashboards to be updated must be owned by the user, or the user must be an administrator."
  },
  "getAllAvailableDashboardGadgets": {
    "comment": "Get available gadgets",
    "doc": "Get available gadgets\n  Gets a list of all available gadgets that can be added to all dashboards.\n \n  [Permissions](#permissions) required: None."
  },
  "getDashboardsPaginated": {
    "comment": "Search for dashboards",
    "doc": "Search for dashboards\n  Returns a [paginated](#pagination) list of dashboards. This operation is similar to [Get dashboards](#api-rest-api-3-dashboard-get) except that the results can be refined to include dashboards that have specific attributes. For example, dashboards with a particular name. When multiple attributes are specified only filters matching all attributes are returned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The following dashboards that match the query parameters are returned:\n \n    Dashboards owned by the user. Not returned for anonymous users.\n    Dashboards shared with a group that the user is a member of. Not returned for anonymous users.\n    Dashboards shared with a private project that the user can browse. Not returned for anonymous users.\n    Dashboards shared with a public project.\n    Dashboards shared with the public."
  },
  "getAllGadgets": {
    "comment": "Get gadgets",
    "doc": "Get gadgets\n  Returns a list of dashboard gadgets on a dashboard.\n \n  This operation returns:\n \n    Gadgets from a list of IDs, when `id` is set.\n    Gadgets with a module key, when `moduleKey` is set.\n    Gadgets from a list of URIs, when `uri` is set.\n    All gadgets, when no other parameters are set.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "addGadget": {
    "comment": "Add gadget to dashboard",
    "doc": "Add gadget to dashboard\n  Adds a gadget to a dashboard.\n \n  [Permissions](#permissions) required: None."
  },
  "removeGadget": {
    "comment": "Remove gadget from dashboard",
    "doc": "Remove gadget from dashboard\n  Removes a dashboard gadget from a dashboard.\n \n  When a gadget is removed from a dashboard, other gadgets in the same column are moved up to fill the emptied position.\n \n  [Permissions](#permissions) required: None."
  },
  "updateGadget": {
    "comment": "Update gadget on dashboard",
    "doc": "Update gadget on dashboard\n  Changes the title, position, and color of the gadget on a dashboard.\n \n  [Permissions](#permissions) required: None."
  },
  "getDashboardItemPropertyKeys": {
    "comment": "Get dashboard item property keys",
    "doc": "Get dashboard item property keys\n  Returns the keys of all properties for a dashboard item.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The user must be the owner of the dashboard or have the dashboard shared with them. Note, users with the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) are considered owners of the System dashboard. The System dashboard is considered to be shared with all other users, and is accessible to anonymous users when Jira\\’s anonymous access is permitted."
  },
  "deleteDashboardItemProperty": {
    "comment": "Delete dashboard item property",
    "doc": "Delete dashboard item property\n  Deletes a dashboard item property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The user must be the owner of the dashboard. Note, users with the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) are considered owners of the System dashboard."
  },
  "getDashboardItemProperty": {
    "comment": "Get dashboard item property",
    "doc": "Get dashboard item property\n  Returns the key and value of a dashboard item property.\n \n  A dashboard item enables an app to add user-specific information to a user dashboard. Dashboard items are exposed to users as gadgets that users can add to their dashboards. For more information on how users do this, see [Adding and customizing gadgets](https://confluence.atlassian.com/x/7AeiLQ).\n \n  When an app creates a dashboard item it registers a callback to receive the dashboard item ID. The callback fires whenever the item is rendered or, where the item is configurable, the user edits the item. The app then uses this resource to store the item's content or configuration details. For more information on working with dashboard items, see [ Building a dashboard item for a JIRA Connect add-on](https://developer.atlassian.com/server/jira/platform/guide-building-a-dashboard-item-for-a-jira-connect-add-on-33746254/) and the [Dashboard Item](https://developer.atlassian.com/cloud/jira/platform/modules/dashboard-item/) documentation.\n \n  There is no resource to set or get dashboard items.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The user must be the owner of the dashboard or have the dashboard shared with them. Note, users with the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) are considered owners of the System dashboard. The System dashboard is considered to be shared with all other users, and is accessible to anonymous users when Jira\\’s anonymous access is permitted."
  },
  "setDashboardItemProperty": {
    "comment": "Set dashboard item property",
    "doc": "Set dashboard item property\n  Sets the value of a dashboard item property. Use this resource in apps to store custom data against a dashboard item.\n \n  A dashboard item enables an app to add user-specific information to a user dashboard. Dashboard items are exposed to users as gadgets that users can add to their dashboards. For more information on how users do this, see [Adding and customizing gadgets](https://confluence.atlassian.com/x/7AeiLQ).\n \n  When an app creates a dashboard item it registers a callback to receive the dashboard item ID. The callback fires whenever the item is rendered or, where the item is configurable, the user edits the item. The app then uses this resource to store the item's content or configuration details. For more information on working with dashboard items, see [ Building a dashboard item for a JIRA Connect add-on](https://developer.atlassian.com/server/jira/platform/guide-building-a-dashboard-item-for-a-jira-connect-add-on-33746254/) and the [Dashboard Item](https://developer.atlassian.com/cloud/jira/platform/modules/dashboard-item/) documentation.\n \n  There is no resource to set or get dashboard items.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: The user must be the owner of the dashboard. Note, users with the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) are considered owners of the System dashboard."
  },
  "deleteDashboard": {
    "comment": "Delete dashboard",
    "doc": "Delete dashboard\n  Deletes a dashboard.\n \n  [Permissions](#permissions) required: None\n \n  The dashboard to be deleted must be owned by the user."
  },
  "getDashboard": {
    "comment": "Get dashboard",
    "doc": "Get dashboard\n  Returns a dashboard.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None.\n \n  However, to get a dashboard, the dashboard must be shared with the user or the user must own it. Note, users with the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) are considered owners of the System dashboard. The System dashboard is considered to be shared with all other users."
  },
  "updateDashboard": {
    "comment": "Update dashboard",
    "doc": "Update dashboard\n  Updates a dashboard, replacing all the dashboard details with those provided.\n \n  [Permissions](#permissions) required: None\n \n  The dashboard to be updated must be owned by the user."
  },
  "copyDashboard": {
    "comment": "Copy dashboard",
    "doc": "Copy dashboard\n  Copies a dashboard. Any values provided in the `dashboard` parameter replace those in the copied dashboard.\n \n  [Permissions](#permissions) required: None\n \n  The dashboard to be copied must be owned by or shared with the user."
  },
  "getPolicy": {
    "comment": "Get data policy for the workspace",
    "doc": "Get data policy for the workspace\n  Returns data policy for the workspace."
  },
  "getPolicies": {
    "comment": "Get data policy for projects",
    "doc": "Get data policy for projects\n  Returns data policies for the projects specified in the request."
  },
  "getEvents": {
    "comment": "Get events",
    "doc": "Get events\n  Returns all issue events.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "analyseExpression": {
    "comment": "Analyse Jira expression",
    "doc": "Analyse Jira expression\n  Analyses and validates Jira expressions.\n \n  As an experimental feature, this operation can also attempt to type-check the expressions.\n \n  Learn more about Jira expressions in the [documentation](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/).\n \n  [Permissions](#permissions) required: None."
  },
  "evaluateJiraExpression": {
    "comment": "Evaluate Jira expression",
    "doc": "Evaluate Jira expression\n  Evaluates a Jira expression and returns its value.\n \n  This resource can be used to test Jira expressions that you plan to use elsewhere, or to fetch data in a flexible way. Consult the [Jira expressions documentation](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/) for more details.\n \n  #### Context variables ####\n \n  The following context variables are available to Jira expressions evaluated by this resource. Their presence depends on various factors; usually you need to manually request them in the context object sent in the payload, but some of them are added automatically under certain conditions.\n \n    `user` ([User](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#user)): The current user. Always available and equal to `null` if the request is anonymous.\n    `app` ([App](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#app)): The [Connect app](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) that made the request. Available only for authenticated requests made by Connect Apps (read more here: [Authentication for Connect apps](https://developer.atlassian.com/cloud/jira/platform/security-for-connect-apps/)).\n    `issue` ([Issue](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue)): The current issue. Available only when the issue is provided in the request context object.\n    `issues` ([List](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#list) of [Issues](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue)): A collection of issues matching a JQL query. Available only when JQL is provided in the request context object.\n    `project` ([Project](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#project)): The current project. Available only when the project is provided in the request context object.\n    `sprint` ([Sprint](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#sprint)): The current sprint. Available only when the sprint is provided in the request context object.\n    `board` ([Board](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#board)): The current board. Available only when the board is provided in the request context object.\n    `serviceDesk` ([ServiceDesk](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#servicedesk)): The current service desk. Available only when the service desk is provided in the request context object.\n    `customerRequest` ([CustomerRequest](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#customerrequest)): The current customer request. Available only when the customer request is provided in the request context object.\n \n  Also, custom context variables can be passed in the request with their types. Those variables can be accessed by key in the Jira expression. These variable types are available for use in a custom context:\n \n    `user`: A [user](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#user) specified as an Atlassian account ID.\n    `issue`: An [issue](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue) specified by ID or key. All the fields of the issue object are available in the Jira expression.\n    `json`: A JSON object containing custom content.\n    `list`: A JSON list of `user`, `issue`, or `json` variable types.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None. However, an expression may return different results for different users depending on their permissions. For example, different users may see different comments on the same issue.\n  Permission to access Jira Software is required to access Jira Software context variables (`board` and `sprint`) or fields (for example, `issue.sprint`)."
  },
  "evaluateJsisJiraExpression": {
    "comment": "Evaluate Jira expression using enhanced search API",
    "doc": "Evaluate Jira expression using enhanced search API\n  Evaluates a Jira expression and returns its value. The difference between this and `eval` is that this endpoint uses the enhanced search API when evaluating JQL queries. This API is eventually consistent, unlike the strongly consistent `eval` API. This allows for better performance and scalability. In addition, this API's response for JQL evaluation is based on a scrolling view (backed by a `nextPageToken`) instead of a paginated view (backed by `startAt` and `totalCount`).\n \n  This resource can be used to test Jira expressions that you plan to use elsewhere, or to fetch data in a flexible way. Consult the [Jira expressions documentation](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/) for more details.\n \n  #### Context variables ####\n \n  The following context variables are available to Jira expressions evaluated by this resource. Their presence depends on various factors; usually you need to manually request them in the context object sent in the payload, but some of them are added automatically under certain conditions.\n \n    `user` ([User](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#user)): The current user. Always available and equal to `null` if the request is anonymous.\n    `app` ([App](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#app)): The [Connect app](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) that made the request. Available only for authenticated requests made by Connect apps (read more here: [Authentication for Connect apps](https://developer.atlassian.com/cloud/jira/platform/security-for-connect-apps/)).\n    `issue` ([Issue](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue)): The current issue. Available only when the issue is provided in the request context object.\n    `issues` ([List](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#list) of [Issues](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue)): A collection of issues matching a JQL query. Available only when JQL is provided in the request context object.\n    `project` ([Project](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#project)): The current project. Available only when the project is provided in the request context object.\n    `sprint` ([Sprint](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#sprint)): The current sprint. Available only when the sprint is provided in the request context object.\n    `board` ([Board](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#board)): The current board. Available only when the board is provided in the request context object.\n    `serviceDesk` ([ServiceDesk](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#servicedesk)): The current service desk. Available only when the service desk is provided in the request context object.\n    `customerRequest` ([CustomerRequest](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#customerrequest)): The current customer request. Available only when the customer request is provided in the request context object.\n \n  In addition, you can pass custom context variables along with their types. You can then access them from the Jira expression by key. You can use the following variables in a custom context:\n \n    `user`: A [user](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#user) specified as an Atlassian account ID.\n    `issue`: An [issue](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference#issue) specified by ID or key. All the fields of the issue object are available in the Jira expression.\n    `json`: A JSON object containing custom content.\n    `list`: A JSON list of `user`, `issue`, or `json` variable types.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None. However, an expression may return different results for different users depending on their permissions. For example, different users may see different comments on the same issue.\n  Permission to access Jira Software is required to access Jira Software context variables (`board` and `sprint`) or fields (for example, `issue.sprint`)."
  },
  "getFields": {
    "comment": "Get fields",
    "doc": "Get fields\n  Returns system and custom issue fields according to the following rules:\n \n    Fields that cannot be added to the issue navigator are always returned.\n    Fields that cannot be placed on an issue screen are always returned.\n    Fields that depend on global Jira settings are only returned if the setting is enabled. That is, timetracking fields, subtasks, votes, and watches.\n    For all other fields, this operation only returns the fields that the user has permission to view (that is, the field is used in at least one project that the user has Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.)\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "createCustomField": {
    "comment": "Create custom field",
    "doc": "Create custom field\n  Creates a custom field.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFieldsPaginated": {
    "comment": "Get fields paginated",
    "doc": "Get fields paginated\n  Returns a [paginated](#pagination) list of fields for Classic Jira projects. The list can include:\n \n    all fields\n    specific fields, by defining `id`\n    fields that contain a string in the field name or description, by defining `query`\n    specific fields that contain a string in the field name or description, by defining `id` and `query`\n \n  Only custom fields can be queried, `type` must be set to `custom`.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getTrashedFieldsPaginated": {
    "comment": "Get fields in trash paginated",
    "doc": "Get fields in trash paginated\n  Returns a [paginated](#pagination) list of fields in the trash. The list may be restricted to fields whose field name or description partially match a string.\n \n  Only custom fields can be queried, `type` must be set to `custom`.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateCustomField": {
    "comment": "Update custom field",
    "doc": "Update custom field\n  Updates a custom field.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getContextsForField": {
    "comment": "Get custom field contexts",
    "doc": "Get custom field contexts\n  Returns a [paginated](#pagination) list of [ contexts](https://confluence.atlassian.com/adminjiracloud/what-are-custom-field-contexts-991923859.html) for a custom field. Contexts can be returned as follows:\n \n    With no other parameters set, all contexts.\n    By defining `id` only, all contexts from the list of IDs.\n    By defining `isAnyIssueType`, limit the list of contexts returned to either those that apply to all issue types (true) or those that apply to only a subset of issue types (false)\n    By defining `isGlobalContext`, limit the list of contexts return to either those that apply to all projects (global contexts) (true) or those that apply to only a subset of projects (false).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createCustomFieldContext": {
    "comment": "Create custom field context",
    "doc": "Create custom field context\n  Creates a custom field context.\n \n  If `projectIds` is empty, a global context is created. A global context is one that applies to all project. If `issueTypeIds` is empty, the context applies to all issue types.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getDefaultValues": {
    "comment": "Get custom field contexts default values",
    "doc": "Get custom field contexts default values\n  Returns a [paginated](#pagination) list of defaults for a custom field. The results can be filtered by `contextId`, otherwise all values are returned. If no defaults are set for a context, nothing is returned.\n  The returned object depends on type of the custom field:\n \n    `CustomFieldContextDefaultValueDate` (type `datepicker`) for date fields.\n    `CustomFieldContextDefaultValueDateTime` (type `datetimepicker`) for date-time fields.\n    `CustomFieldContextDefaultValueSingleOption` (type `option.single`) for single choice select lists and radio buttons.\n    `CustomFieldContextDefaultValueMultipleOption` (type `option.multiple`) for multiple choice select lists and checkboxes.\n    `CustomFieldContextDefaultValueCascadingOption` (type `option.cascading`) for cascading select lists.\n    `CustomFieldContextSingleUserPickerDefaults` (type `single.user.select`) for single users.\n    `CustomFieldContextDefaultValueMultiUserPicker` (type `multi.user.select`) for user lists.\n    `CustomFieldContextDefaultValueSingleGroupPicker` (type `grouppicker.single`) for single choice group pickers.\n    `CustomFieldContextDefaultValueMultipleGroupPicker` (type `grouppicker.multiple`) for multiple choice group pickers.\n    `CustomFieldContextDefaultValueURL` (type `url`) for URLs.\n    `CustomFieldContextDefaultValueProject` (type `project`) for project pickers.\n    `CustomFieldContextDefaultValueFloat` (type `float`) for floats (floating-point numbers).\n    `CustomFieldContextDefaultValueLabels` (type `labels`) for labels.\n    `CustomFieldContextDefaultValueTextField` (type `textfield`) for text fields.\n    `CustomFieldContextDefaultValueTextArea` (type `textarea`) for text area fields.\n    `CustomFieldContextDefaultValueReadOnly` (type `readonly`) for read only (text) fields.\n    `CustomFieldContextDefaultValueMultipleVersion` (type `version.multiple`) for single choice version pickers.\n    `CustomFieldContextDefaultValueSingleVersion` (type `version.single`) for multiple choice version pickers.\n \n  Forge custom fields [types](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/#data-types) are also supported, returning:\n \n    `CustomFieldContextDefaultValueForgeStringFieldBean` (type `forge.string`) for Forge string fields.\n    `CustomFieldContextDefaultValueForgeMultiStringFieldBean` (type `forge.string.list`) for Forge string collection fields.\n    `CustomFieldContextDefaultValueForgeObjectFieldBean` (type `forge.object`) for Forge object fields.\n    `CustomFieldContextDefaultValueForgeDateTimeFieldBean` (type `forge.datetime`) for Forge date-time fields.\n    `CustomFieldContextDefaultValueForgeGroupFieldBean` (type `forge.group`) for Forge group fields.\n    `CustomFieldContextDefaultValueForgeMultiGroupFieldBean` (type `forge.group.list`) for Forge group collection fields.\n    `CustomFieldContextDefaultValueForgeNumberFieldBean` (type `forge.number`) for Forge number fields.\n    `CustomFieldContextDefaultValueForgeUserFieldBean` (type `forge.user`) for Forge user fields.\n    `CustomFieldContextDefaultValueForgeMultiUserFieldBean` (type `forge.user.list`) for Forge user collection fields.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setDefaultValues": {
    "comment": "Set custom field contexts default values",
    "doc": "Set custom field contexts default values\n  Sets default for contexts of a custom field. Default are defined using these objects:\n \n    `CustomFieldContextDefaultValueDate` (type `datepicker`) for date fields.\n    `CustomFieldContextDefaultValueDateTime` (type `datetimepicker`) for date-time fields.\n    `CustomFieldContextDefaultValueSingleOption` (type `option.single`) for single choice select lists and radio buttons.\n    `CustomFieldContextDefaultValueMultipleOption` (type `option.multiple`) for multiple choice select lists and checkboxes.\n    `CustomFieldContextDefaultValueCascadingOption` (type `option.cascading`) for cascading select lists.\n    `CustomFieldContextSingleUserPickerDefaults` (type `single.user.select`) for single users.\n    `CustomFieldContextDefaultValueMultiUserPicker` (type `multi.user.select`) for user lists.\n    `CustomFieldContextDefaultValueSingleGroupPicker` (type `grouppicker.single`) for single choice group pickers.\n    `CustomFieldContextDefaultValueMultipleGroupPicker` (type `grouppicker.multiple`) for multiple choice group pickers.\n    `CustomFieldContextDefaultValueURL` (type `url`) for URLs.\n    `CustomFieldContextDefaultValueProject` (type `project`) for project pickers.\n    `CustomFieldContextDefaultValueFloat` (type `float`) for floats (floating-point numbers).\n    `CustomFieldContextDefaultValueLabels` (type `labels`) for labels.\n    `CustomFieldContextDefaultValueTextField` (type `textfield`) for text fields.\n    `CustomFieldContextDefaultValueTextArea` (type `textarea`) for text area fields.\n    `CustomFieldContextDefaultValueReadOnly` (type `readonly`) for read only (text) fields.\n    `CustomFieldContextDefaultValueMultipleVersion` (type `version.multiple`) for single choice version pickers.\n    `CustomFieldContextDefaultValueSingleVersion` (type `version.single`) for multiple choice version pickers.\n \n  Forge custom fields [types](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/#data-types) are also supported, returning:\n \n    `CustomFieldContextDefaultValueForgeStringFieldBean` (type `forge.string`) for Forge string fields.\n    `CustomFieldContextDefaultValueForgeMultiStringFieldBean` (type `forge.string.list`) for Forge string collection fields.\n    `CustomFieldContextDefaultValueForgeObjectFieldBean` (type `forge.object`) for Forge object fields.\n    `CustomFieldContextDefaultValueForgeDateTimeFieldBean` (type `forge.datetime`) for Forge date-time fields.\n    `CustomFieldContextDefaultValueForgeGroupFieldBean` (type `forge.group`) for Forge group fields.\n    `CustomFieldContextDefaultValueForgeMultiGroupFieldBean` (type `forge.group.list`) for Forge group collection fields.\n    `CustomFieldContextDefaultValueForgeNumberFieldBean` (type `forge.number`) for Forge number fields.\n    `CustomFieldContextDefaultValueForgeUserFieldBean` (type `forge.user`) for Forge user fields.\n    `CustomFieldContextDefaultValueForgeMultiUserFieldBean` (type `forge.user.list`) for Forge user collection fields.\n \n  Only one type of default object can be included in a request. To remove a default for a context, set the default parameter to `null`.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeMappingsForContexts": {
    "comment": "Get issue types for custom field context",
    "doc": "Get issue types for custom field context\n  Returns a [paginated](#pagination) list of context to issue type mappings for a custom field. Mappings are returned for all contexts or a list of contexts. Mappings are ordered first by context ID and then by issue type ID.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getCustomFieldContextsForProjectsAndIssueTypes": {
    "comment": "Get custom field contexts for projects and issue types",
    "doc": "Get custom field contexts for projects and issue types\n  Returns a [paginated](#pagination) list of project and issue type mappings and, for each mapping, the ID of a [custom field context](https://confluence.atlassian.com/x/k44fOw) that applies to the project and issue type.\n \n  If there is no custom field context assigned to the project then, if present, the custom field context that applies to all projects is returned if it also applies to the issue type or all issue types. If a custom field context is not found, the returned custom field context ID is `null`.\n \n  Duplicate project and issue type mappings cannot be provided in the request.\n \n  The order of the returned values is the same as provided in the request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectContextMapping": {
    "comment": "Get project mappings for custom field context",
    "doc": "Get project mappings for custom field context\n  Returns a [paginated](#pagination) list of context to project mappings for a custom field. The result can be filtered by `contextId`. Otherwise, all mappings are returned. Invalid IDs are ignored.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteCustomFieldContext": {
    "comment": "Delete custom field context",
    "doc": "Delete custom field context\n  Deletes a [ custom field context](https://confluence.atlassian.com/adminjiracloud/what-are-custom-field-contexts-991923859.html).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateCustomFieldContext": {
    "comment": "Update custom field context",
    "doc": "Update custom field context\n  Updates a [ custom field context](https://confluence.atlassian.com/adminjiracloud/what-are-custom-field-contexts-991923859.html).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addIssueTypesToContext": {
    "comment": "Add issue types to context",
    "doc": "Add issue types to context\n  Adds issue types to a custom field context, appending the issue types to the issue types list.\n \n  A custom field context without any issue types applies to all issue types. Adding issue types to such a custom field context would result in it applying to only the listed issue types.\n \n  If any of the issue types exists in the custom field context, the operation fails and no issue types are added.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeIssueTypesFromContext": {
    "comment": "Remove issue types from context",
    "doc": "Remove issue types from context\n  Removes issue types from a custom field context.\n \n  A custom field context without any issue types applies to all issue types.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getOptionsForContext": {
    "comment": "Get custom field options (context)",
    "doc": "Get custom field options (context)\n  Returns a [paginated](#pagination) list of all custom field option for a context. Options are returned first then cascading options, in the order they display in Jira.\n \n  This operation works for custom field options created in Jira or the operations from this resource. To work with issue field select list options created for Connect apps use the [Issue custom field options (apps)](#api-group-issue-custom-field-options--apps-) operations.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createCustomFieldOption": {
    "comment": "Create custom field options (context)",
    "doc": "Create custom field options (context)\n  Creates options and, where the custom select field is of the type Select List (cascading), cascading options for a custom select field. The options are added to a context of the field.\n \n  The maximum number of options that can be created per request is 1000 and each field can have a maximum of 10000 options.\n \n  This operation works for custom field options created in Jira or the operations from this resource. To work with issue field select list options created for Connect apps use the [Issue custom field options (apps)](#api-group-issue-custom-field-options--apps-) operations.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateCustomFieldOption": {
    "comment": "Update custom field options (context)",
    "doc": "Update custom field options (context)\n  Updates the options of a custom field.\n \n  If any of the options are not found, no options are updated. Options where the values in the request match the current values aren't updated and aren't reported in the response.\n \n  Note that this operation only works for issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource, it cannot be used with issue field select list options created by Connect apps.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "reorderCustomFieldOptions": {
    "comment": "Reorder custom field options (context)",
    "doc": "Reorder custom field options (context)\n  Changes the order of custom field options or cascading options in a context.\n \n  This operation works for custom field options created in Jira or the operations from this resource. To work with issue field select list options created for Connect apps use the [Issue custom field options (apps)](#api-group-issue-custom-field-options--apps-) operations.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteCustomFieldOption": {
    "comment": "Delete custom field options (context)",
    "doc": "Delete custom field options (context)\n  Deletes a custom field option.\n \n  Options with cascading options cannot be deleted without deleting the cascading options first.\n \n  This operation works for custom field options created in Jira or the operations from this resource. To work with issue field select list options created for Connect apps use the [Issue custom field options (apps)](#api-group-issue-custom-field-options--apps-) operations.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "replaceCustomFieldOption": {
    "comment": "Replace custom field options",
    "doc": "Replace custom field options\n  Replaces the options of a custom field.\n \n  Note that this operation only works for issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource, it cannot be used with issue field select list options created by Connect or Forge apps.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "assignProjectsToCustomFieldContext": {
    "comment": "Assign custom field context to projects",
    "doc": "Assign custom field context to projects\n  Assigns a custom field context to projects.\n \n  If any project in the request is assigned to any context of the custom field, the operation fails.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeCustomFieldContextFromProjects": {
    "comment": "Remove custom field context from projects",
    "doc": "Remove custom field context from projects\n  Removes a custom field context from projects.\n \n  A custom field context without any projects applies to all projects. Removing all projects from a custom field context would result in it applying to all projects.\n \n  If any project in the request is not assigned to the context, or the operation would result in two global contexts for the field, the operation fails.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getContextsForFieldDeprecated": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get contexts for a field\n  Returns a [paginated](#pagination) list of the contexts a field is used in. Deprecated, use [ Get custom field contexts](#api-rest-api-3-field-fieldId-context-get).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getScreensForField": {
    "comment": "Get screens for a field",
    "doc": "Get screens for a field\n  Returns a [paginated](#pagination) list of the screens a field is used in.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllIssueFieldOptions": {
    "comment": "Get all issue field options",
    "doc": "Get all issue field options\n  Returns a [paginated](#pagination) list of all the options of a select list issue field. A select list issue field is a type of [issue field](https://developer.atlassian.com/cloud/jira/platform/modules/issue-field/) that enables a user to select a value from a list of options.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "createIssueFieldOption": {
    "comment": "Create issue field option",
    "doc": "Create issue field option\n  Creates an option for a select list issue field.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  Each field can have a maximum of 10000 options, and each option can have a maximum of 10000 scopes.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "getSelectableIssueFieldOptions": {
    "comment": "Get selectable issue field options",
    "doc": "Get selectable issue field options\n  Returns a [paginated](#pagination) list of options for a select list issue field that can be viewed and selected by the user.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getVisibleIssueFieldOptions": {
    "comment": "Get visible issue field options",
    "doc": "Get visible issue field options\n  Returns a [paginated](#pagination) list of options for a select list issue field that can be viewed by the user.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deleteIssueFieldOption": {
    "comment": "Delete issue field option",
    "doc": "Delete issue field option\n  Deletes an option from a select list issue field.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "getIssueFieldOption": {
    "comment": "Get issue field option",
    "doc": "Get issue field option\n  Returns an option from a select list issue field.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "updateIssueFieldOption": {
    "comment": "Update issue field option",
    "doc": "Update issue field option\n  Updates or creates an option for a select list issue field. This operation requires that the option ID is provided when creating an option, therefore, the option ID needs to be specified as a path and body parameter. The option ID provided in the path and body must be identical.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "replaceIssueFieldOption": {
    "comment": "Replace issue field option",
    "doc": "Replace issue field option\n  Deselects an issue-field select-list option from all issues where it is selected. A different option can be selected to replace the deselected option. The update can also be limited to a smaller set of issues by using a JQL query.\n \n  Connect and Forge app users with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) can override the screen security configuration using `overrideScreenSecurity` and `overrideEditableFlag`.\n \n  This is an [asynchronous operation](#async). The response object contains a link to the long-running task.\n \n  Note that this operation only works for issue field select list options added by Connect apps, it cannot be used with issue field select list options created in Jira or using operations from the [Issue custom field options](#api-group-Issue-custom-field-options) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). Jira permissions are not required for the app providing the field."
  },
  "deleteCustomField": {
    "comment": "Delete custom field",
    "doc": "Delete custom field\n  Deletes a custom field. The custom field is deleted whether it is in the trash or not. See [Edit or delete a custom field](https://confluence.atlassian.com/x/Z44fOw) for more information on trashing and deleting custom fields.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "restoreCustomField": {
    "comment": "Restore custom field from trash",
    "doc": "Restore custom field from trash\n  Restores a custom field from trash. See [Edit or delete a custom field](https://confluence.atlassian.com/x/Z44fOw) for more information on trashing and deleting custom fields.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "trashCustomField": {
    "comment": "Move custom field to trash",
    "doc": "Move custom field to trash\n  Moves a custom field to trash. See [Edit or delete a custom field](https://confluence.atlassian.com/x/Z44fOw) for more information on trashing and deleting custom fields.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllFieldConfigurations": {
    "comment": "Get all field configurations",
    "doc": "Get all field configurations\n  Returns a [paginated](#pagination) list of field configurations. The list can be for all field configurations or a subset determined by any combination of these criteria:\n \n    a list of field configuration item IDs.\n    whether the field configuration is a default.\n    whether the field configuration name or description contains a query string.\n \n  Only field configurations used in company-managed (classic) projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createFieldConfiguration": {
    "comment": "Create field configuration",
    "doc": "Create field configuration\n  Creates a field configuration. The field configuration is created with the same field properties as the default configuration, with all the fields being optional.\n \n  This operation can only create configurations for use in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteFieldConfiguration": {
    "comment": "Delete field configuration",
    "doc": "Delete field configuration\n  Deletes a field configuration.\n \n  This operation can only delete configurations used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateFieldConfiguration": {
    "comment": "Update field configuration",
    "doc": "Update field configuration\n  Updates a field configuration. The name and the description provided in the request override the existing values.\n \n  This operation can only update configurations used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFieldConfigurationItems": {
    "comment": "Get field configuration items",
    "doc": "Get field configuration items\n  Returns a [paginated](#pagination) list of all fields for a configuration.\n \n  Only the fields from configurations used in company-managed (classic) projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateFieldConfigurationItems": {
    "comment": "Update field configuration items",
    "doc": "Update field configuration items\n  Updates fields in a field configuration. The properties of the field configuration fields provided override the existing values.\n \n  This operation can only update field configurations used in company-managed (classic) projects.\n \n  The operation can set the renderer for text fields to the default text renderer (`text-renderer`) or wiki style renderer (`wiki-renderer`). However, the renderer cannot be updated for fields using the autocomplete renderer (`autocomplete-renderer`).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllFieldConfigurationSchemes": {
    "comment": "Get all field configuration schemes",
    "doc": "Get all field configuration schemes\n  Returns a [paginated](#pagination) list of field configuration schemes.\n \n  Only field configuration schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createFieldConfigurationScheme": {
    "comment": "Create field configuration scheme",
    "doc": "Create field configuration scheme\n  Creates a field configuration scheme.\n \n  This operation can only create field configuration schemes used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFieldConfigurationSchemeMappings": {
    "comment": "Get field configuration issue type items",
    "doc": "Get field configuration issue type items\n  Returns a [paginated](#pagination) list of field configuration issue type items.\n \n  Only items used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFieldConfigurationSchemeProjectMapping": {
    "comment": "Get field configuration schemes for projects",
    "doc": "Get field configuration schemes for projects\n  Returns a [paginated](#pagination) list of field configuration schemes and, for each scheme, a list of the projects that use it.\n \n  The list is sorted by field configuration scheme ID. The first item contains the list of project IDs assigned to the default field configuration scheme.\n \n  Only field configuration schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "assignFieldConfigurationSchemeToProject": {
    "comment": "Assign field configuration scheme to project",
    "doc": "Assign field configuration scheme to project\n  Assigns a field configuration scheme to a project. If the field configuration scheme ID is `null`, the operation assigns the default field configuration scheme.\n \n  Field configuration schemes can only be assigned to classic projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteFieldConfigurationScheme": {
    "comment": "Delete field configuration scheme",
    "doc": "Delete field configuration scheme\n  Deletes a field configuration scheme.\n \n  This operation can only delete field configuration schemes used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateFieldConfigurationScheme": {
    "comment": "Update field configuration scheme",
    "doc": "Update field configuration scheme\n  Updates a field configuration scheme.\n \n  This operation can only update field configuration schemes used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setFieldConfigurationSchemeMapping": {
    "comment": "Assign issue types to field configurations",
    "doc": "Assign issue types to field configurations\n  Assigns issue types to field configurations on field configuration scheme.\n \n  This operation can only modify field configuration schemes used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeIssueTypesFromGlobalFieldConfigurationScheme": {
    "comment": "Remove issue types from field configuration scheme",
    "doc": "Remove issue types from field configuration scheme\n  Removes issue types from the field configuration scheme.\n \n  This operation can only modify field configuration schemes used in company-managed (classic) projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createFilter": {
    "comment": "Create filter",
    "doc": "Create filter\n  Creates a filter. The filter is shared according to the [default share scope](#api-rest-api-3-filter-post). The filter is not selected as a favorite.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getDefaultShareScope": {
    "comment": "Get default share scope",
    "doc": "Get default share scope\n  Returns the default sharing settings for new filters and dashboards for a user.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "setDefaultShareScope": {
    "comment": "Set default share scope",
    "doc": "Set default share scope\n  Sets the default sharing for new filters and dashboards for a user.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getFavouriteFilters": {
    "comment": "Get favorite filters",
    "doc": "Get favorite filters\n  Returns the visible favorite filters of the user.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: A favorite filter is only visible to the user where the filter is:\n \n    owned by the user.\n    shared with a group that the user is a member of.\n    shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    shared with a public project.\n    shared with the public.\n \n  For example, if the user favorites a public filter that is subsequently made private that filter is not returned by this operation."
  },
  "getMyFilters": {
    "comment": "Get my filters",
    "doc": "Get my filters\n  Returns the filters owned by the user. If `includeFavourites` is `true`, the user's visible favorite filters are also returned.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, a favorite filters is only visible to the user where the filter is:\n \n    owned by the user.\n    shared with a group that the user is a member of.\n    shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    shared with a public project.\n    shared with the public.\n \n  For example, if the user favorites a public filter that is subsequently made private that filter is not returned by this operation."
  },
  "getFiltersPaginated": {
    "comment": "Search for filters",
    "doc": "Search for filters\n  Returns a [paginated](#pagination) list of filters. Use this operation to get:\n \n    specific filters, by defining `id` only.\n    filters that match all of the specified attributes. For example, all filters for a user with a particular word in their name. When multiple attributes are specified only filters matching all attributes are returned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None, however, only the following filters that match the query parameters are returned:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "deleteFilter": {
    "comment": "Delete filter",
    "doc": "Delete filter\n  Delete a filter.\n \n  [Permissions](#permissions) required: Permission to access Jira, however filters can only be deleted by the creator of the filter or a user with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFilter": {
    "comment": "Get filter",
    "doc": "Get filter\n  Returns a filter.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None, however, the filter is only returned where it is:\n \n    owned by the user.\n    shared with a group that the user is a member of.\n    shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    shared with a public project.\n    shared with the public."
  },
  "updateFilter": {
    "comment": "Update filter",
    "doc": "Update filter\n  Updates a filter. Use this operation to update a filter's name, description, JQL, or sharing.\n \n  [Permissions](#permissions) required: Permission to access Jira, however the user must own the filter."
  },
  "resetColumns": {
    "comment": "Reset columns",
    "doc": "Reset columns\n  Reset the user's column configuration for the filter to the default.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, columns are only reset for:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "getColumns": {
    "comment": "Get columns",
    "doc": "Get columns\n  Returns the columns configured for a filter. The column configuration is used when the filter's results are viewed in List View with the Columns set to Filter.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None, however, column details are only returned for:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "setColumns": {
    "comment": "Set columns",
    "doc": "Set columns\n  Sets the columns for a filter. Only navigable fields can be set as columns. Use [Get fields](#api-rest-api-3-field-get) to get the list fields in Jira. A navigable field has `navigable` set to `true`.\n \n  The parameters for this resource are expressed as HTML form data. For example, in curl:\n \n  `curl -X PUT -d columns=summary -d columns=description https://your-domain.atlassian.net/rest/api/3/filter/10000/columns`\n \n  [Permissions](#permissions) required: Permission to access Jira, however, columns are only set for:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "deleteFavouriteForFilter": {
    "comment": "Remove filter as favorite",
    "doc": "Remove filter as favorite\n  Removes a filter as a favorite for the user. Note that this operation only removes filters visible to the user from the user's favorites list. For example, if the user favorites a public filter that is subsequently made private (and is therefore no longer visible on their favorites list) they cannot remove it from their favorites list.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "setFavouriteForFilter": {
    "comment": "Add filter as favorite",
    "doc": "Add filter as favorite\n  Add a filter as a favorite for the user.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, the user can only favorite:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "changeFilterOwner": {
    "comment": "Change filter owner",
    "doc": "Change filter owner\n  Changes the owner of the filter.\n \n  [Permissions](#permissions) required: Permission to access Jira. However, the user must own the filter or have the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getSharePermissions": {
    "comment": "Get share permissions",
    "doc": "Get share permissions\n  Returns the share permissions for a filter. A filter can be shared with groups, projects, all logged-in users, or the public. Sharing with all logged-in users or the public is known as a global share permission.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None, however, share permissions are only returned for:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "addSharePermission": {
    "comment": "Add share permission",
    "doc": "Add share permission\n  Add a share permissions to a filter. If you add a global share permission (one for all logged-in users or the public) it will overwrite all share permissions for the filter.\n \n  Be aware that this operation uses different objects for updating share permissions compared to [Update filter](#api-rest-api-3-filter-id-put).\n \n  [Permissions](#permissions) required: Share dashboards and filters [global permission](https://confluence.atlassian.com/x/x4dKLg) and the user must own the filter."
  },
  "deleteSharePermission": {
    "comment": "Delete share permission",
    "doc": "Delete share permission\n  Deletes a share permission from a filter.\n \n  [Permissions](#permissions) required: Permission to access Jira and the user must own the filter."
  },
  "getSharePermission": {
    "comment": "Get share permission",
    "doc": "Get share permission\n  Returns a share permission for a filter. A filter can be shared with groups, projects, all logged-in users, or the public. Sharing with all logged-in users or the public is known as a global share permission.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None, however, a share permission is only returned for:\n \n    filters owned by the user.\n    filters shared with a group that the user is a member of.\n    filters shared with a private project that the user has Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for.\n    filters shared with a public project.\n    filters shared with the public."
  },
  "removeGroup": {
    "comment": "Remove group",
    "doc": "Remove group\n  Deletes a group.\n \n  [Permissions](#permissions) required: Site administration (that is, member of the site-admin strategic [group](https://confluence.atlassian.com/x/24xjL))."
  },
  "getGroup": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get group\n  This operation is deprecated, use [`group/member`](#api-rest-api-3-group-member-get).\n \n  Returns all users in a group.\n \n  [Permissions](#permissions) required: either of:\n \n    Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createGroup": {
    "comment": "Create group",
    "doc": "Create group\n  Creates a group.\n \n  [Permissions](#permissions) required: Site administration (that is, member of the site-admin [group](https://confluence.atlassian.com/x/24xjL))."
  },
  "bulkGetGroups": {
    "comment": "Bulk get groups",
    "doc": "Bulk get groups\n  Returns a [paginated](#pagination) list of groups.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getUsersFromGroup": {
    "comment": "Get users from group",
    "doc": "Get users from group\n  Returns a [paginated](#pagination) list of all users in a group.\n \n  Note that users are ordered by username, however the username is not returned in the results due to privacy reasons.\n \n  [Permissions](#permissions) required: either of:\n \n    Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeUserFromGroup": {
    "comment": "Remove user from group",
    "doc": "Remove user from group\n  Removes a user from a group.\n \n  [Permissions](#permissions) required: Site administration (that is, member of the site-admin [group](https://confluence.atlassian.com/x/24xjL))."
  },
  "addUserToGroup": {
    "comment": "Add user to group",
    "doc": "Add user to group\n  Adds a user to a group.\n \n  [Permissions](#permissions) required: Site administration (that is, member of the site-admin [group](https://confluence.atlassian.com/x/24xjL))."
  },
  "findGroups": {
    "comment": "Find groups",
    "doc": "Find groups\n  Returns a list of groups whose names contain a query string. A list of group names can be provided to exclude groups from the results.\n \n  The primary use case for this resource is to populate a group picker suggestions list. To this end, the returned object includes the `html` field where the matched query term is highlighted in the group name with the HTML strong tag. Also, the groups list is wrapped in a response object that contains a header for use in the picker, specifically Showing X of Y matching groups.\n \n  The list returns with the groups sorted. If no groups match the list criteria, an empty list is returned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg). Anonymous calls and calls by users without the required permission return an empty list.\n \n  Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg). Without this permission, calls where query is not an exact match to an existing group will return an empty list."
  },
  "findUsersAndGroups": {
    "comment": "Find users and groups",
    "doc": "Find users and groups\n  Returns a list of users and groups matching a string. The string is used:\n \n    for users, to find a case-insensitive match with display name and e-mail address. Note that if a user has hidden their email address in their user profile, partial matches of the email address will not find the user. An exact match is required.\n    for groups, to find a case-sensitive match with group name.\n \n  For example, if the string tin is used, records with the display name Tina, email address sarah@tinplatetraining.com, and the group accounting would be returned.\n \n  Optionally, the search can be refined to:\n \n    the projects and issue types associated with a custom field, such as a user picker. The search can then be further refined to return only users and groups that have permission to view specific:\n \n    projects.\n    issue types.\n \n  If multiple projects or issue types are specified, they must be a subset of those enabled for the custom field or no results are returned. For example, if a field is enabled for projects A, B, and C then the search could be limited to projects B and C. However, if the search is limited to projects B and D, nothing is returned.\n    not return Connect app users and groups.\n    return groups that have a case-insensitive match with the query.\n \n  The primary use case for this resource is to populate a picker field suggestion list with users or groups. To this end, the returned object includes an `html` field for each list. This field highlights the matched query term in the item name with the HTML strong tag. Also, each list is wrapped in a response object that contains a header for use in a picker, specifically Showing X of Y matching groups.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "getLicense": {
    "comment": "Get license",
    "doc": "Get license\n  Returns licensing information about the Jira instance.\n \n  [Permissions](#permissions) required: None."
  },
  "createIssue": {
    "comment": "Create issue",
    "doc": "Create issue\n  Creates an issue or, where the option to create subtasks is enabled in Jira, a subtask. A transition may be applied, to move the issue or subtask to a workflow step other than the default start step, and issue properties set.\n \n  The content of the issue or subtask is defined using `update` and `fields`. The fields that can be set in the issue or subtask are determined using the [ Get create issue metadata](#api-rest-api-3-issue-createmeta-get). These are the same fields that appear on the issue's create screen. Note that the `description`, `environment`, and any `textarea` type custom fields (multi-line text fields) take Atlassian Document Format content. Single line custom fields (`textfield`) accept a string and don't handle Atlassian Document Format content.\n \n  Creating a subtask differs from creating an issue as follows:\n \n    `issueType` must be set to a subtask issue type (use [ Get create issue metadata](#api-rest-api-3-issue-createmeta-get) to find subtask issue types).\n    `parent` must contain the ID or key of the parent issue.\n \n  In a next-gen project any issue may be made a child providing that the parent and child are members of the same project.\n \n  [Permissions](#permissions) required: Browse projects and Create issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project in which the issue or subtask is created."
  },
  "archiveIssuesAsync": {
    "comment": "Archive issue(s) by JQL",
    "doc": "Archive issue(s) by JQL\n  Enables admins to archive up to 100,000 issues in a single request using JQL, returning the URL to check the status of the submitted request.\n \n  You can use the [get task](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-tasks/#api-rest-api-3-task-taskid-get) and [cancel task](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-tasks/#api-rest-api-3-task-taskid-cancel-post) APIs to manage the request.\n \n  Note that:\n \n    you can't archive subtasks directly, only through their parent issues\n    you can only archive issues from software, service management, and business projects\n \n  [Permissions](#permissions) required: Jira admin or site admin: [global permission](https://confluence.atlassian.com/x/x4dKLg)\n \n  License required: Premium or Enterprise\n \n  Signed-in users only: This API can't be accessed anonymously.\n \n  Rate limiting: Only a single request per jira instance can be active at any given time."
  },
  "archiveIssues": {
    "comment": "Archive issue(s) by issue ID/key",
    "doc": "Archive issue(s) by issue ID/key\n  Enables admins to archive up to 1000 issues in a single request using issue ID/key, returning details of the issue(s) archived in the process and the errors encountered, if any.\n \n  Note that:\n \n    you can't archive subtasks directly, only through their parent issues\n    you can only archive issues from software, service management, and business projects\n \n  [Permissions](#permissions) required: Jira admin or site admin: [global permission](https://confluence.atlassian.com/x/x4dKLg)\n \n  License required: Premium or Enterprise\n \n  Signed-in users only: This API can't be accessed anonymously."
  },
  "createIssues": {
    "comment": "Bulk create issue",
    "doc": "Bulk create issue\n  Creates upto 50 issues and, where the option to create subtasks is enabled in Jira, subtasks. Transitions may be applied, to move the issues or subtasks to a workflow step other than the default start step, and issue properties set.\n \n  The content of each issue or subtask is defined using `update` and `fields`. The fields that can be set in the issue or subtask are determined using the [ Get create issue metadata](#api-rest-api-3-issue-createmeta-get). These are the same fields that appear on the issues' create screens. Note that the `description`, `environment`, and any `textarea` type custom fields (multi-line text fields) take Atlassian Document Format content. Single line custom fields (`textfield`) accept a string and don't handle Atlassian Document Format content.\n \n  Creating a subtask differs from creating an issue as follows:\n \n    `issueType` must be set to a subtask issue type (use [ Get create issue metadata](#api-rest-api-3-issue-createmeta-get) to find subtask issue types).\n    `parent` the must contain the ID or key of the parent issue.\n \n  [Permissions](#permissions) required: Browse projects and Create issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project in which each issue or subtask is created."
  },
  "bulkFetchIssues": {
    "comment": "Bulk fetch issues",
    "doc": "Bulk fetch issues\n  Returns the details for a set of requested issues. You can request up to 100 issues.\n \n  Each issue is identified by its ID or key, however, if the identifier doesn't match an issue, a case-insensitive search and check for moved issues is performed. If a matching issue is found its details are returned, a 302 or other redirect is not returned.\n \n  Issues will be returned in ascending `id` order. If there are errors, Jira will return a list of issues which couldn't be fetched along with error messages.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getCreateIssueMeta": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get create issue metadata\n  Returns details of projects, issue types within projects, and, when requested, the create screen fields for each issue type for the user. Use the information to populate the requests in [ Create issue](#api-rest-api-3-issue-post) and [Create issues](#api-rest-api-3-issue-bulk-post).\n \n  Deprecated, see [Create Issue Meta Endpoint Deprecation Notice](https://developer.atlassian.com/cloud/jira/platform/changelog/#CHANGE-1304).\n \n  The request can be restricted to specific projects or issue types using the query parameters. The response will contain information for the valid projects, issue types, or project and issue type combinations requested. Note that invalid project, issue type, or project and issue type combinations do not generate errors.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Create issues [project permission](https://confluence.atlassian.com/x/yodKLg) in the requested projects."
  },
  "getCreateIssueMetaIssueTypes": {
    "comment": "Get create metadata issue types for a project",
    "doc": "Get create metadata issue types for a project\n  Returns a page of issue type metadata for a specified project. Use the information to populate the requests in [ Create issue](#api-rest-api-3-issue-post) and [Create issues](#api-rest-api-3-issue-bulk-post).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Create issues [project permission](https://confluence.atlassian.com/x/yodKLg) in the requested projects."
  },
  "getCreateIssueMetaIssueTypeId": {
    "comment": "Get create field metadata for a project and issue type id",
    "doc": "Get create field metadata for a project and issue type id\n  Returns a page of field metadata for a specified project and issuetype id. Use the information to populate the requests in [ Create issue](#api-rest-api-3-issue-post) and [Create issues](#api-rest-api-3-issue-bulk-post).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Create issues [project permission](https://confluence.atlassian.com/x/yodKLg) in the requested projects."
  },
  "getIssueLimitReport": {
    "comment": "Get issue limit report",
    "doc": "Get issue limit report\n  Returns all issues breaching and approaching per-issue limits.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) is required for the project the issues are in. Results may be incomplete otherwise\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssuePickerResource": {
    "comment": "Get issue picker suggestions",
    "doc": "Get issue picker suggestions\n  Returns lists of issues matching a query string. Use this resource to provide auto-completion suggestions when the user is looking for an issue using a word or string.\n \n  This operation returns two lists:\n \n    `History Search` which includes issues from the user's history of created, edited, or viewed issues that contain the string in the `query` parameter.\n    `Current Search` which includes issues that match the JQL expression in `currentJQL` and contain the string in the `query` parameter.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "bulkSetIssuesPropertiesList": {
    "comment": "Bulk set issues properties by list",
    "doc": "Bulk set issues properties by list\n  Sets or updates a list of entity property values on issues. A list of up to 10 entity properties can be specified along with up to 10,000 issues on which to set or update that list of entity properties.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON. The maximum length of single issue property value is 32768 characters. This operation can be accessed anonymously.\n \n  This operation is:\n \n    transactional, either all properties are updated in all eligible issues or, when errors occur, no properties are updated.\n    [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Edit issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "bulkSetIssuePropertiesByIssue": {
    "comment": "Bulk set issue properties by issue",
    "doc": "Bulk set issue properties by issue\n  Sets or updates entity property values on issues. Up to 10 entity properties can be specified for each issue and up to 100 issues included in the request.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON.\n \n  This operation is:\n \n    [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n    non-transactional. Updating some entities may fail. Such information will available in the task result.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Edit issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "bulkDeleteIssueProperty": {
    "comment": "Bulk delete issue property",
    "doc": "Bulk delete issue property\n  Deletes a property value from multiple issues. The issues to be updated can be specified by filter criteria.\n \n  The criteria the filter used to identify eligible issues are:\n \n    `entityIds` Only issues from this list are eligible.\n    `currentValue` Only issues with the property set to this value are eligible.\n \n  If both criteria is specified, they are joined with the logical AND: only issues that satisfy both criteria are considered eligible.\n \n  If no filter criteria are specified, all the issues visible to the user and where the user has the EDIT\\_ISSUES permission for the issue are considered eligible.\n \n  This operation is:\n \n    transactional, either the property is deleted from all eligible issues or, when errors occur, no properties are deleted.\n    [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [ project permission](https://confluence.atlassian.com/x/yodKLg) for each project containing issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Edit issues [project permission](https://confluence.atlassian.com/x/yodKLg) for each issue."
  },
  "bulkSetIssueProperty": {
    "comment": "Bulk set issue property",
    "doc": "Bulk set issue property\n  Sets a property value on multiple issues.\n \n  The value set can be a constant or determined by a [Jira expression](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/). Expressions must be computable with constant complexity when applied to a set of issues. Expressions must also comply with the [restrictions](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/#restrictions) that apply to all Jira expressions.\n \n  The issues to be updated can be specified by a filter.\n \n  The filter identifies issues eligible for update using these criteria:\n \n    `entityIds` Only issues from this list are eligible.\n    `currentValue` Only issues with the property set to this value are eligible.\n    `hasProperty`:\n \n    If true, only issues with the property are eligible.\n    If false, only issues without the property are eligible.\n \n  If more than one criteria is specified, they are joined with the logical AND: only issues that satisfy all criteria are eligible.\n \n  If an invalid combination of criteria is provided, an error is returned. For example, specifying a `currentValue` and `hasProperty` as false would not match any issues (because without the property the property cannot have a value).\n \n  The filter is optional. Without the filter all the issues visible to the user and where the user has the EDIT\\_ISSUES permission for the issue are considered eligible.\n \n  This operation is:\n \n    transactional, either all eligible issues are updated or, when errors occur, none are updated.\n    [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for each project containing issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Edit issues [project permission](https://confluence.atlassian.com/x/yodKLg) for each issue."
  },
  "unarchiveIssues": {
    "comment": "Unarchive issue(s) by issue keys/ID",
    "doc": "Unarchive issue(s) by issue keys/ID\n  Enables admins to unarchive up to 1000 issues in a single request using issue ID/key, returning details of the issue(s) unarchived in the process and the errors encountered, if any.\n \n  Note that:\n \n    you can't unarchive subtasks directly, only through their parent issues\n    you can only unarchive issues from software, service management, and business projects\n \n  [Permissions](#permissions) required: Jira admin or site admin: [global permission](https://confluence.atlassian.com/x/x4dKLg)\n \n  License required: Premium or Enterprise\n \n  Signed-in users only: This API can't be accessed anonymously."
  },
  "getIsWatchingIssueBulk": {
    "comment": "Get is watching issue bulk",
    "doc": "Get is watching issue bulk\n  Returns, for the user, details of the watched status of issues from a list. If an issue ID is invalid, the returned watched status is `false`.\n \n  This operation requires the Allow users to watch issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "deleteIssue": {
    "comment": "Delete issue",
    "doc": "Delete issue\n  Deletes an issue.\n \n  An issue cannot be deleted if it has one or more subtasks. To delete an issue with subtasks, set `deleteSubtasks`. This causes the issue's subtasks to be deleted with the issue.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Delete issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getIssue": {
    "comment": "Get issue",
    "doc": "Get issue\n  Returns the details for an issue.\n \n  The issue is identified by its ID or key, however, if the identifier doesn't match an issue, a case-insensitive search and check for moved issues is performed. If a matching issue is found its details are returned, a 302 or other redirect is not returned. The issue key returned in the response is the key of the issue found.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "editIssue": {
    "comment": "Edit issue",
    "doc": "Edit issue\n  Edits an issue. Issue properties may be updated as part of the edit. Please note that issue transition will be ignored as it is not supported yet.\n \n  The edits to the issue's fields are defined using `update` and `fields`. The fields that can be edited are determined using [ Get edit issue metadata](#api-rest-api-3-issue-issueIdOrKey-editmeta-get).\n \n  The parent field may be set by key or ID. For standard issue types, the parent may be removed by setting `update.parent.set.none` to true. Note that the `description`, `environment`, and any `textarea` type custom fields (multi-line text fields) take Atlassian Document Format content. Single line custom fields (`textfield`) accept a string and don't handle Atlassian Document Format content.\n \n  Connect apps having an app user with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), and Forge apps acting on behalf of users with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), can override the screen security configuration using `overrideScreenSecurity` and `overrideEditableFlag`.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Edit issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "assignIssue": {
    "comment": "Assign issue",
    "doc": "Assign issue\n  Assigns an issue to a user. Use this operation when the calling user does not have the Edit Issues permission but has the Assign issue permission for the project that the issue is in.\n \n  If `name` or `accountId` is set to:\n \n    `\"-1\"`, the issue is assigned to the default assignee for the project.\n    `null`, the issue is set to unassigned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse Projects and Assign Issues [ project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "addAttachment": {
    "comment": "Add attachment",
    "doc": "Add attachment\n  Adds one or more attachments to an issue. Attachments are posted as multipart/form-data ([RFC 1867](https://www.ietf.org/rfc/rfc1867.txt)).\n \n  Note that:\n \n    The request must have a `X-Atlassian-Token: no-check` header, if not it is blocked. See [Special headers](#special-request-headers) for more information.\n    The name of the multipart/form-data parameter that contains the attachments must be `file`.\n \n  The following examples upload a file called myfile.txt to the issue TEST-123:\n \n  #### curl ####\n \n  curl --location --request POST 'https://your-domain.atlassian.net/rest/api/3/issue/TEST-123/attachments'\n  -u 'email@example.com:<api_token>'\n  -H 'X-Atlassian-Token: no-check'\n  --form 'file=@\"myfile.txt\"'\n \n  #### Node.js ####\n \n  // This code sample uses the 'node-fetch' and 'form-data' libraries:\n  // https://www.npmjs.com/package/node-fetch\n  // https://www.npmjs.com/package/form-data\n  const fetch = require('node-fetch');\n  const FormData = require('form-data');\n  const fs = require('fs');\n \n  const filePath = 'myfile.txt';\n  const form = new FormData();\n  const stats = fs.statSync(filePath);\n  const fileSizeInBytes = stats.size;\n  const fileStream = fs.createReadStream(filePath);\n \n  form.append('file', fileStream, {knownLength: fileSizeInBytes});\n \n  fetch('https://your-domain.atlassian.net/rest/api/3/issue/TEST-123/attachments', {\n  method: 'POST',\n  body: form,\n  headers: {\n  'Authorization': `Basic ${Buffer.from(\n  'email@example.com:'\n  ).toString('base64')}`,\n  'Accept': 'application/json',\n  'X-Atlassian-Token': 'no-check'\n  }\n  })\n  .then(response => {\n  console.log(\n  `Response: ${response.status} ${response.statusText}`\n  );\n  return response.text();\n  })\n  .then(text => console.log(text))\n  .catch(err => console.error(err));\n \n  #### Java ####\n \n  // This code sample uses the  'Unirest' library:\n  // http://unirest.io/java.html\n  HttpResponse response = Unirest.post(\"https://your-domain.atlassian.net/rest/api/2/issue/{issueIdOrKey}/attachments\")\n  .basicAuth(\"email@example.com\", \"\")\n  .header(\"Accept\", \"application/json\")\n  .header(\"X-Atlassian-Token\", \"no-check\")\n  .field(\"file\", new File(\"myfile.txt\"))\n  .asJson();\n \n  System.out.println(response.getBody());\n \n  #### Python ####\n \n  # This code sample uses the 'requests' library:\n  # http://docs.python-requests.org\n  import requests\n  from requests.auth import HTTPBasicAuth\n  import json\n \n  url = \"https://your-domain.atlassian.net/rest/api/2/issue/{issueIdOrKey}/attachments\"\n \n  auth = HTTPBasicAuth(\"email@example.com\", \"\")\n \n  headers = {\n  \"Accept\": \"application/json\",\n  \"X-Atlassian-Token\": \"no-check\"\n  }\n \n  response = requests.request(\n  \"POST\",\n  url,\n  headers = headers,\n  auth = auth,\n  files = {\n  \"file\": (\"myfile.txt\", open(\"myfile.txt\",\"rb\"), \"application-type\")\n  }\n  )\n \n  print(json.dumps(json.loads(response.text), sort_keys=True, indent=4, separators=(\",\", \": \")))\n \n  #### PHP ####\n \n  // This code sample uses the 'Unirest' library:\n  // http://unirest.io/php.html\n  Unirest\\Request::auth('email@example.com', '');\n \n  $headers = array(\n  'Accept' => 'application/json',\n  'X-Atlassian-Token' => 'no-check'\n  );\n \n  $parameters = array(\n  'file' => File::add('myfile.txt')\n  );\n \n  $response = Unirest\\Request::post(\n  'https://your-domain.atlassian.net/rest/api/2/issue/{issueIdOrKey}/attachments',\n  $headers,\n  $parameters\n  );\n \n  var_dump($response)\n \n  #### Forge ####\n \n  // This sample uses Atlassian Forge and the `form-data` library.\n  // https://developer.atlassian.com/platform/forge/\n  // https://www.npmjs.com/package/form-data\n  import api from \"@forge/api\";\n  import FormData from \"form-data\";\n \n  const form = new FormData();\n  form.append('file', fileStream, {knownLength: fileSizeInBytes});\n \n  const response = await api.asApp().requestJira('/rest/api/2/issue/{issueIdOrKey}/attachments', {\n  method: 'POST',\n  body: form,\n  headers: {\n  'Accept': 'application/json',\n  'X-Atlassian-Token': 'no-check'\n  }\n  });\n \n  console.log(`Response: ${response.status} ${response.statusText}`);\n  console.log(await response.json());\n \n  Tip: Use a client library. Many client libraries have classes for handling multipart POST operations. For example, in Java, the Apache HTTP Components library provides a [MultiPartEntity](http://hc.apache.org/httpcomponents-client-ga/httpmime/apidocs/org/apache/http/entity/mime/MultipartEntity.html) class for multipart POST operations.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse Projects and Create attachments [ project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getChangeLogs": {
    "comment": "Get changelogs",
    "doc": "Get changelogs\n  Returns a [paginated](#pagination) list of all changelogs for an issue sorted by date, starting from the oldest.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getChangeLogsByIds": {
    "comment": "Get changelogs by IDs",
    "doc": "Get changelogs by IDs\n  Returns changelogs for an issue specified by a list of changelog IDs.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getComments": {
    "comment": "Get comments",
    "doc": "Get comments\n  Returns all comments for an issue.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Comments are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the comment.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, belongs to the group or has the role visibility is role visibility is restricted to."
  },
  "addComment": {
    "comment": "Add comment",
    "doc": "Add comment\n  Adds a comment to an issue.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Add comments [ project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue containing the comment is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "deleteComment": {
    "comment": "Delete comment",
    "doc": "Delete comment\n  Deletes a comment.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue containing the comment is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Delete all comments[ project permission](https://confluence.atlassian.com/x/yodKLg) to delete any comment or Delete own comments to delete comment created by the user,\n    If the comment has visibility restrictions, the user belongs to the group or has the role visibility is restricted to."
  },
  "getComment": {
    "comment": "Get comment",
    "doc": "Get comment\n  Returns a comment.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the comment.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, the user belongs to the group or has the role visibility is restricted to."
  },
  "updateComment": {
    "comment": "Update comment",
    "doc": "Update comment\n  Updates a comment.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue containing the comment is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Edit all comments[ project permission](https://confluence.atlassian.com/x/yodKLg) to update any comment or Edit own comments to update comment created by the user.\n    If the comment has visibility restrictions, the user belongs to the group or has the role visibility is restricted to."
  },
  "getEditIssueMeta": {
    "comment": "Get edit issue metadata",
    "doc": "Get edit issue metadata\n  Returns the edit screen fields for an issue that are visible to and editable by the user. Use the information to populate the requests in [Edit issue](#api-rest-api-3-issue-issueIdOrKey-put).\n \n  This endpoint will check for these conditions:\n \n  1.  Field is available on a field screen - through screen, screen scheme, issue type screen scheme, and issue type scheme configuration. `overrideScreenSecurity=true` skips this condition.\n  2.  Field is visible in the [field configuration](https://support.atlassian.com/jira-cloud-administration/docs/change-a-field-configuration/). `overrideScreenSecurity=true` skips this condition.\n  3.  Field is shown on the issue: each field has different conditions here. For example: Attachment field only shows if attachments are enabled. Assignee only shows if user has permissions to assign the issue.\n  4.  If a field is custom then it must have valid custom field context, applicable for its project and issue type. All system fields are assumed to have context in all projects and all issue types.\n  5.  Issue has a project, issue type, and status defined.\n  6.  Issue is assigned to a valid workflow, and the current status has assigned a workflow step. `overrideEditableFlag=true` skips this condition.\n  7.  The current workflow step is editable. This is true by default, but [can be disabled by setting](https://support.atlassian.com/jira-cloud-administration/docs/use-workflow-properties/) the `jira.issue.editable` property to `false`. `overrideEditableFlag=true` skips this condition.\n  8.  User has [Edit issues permission](https://support.atlassian.com/jira-cloud-administration/docs/permissions-for-company-managed-projects/).\n  9.  Workflow permissions allow editing a field. This is true by default but [can be modified](https://support.atlassian.com/jira-cloud-administration/docs/use-workflow-properties/) using `jira.permission.` workflow properties.\n \n  Fields hidden using [Issue layout settings page](https://support.atlassian.com/jira-software-cloud/docs/configure-field-layout-in-the-issue-view/) remain editable.\n \n  Connect apps having an app user with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), and Forge apps acting on behalf of users with Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), can return additional details using:\n \n    `overrideScreenSecurity` When this flag is `true`, then this endpoint skips checking if fields are available through screens, and field configuration (conditions 1. and 2. from the list above).\n    `overrideEditableFlag` When this flag is `true`, then this endpoint skips checking if workflow is present and if the current step is editable (conditions 6. and 7. from the list above).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n \n  Note: For any fields to be editable the user must have the Edit issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the issue."
  },
  "notify": {
    "comment": "Send notification for issue",
    "doc": "Send notification for issue\n  Creates an email notification for an issue and adds it to the mail queue.\n \n  [Permissions](#permissions) required:\n \n    Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getIssuePropertyKeys": {
    "comment": "Get issue property keys",
    "doc": "Get issue property keys\n  Returns the URLs and keys of an issue's properties.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Property details are only returned where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "deleteIssueProperty": {
    "comment": "Delete issue property",
    "doc": "Delete issue property\n  Deletes an issue's property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Edit issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getIssueProperty": {
    "comment": "Get issue property",
    "doc": "Get issue property\n  Returns the key and value of an issue's property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "setIssueProperty": {
    "comment": "Set issue property",
    "doc": "Set issue property\n  Sets the value of an issue's property. Use this resource to store custom data against an issue.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Edit issues [project permissions](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "deleteRemoteIssueLinkByGlobalId": {
    "comment": "Delete remote issue link by global ID",
    "doc": "Delete remote issue link by global ID\n  Deletes the remote issue link from the issue using the link's global ID. Where the global ID includes reserved URL characters these must be escaped in the request. For example, pass `system=http://www.mycompany.com/support&id=1` as `system%3Dhttp%3A%2F%2Fwww.mycompany.com%2Fsupport%26id%3D1`.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is implemented, issue-level security permission to view the issue."
  },
  "getRemoteIssueLinks": {
    "comment": "Get remote issue links",
    "doc": "Get remote issue links\n  Returns the remote issue links for an issue. When a remote issue link global ID is provided the record with that global ID is returned, otherwise all remote issue links are returned. Where a global ID includes reserved URL characters these must be escaped in the request. For example, pass `system=http://www.mycompany.com/support&id=1` as `system%3Dhttp%3A%2F%2Fwww.mycompany.com%2Fsupport%26id%3D1`.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "createOrUpdateRemoteIssueLink": {
    "comment": "Create or update remote issue link",
    "doc": "Create or update remote issue link\n  Creates or updates a remote issue link for an issue.\n \n  If a `globalId` is provided and a remote issue link with that global ID is found it is updated. Any fields without values in the request are set to null. Otherwise, the remote issue link is created.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "deleteRemoteIssueLinkById": {
    "comment": "Delete remote issue link by ID",
    "doc": "Delete remote issue link by ID\n  Deletes a remote issue link from an issue.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects, Edit issues, and Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getRemoteIssueLinkById": {
    "comment": "Get remote issue link by ID",
    "doc": "Get remote issue link by ID\n  Returns a remote issue link for an issue.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "updateRemoteIssueLink": {
    "comment": "Update remote issue link by ID",
    "doc": "Update remote issue link by ID\n  Updates a remote issue link for an issue.\n \n  Note: Fields without values in the request are set to null.\n \n  This operation requires [issue linking to be active](https://confluence.atlassian.com/x/yoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getTransitions": {
    "comment": "Get transitions",
    "doc": "Get transitions\n  Returns either all transitions or a transition that can be performed by the user on an issue, based on the issue's status.\n \n  Note, if a request is made for a transition that does not exist or cannot be performed on the issue, given its status, the response will return any empty transitions list.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: A list or transition is returned only when the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n \n  However, if the user does not have the Transition issues [ project permission](https://confluence.atlassian.com/x/yodKLg) the response will not list any transitions."
  },
  "doTransition": {
    "comment": "Transition issue",
    "doc": "Transition issue\n  Performs an issue transition and, if the transition has a screen, updates the fields from the transition screen.\n \n  sortByCategory To update the fields on the transition screen, specify the fields in the `fields` or `update` parameters in the request body. Get details about the fields using [ Get transitions](#api-rest-api-3-issue-issueIdOrKey-transitions-get) with the `transitions.fields` expand.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Transition issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "removeVote": {
    "comment": "Delete vote",
    "doc": "Delete vote\n  Deletes a user's vote from an issue. This is the equivalent of the user clicking Unvote on an issue in Jira.\n \n  This operation requires the Allow users to vote on issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getVotes": {
    "comment": "Get votes",
    "doc": "Get votes\n  Returns details about the votes on an issue.\n \n  This operation requires the Allow users to vote on issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is ini\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n \n  Note that users with the necessary permissions for this operation but without the View voters and watchers project permissions are not returned details in the `voters` field."
  },
  "addVote": {
    "comment": "Add vote",
    "doc": "Add vote\n  Adds the user's vote to an issue. This is the equivalent of the user clicking Vote on an issue in Jira.\n \n  This operation requires the Allow users to vote on issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "removeWatcher": {
    "comment": "Delete watcher",
    "doc": "Delete watcher\n  Deletes a user as a watcher of an issue.\n \n  This operation requires the Allow users to watch issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    To remove users other than themselves from the watchlist, Manage watcher list [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in."
  },
  "getIssueWatchers": {
    "comment": "Get issue watchers",
    "doc": "Get issue watchers\n  Returns the watchers for an issue.\n \n  This operation requires the Allow users to watch issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is ini\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    To see details of users on the watchlist other than themselves, View voters and watchers [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in."
  },
  "addWatcher": {
    "comment": "Add watcher",
    "doc": "Add watcher\n  Adds a user as a watcher of an issue by passing the account ID of the user. For example, `\"5b10ac8d82e05b22cc7d4ef5\"`. If no user is specified the calling user is added.\n \n  This operation requires the Allow users to watch issues option to be ON. This option is set in General configuration for Jira. See [Configuring Jira application options](https://confluence.atlassian.com/x/uYXKM) for details.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    To add users other than themselves to the watchlist, Manage watcher list [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in."
  },
  "bulkDeleteWorklogs": {
    "comment": "Bulk delete worklogs",
    "doc": "Bulk delete worklogs\n  Deletes a list of worklogs from an issue. This is an experimental API with limitations:\n \n    You can't delete more than 5000 worklogs at once.\n    No notifications will be sent for deleted worklogs.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Delete all worklogs[ project permission](https://confluence.atlassian.com/x/yodKLg) to delete any worklog.\n    If any worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "getIssueWorklog": {
    "comment": "Get issue worklogs",
    "doc": "Get issue worklogs\n  Returns worklogs for an issue (ordered by created time), starting from the oldest worklog or from the worklog started on or after a date and time.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Workloads are only returned where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "addWorklog": {
    "comment": "Add worklog",
    "doc": "Add worklog\n  Adds a worklog to an issue.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects and Work on issues [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "bulkMoveWorklogs": {
    "comment": "Bulk move worklogs",
    "doc": "Bulk move worklogs\n  Moves a list of worklogs from one issue to another. This is an experimental API with several limitations:\n \n    You can't move more than 5000 worklogs at once.\n    You can't move worklogs containing an attachment.\n    You can't move worklogs restricted by project roles.\n    No notifications will be sent for moved worklogs.\n    No webhooks or events will be sent for moved worklogs.\n    No issue history will be recorded for moved worklogs.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the projects containing the source and destination issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Delete all worklogs[ and Edit all worklogs](https://confluence.atlassian.com/x/yodKLg)[project permission](https://confluence.atlassian.com/x/yodKLg)\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "deleteWorklog": {
    "comment": "Delete worklog",
    "doc": "Delete worklog\n  Deletes a worklog from an issue.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Delete all worklogs[ project permission](https://confluence.atlassian.com/x/yodKLg) to delete any worklog or Delete own worklogs to delete worklogs created by the user,\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "getWorklog": {
    "comment": "Get worklog",
    "doc": "Get worklog\n  Returns a worklog.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "updateWorklog": {
    "comment": "Update worklog",
    "doc": "Update worklog\n  Updates a worklog.\n \n  Time tracking must be enabled in Jira, otherwise this operation returns an error. For more information, see [Configuring time tracking](https://confluence.atlassian.com/x/qoXKM).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Edit all worklogs[ project permission](https://confluence.atlassian.com/x/yodKLg) to update any worklog or Edit own worklogs to update worklogs created by the user.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "getWorklogPropertyKeys": {
    "comment": "Get worklog property keys",
    "doc": "Get worklog property keys\n  Returns the keys of all properties for a worklog.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "deleteWorklogProperty": {
    "comment": "Delete worklog property",
    "doc": "Delete worklog property\n  Deletes a worklog property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "getWorklogProperty": {
    "comment": "Get worklog property",
    "doc": "Get worklog property\n  Returns the value of a worklog property.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "setWorklogProperty": {
    "comment": "Set worklog property",
    "doc": "Set worklog property\n  Sets the value of a worklog property. Use this operation to store custom data against the worklog.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    Edit all worklogs[ project permission](https://confluence.atlassian.com/x/yodKLg) to update any worklog or Edit own worklogs to update worklogs created by the user.\n    If the worklog has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "linkIssues": {
    "comment": "Create issue link",
    "doc": "Create issue link\n  Creates a link between two issues. Use this operation to indicate a relationship between two issues and optionally add a comment to the from (outward) issue. To use this resource the site must have [Issue Linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  This resource returns nothing on the creation of an issue link. To obtain the ID of the issue link, use `https://your-domain.atlassian.net/rest/api/3/issue/[linked issue key]?fields=issuelinks`.\n \n  If the link request duplicates a link, the response indicates that the issue link was created. If the request included a comment, the comment is added.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse project [project permission](https://confluence.atlassian.com/x/yodKLg) for all the projects containing the issues to be linked,\n    Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) on the project containing the from (outward) issue,\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue.\n    If the comment has visibility restrictions, belongs to the group or has the role visibility is restricted to."
  },
  "deleteIssueLink": {
    "comment": "Delete issue link",
    "doc": "Delete issue link\n  Deletes an issue link.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse project [project permission](https://confluence.atlassian.com/x/yodKLg) for all the projects containing the issues in the link.\n    Link issues [project permission](https://confluence.atlassian.com/x/yodKLg) for at least one of the projects containing issues in the link.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, permission to view both of the issues."
  },
  "getIssueLink": {
    "comment": "Get issue link",
    "doc": "Get issue link\n  Returns an issue link.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Browse project [project permission](https://confluence.atlassian.com/x/yodKLg) for all the projects containing the linked issues.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, permission to view both of the issues."
  },
  "getIssueLinkTypes": {
    "comment": "Get issue link types",
    "doc": "Get issue link types\n  Returns a list of all issue link types.\n \n  To use this operation, the site must have [issue linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for a project in the site."
  },
  "createIssueLinkType": {
    "comment": "Create issue link type",
    "doc": "Create issue link type\n  Creates an issue link type. Use this operation to create descriptions of the reasons why issues are linked. The issue link type consists of a name and descriptions for a link's inward and outward relationships.\n \n  To use this operation, the site must have [issue linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteIssueLinkType": {
    "comment": "Delete issue link type",
    "doc": "Delete issue link type\n  Deletes an issue link type.\n \n  To use this operation, the site must have [issue linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueLinkType": {
    "comment": "Get issue link type",
    "doc": "Get issue link type\n  Returns an issue link type.\n \n  To use this operation, the site must have [issue linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for a project in the site."
  },
  "updateIssueLinkType": {
    "comment": "Update issue link type",
    "doc": "Update issue link type\n  Updates an issue link type.\n \n  To use this operation, the site must have [issue linking](https://confluence.atlassian.com/x/yoXKM) enabled.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "exportArchivedIssues": {
    "comment": "Export archived issue(s)",
    "doc": "Export archived issue(s)\n  Enables admins to retrieve details of all archived issues. Upon a successful request, the admin who submitted it will receive an email with a link to download a CSV file with the issue details.\n \n  Note that this API only exports the values of system fields and archival-specific fields (`ArchivedBy` and `ArchivedDate`). Custom fields aren't supported.\n \n  [Permissions](#permissions) required: Jira admin or site admin: [global permission](https://confluence.atlassian.com/x/x4dKLg)\n \n  License required: Premium or Enterprise\n \n  Signed-in users only: This API can't be accessed anonymously.\n \n  Rate limiting: Only a single request can be active at any given time."
  },
  "getIssueSecuritySchemes": {
    "comment": "Get issue security schemes",
    "doc": "Get issue security schemes\n  Returns all [issue security schemes](https://confluence.atlassian.com/x/J4lKLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createIssueSecurityScheme": {
    "comment": "Create issue security scheme",
    "doc": "Create issue security scheme\n  Creates a security scheme with security scheme levels and levels' members. You can create up to 100 security scheme levels and security scheme levels' members per request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getSecurityLevels": {
    "comment": "Get issue security levels",
    "doc": "Get issue security levels\n  Returns a [paginated](#pagination) list of issue security levels.\n \n  Only issue security levels in the context of classic projects are returned.\n \n  Filtering using IDs is inclusive: if you specify both security scheme IDs and level IDs, the result will include both specified issue security levels and all issue security levels from the specified schemes.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setDefaultLevels": {
    "comment": "Set default issue security levels",
    "doc": "Set default issue security levels\n  Sets default issue security levels for schemes.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getSecurityLevelMembers": {
    "comment": "Get issue security level members",
    "doc": "Get issue security level members\n  Returns a [paginated](#pagination) list of issue security level members.\n \n  Only issue security level members in the context of classic projects are returned.\n \n  Filtering using parameters is inclusive: if you specify both security scheme IDs and level IDs, the result will include all issue security level members from the specified schemes and levels.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchProjectsUsingSecuritySchemes": {
    "comment": "Get projects using issue security schemes",
    "doc": "Get projects using issue security schemes\n  Returns a [paginated](#pagination) mapping of projects that are using security schemes. You can provide either one or multiple security scheme IDs or project IDs to filter by. If you don't provide any, this will return a list of all mappings. Only issue security schemes in the context of classic projects are supported. [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "associateSchemesToProjects": {
    "comment": "Associate security scheme to project",
    "doc": "Associate security scheme to project\n  Associates an issue security scheme with a project and remaps security levels of issues to the new levels, if provided.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchSecuritySchemes": {
    "comment": "Search issue security schemes",
    "doc": "Search issue security schemes\n  Returns a [paginated](#pagination) list of issue security schemes.\n  If you specify the project ID parameter, the result will contain issue security schemes and related project IDs you filter by. Use \\{@link IssueSecuritySchemeResource\\#searchProjectsUsingSecuritySchemes(String, String, Set, Set)\\} to obtain all projects related to scheme.\n \n  Only issue security schemes in the context of classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueSecurityScheme": {
    "comment": "Get issue security scheme",
    "doc": "Get issue security scheme\n  Returns an issue security scheme along with its security levels.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for a project that uses the requested issue security scheme."
  },
  "updateIssueSecurityScheme": {
    "comment": "Update issue security scheme",
    "doc": "Update issue security scheme\n  Updates the issue security scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueSecurityLevelMembers": {
    "comment": "Get issue security level members by issue security scheme",
    "doc": "Get issue security level members by issue security scheme\n  Returns issue security level members.\n \n  Only issue security level members in context of classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteSecurityScheme": {
    "comment": "Delete issue security scheme",
    "doc": "Delete issue security scheme\n  Deletes an issue security scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addSecurityLevel": {
    "comment": "Add issue security levels",
    "doc": "Add issue security levels\n  Adds levels and levels' members to the issue security scheme. You can add up to 100 levels per request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeLevel": {
    "comment": "Remove issue security level",
    "doc": "Remove issue security level\n  Deletes an issue security level.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateSecurityLevel": {
    "comment": "Update issue security level",
    "doc": "Update issue security level\n  Updates the issue security level.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addSecurityLevelMembers": {
    "comment": "Add issue security level members",
    "doc": "Add issue security level members\n  Adds members to the issue security level. You can add up to 100 members per request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeMemberFromSecurityLevel": {
    "comment": "Remove member from issue security level",
    "doc": "Remove member from issue security level\n  Removes an issue security level member from an issue security scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueAllTypes": {
    "comment": "Get all issue types for user",
    "doc": "Get all issue types for user\n  Returns all issue types.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issue types are only returned as follows:\n \n    if the user has the Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), all issue types are returned.\n    if the user has the Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for one or more projects, the issue types associated with the projects the user has permission to browse are returned."
  },
  "createIssueType": {
    "comment": "Create issue type",
    "doc": "Create issue type\n  Creates an issue type and adds it to the default issue type scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypesForProject": {
    "comment": "Get issue types for project",
    "doc": "Get issue types for project\n  Returns issue types for a project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) in the relevant project or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteIssueType": {
    "comment": "Delete issue type",
    "doc": "Delete issue type\n  Deletes the issue type. If the issue type is in use, all uses are updated with the alternative issue type (`alternativeIssueTypeId`). A list of alternative issue types are obtained from the [Get alternative issue types](#api-rest-api-3-issuetype-id-alternatives-get) resource.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueType": {
    "comment": "Get issue type",
    "doc": "Get issue type\n  Returns an issue type.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) in a project the issue type is associated with or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateIssueType": {
    "comment": "Update issue type",
    "doc": "Update issue type\n  Updates the issue type.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAlternativeIssueTypes": {
    "comment": "Get alternative issue types",
    "doc": "Get alternative issue types\n  Returns a list of issue types that can be used to replace the issue type. The alternative issue types are those assigned to the same workflow scheme, field configuration scheme, and screen scheme.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "createIssueTypeAvatar": {
    "comment": "Load issue type avatar",
    "doc": "Load issue type avatar\n  Loads an avatar for the issue type.\n \n  Specify the avatar's local file location in the body of the request. Also, include the following headers:\n \n    `X-Atlassian-Token: no-check` To prevent XSRF protection blocking the request, for more information see [Special Headers](#special-request-headers).\n    `Content-Type: image/image type` Valid image types are JPEG, GIF, or PNG.\n \n  For example:\n  `curl --request POST \\ --user email@example.com:<api_token> \\ --header 'X-Atlassian-Token: no-check' \\ --header 'Content-Type: image/< image_type>' \\ --data-binary \"<@/path/to/file/with/your/avatar>\" \\ --url 'https://your-domain.atlassian.net/rest/api/3/issuetype/{issueTypeId}'This`\n \n  The avatar is cropped to a square. If no crop parameters are specified, the square originates at the top left of the image. The length of the square's sides is set to the smaller of the height or width of the image.\n \n  The cropped image is then used to create avatars of 16x16, 24x24, 32x32, and 48x48 in size.\n \n  After creating the avatar, use [ Update issue type](#api-rest-api-3-issuetype-id-put) to set it as the issue type's displayed avatar.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypePropertyKeys": {
    "comment": "Get issue type property keys",
    "doc": "Get issue type property keys\n  Returns all the [issue type property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties) keys of the issue type.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) to get the property keys of any issue type.\n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) to get the property keys of any issue types associated with the projects the user has permission to browse."
  },
  "deleteIssueTypeProperty": {
    "comment": "Delete issue type property",
    "doc": "Delete issue type property\n  Deletes the [issue type property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeProperty": {
    "comment": "Get issue type property",
    "doc": "Get issue type property\n  Returns the key and value of the [issue type property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) to get the details of any issue type.\n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) to get the details of any issue types associated with the projects the user has permission to browse."
  },
  "setIssueTypeProperty": {
    "comment": "Set issue type property",
    "doc": "Set issue type property\n  Creates or updates the value of the [issue type property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties). Use this resource to store and update data against an issue type.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllIssueTypeSchemes": {
    "comment": "Get all issue type schemes",
    "doc": "Get all issue type schemes\n  Returns a [paginated](#pagination) list of issue type schemes.\n \n  Only issue type schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createIssueTypeScheme": {
    "comment": "Create issue type scheme",
    "doc": "Create issue type scheme\n  Creates an issue type scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeSchemesMapping": {
    "comment": "Get issue type scheme items",
    "doc": "Get issue type scheme items\n  Returns a [paginated](#pagination) list of issue type scheme items.\n \n  Only issue type scheme items used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeSchemeForProjects": {
    "comment": "Get issue type schemes for projects",
    "doc": "Get issue type schemes for projects\n  Returns a [paginated](#pagination) list of issue type schemes and, for each issue type scheme, a list of the projects that use it.\n \n  Only issue type schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "assignIssueTypeSchemeToProject": {
    "comment": "Assign issue type scheme to project",
    "doc": "Assign issue type scheme to project\n  Assigns an issue type scheme to a project.\n \n  If any issues in the project are assigned issue types not present in the new scheme, the operation will fail. To complete the assignment those issues must be updated to use issue types in the new scheme.\n \n  Issue type schemes can only be assigned to classic projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteIssueTypeScheme": {
    "comment": "Delete issue type scheme",
    "doc": "Delete issue type scheme\n  Deletes an issue type scheme.\n \n  Only issue type schemes used in classic projects can be deleted.\n \n  Any projects assigned to the scheme are reassigned to the default issue type scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateIssueTypeScheme": {
    "comment": "Update issue type scheme",
    "doc": "Update issue type scheme\n  Updates an issue type scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addIssueTypesToIssueTypeScheme": {
    "comment": "Add issue types to issue type scheme",
    "doc": "Add issue types to issue type scheme\n  Adds issue types to an issue type scheme.\n \n  The added issue types are appended to the issue types list.\n \n  If any of the issue types exist in the issue type scheme, the operation fails and no issue types are added.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "reorderIssueTypesInIssueTypeScheme": {
    "comment": "Change order of issue types",
    "doc": "Change order of issue types\n  Changes the order of issue types in an issue type scheme.\n \n  The request body parameters must meet the following requirements:\n \n    all of the issue types must belong to the issue type scheme.\n    either `after` or `position` must be provided.\n    the issue type in `after` must not be in the issue type list.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeIssueTypeFromIssueTypeScheme": {
    "comment": "Remove issue type from issue type scheme",
    "doc": "Remove issue type from issue type scheme\n  Removes an issue type from an issue type scheme.\n \n  This operation cannot remove:\n \n    any issue type used by issues.\n    any issue types from the default issue type scheme.\n    the last standard issue type from an issue type scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeScreenSchemes": {
    "comment": "Get issue type screen schemes",
    "doc": "Get issue type screen schemes\n  Returns a [paginated](#pagination) list of issue type screen schemes.\n \n  Only issue type screen schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createIssueTypeScreenScheme": {
    "comment": "Create issue type screen scheme",
    "doc": "Create issue type screen scheme\n  Creates an issue type screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeScreenSchemeMappings": {
    "comment": "Get issue type screen scheme items",
    "doc": "Get issue type screen scheme items\n  Returns a [paginated](#pagination) list of issue type screen scheme items.\n \n  Only issue type screen schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIssueTypeScreenSchemeProjectAssociations": {
    "comment": "Get issue type screen schemes for projects",
    "doc": "Get issue type screen schemes for projects\n  Returns a [paginated](#pagination) list of issue type screen schemes and, for each issue type screen scheme, a list of the projects that use it.\n \n  Only issue type screen schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "assignIssueTypeScreenSchemeToProject": {
    "comment": "Assign issue type screen scheme to project",
    "doc": "Assign issue type screen scheme to project\n  Assigns an issue type screen scheme to a project.\n \n  Issue type screen schemes can only be assigned to classic projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteIssueTypeScreenScheme": {
    "comment": "Delete issue type screen scheme",
    "doc": "Delete issue type screen scheme\n  Deletes an issue type screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateIssueTypeScreenScheme": {
    "comment": "Update issue type screen scheme",
    "doc": "Update issue type screen scheme\n  Updates an issue type screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "appendMappingsForIssueTypeScreenScheme": {
    "comment": "Append mappings to issue type screen scheme",
    "doc": "Append mappings to issue type screen scheme\n  Appends issue type to screen scheme mappings to an issue type screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateDefaultScreenScheme": {
    "comment": "Update issue type screen scheme default screen scheme",
    "doc": "Update issue type screen scheme default screen scheme\n  Updates the default screen scheme of an issue type screen scheme. The default screen scheme is used for all unmapped issue types.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeMappingsFromIssueTypeScreenScheme": {
    "comment": "Remove mappings from issue type screen scheme",
    "doc": "Remove mappings from issue type screen scheme\n  Removes issue type to screen scheme mappings from an issue type screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectsForIssueTypeScreenScheme": {
    "comment": "Get issue type screen scheme projects",
    "doc": "Get issue type screen scheme projects\n  Returns a [paginated](#pagination) list of projects associated with an issue type screen scheme.\n \n  Only company-managed projects associated with an issue type screen scheme are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAutoComplete": {
    "comment": "Get field reference data (GET)",
    "doc": "Get field reference data (GET)\n  Returns reference data for JQL searches. This is a downloadable version of the documentation provided in [Advanced searching - fields reference](https://confluence.atlassian.com/x/gwORLQ) and [Advanced searching - functions reference](https://confluence.atlassian.com/x/hgORLQ), along with a list of JQL-reserved words. Use this information to assist with the programmatic creation of JQL queries or the validation of queries built in a custom query builder.\n \n  To filter visible field details by project or collapse non-unique fields by field type then [Get field reference data (POST)](#api-rest-api-3-jql-autocompletedata-post) can be used.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAutoCompletePost": {
    "comment": "Get field reference data (POST)",
    "doc": "Get field reference data (POST)\n  Returns reference data for JQL searches. This is a downloadable version of the documentation provided in [Advanced searching - fields reference](https://confluence.atlassian.com/x/gwORLQ) and [Advanced searching - functions reference](https://confluence.atlassian.com/x/hgORLQ), along with a list of JQL-reserved words. Use this information to assist with the programmatic creation of JQL queries or the validation of queries built in a custom query builder.\n \n  This operation can filter the custom fields returned by project. Invalid project IDs in `projectIds` are ignored. System fields are always returned.\n \n  It can also return the collapsed field for custom fields. Collapsed fields enable searches to be performed across all fields with the same name and of the same field type. For example, the collapsed field `Component - Component[Dropdown]` enables dropdown fields `Component - cf[10061]` and `Component - cf[10062]` to be searched simultaneously.\n \n  [Permissions](#permissions) required: None."
  },
  "getFieldAutoCompleteForQueryString": {
    "comment": "Get field auto complete suggestions",
    "doc": "Get field auto complete suggestions\n  Returns the JQL search auto complete suggestions for a field.\n \n  Suggestions can be obtained by providing:\n \n    `fieldName` to get a list of all values for the field.\n    `fieldName` and `fieldValue` to get a list of values containing the text in `fieldValue`.\n    `fieldName` and `predicateName` to get a list of all predicate values for the field.\n    `fieldName`, `predicateName`, and `predicateValue` to get a list of predicate values containing the text in `predicateValue`.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getPrecomputations": {
    "comment": "Get precomputations (apps)",
    "doc": "Get precomputations (apps)\n  Returns the list of a function's precomputations along with information about when they were created, updated, and last used. Each precomputation has a `value` \\- the JQL fragment to replace the custom function clause with.\n \n  [Permissions](#permissions) required: This API is only accessible to apps and apps can only inspect their own functions.\n \n  The new `read:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "updatePrecomputations": {
    "comment": "Update precomputations (apps)",
    "doc": "Update precomputations (apps)\n  Update the precomputation value of a function created by a Forge/Connect app.\n \n  [Permissions](#permissions) required: An API for apps to update their own precomputations.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "matchIssues": {
    "comment": "Check issues against JQL",
    "doc": "Check issues against JQL\n  Checks whether one or more issues would be returned by one or more JQL queries.\n \n  [Permissions](#permissions) required: None, however, issues are only matched against JQL queries where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "parseJqlQueries": {
    "comment": "Parse JQL query",
    "doc": "Parse JQL query\n  Parses and validates JQL queries.\n \n  Validation is performed in context of the current user.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "migrateQueries": {
    "comment": "Convert user identifiers to account IDs in JQL queries",
    "doc": "Convert user identifiers to account IDs in JQL queries\n  Converts one or more JQL queries with user identifiers (username or user key) to equivalent JQL queries with account IDs.\n \n  You may wish to use this operation if your system stores JQL queries and you want to make them GDPR-compliant. For more information about GDPR-related changes, see the [migration guide](https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-user-privacy-api-migration-guide/).\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "sanitiseJqlQueries": {
    "comment": "Sanitize JQL queries",
    "doc": "Sanitize JQL queries\n  Sanitizes one or more JQL queries by converting readable details into IDs where a user doesn't have permission to view the entity.\n \n  For example, if the query contains the clause project = 'Secret project', and a user does not have browse permission for the project \"Secret project\", the sanitized query replaces the clause with project = 12345\" (where 12345 is the ID of the project). If a user has the required permission, the clause is not sanitized. If the account ID is null, sanitizing is performed for an anonymous user.\n \n  Note that sanitization doesn't make the queries GDPR-compliant, because it doesn't remove user identifiers (username or user key). If you need to make queries GDPR-compliant, use [Convert user identifiers to account IDs in JQL queries](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-jql/#api-rest-api-3-jql-sanitize-post).\n \n  Before sanitization each JQL query is parsed. The queries are returned in the same order that they were passed.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllLabels": {
    "comment": "Get all labels",
    "doc": "Get all labels\n  Returns a [paginated](#pagination) list of labels."
  },
  "getApproximateLicenseCount": {
    "comment": "Get approximate license count",
    "doc": "Get approximate license count\n  Returns the approximate number of user accounts across all Jira licenses. Note that this information is cached with a 7-day lifecycle and could be stale at the time of call.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getApproximateApplicationLicenseCount": {
    "comment": "Get approximate application license count",
    "doc": "Get approximate application license count\n  Returns the total approximate number of user accounts for a single Jira license. Note that this information is cached with a 7-day lifecycle and could be stale at the time of call.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getMyPermissions": {
    "comment": "Get my permissions",
    "doc": "Get my permissions\n  Returns a list of permissions indicating which permissions the user has. Details of the user's permissions can be obtained in a global, project, issue or comment context.\n \n  The user is reported as having a project permission:\n \n    in the global context, if the user has the project permission in any project.\n    for a project, where the project permission is determined using issue data, if the user meets the permission's criteria for any issue in the project. Otherwise, if the user has the project permission in the project.\n    for an issue, where a project permission is determined using issue data, if the user has the permission in the issue. Otherwise, if the user has the project permission in the project containing the issue.\n    for a comment, where the user has both the permission to browse the comment and the project permission for the comment's parent issue. Only the BROWSE\\_PROJECTS permission is supported. If a `commentId` is provided whose `permissions` does not equal BROWSE\\_PROJECTS, a 400 error will be returned.\n \n  This means that users may be shown as having an issue permission (such as EDIT\\_ISSUES) in the global context or a project context but may not have the permission for any or all issues. For example, if Reporters have the EDIT\\_ISSUES permission a user would be shown as having this permission in the global context or the context of a project, because any user can be a reporter. However, if they are not the user who reported the issue queried they would not have EDIT\\_ISSUES permission for that issue.\n \n  For [Jira Service Management project permissions](https://support.atlassian.com/jira-cloud-administration/docs/customize-jira-service-management-permissions/), this will be evaluated similarly to a user in the customer portal. For example, if the BROWSE\\_PROJECTS permission is granted to Service Project Customer - Portal Access, any users with access to the customer portal will have the BROWSE\\_PROJECTS permission.\n \n  Global permissions are unaffected by context.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "removePreference": {
    "comment": "Delete preference",
    "doc": "Delete preference\n  Deletes a preference of the user, which restores the default value of system defined settings.\n \n  Note that these keys are deprecated:\n \n    jira.user.locale The locale of the user. By default, not set. The user takes the instance locale.\n    jira.user.timezone The time zone of the user. By default, not set. The user takes the instance timezone.\n \n  Use [ Update a user profile](https://developer.atlassian.com/cloud/admin/user-management/rest/#api-users-account-id-manage-profile-patch) from the user management REST API to manage timezone and locale instead.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getPreference": {
    "comment": "Get preference",
    "doc": "Get preference\n  Returns the value of a preference of the current user.\n \n  Note that these keys are deprecated:\n \n    jira.user.locale The locale of the user. By default this is not set and the user takes the locale of the instance.\n    jira.user.timezone The time zone of the user. By default this is not set and the user takes the timezone of the instance.\n \n  These system preferences keys will be deprecated by 15/07/2024. You can still retrieve these keys, but it will not have any impact on Notification behaviour.\n \n    user.notifications.watcher Whether the user gets notified when they are watcher.\n    user.notifications.assignee Whether the user gets notified when they are assignee.\n    user.notifications.reporter Whether the user gets notified when they are reporter.\n    user.notifications.mentions Whether the user gets notified when they are mentions.\n \n  Use [ Update a user profile](https://developer.atlassian.com/cloud/admin/user-management/rest/#api-users-account-id-manage-profile-patch) from the user management REST API to manage timezone and locale instead.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "setPreference": {
    "comment": "Set preference",
    "doc": "Set preference\n  Creates a preference for the user or updates a preference's value by sending a plain text string. For example, `false`. An arbitrary preference can be created with the value containing up to 255 characters. In addition, the following keys define system preferences that can be set or created:\n \n    user.notifications.mimetype The mime type used in notifications sent to the user. Defaults to `html`.\n    user.default.share.private Whether new [ filters](https://confluence.atlassian.com/x/eQiiLQ) are set to private. Defaults to `true`.\n    user.keyboard.shortcuts.disabled Whether keyboard shortcuts are disabled. Defaults to `false`.\n    user.autowatch.disabled Whether the user automatically watches issues they create or add a comment to. By default, not set: the user takes the instance autowatch setting.\n    user.notifiy.own.changes Whether the user gets notified of their own changes.\n \n  Note that these keys are deprecated:\n \n    jira.user.locale The locale of the user. By default, not set. The user takes the instance locale.\n    jira.user.timezone The time zone of the user. By default, not set. The user takes the instance timezone.\n \n  These system preferences keys will be deprecated by 15/07/2024. You can still use these keys to create arbitrary preferences, but it will not have any impact on Notification behaviour.\n \n    user.notifications.watcher Whether the user gets notified when they are watcher.\n    user.notifications.assignee Whether the user gets notified when they are assignee.\n    user.notifications.reporter Whether the user gets notified when they are reporter.\n    user.notifications.mentions Whether the user gets notified when they are mentions.\n \n  Use [ Update a user profile](https://developer.atlassian.com/cloud/admin/user-management/rest/#api-users-account-id-manage-profile-patch) from the user management REST API to manage timezone and locale instead.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deleteLocale": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Delete locale\n  Deprecated, use [ Update a user profile](https://developer.atlassian.com/cloud/admin/user-management/rest/#api-users-account-id-manage-profile-patch) from the user management REST API instead.\n \n  Deletes the locale of the user, which restores the default setting.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getLocale": {
    "comment": "Get locale",
    "doc": "Get locale\n  Returns the locale for the user.\n \n  If the user has no language preference set (which is the default setting) or this resource is accessed anonymous, the browser locale detected by Jira is returned. Jira detects the browser locale using the Accept-Language header in the request. However, if this doesn't match a locale available Jira, the site default locale is returned.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "setLocale": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Set locale\n  Deprecated, use [ Update a user profile](https://developer.atlassian.com/cloud/admin/user-management/rest/#api-users-account-id-manage-profile-patch) from the user management REST API instead.\n \n  Sets the locale of the user. The locale must be one supported by the instance of Jira.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getCurrentUser": {
    "comment": "Get current user",
    "doc": "Get current user\n  Returns details for the current user.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getNotificationSchemes": {
    "comment": "Get notification schemes paginated",
    "doc": "Get notification schemes paginated\n  Returns a [paginated](#pagination) list of [notification schemes](https://confluence.atlassian.com/x/8YdKLg) ordered by the display name.\n \n  Note that you should allow for events without recipients to appear in responses.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, the user must have permission to administer at least one project associated with a notification scheme for it to be returned."
  },
  "createNotificationScheme": {
    "comment": "Create notification scheme",
    "doc": "Create notification scheme\n  Creates a notification scheme with notifications. You can create up to 1000 notifications per request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getNotificationSchemeToProjectMappings": {
    "comment": "Get projects using notification schemes paginated",
    "doc": "Get projects using notification schemes paginated\n  Returns a [paginated](#pagination) mapping of project that have notification scheme assigned. You can provide either one or multiple notification scheme IDs or project IDs to filter by. If you don't provide any, this will return a list of all mappings. Note that only company-managed (classic) projects are supported. This is because team-managed projects don't have a concept of a default notification scheme. The mappings are ordered by projectId.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getNotificationScheme": {
    "comment": "Get notification scheme",
    "doc": "Get notification scheme\n  Returns a [notification scheme](https://confluence.atlassian.com/x/8YdKLg), including the list of events and the recipients who will receive notifications for those events.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, the user must have permission to administer at least one project associated with the notification scheme."
  },
  "updateNotificationScheme": {
    "comment": "Update notification scheme",
    "doc": "Update notification scheme\n  Updates a notification scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addNotifications": {
    "comment": "Add notifications to notification scheme",
    "doc": "Add notifications to notification scheme\n  Adds notifications to a notification scheme. You can add up to 1000 notifications per request.\n \n  Deprecated: The notification type `EmailAddress` is no longer supported in Cloud. Refer to the [changelog](https://developer.atlassian.com/cloud/jira/platform/changelog/#CHANGE-1031) for more details.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteNotificationScheme": {
    "comment": "Delete notification scheme",
    "doc": "Delete notification scheme\n  Deletes a notification scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeNotificationFromNotificationScheme": {
    "comment": "Remove notification from notification scheme",
    "doc": "Remove notification from notification scheme\n  Removes a notification from a notification scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllPermissions": {
    "comment": "Get all permissions",
    "doc": "Get all permissions\n  Returns all permissions, including:\n \n    global permissions.\n    project permissions.\n    global permissions added by plugins.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getBulkPermissions": {
    "comment": "Get bulk permissions",
    "doc": "Get bulk permissions\n  Returns:\n \n    for a list of global permissions, the global permissions granted to a user.\n    for a list of project permissions and lists of projects and issues, for each project permission a list of the projects and issues a user can access or manipulate.\n \n  If no account ID is provided, the operation returns details for the logged in user.\n \n  Note that:\n \n    Invalid project and issue IDs are ignored.\n    A maximum of 1000 projects and 1000 issues can be checked.\n    Null values in `globalPermissions`, `projectPermissions`, `projectPermissions.projects`, and `projectPermissions.issues` are ignored.\n    Empty strings in `projectPermissions.permissions` are ignored.\n \n  Deprecation notice: The required OAuth 2.0 scopes will be updated on June 15, 2024.\n \n    Classic: `read:jira-work`\n    Granular: `read:permission:jira`\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) to check the permissions for other users, otherwise none. However, Connect apps can make a call from the app server to the product to obtain permission details for any user, without admin permission. This Connect app ability doesn't apply to calls made using AP.request() in a browser."
  },
  "getPermittedProjects": {
    "comment": "Get permitted projects",
    "doc": "Get permitted projects\n  Returns all the projects where the user is granted a list of project permissions.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAllPermissionSchemes": {
    "comment": "Get all permission schemes",
    "doc": "Get all permission schemes\n  Returns all permission schemes.\n \n  ### About permission schemes and grants ###\n \n  A permission scheme is a collection of permission grants. A permission grant consists of a `holder` and a `permission`.\n \n  #### Holder object ####\n \n  The `holder` object contains information about the user or group being granted the permission. For example, the Administer projects permission is granted to a group named Teams in space administrators. In this case, the type is `\"type\": \"group\"`, and the parameter is the group name, `\"parameter\": \"Teams in space administrators\"` and the value is group ID, `\"value\": \"ca85fac0-d974-40ca-a615-7af99c48d24f\"`.\n \n  The `holder` object is defined by the following properties:\n \n    `type` Identifies the user or group (see the list of types below).\n    `parameter` As a group's name can change, use of `value` is recommended. The value of this property depends on the `type`. For example, if the `type` is a group, then you need to specify the group name.\n    `value` The value of this property depends on the `type`. If the `type` is a group, then you need to specify the group ID. For other `type` it has the same value as `parameter`\n \n  The following `types` are available. The expected values for `parameter` and `value` are given in parentheses (some types may not have a `parameter` or `value`):\n \n    `anyone` Grant for anonymous users.\n    `applicationRole` Grant for users with access to the specified application (application name, application name). See [Update product access settings](https://confluence.atlassian.com/x/3YxjL) for more information.\n    `assignee` Grant for the user currently assigned to an issue.\n    `group` Grant for the specified group (`parameter` : group name, `value` : group ID).\n    `groupCustomField` Grant for a user in the group selected in the specified custom field (`parameter` : custom field ID, `value` : custom field ID).\n    `projectLead` Grant for a project lead.\n    `projectRole` Grant for the specified project role (`parameter` :project role ID, `value` : project role ID).\n    `reporter` Grant for the user who reported the issue.\n    `sd.customer.portal.only` Jira Service Desk only. Grants customers permission to access the customer portal but not Jira. See [Customizing Jira Service Desk permissions](https://confluence.atlassian.com/x/24dKLg) for more information.\n    `user` Grant for the specified user (`parameter` : user ID - historically this was the userkey but that is deprecated and the account ID should be used, `value` : user ID).\n    `userCustomField` Grant for a user selected in the specified custom field (`parameter` : custom field ID, `value` : custom field ID).\n \n  #### Built-in permissions ####\n \n  The [built-in Jira permissions](https://confluence.atlassian.com/x/yodKLg) are listed below. Apps can also define custom permissions. See the [project permission](https://developer.atlassian.com/cloud/jira/platform/modules/project-permission/) and [global permission](https://developer.atlassian.com/cloud/jira/platform/modules/global-permission/) module documentation for more information.\n \n  Project permissions\n \n    `ADMINISTER_PROJECTS`\n    `BROWSE_PROJECTS`\n    `MANAGE_SPRINTS_PERMISSION` (Jira Software only)\n    `SERVICEDESK_AGENT` (Jira Service Desk only)\n    `VIEW_DEV_TOOLS` (Jira Software only)\n    `VIEW_READONLY_WORKFLOW`\n \n  Issue permissions\n \n    `ASSIGNABLE_USER`\n    `ASSIGN_ISSUES`\n    `CLOSE_ISSUES`\n    `CREATE_ISSUES`\n    `DELETE_ISSUES`\n    `EDIT_ISSUES`\n    `LINK_ISSUES`\n    `MODIFY_REPORTER`\n    `MOVE_ISSUES`\n    `RESOLVE_ISSUES`\n    `SCHEDULE_ISSUES`\n    `SET_ISSUE_SECURITY`\n    `TRANSITION_ISSUES`\n \n  Voters and watchers permissions\n \n    `MANAGE_WATCHERS`\n    `VIEW_VOTERS_AND_WATCHERS`\n \n  Comments permissions\n \n    `ADD_COMMENTS`\n    `DELETE_ALL_COMMENTS`\n    `DELETE_OWN_COMMENTS`\n    `EDIT_ALL_COMMENTS`\n    `EDIT_OWN_COMMENTS`\n \n  Attachments permissions\n \n    `CREATE_ATTACHMENTS`\n    `DELETE_ALL_ATTACHMENTS`\n    `DELETE_OWN_ATTACHMENTS`\n \n  Time tracking permissions\n \n    `DELETE_ALL_WORKLOGS`\n    `DELETE_OWN_WORKLOGS`\n    `EDIT_ALL_WORKLOGS`\n    `EDIT_OWN_WORKLOGS`\n    `WORK_ON_ISSUES`\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createPermissionScheme": {
    "comment": "Create permission scheme",
    "doc": "Create permission scheme\n  Creates a new permission scheme. You can create a permission scheme with or without defining a set of permission grants.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deletePermissionScheme": {
    "comment": "Delete permission scheme",
    "doc": "Delete permission scheme\n  Deletes a permission scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPermissionScheme": {
    "comment": "Get permission scheme",
    "doc": "Get permission scheme\n  Returns a permission scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "updatePermissionScheme": {
    "comment": "Update permission scheme",
    "doc": "Update permission scheme\n  Updates a permission scheme. Below are some important things to note when using this resource:\n \n    If a permissions list is present in the request, then it is set in the permission scheme, overwriting all existing grants.\n    If you want to update only the name and description, then do not send a permissions list in the request.\n    Sending an empty list will remove all permission grants from the permission scheme.\n \n  If you want to add or delete a permission grant instead of updating the whole list, see [Create permission grant](#api-rest-api-3-permissionscheme-schemeId-permission-post) or [Delete permission scheme entity](#api-rest-api-3-permissionscheme-schemeId-permission-permissionId-delete).\n \n  See [About permission schemes and grants](../api-group-permission-schemes/#about-permission-schemes-and-grants) for more details.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPermissionSchemeGrants": {
    "comment": "Get permission scheme grants",
    "doc": "Get permission scheme grants\n  Returns all permission grants for a permission scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createPermissionGrant": {
    "comment": "Create permission grant",
    "doc": "Create permission grant\n  Creates a permission grant in a permission scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deletePermissionSchemeEntity": {
    "comment": "Delete permission scheme grant",
    "doc": "Delete permission scheme grant\n  Deletes a permission grant from a permission scheme. See [About permission schemes and grants](../api-group-permission-schemes/#about-permission-schemes-and-grants) for more details.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPermissionSchemeGrant": {
    "comment": "Get permission scheme grant",
    "doc": "Get permission scheme grant\n  Returns a permission grant.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getPriorities": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get priorities\n  Returns the list of all issue priorities.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createPriority": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Create priority\n  Creates an issue priority.\n \n  Deprecation applies to iconUrl param in request body which will be sunset on 16th Mar 2025. For more details refer to [changelog](https://developer.atlassian.com/changelog/#CHANGE-1525).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setDefaultPriority": {
    "comment": "Set default priority",
    "doc": "Set default priority\n  Sets default issue priority.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "movePriorities": {
    "comment": "Move priorities",
    "doc": "Move priorities\n  Changes the order of issue priorities.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchPriorities": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Search priorities\n  Returns a [paginated](#pagination) list of priorities. The list can contain all priorities or a subset determined by any combination of these criteria:\n \n    a list of priority IDs. Any invalid priority IDs are ignored.\n    a list of project IDs. Only priorities that are available in these projects will be returned. Any invalid project IDs are ignored.\n    whether the field configuration is a default. This returns priorities from company-managed (classic) projects only, as there is no concept of default priorities in team-managed projects.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deletePriority": {
    "comment": "Delete priority",
    "doc": "Delete priority\n  Deletes an issue priority.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPriority": {
    "comment": "Get priority",
    "doc": "Get priority\n  Returns an issue priority.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "updatePriority": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Update priority\n  Updates an issue priority.\n \n  At least one request body parameter must be defined.\n \n  Deprecation applies to iconUrl param in request body which will be sunset on 16th Mar 2025. For more details refer to [changelog](https://developer.atlassian.com/changelog/#CHANGE-1525).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPrioritySchemes": {
    "comment": "Get priority schemes",
    "doc": "Get priority schemes\n  Returns a [paginated](#pagination) list of priority schemes.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createPriorityScheme": {
    "comment": "Create priority scheme",
    "doc": "Create priority scheme\n  Creates a new priority scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "suggestedPrioritiesForMappings": {
    "comment": "Suggested priorities for mappings",
    "doc": "Suggested priorities for mappings\n  Returns a [paginated](#pagination) list of priorities that would require mapping, given a change in priorities or projects associated with a priority scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getAvailablePrioritiesByPriorityScheme": {
    "comment": "Get available priorities by priority scheme",
    "doc": "Get available priorities by priority scheme\n  Returns a [paginated](#pagination) list of priorities available for adding to a priority scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deletePriorityScheme": {
    "comment": "Delete priority scheme",
    "doc": "Delete priority scheme\n  Deletes a priority scheme.\n \n  This operation is only available for priority schemes without any associated projects. Any associated projects must be removed from the priority scheme before this operation can be performed.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updatePriorityScheme": {
    "comment": "Update priority scheme",
    "doc": "Update priority scheme\n  Updates a priority scheme. This includes its details, the lists of priorities and projects in it\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getPrioritiesByPriorityScheme": {
    "comment": "Get priorities by priority scheme",
    "doc": "Get priorities by priority scheme\n  Returns a [paginated](#pagination) list of priorities by scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getProjectsByPriorityScheme": {
    "comment": "Get projects by priority scheme",
    "doc": "Get projects by priority scheme\n  Returns a [paginated](#pagination) list of projects by scheme.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getAllProjects": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get all projects\n  Returns all projects visible to the user. Deprecated, use [ Get projects paginated](#api-rest-api-3-project-search-get) that supports search and pagination.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Projects are returned only where the user has Browse Projects or Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "createProject": {
    "comment": "Create project",
    "doc": "Create project\n  Creates a project based on a project type template, as shown in the following table:\n \n  | Project Type Key | Project Template Key |\n  |--|--|\n  | `business` | `com.atlassian.jira-core-project-templates:jira-core-simplified-content-management`, `com.atlassian.jira-core-project-templates:jira-core-simplified-document-approval`, `com.atlassian.jira-core-project-templates:jira-core-simplified-lead-tracking`, `com.atlassian.jira-core-project-templates:jira-core-simplified-process-control`, `com.atlassian.jira-core-project-templates:jira-core-simplified-procurement`, `com.atlassian.jira-core-project-templates:jira-core-simplified-project-management`, `com.atlassian.jira-core-project-templates:jira-core-simplified-recruitment`, `com.atlassian.jira-core-project-templates:jira-core-simplified-task-tracking` |\n  | `service_desk` | `com.atlassian.servicedesk:simplified-it-service-management`, `com.atlassian.servicedesk:simplified-general-service-desk-it`, `com.atlassian.servicedesk:simplified-general-service-desk-business`, `com.atlassian.servicedesk:simplified-external-service-desk`, `com.atlassian.servicedesk:simplified-hr-service-desk`, `com.atlassian.servicedesk:simplified-facilities-service-desk`, `com.atlassian.servicedesk:simplified-legal-service-desk`, `com.atlassian.servicedesk:simplified-analytics-service-desk`, `com.atlassian.servicedesk:simplified-marketing-service-desk`, `com.atlassian.servicedesk:simplified-design-service-desk`, `com.atlassian.servicedesk:simplified-sales-service-desk`, `com.atlassian.servicedesk:simplified-blank-project-business`, `com.atlassian.servicedesk:simplified-blank-project-it`, `com.atlassian.servicedesk:simplified-finance-service-desk`, `com.atlassian.servicedesk:next-gen-it-service-desk`, `com.atlassian.servicedesk:next-gen-hr-service-desk`, `com.atlassian.servicedesk:next-gen-legal-service-desk`, `com.atlassian.servicedesk:next-gen-marketing-service-desk`, `com.atlassian.servicedesk:next-gen-facilities-service-desk`, `com.atlassian.servicedesk:next-gen-general-it-service-desk`, `com.atlassian.servicedesk:next-gen-general-business-service-desk`, `com.atlassian.servicedesk:next-gen-analytics-service-desk`, `com.atlassian.servicedesk:next-gen-finance-service-desk`, `com.atlassian.servicedesk:next-gen-design-service-desk`, `com.atlassian.servicedesk:next-gen-sales-service-desk` |\n  | `software` | `com.pyxis.greenhopper.jira:gh-simplified-agility-kanban`, `com.pyxis.greenhopper.jira:gh-simplified-agility-scrum`, `com.pyxis.greenhopper.jira:gh-simplified-basic`, `com.pyxis.greenhopper.jira:gh-simplified-kanban-classic`, `com.pyxis.greenhopper.jira:gh-simplified-scrum-classic` |\n  The project types are available according to the installed Jira features as follows:\n \n    Jira Core, the default, enables `business` projects.\n    Jira Service Management enables `service_desk` projects.\n    Jira Software enables `software` projects.\n \n  To determine which features are installed, go to Jira settings > Apps > Manage apps and review the System Apps list. To add Jira Software or Jira Service Management into a JIRA instance, use Jira settings > Apps > Finding new apps. For more information, see [ Managing add-ons](https://confluence.atlassian.com/x/S31NLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getRecent": {
    "comment": "Get recent projects",
    "doc": "Get recent projects\n  Returns a list of up to 20 projects recently viewed by the user that are still visible to the user.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Projects are returned only where the user has one of:\n \n    Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchProjects": {
    "comment": "Get projects paginated",
    "doc": "Get projects paginated\n  Returns a [paginated](#pagination) list of projects visible to the user.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Projects are returned only where the user has one of:\n \n    Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllProjectTypes": {
    "comment": "Get all project types",
    "doc": "Get all project types\n  Returns all [project types](https://confluence.atlassian.com/x/Var1Nw), whether or not the instance has a valid license for each type.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAllAccessibleProjectTypes": {
    "comment": "Get licensed project types",
    "doc": "Get licensed project types\n  Returns all [project types](https://confluence.atlassian.com/x/Var1Nw) with a valid license."
  },
  "getProjectTypeByKey": {
    "comment": "Get project type by key",
    "doc": "Get project type by key\n  Returns a [project type](https://confluence.atlassian.com/x/Var1Nw).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAccessibleProjectTypeByKey": {
    "comment": "Get accessible project type by key",
    "doc": "Get accessible project type by key\n  Returns a [project type](https://confluence.atlassian.com/x/Var1Nw) if it is accessible to the user.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deleteProject": {
    "comment": "Delete project",
    "doc": "Delete project\n  Deletes a project.\n \n  You can't delete a project if it's archived. To delete an archived project, restore the project and then delete it. To restore a project, use the Jira UI.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProject": {
    "comment": "Get project",
    "doc": "Get project\n  Returns the [project details](https://confluence.atlassian.com/x/ahLpNw) for a project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "updateProject": {
    "comment": "Update project",
    "doc": "Update project\n  Updates the [project details](https://confluence.atlassian.com/x/ahLpNw) of a project.\n \n  All parameters are optional in the body of the request. Schemes will only be updated if they are included in the request, any omitted schemes will be left unchanged.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg). is only needed when changing the schemes or project key. Otherwise you will only need Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg)"
  },
  "archiveProject": {
    "comment": "Archive project",
    "doc": "Archive project\n  Archives a project. You can't delete a project if it's archived. To delete an archived project, restore the project and then delete it. To restore a project, use the Jira UI.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateProjectAvatar": {
    "comment": "Set project avatar",
    "doc": "Set project avatar\n  Sets the avatar displayed for a project.\n \n  Use [Load project avatar](#api-rest-api-3-project-projectIdOrKey-avatar2-post) to store avatars against the project, before using this operation to set the displayed avatar.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "deleteProjectAvatar": {
    "comment": "Delete project avatar",
    "doc": "Delete project avatar\n  Deletes a custom avatar from a project. Note that system avatars cannot be deleted.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "createProjectAvatar": {
    "comment": "Load project avatar",
    "doc": "Load project avatar\n  Loads an avatar for a project.\n \n  Specify the avatar's local file location in the body of the request. Also, include the following headers:\n \n    `X-Atlassian-Token: no-check` To prevent XSRF protection blocking the request, for more information see [Special Headers](#special-request-headers).\n    `Content-Type: image/image type` Valid image types are JPEG, GIF, or PNG.\n \n  For example:\n  `curl --request POST `\n \n  `--user email@example.com:<api_token> `\n \n  `--header 'X-Atlassian-Token: no-check' `\n \n  `--header 'Content-Type: image/< image_type>' `\n \n  `--data-binary \"<@/path/to/file/with/your/avatar>\" `\n \n  `--url 'https://your-domain.atlassian.net/rest/api/3/project/{projectIdOrKey}/avatar2'`\n \n  The avatar is cropped to a square. If no crop parameters are specified, the square originates at the top left of the image. The length of the square's sides is set to the smaller of the height or width of the image.\n \n  The cropped image is then used to create avatars of 16x16, 24x24, 32x32, and 48x48 in size.\n \n  After creating the avatar use [Set project avatar](#api-rest-api-3-project-projectIdOrKey-avatar-put) to set it as the project's displayed avatar.\n \n  [Permissions](#permissions) required: Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "getAllProjectAvatars": {
    "comment": "Get all project avatars",
    "doc": "Get all project avatars\n  Returns all project avatars, grouped by system and custom avatars.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "removeDefaultProjectClassification": {
    "comment": "Remove the default data classification level from a project",
    "doc": "Remove the default data classification level from a project\n  Remove the default data classification level for a project.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getDefaultProjectClassification": {
    "comment": "Get the default data classification level of a project",
    "doc": "Get the default data classification level of a project\n  Returns the default data classification for a project.\n \n  [Permissions](#permissions) required:\n \n    Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateDefaultProjectClassification": {
    "comment": "Update the default data classification level of a project",
    "doc": "Update the default data classification level of a project\n  Updates the default data classification level for a project.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project.\n    Administer jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectComponentsPaginated": {
    "comment": "Get project components paginated",
    "doc": "Get project components paginated\n  Returns a [paginated](#pagination) list of all components in a project. See the [Get project components](#api-rest-api-3-project-projectIdOrKey-components-get) resource if you want to get a full list of versions without pagination.\n \n  If your project uses Compass components, this API will return a list of Compass components that are linked to issues in that project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getProjectComponents": {
    "comment": "Get project components",
    "doc": "Get project components\n  Returns all components in a project. See the [Get project components paginated](#api-rest-api-3-project-projectIdOrKey-component-get) resource if you want to get a full list of components with pagination.\n \n  If your project uses Compass components, this API will return a paginated list of Compass components that are linked to issues in that project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "deleteProjectAsynchronously": {
    "comment": "Delete project asynchronously",
    "doc": "Delete project asynchronously\n  Deletes a project asynchronously.\n \n  This operation is:\n \n    transactional, that is, if part of the delete fails the project is not deleted.\n    [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getFeaturesForProject": {
    "comment": "Get project features",
    "doc": "Get project features\n  Returns the list of features for a project."
  },
  "toggleFeatureForProject": {
    "comment": "Set project feature state",
    "doc": "Set project feature state\n  Sets the state of a project feature."
  },
  "getProjectPropertyKeys": {
    "comment": "Get project property keys",
    "doc": "Get project property keys\n  Returns all [project property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties) keys for the project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "deleteProjectProperty": {
    "comment": "Delete project property",
    "doc": "Delete project property\n  Deletes the [property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties) from a project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the property."
  },
  "getProjectProperty": {
    "comment": "Get project property",
    "doc": "Get project property\n  Returns the value of a [project property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the property."
  },
  "setProjectProperty": {
    "comment": "Set project property",
    "doc": "Set project property\n  Sets the value of the [project property](https://developer.atlassian.com/cloud/jira/platform/storing-data-without-a-database/#a-id-jira-entity-properties-a-jira-entity-properties). You can use project properties to store custom data against the project.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project in which the property is created."
  },
  "restore": {
    "comment": "Restore deleted or archived project",
    "doc": "Restore deleted or archived project\n  Restores a project that has been archived or placed in the Jira recycle bin.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)for Company managed projects.\n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project for Team managed projects."
  },
  "getProjectRoles": {
    "comment": "Get project roles for project",
    "doc": "Get project roles for project\n  Returns a list of [project roles](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-roles/) for the project returning the name and self URL for each role.\n \n  Note that all project roles are shared with all projects in Jira Cloud. See [Get all project roles](#api-rest-api-3-role-get) for more information.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for any project on the site or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteActor": {
    "comment": "Delete actors from project role",
    "doc": "Delete actors from project role\n  Deletes actors from a project role for the project.\n \n  To remove default actors from the project role, use [Delete default actors from project role](#api-rest-api-3-role-id-actors-delete).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectRole": {
    "comment": "Get project role for project",
    "doc": "Get project role for project\n  Returns a project role's details and actors associated with the project. The list of actors is sorted by display name.\n \n  To check whether a user belongs to a role based on their group memberships, use [Get user](#api-rest-api-3-user-get) with the `groups` expand parameter selected. Then check whether the user keys and groups match with the actors returned for the project.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addActorUsers": {
    "comment": "Add actors to project role",
    "doc": "Add actors to project role\n  Adds actors to a project role for the project.\n \n  To replace all actors for the project, use [Set actors for project role](#api-rest-api-3-project-projectIdOrKey-role-id-put).\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setActors": {
    "comment": "Set actors for project role",
    "doc": "Set actors for project role\n  Sets the actors for a project role for a project, replacing all existing actors.\n \n  To add actors to the project without overwriting the existing list, use [Add actors to project role](#api-rest-api-3-project-projectIdOrKey-role-id-post).\n \n  [Permissions](#permissions) required: Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project or Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectRoleDetails": {
    "comment": "Get project role details",
    "doc": "Get project role details\n  Returns all [project roles](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-roles/) and the details for each role. Note that the list of project roles is common to all projects.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getAllStatuses": {
    "comment": "Get all statuses for project",
    "doc": "Get all statuses for project\n  Returns the valid statuses for a project. The statuses are grouped by issue type, as each project has a set of valid issue types and each issue type has a set of valid statuses.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getProjectVersionsPaginated": {
    "comment": "Get project versions paginated",
    "doc": "Get project versions paginated\n  Returns a [paginated](#pagination) list of all versions in a project. See the [Get project versions](#api-rest-api-3-project-projectIdOrKey-versions-get) resource if you want to get a full list of versions without pagination.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getProjectVersions": {
    "comment": "Get project versions",
    "doc": "Get project versions\n  Returns all versions in a project. The response is not paginated. Use [Get project versions paginated](#api-rest-api-3-project-projectIdOrKey-version-get) if you want to get the versions in a project with pagination.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getProjectEmail": {
    "comment": "Get project's sender email",
    "doc": "Get project's sender email\n  Returns the [project's sender email address](https://confluence.atlassian.com/x/dolKLg).\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "updateProjectEmail": {
    "comment": "Set project's sender email",
    "doc": "Set project's sender email\n  Sets the [project's sender email address](https://confluence.atlassian.com/x/dolKLg).\n \n  If `emailAddress` is an empty string, the default email address is restored.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "getHierarchy": {
    "comment": "Get project issue type hierarchy",
    "doc": "Get project issue type hierarchy\n  Get the issue type hierarchy for a next-gen project.\n \n  The issue type hierarchy for a project consists of:\n \n    Epic at level 1 (optional).\n    One or more issue types at level 0 such as Story, Task, or Bug. Where the issue type Epic is defined, these issue types are used to break down the content of an epic.\n    Subtask at level -1 (optional). This issue type enables level 0 issue types to be broken down into components. Issues based on a level -1 issue type must have a parent issue.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project."
  },
  "getProjectIssueSecurityScheme": {
    "comment": "Get project issue security scheme",
    "doc": "Get project issue security scheme\n  Returns the [issue security scheme](https://confluence.atlassian.com/x/J4lKLg) associated with the project.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or the Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "getNotificationSchemeForProject": {
    "comment": "Get project notification scheme",
    "doc": "Get project notification scheme\n  Gets a [notification scheme](https://confluence.atlassian.com/x/8YdKLg) associated with the project.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "getAssignedPermissionScheme": {
    "comment": "Get assigned permission scheme",
    "doc": "Get assigned permission scheme\n  Gets the [permission scheme](https://confluence.atlassian.com/x/yodKLg) associated with the project.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg)."
  },
  "assignPermissionScheme": {
    "comment": "Assign permission scheme",
    "doc": "Assign permission scheme\n  Assigns a permission scheme with a project. See [Managing project permissions](https://confluence.atlassian.com/x/yodKLg) for more information about permission schemes.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)"
  },
  "getSecurityLevelsForProject": {
    "comment": "Get project issue security levels",
    "doc": "Get project issue security levels\n  Returns all [issue security](https://confluence.atlassian.com/x/J4lKLg) levels for the project that the user has access to.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [global permission](https://confluence.atlassian.com/x/x4dKLg) for the project, however, issue security levels are only returned for authenticated user with Set Issue Security [global permission](https://confluence.atlassian.com/x/x4dKLg) for the project."
  },
  "getAllProjectCategories": {
    "comment": "Get all project categories",
    "doc": "Get all project categories\n  Returns all project categories.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createProjectCategory": {
    "comment": "Create project category",
    "doc": "Create project category\n  Creates a project category.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeProjectCategory": {
    "comment": "Delete project category",
    "doc": "Delete project category\n  Deletes a project category.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectCategoryById": {
    "comment": "Get project category by ID",
    "doc": "Get project category by ID\n  Returns a project category.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "updateProjectCategory": {
    "comment": "Update project category",
    "doc": "Update project category\n  Updates a project category.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "validateProjectKey": {
    "comment": "Validate project key",
    "doc": "Validate project key\n  Validates a project key by confirming the key is a valid string and not in use.\n \n  [Permissions](#permissions) required: None."
  },
  "getValidProjectKey": {
    "comment": "Get valid project key",
    "doc": "Get valid project key\n  Validates a project key and, if the key is invalid or in use, generates a valid random string for the project key.\n \n  [Permissions](#permissions) required: None."
  },
  "getValidProjectName": {
    "comment": "Get valid project name",
    "doc": "Get valid project name\n  Checks that a project name isn't in use. If the name isn't in use, the passed string is returned. If the name is in use, this operation attempts to generate a valid project name based on the one supplied, usually by adding a sequence number. If a valid project name cannot be generated, a 404 response is returned.\n \n  [Permissions](#permissions) required: None."
  },
  "getResolutions": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get resolutions\n  Returns a list of all issue resolution values.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "createResolution": {
    "comment": "Create resolution",
    "doc": "Create resolution\n  Creates an issue resolution.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setDefaultResolution": {
    "comment": "Set default resolution",
    "doc": "Set default resolution\n  Sets default issue resolution.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "moveResolutions": {
    "comment": "Move resolutions",
    "doc": "Move resolutions\n  Changes the order of issue resolutions.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchResolutions": {
    "comment": "Search resolutions",
    "doc": "Search resolutions\n  Returns a [paginated](#pagination) list of resolutions. The list can contain all resolutions or a subset determined by any combination of these criteria:\n \n    a list of resolutions IDs.\n    whether the field configuration is a default. This returns resolutions from company-managed (classic) projects only, as there is no concept of default resolutions in team-managed projects.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deleteResolution": {
    "comment": "Delete resolution",
    "doc": "Delete resolution\n  Deletes an issue resolution.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain subsequent updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getResolution": {
    "comment": "Get resolution",
    "doc": "Get resolution\n  Returns an issue resolution value.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "updateResolution": {
    "comment": "Update resolution",
    "doc": "Update resolution\n  Updates an issue resolution.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllProjectRoles": {
    "comment": "Get all project roles",
    "doc": "Get all project roles\n  Gets a list of all project roles, complete with project role details and default actors.\n \n  ### About project roles ###\n \n  [Project roles](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-roles/) are a flexible way to to associate users and groups with projects. In Jira Cloud, the list of project roles is shared globally with all projects, but each project can have a different set of actors associated with it (unlike groups, which have the same membership throughout all Jira applications).\n \n  Project roles are used in [permission schemes](#api-rest-api-3-permissionscheme-get), [email notification schemes](#api-rest-api-3-notificationscheme-get), [issue security levels](#api-rest-api-3-issuesecurityschemes-get), [comment visibility](#api-rest-api-3-comment-list-post), and workflow conditions.\n \n  #### Members and actors ####\n \n  In the Jira REST API, a member of a project role is called an actor. An actor is a group or user associated with a project role.\n \n  Actors may be set as [default members](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-roles/#Specifying-'default-members'-for-a-project-role) of the project role or set at the project level:\n \n    Default actors: Users and groups that are assigned to the project role for all newly created projects. The default actors can be removed at the project level later if desired.\n    Actors: Users and groups that are associated with a project role for a project, which may differ from the default actors. This enables you to assign a user to different roles in different projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createProjectRole": {
    "comment": "Create project role",
    "doc": "Create project role\n  Creates a new project role with no [default actors](#api-rest-api-3-resolution-get). You can use the [Add default actors to project role](#api-rest-api-3-role-id-actors-post) operation to add default actors to the project role after creating it.\n \n  Note that although a new project role is available to all projects upon creation, any default actors that are associated with the project role are not added to projects that existed prior to the role being created.<\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteProjectRole": {
    "comment": "Delete project role",
    "doc": "Delete project role\n  Deletes a project role. You must specify a replacement project role if you wish to delete a project role that is in use.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectRoleById": {
    "comment": "Get project role by ID",
    "doc": "Get project role by ID\n  Gets the project role details and the default actors associated with the role. The list of default actors is sorted by display name.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "partialUpdateProjectRole": {
    "comment": "Partial update project role",
    "doc": "Partial update project role\n  Updates either the project role's name or its description.\n \n  You cannot update both the name and description at the same time using this operation. If you send a request with a name and a description only the name is updated.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "fullyUpdateProjectRole": {
    "comment": "Fully update project role",
    "doc": "Fully update project role\n  Updates the project role's name and description. You must include both a name and a description in the request.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteProjectRoleActorsFromRole": {
    "comment": "Delete default actors from project role",
    "doc": "Delete default actors from project role\n  Deletes the [default actors](#api-rest-api-3-resolution-get) from a project role. You may delete a group or user, but you cannot delete a group and a user in the same request.\n \n  Changing a project role's default actors does not affect project role members for projects already created.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getProjectRoleActorsForRole": {
    "comment": "Get default actors for project role",
    "doc": "Get default actors for project role\n  Returns the [default actors](#api-rest-api-3-resolution-get) for the project role.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addProjectRoleActorsToRole": {
    "comment": "Add default actors to project role",
    "doc": "Add default actors to project role\n  Adds [default actors](#api-rest-api-3-resolution-get) to a role. You may add groups or users, but you cannot add groups and users in the same request.\n \n  Changing a project role's default actors does not affect project role members for projects already created.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getScreens": {
    "comment": "Get screens",
    "doc": "Get screens\n  Returns a [paginated](#pagination) list of all screens or those specified by one or more screen IDs.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createScreen": {
    "comment": "Create screen",
    "doc": "Create screen\n  Creates a screen with a default field tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "addFieldToDefaultScreen": {
    "comment": "Add field to default screen",
    "doc": "Add field to default screen\n  Adds a field to the default tab of the default screen.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getBulkScreenTabs": {
    "comment": "Get bulk screen tabs",
    "doc": "Get bulk screen tabs\n  Returns the list of tabs for a bulk of screens.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteScreen": {
    "comment": "Delete screen",
    "doc": "Delete screen\n  Deletes a screen. A screen cannot be deleted if it is used in a screen scheme, workflow, or workflow draft.\n \n  Only screens used in classic projects can be deleted."
  },
  "updateScreen": {
    "comment": "Update screen",
    "doc": "Update screen\n  Updates a screen. Only screens used in classic projects can be updated.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAvailableScreenFields": {
    "comment": "Get available screen fields",
    "doc": "Get available screen fields\n  Returns the fields that can be added to a tab on a screen.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllScreenTabs": {
    "comment": "Get all screen tabs",
    "doc": "Get all screen tabs\n  Returns the list of tabs for a screen.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) when the project key is specified, providing that the screen is associated with the project through a Screen Scheme and Issue Type Screen Scheme."
  },
  "addScreenTab": {
    "comment": "Create screen tab",
    "doc": "Create screen tab\n  Creates a tab for a screen.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteScreenTab": {
    "comment": "Delete screen tab",
    "doc": "Delete screen tab\n  Deletes a screen tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "renameScreenTab": {
    "comment": "Update screen tab",
    "doc": "Update screen tab\n  Updates the name of a screen tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllScreenTabFields": {
    "comment": "Get all screen tab fields",
    "doc": "Get all screen tab fields\n  Returns all fields for a screen tab.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Administer projects [project permission](https://confluence.atlassian.com/x/yodKLg) when the project key is specified, providing that the screen is associated with the project through a Screen Scheme and Issue Type Screen Scheme."
  },
  "addScreenTabField": {
    "comment": "Add screen tab field",
    "doc": "Add screen tab field\n  Adds a field to a screen tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "removeScreenTabField": {
    "comment": "Remove screen tab field",
    "doc": "Remove screen tab field\n  Removes a field from a screen tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "moveScreenTabField": {
    "comment": "Move screen tab field",
    "doc": "Move screen tab field\n  Moves a screen tab field.\n \n  If `after` and `position` are provided in the request, `position` is ignored.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "moveScreenTab": {
    "comment": "Move screen tab",
    "doc": "Move screen tab\n  Moves a screen tab.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getScreenSchemes": {
    "comment": "Get screen schemes",
    "doc": "Get screen schemes\n  Returns a [paginated](#pagination) list of screen schemes.\n \n  Only screen schemes used in classic projects are returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createScreenScheme": {
    "comment": "Create screen scheme",
    "doc": "Create screen scheme\n  Creates a screen scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteScreenScheme": {
    "comment": "Delete screen scheme",
    "doc": "Delete screen scheme\n  Deletes a screen scheme. A screen scheme cannot be deleted if it is used in an issue type screen scheme.\n \n  Only screens schemes used in classic projects can be deleted.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateScreenScheme": {
    "comment": "Update screen scheme",
    "doc": "Update screen scheme\n  Updates a screen scheme. Only screen schemes used in classic projects can be updated.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "searchForIssuesUsingJql": {
    "comment": "Search for issues using JQL (GET)",
    "doc": "Search for issues using JQL (GET)\n  Searches for issues using [JQL](https://confluence.atlassian.com/x/egORLQ).\n \n  If the JQL query expression is too large to be encoded as a query parameter, use the [POST](#api-rest-api-3-search-post) version of this resource.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "searchForIssuesUsingJqlPost": {
    "comment": "Search for issues using JQL (POST)",
    "doc": "Search for issues using JQL (POST)\n  Searches for issues using [JQL](https://confluence.atlassian.com/x/egORLQ).\n \n  There is a [GET](#api-rest-api-3-search-get) version of this resource that can be used for smaller JQL query expressions.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "countIssues": {
    "comment": "Count issues using JQL",
    "doc": "Count issues using JQL\n  Provide an estimated count of the issues that match the [JQL](https://confluence.atlassian.com/x/egORLQ). Recent updates might not be immediately visible in the returned output. This endpoint requires JQL to be bounded.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "searchForIssuesIds": {
    "comment": "Search issue IDs using JQL",
    "doc": "Search issue IDs using JQL\n  Searches for IDs of issues using [JQL](https://confluence.atlassian.com/x/egORLQ).\n \n  Use the [Search](#api-rest-api-3-search-post) endpoint if you need to fetch more than just issue IDs. The Search endpoint returns more information, but may take much longer to respond to requests. This is because it uses a different mechanism for ordering results than this endpoint and doesn't provide the total number of results for your query.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "searchAndReconsileIssuesUsingJql": {
    "comment": "Search for issues using JQL enhanced search (GET)",
    "doc": "Search for issues using JQL enhanced search (GET)\n  Searches for issues using [JQL](https://confluence.atlassian.com/x/egORLQ). Recent updates might not be immediately visible in the returned search results. If you need read-after-write consistency, you can utilize the `reconcileIssues` parameter to ensure stronger consistency assurances. This operation can be accessed anonymously.\n \n  If the JQL query expression is too large to be encoded as a query parameter, use the [POST](#api-rest-api-3-search-post) version of this resource.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "searchAndReconsileIssuesUsingJqlPost": {
    "comment": "Search for issues using JQL enhanced search (POST)",
    "doc": "Search for issues using JQL enhanced search (POST)\n  Searches for issues using [JQL](https://confluence.atlassian.com/x/egORLQ). Recent updates might not be immediately visible in the returned search results. If you need read-after-write consistency, you can utilize the `reconcileIssues` parameter to ensure stronger consistency assurances. This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Issues are included in the response where the user has:\n \n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the issue.\n    If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."
  },
  "getIssueSecurityLevel": {
    "comment": "Get issue security level",
    "doc": "Get issue security level\n  Returns details of an issue security level.\n \n  Use [Get issue security scheme](#api-rest-api-3-issuesecurityschemes-id-get) to obtain the IDs of issue security levels associated with the issue security scheme.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getServerInfo": {
    "comment": "Get Jira instance info",
    "doc": "Get Jira instance info\n  Returns information about the Jira instance.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getIssueNavigatorDefaultColumns": {
    "comment": "Get issue navigator default columns",
    "doc": "Get issue navigator default columns\n  Returns the default issue navigator columns.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setIssueNavigatorDefaultColumns": {
    "comment": "Set issue navigator default columns",
    "doc": "Set issue navigator default columns\n  Sets the default issue navigator columns.\n \n  The `columns` parameter accepts a navigable field value and is expressed as HTML form data. To specify multiple columns, pass multiple `columns` parameters. For example, in curl:\n \n  `curl -X PUT -d columns=summary -d columns=description https://your-domain.atlassian.net/rest/api/3/settings/columns`\n \n  If no column details are sent, then all default columns are removed.\n \n  A navigable field is one that can be used as a column on the issue navigator. Find details of navigable issue columns using [Get fields](#api-rest-api-3-field-get).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getStatuses": {
    "comment": "Get all statuses",
    "doc": "Get all statuses\n  Returns a list of all statuses associated with active workflows.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getStatus": {
    "comment": "Get status",
    "doc": "Get status\n  Returns a status. The status must be associated with an active workflow to be returned.\n \n  If a name is used on more than one status, only the status found first is returned. Therefore, identifying the status by its ID may be preferable.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getStatusCategories": {
    "comment": "Get all status categories",
    "doc": "Get all status categories\n  Returns a list of all status categories.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getStatusCategory": {
    "comment": "Get status category",
    "doc": "Get status category\n  Returns a status category. Status categories provided a mechanism for categorizing [statuses](#api-rest-api-3-status-idOrName-get).\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "deleteStatusesById": {
    "comment": "Bulk delete Statuses",
    "doc": "Bulk delete Statuses\n  Deletes statuses by ID.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission.](https://confluence.atlassian.com/x/yodKLg)\n    Administer Jira [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "getStatusesById": {
    "comment": "Bulk get statuses",
    "doc": "Bulk get statuses\n  Returns a list of the statuses specified by one or more status IDs.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission.](https://confluence.atlassian.com/x/yodKLg)\n    Administer Jira [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "createStatuses": {
    "comment": "Bulk create statuses",
    "doc": "Bulk create statuses\n  Creates statuses for a global or project scope.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission.](https://confluence.atlassian.com/x/yodKLg)\n    Administer Jira [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "updateStatuses": {
    "comment": "Bulk update statuses",
    "doc": "Bulk update statuses\n  Updates statuses by ID.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission.](https://confluence.atlassian.com/x/yodKLg)\n    Administer Jira [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "search": {
    "comment": "Search statuses paginated",
    "doc": "Search statuses paginated\n  Returns a [paginated](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#pagination) list of statuses that match a search on name or project.\n \n  [Permissions](#permissions) required:\n \n    Administer projects [project permission.](https://confluence.atlassian.com/x/yodKLg)\n    Administer Jira [project permission.](https://confluence.atlassian.com/x/yodKLg)"
  },
  "getTask": {
    "comment": "Get task",
    "doc": "Get task\n  Returns the status of a [long-running asynchronous task](#async).\n \n  When a task has finished, this operation returns the JSON blob applicable to the task. See the documentation of the operation that created the task for details. Task details are not permanently retained. As of September 2019, details are retained for 14 days although this period may change without notice.\n \n  Deprecation notice: The required OAuth 2.0 scopes will be updated on June 15, 2024.\n \n    `read:jira-work`\n \n  [Permissions](#permissions) required: either of:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Creator of the task."
  },
  "cancelTask": {
    "comment": "Cancel task",
    "doc": "Cancel task\n  Cancels a task.\n \n  [Permissions](#permissions) required: either of:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg).\n    Creator of the task."
  },
  "getUiModifications": {
    "comment": "Get UI modifications",
    "doc": "Get UI modifications\n  Gets UI modifications. UI modifications can only be retrieved by Forge apps.\n \n  [Permissions](#permissions) required: None.\n \n  The new `read:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "createUiModification": {
    "comment": "Create UI modification",
    "doc": "Create UI modification\n  Creates a UI modification. UI modification can only be created by Forge apps.\n \n  Each app can define up to 3000 UI modifications. Each UI modification can define up to 1000 contexts. The same context can be assigned to maximum 100 UI modifications.\n \n  [Permissions](#permissions) required:\n \n    None if the UI modification is created without contexts.\n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for one or more projects, if the UI modification is created with contexts.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "deleteUiModification": {
    "comment": "Delete UI modification",
    "doc": "Delete UI modification\n  Deletes a UI modification. All the contexts that belong to the UI modification are deleted too. UI modification can only be deleted by Forge apps.\n \n  [Permissions](#permissions) required: None.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "updateUiModification": {
    "comment": "Update UI modification",
    "doc": "Update UI modification\n  Updates a UI modification. UI modification can only be updated by Forge apps.\n \n  Each UI modification can define up to 1000 contexts. The same context can be assigned to maximum 100 UI modifications.\n \n  [Permissions](#permissions) required:\n \n    None if the UI modification is created without contexts.\n    Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for one or more projects, if the UI modification is created with contexts.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "getAvatars": {
    "comment": "Get avatars",
    "doc": "Get avatars\n  Returns the system and custom avatars for a project, issue type or priority.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    for custom project avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project the avatar belongs to.\n    for custom issue type avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for at least one project the issue type is used in.\n    for system avatars, none.\n    for priority avatars, none."
  },
  "storeAvatar": {
    "comment": "Load avatar",
    "doc": "Load avatar\n  Loads a custom avatar for a project, issue type or priority.\n \n  Specify the avatar's local file location in the body of the request. Also, include the following headers:\n \n    `X-Atlassian-Token: no-check` To prevent XSRF protection blocking the request, for more information see [Special Headers](#special-request-headers).\n    `Content-Type: image/image type` Valid image types are JPEG, GIF, or PNG.\n \n  For example:\n  `curl --request POST `\n \n  `--user email@example.com:<api_token> `\n \n  `--header 'X-Atlassian-Token: no-check' `\n \n  `--header 'Content-Type: image/< image_type>' `\n \n  `--data-binary \"<@/path/to/file/with/your/avatar>\" `\n \n  `--url 'https://your-domain.atlassian.net/rest/api/3/universal_avatar/type/{type}/owner/{entityId}'`\n \n  The avatar is cropped to a square. If no crop parameters are specified, the square originates at the top left of the image. The length of the square's sides is set to the smaller of the height or width of the image.\n \n  The cropped image is then used to create avatars of 16x16, 24x24, 32x32, and 48x48 in size.\n \n  After creating the avatar use:\n \n    [Update issue type](#api-rest-api-3-issuetype-id-put) to set it as the issue type's displayed avatar.\n    [Set project avatar](#api-rest-api-3-project-projectIdOrKey-avatar-put) to set it as the project's displayed avatar.\n    [Update priority](#api-rest-api-3-priority-id-put) to set it as the priority's displayed avatar.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteAvatar": {
    "comment": "Delete avatar",
    "doc": "Delete avatar\n  Deletes an avatar from a project, issue type or priority.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAvatarImageByType": {
    "comment": "Get avatar image by type",
    "doc": "Get avatar image by type\n  Returns the default project, issue type or priority avatar image.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "getAvatarImageById": {
    "comment": "Get avatar image by ID",
    "doc": "Get avatar image by ID\n  Returns a project, issue type or priority avatar image by ID.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    For system avatars, none.\n    For custom project avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project the avatar belongs to.\n    For custom issue type avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for at least one project the issue type is used in.\n    For priority avatars, none."
  },
  "getAvatarImageByOwner": {
    "comment": "Get avatar image by owner",
    "doc": "Get avatar image by owner\n  Returns the avatar image for a project, issue type or priority.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    For system avatars, none.\n    For custom project avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project the avatar belongs to.\n    For custom issue type avatars, Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for at least one project the issue type is used in.\n    For priority avatars, none."
  },
  "removeUser": {
    "comment": "Delete user",
    "doc": "Delete user\n  Deletes a user. If the operation completes successfully then the user is removed from Jira's user base. This operation does not delete the user's Atlassian account.\n \n  [Permissions](#permissions) required: Site administration (that is, membership of the site-admin [group](https://confluence.atlassian.com/x/24xjL))."
  },
  "getUser": {
    "comment": "Get user",
    "doc": "Get user\n  Returns a user.\n \n  Privacy controls are applied to the response based on the user's preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createUser": {
    "comment": "Create user",
    "doc": "Create user\n  Creates a user. This resource is retained for legacy compatibility. As soon as a more suitable alternative is available this resource will be deprecated.\n \n  If the user exists and has access to Jira, the operation returns a 201 status. If the user exists but does not have access to Jira, the operation returns a 400 status.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "findBulkAssignableUsers": {
    "comment": "Find users assignable to projects",
    "doc": "Find users assignable to projects\n  Returns a list of users who can be assigned issues in one or more projects. The list may be restricted to users whose attributes match a string.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that can be assigned issues in the projects. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who can be assigned issues in the projects, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: None."
  },
  "findAssignableUsers": {
    "comment": "Find users assignable to issues",
    "doc": "Find users assignable to issues\n  Returns a list of users that can be assigned to an issue. Use this operation to find the list of users who can be assigned to:\n \n    a new issue, by providing the `projectKeyOrId`.\n    an updated issue, by providing the `issueKey`.\n    to an issue during a transition (workflow action), by providing the `issueKey` and the transition id in `actionDescriptorId`. You can obtain the IDs of an issue's valid transitions using the `transitions` option in the `expand` parameter of [ Get issue](#api-rest-api-3-issue-issueIdOrKey-get).\n \n  In all these cases, you can pass an account ID to determine if a user can be assigned to an issue. The user is returned in the response if they can be assigned to the issue or issue transition.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that can be assigned the issue. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who can be assigned the issue, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg) or Assign issues [project permission](https://confluence.atlassian.com/x/yodKLg)"
  },
  "bulkGetUsers": {
    "comment": "Bulk get users",
    "doc": "Bulk get users\n  Returns a [paginated](#pagination) list of the users specified by one or more account IDs.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "bulkGetUsersMigration": {
    "comment": "Get account IDs for users",
    "doc": "Get account IDs for users\n  Returns the account IDs for the users specified in the `key` or `username` parameters. Note that multiple `key` or `username` parameters can be specified.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "resetUserColumns": {
    "comment": "Reset user default columns",
    "doc": "Reset user default columns\n  Resets the default [ issue table columns](https://confluence.atlassian.com/x/XYdKLg) for the user to the system default. If `accountId` is not passed, the calling user's default columns are reset.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to set the columns on any user.\n    Permission to access Jira, to set the calling user's columns."
  },
  "getUserDefaultColumns": {
    "comment": "Get user default columns",
    "doc": "Get user default columns\n  Returns the default [issue table columns](https://confluence.atlassian.com/x/XYdKLg) for the user. If `accountId` is not passed in the request, the calling user's details are returned.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLgl), to get the column details for any user.\n    Permission to access Jira, to get the calling user's column details."
  },
  "setUserColumns": {
    "comment": "Set user default columns",
    "doc": "Set user default columns\n  Sets the default [ issue table columns](https://confluence.atlassian.com/x/XYdKLg) for the user. If an account ID is not passed, the calling user's default columns are set. If no column details are sent, then all default columns are removed.\n \n  The parameters for this resource are expressed as HTML form data. For example, in curl:\n \n  `curl -X PUT -d columns=summary -d columns=description https://your-domain.atlassian.net/rest/api/3/user/columns?accountId=5b10ac8d82e05b22cc7d4ef5'`\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to set the columns on any user.\n    Permission to access Jira, to set the calling user's columns."
  },
  "getUserEmail": {
    "comment": "Get user email",
    "doc": "Get user email\n  Returns a user's email address regardless of the user's profile visibility settings. For Connect apps, this API is only available to apps approved by Atlassian, according to these [guidelines](https://community.developer.atlassian.com/t/guidelines-for-requesting-access-to-email-address/27603). For Forge apps, this API only supports access via asApp() requests."
  },
  "getUserEmailBulk": {
    "comment": "Get user email bulk",
    "doc": "Get user email bulk\n  Returns a user's email address regardless of the user's profile visibility settings. For Connect apps, this API is only available to apps approved by Atlassian, according to these [guidelines](https://community.developer.atlassian.com/t/guidelines-for-requesting-access-to-email-address/27603). For Forge apps, this API only supports access via asApp() requests."
  },
  "getUserGroups": {
    "comment": "Get user groups",
    "doc": "Get user groups\n  Returns the groups to which a user belongs.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "findUsersWithAllPermissions": {
    "comment": "Find users with permissions",
    "doc": "Find users with permissions\n  Returns a list of users who fulfill these criteria:\n \n    their user attributes match a search string.\n    they have a set of permissions for a project or issue.\n \n  If no search string is provided, a list of all users with the permissions is returned.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that match the search string and have permission for the project or issue. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who match the search string and have permission for the project or issue, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to get users for any project.\n    Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for a project, to get users for that project."
  },
  "findUsersForPicker": {
    "comment": "Find users for picker",
    "doc": "Find users for picker\n  Returns a list of users whose attributes match the query term. The returned object includes the `html` field where the matched query term is highlighted with the HTML strong tag. A list of account IDs can be provided to exclude users from the results.\n \n  This operation takes the users in the range defined by `maxResults`, up to the thousandth user, and then returns only the users from that range that match the query term. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who match the query term, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg). Anonymous calls and calls by users without the required permission return search results for an exact name match only."
  },
  "getUserPropertyKeys": {
    "comment": "Get user property keys",
    "doc": "Get user property keys\n  Returns the keys of all properties for a user.\n \n  Note: This operation does not access the [user properties](https://confluence.atlassian.com/x/8YxjL) created and maintained in Jira.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to access the property keys on any user.\n    Access to Jira, to access the calling user's property keys."
  },
  "deleteUserProperty": {
    "comment": "Delete user property",
    "doc": "Delete user property\n  Deletes a property from a user.\n \n  Note: This operation does not access the [user properties](https://confluence.atlassian.com/x/8YxjL) created and maintained in Jira.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to delete a property from any user.\n    Access to Jira, to delete a property from the calling user's record."
  },
  "getUserProperty": {
    "comment": "Get user property",
    "doc": "Get user property\n  Returns the value of a user's property. If no property key is provided [Get user property keys](#api-rest-api-3-user-properties-get) is called.\n \n  Note: This operation does not access the [user properties](https://confluence.atlassian.com/x/8YxjL) created and maintained in Jira.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to get a property from any user.\n    Access to Jira, to get a property from the calling user's record."
  },
  "setUserProperty": {
    "comment": "Set user property",
    "doc": "Set user property\n  Sets the value of a user's property. Use this resource to store custom data against a user.\n \n  Note: This operation does not access the [user properties](https://confluence.atlassian.com/x/8YxjL) created and maintained in Jira.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg), to set a property on any user.\n    Access to Jira, to set a property on the calling user's record."
  },
  "findUsers": {
    "comment": "Find users",
    "doc": "Find users\n  Returns a list of active users that match the search string and property.\n \n  This operation first applies a filter to match the search string and property, and then takes the filtered users in the range defined by `startAt` and `maxResults`, up to the thousandth user. To get all the users who match the search string and property, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  This operation can be accessed anonymously.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg). Anonymous calls or calls by users without the required permission return empty search results."
  },
  "findUsersByQuery": {
    "comment": "Find users by query",
    "doc": "Find users by query\n  Finds users with a structured query and returns a [paginated](#pagination) list of user details.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that match the structured query. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who match the structured query, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg).\n \n  The query statements are:\n \n    `is assignee of PROJ` Returns the users that are assignees of at least one issue in project PROJ.\n    `is assignee of (PROJ-1, PROJ-2)` Returns users that are assignees on the issues PROJ-1 or PROJ-2.\n    `is reporter of (PROJ-1, PROJ-2)` Returns users that are reporters on the issues PROJ-1 or PROJ-2.\n    `is watcher of (PROJ-1, PROJ-2)` Returns users that are watchers on the issues PROJ-1 or PROJ-2.\n    `is voter of (PROJ-1, PROJ-2)` Returns users that are voters on the issues PROJ-1 or PROJ-2.\n    `is commenter of (PROJ-1, PROJ-2)` Returns users that have posted a comment on the issues PROJ-1 or PROJ-2.\n    `is transitioner of (PROJ-1, PROJ-2)` Returns users that have performed a transition on issues PROJ-1 or PROJ-2.\n    `[propertyKey].entity.property.path is \"property value\"` Returns users with the entity property value.\n \n  The list of issues can be extended as needed, as in (PROJ-1, PROJ-2, ... PROJ-n). Statements can be combined using the `AND` and `OR` operators to form more complex queries. For example:\n \n  `is assignee of PROJ AND [propertyKey].entity.property.path is \"property value\"`"
  },
  "findUserKeysByQuery": {
    "comment": "Find user keys by query",
    "doc": "Find user keys by query\n  Finds users with a structured query and returns a [paginated](#pagination) list of user keys.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that match the structured query. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who match the structured query, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg).\n \n  The query statements are:\n \n    `is assignee of PROJ` Returns the users that are assignees of at least one issue in project PROJ.\n    `is assignee of (PROJ-1, PROJ-2)` Returns users that are assignees on the issues PROJ-1 or PROJ-2.\n    `is reporter of (PROJ-1, PROJ-2)` Returns users that are reporters on the issues PROJ-1 or PROJ-2.\n    `is watcher of (PROJ-1, PROJ-2)` Returns users that are watchers on the issues PROJ-1 or PROJ-2.\n    `is voter of (PROJ-1, PROJ-2)` Returns users that are voters on the issues PROJ-1 or PROJ-2.\n    `is commenter of (PROJ-1, PROJ-2)` Returns users that have posted a comment on the issues PROJ-1 or PROJ-2.\n    `is transitioner of (PROJ-1, PROJ-2)` Returns users that have performed a transition on issues PROJ-1 or PROJ-2.\n    `[propertyKey].entity.property.path is \"property value\"` Returns users with the entity property value.\n \n  The list of issues can be extended as needed, as in (PROJ-1, PROJ-2, ... PROJ-n). Statements can be combined using the `AND` and `OR` operators to form more complex queries. For example:\n \n  `is assignee of PROJ AND [propertyKey].entity.property.path is \"property value\"`"
  },
  "findUsersWithBrowsePermission": {
    "comment": "Find users with browse permission",
    "doc": "Find users with browse permission\n  Returns a list of users who fulfill these criteria:\n \n    their user attributes match a search string.\n    they have permission to browse issues.\n \n  Use this resource to find users who can browse:\n \n    an issue, by providing the `issueKey`.\n    any issue in a project, by providing the `projectKey`.\n \n  This operation takes the users in the range defined by `startAt` and `maxResults`, up to the thousandth user, and then returns only the users from that range that match the search string and have permission to browse issues. This means the operation usually returns fewer users than specified in `maxResults`. To get all the users who match the search string and have permission to browse issues, use [Get all users](#api-rest-api-3-users-search-get) and filter the records in your code.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg). Anonymous calls and calls by users without the required permission return empty search results."
  },
  "getAllUsersDefault": {
    "comment": "Get all users default",
    "doc": "Get all users default\n  Returns a list of all users, including active users, inactive users and previously deleted users that have an Atlassian account.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getAllUsers": {
    "comment": "Get all users",
    "doc": "Get all users\n  Returns a list of all users, including active users, inactive users and previously deleted users that have an Atlassian account.\n \n  Privacy controls are applied to the response based on the users' preferences. This could mean, for example, that the user's email address is hidden. See the [Profile visibility overview](https://developer.atlassian.com/cloud/jira/platform/profile-visibility/) for more details.\n \n  [Permissions](#permissions) required: Browse users and groups [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createVersion": {
    "comment": "Create version",
    "doc": "Create version\n  Creates a project version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project the version is added to."
  },
  "deleteVersion": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Delete version\n  Deletes a project version.\n \n  Deprecated, use [ Delete and replace version](#api-rest-api-3-version-id-removeAndSwap-post) that supports swapping version values in custom fields, in addition to the swapping for `fixVersion` and `affectedVersion` provided in this resource.\n \n  Alternative versions can be provided to update issues that use the deleted version in `fixVersion` or `affectedVersion`. If alternatives are not provided, occurrences of `fixVersion` and `affectedVersion` that contain the deleted version are cleared.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that contains the version."
  },
  "getVersion": {
    "comment": "Get version",
    "doc": "Get version\n  Returns a project version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the version."
  },
  "updateVersion": {
    "comment": "Update version",
    "doc": "Update version\n  Updates a project version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that contains the version."
  },
  "mergeVersions": {
    "comment": "Merge versions",
    "doc": "Merge versions\n  Merges two project versions. The merge is completed by deleting the version specified in `id` and replacing any occurrences of its ID in `fixVersion` with the version ID specified in `moveIssuesTo`.\n \n  Consider using [ Delete and replace version](#api-rest-api-3-version-id-removeAndSwap-post) instead. This resource supports swapping version values in `fixVersion`, `affectedVersion`, and custom fields.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that contains the version."
  },
  "moveVersion": {
    "comment": "Move version",
    "doc": "Move version\n  Modifies the version's sequence within the project, which affects the display order of the versions in Jira.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects project permission for the project that contains the version."
  },
  "getVersionRelatedIssues": {
    "comment": "Get version's related issues count",
    "doc": "Get version's related issues count\n  Returns the following counts for a version:\n \n    Number of issues where the `fixVersion` is set to the version.\n    Number of issues where the `affectedVersion` is set to the version.\n    Number of issues where a version custom field is set to the version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects project permission for the project that contains the version."
  },
  "getRelatedWork": {
    "comment": "Get related work",
    "doc": "Get related work\n  Returns related work items for the given version id.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project containing the version."
  },
  "createRelatedWork": {
    "comment": "Create related work",
    "doc": "Create related work\n  Creates a related work for the given version. You can only create a generic link type of related works via this API. relatedWorkId will be auto-generated UUID, that does not need to be provided.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Resolve issues: and Edit issues [Managing project permissions](https://confluence.atlassian.com/adminjiraserver/managing-project-permissions-938847145.html) for the project that contains the version."
  },
  "updateRelatedWork": {
    "comment": "Update related work",
    "doc": "Update related work\n  Updates the given related work. You can only update generic link related works via Rest APIs. Any archived version related works can't be edited.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Resolve issues: and Edit issues [Managing project permissions](https://confluence.atlassian.com/adminjiraserver/managing-project-permissions-938847145.html) for the project that contains the version."
  },
  "deleteAndReplaceVersion": {
    "comment": "Delete and replace version",
    "doc": "Delete and replace version\n  Deletes a project version.\n \n  Alternative versions can be provided to update issues that use the deleted version in `fixVersion`, `affectedVersion`, or any version picker custom fields. If alternatives are not provided, occurrences of `fixVersion`, `affectedVersion`, and any version picker custom field, that contain the deleted version, are cleared. Any replacement version must be in the same project as the version being deleted and cannot be the version being deleted.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg) or Administer Projects [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that contains the version."
  },
  "getVersionUnresolvedIssues": {
    "comment": "Get version's unresolved issues count",
    "doc": "Get version's unresolved issues count\n  Returns counts of the issues and unresolved issues for the project version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Browse projects project permission for the project that contains the version."
  },
  "deleteRelatedWork": {
    "comment": "Delete related work",
    "doc": "Delete related work\n  Deletes the given related work for the given version.\n \n  This operation can be accessed anonymously.\n \n  [Permissions](#permissions) required: Resolve issues: and Edit issues [Managing project permissions](https://confluence.atlassian.com/adminjiraserver/managing-project-permissions-938847145.html) for the project that contains the version."
  },
  "deleteWebhookById": {
    "comment": "Delete webhooks by ID",
    "doc": "Delete webhooks by ID\n  Removes webhooks by ID. Only webhooks registered by the calling app are removed. If webhooks created by other apps are specified, they are ignored.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/#connect-apps) and [OAuth 2.0](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps) apps can use this operation."
  },
  "getDynamicWebhooksForApp": {
    "comment": "Get dynamic webhooks for app",
    "doc": "Get dynamic webhooks for app\n  Returns a [paginated](#pagination) list of the webhooks registered by the calling app.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/#connect-apps) and [OAuth 2.0](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps) apps can use this operation."
  },
  "registerDynamicWebhooks": {
    "comment": "Register dynamic webhooks",
    "doc": "Register dynamic webhooks\n  Registers webhooks.\n \n  NOTE: for non-public OAuth apps, webhooks are delivered only if there is a match between the app owner and the user who registered a dynamic webhook.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/#connect-apps) and [OAuth 2.0](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps) apps can use this operation."
  },
  "getFailedWebhooks": {
    "comment": "Get failed webhooks",
    "doc": "Get failed webhooks\n  Returns webhooks that have recently failed to be delivered to the requesting app after the maximum number of retries.\n \n  After 72 hours the failure may no longer be returned by this operation.\n \n  The oldest failure is returned first.\n \n  This method uses a cursor-based pagination. To request the next page use the failure time of the last webhook on the list as the `failedAfter` value or use the URL provided in `next`.\n \n  [Permissions](#permissions) required: Only [Connect apps](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) can use this operation."
  },
  "refreshWebhooks": {
    "comment": "Extend webhook life",
    "doc": "Extend webhook life\n  Extends the life of webhook. Webhooks registered through the REST API expire after 30 days. Call this operation to keep them alive.\n \n  Unrecognized webhook IDs (those that are not found or belong to other apps) are ignored.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/#connect-apps) and [OAuth 2.0](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps) apps can use this operation."
  },
  "getAllWorkflows": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Get all workflows\n  Returns all workflows in Jira or a workflow. Deprecated, use [Get workflows paginated](#api-rest-api-3-workflow-search-get).\n \n  If the `workflowName` parameter is specified, the workflow is returned as an object (not in an array). Otherwise, an array of workflow objects is returned.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createWorkflow": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Create workflow\n  Creates a workflow. You can define transition rules using the shapes detailed in the following sections. If no transitional rules are specified the default system transition rules are used. Note: This only applies to company-managed scoped workflows. Use [bulk create workflows](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/#api-rest-api-3-workflows-create-post) to create both team and company-managed scoped workflows.\n \n  #### Conditions ####\n \n  Conditions enable workflow rules that govern whether a transition can execute.\n \n  ##### Always false condition #####\n \n  A condition that always fails.\n \n  {\n  \"type\": \"AlwaysFalseCondition\"\n  }\n \n  ##### Block transition until approval #####\n \n  A condition that blocks issue transition if there is a pending approval.\n \n  {\n  \"type\": \"BlockInProgressApprovalCondition\"\n  }\n \n  ##### Compare number custom field condition #####\n \n  A condition that allows transition if a comparison between a number custom field and a value is true.\n \n  {\n  \"type\": \"CompareNumberCFCondition\",\n  \"configuration\": {\n  \"comparator\": \"=\",\n  \"fieldId\": \"customfield_10029\",\n  \"fieldValue\": 2\n  }\n  }\n \n    `comparator` One of the supported comparator: `=`, `>`, and `<`.\n    `fieldId` The custom numeric field ID. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:float`\n    `com.pyxis.greenhopper.jira:jsw-story-points`\n    `fieldValue` The value for comparison.\n \n  ##### Hide from user condition #####\n \n  A condition that hides a transition from users. The transition can only be triggered from a workflow function or REST API operation.\n \n  {\n  \"type\": \"RemoteOnlyCondition\"\n  }\n \n  ##### Only assignee condition #####\n \n  A condition that allows only the assignee to execute a transition.\n \n  {\n  \"type\": \"AllowOnlyAssignee\"\n  }\n \n  ##### Only Bamboo notifications workflow condition (deprecated) #####\n \n  A condition that makes the transition available only to Bamboo build notifications.\n \n  {\n  \"type\": \"OnlyBambooNotificationsCondition\"\n  }\n \n  ##### Only reporter condition #####\n \n  A condition that allows only the reporter to execute a transition.\n \n  {\n  \"type\": \"AllowOnlyReporter\"\n  }\n \n  ##### Permission condition #####\n \n  A condition that allows only users with a permission to execute a transition.\n \n  {\n  \"type\": \"PermissionCondition\",\n  \"configuration\": {\n  \"permissionKey\": \"BROWSE_PROJECTS\"\n  }\n  }\n \n    `permissionKey` The permission required to perform the transition. Allowed values: [built-in](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permission-schemes/#built-in-permissions) or app defined permissions.\n \n  ##### Previous status condition #####\n \n  A condition that allows a transition based on whether an issue has or has not transitioned through a status.\n \n  {\n  \"type\": \"PreviousStatusCondition\",\n  \"configuration\": {\n  \"ignoreLoopTransitions\": true,\n  \"includeCurrentStatus\": true,\n  \"mostRecentStatusOnly\": true,\n  \"reverseCondition\": true,\n  \"previousStatus\": {\n  \"id\": \"5\"\n  }\n  }\n  }\n \n  By default this condition allows the transition if the status, as defined by its ID in the `previousStatus` object, matches any previous issue status, unless:\n \n    `ignoreLoopTransitions` is `true`, then loop transitions (from and to the same status) are ignored.\n    `includeCurrentStatus` is `true`, then the current issue status is also checked.\n    `mostRecentStatusOnly` is `true`, then only the issue's preceding status (the one immediately before the current status) is checked.\n    `reverseCondition` is `true`, then the status must not be present.\n \n  ##### Separation of duties condition #####\n \n  A condition that prevents a user to perform the transition, if the user has already performed a transition on the issue.\n \n  {\n  \"type\": \"SeparationOfDutiesCondition\",\n  \"configuration\": {\n  \"fromStatus\": {\n  \"id\": \"5\"\n  },\n  \"toStatus\": {\n  \"id\": \"6\"\n  }\n  }\n  }\n \n    `fromStatus` OPTIONAL. An object containing the ID of the source status of the transition that is blocked. If omitted any transition to `toStatus` is blocked.\n    `toStatus` An object containing the ID of the target status of the transition that is blocked.\n \n  ##### Subtask blocking condition #####\n \n  A condition that blocks transition on a parent issue if any of its subtasks are in any of one or more statuses.\n \n  {\n  \"type\": \"SubTaskBlockingCondition\",\n  \"configuration\": {\n  \"statuses\": [\n  {\n  \"id\": \"1\"\n  },\n  {\n  \"id\": \"3\"\n  }\n  ]\n  }\n  }\n \n    `statuses` A list of objects containing status IDs.\n \n  ##### User is in any group condition #####\n \n  A condition that allows users belonging to any group from a list of groups to execute a transition.\n \n  {\n  \"type\": \"UserInAnyGroupCondition\",\n  \"configuration\": {\n  \"groups\": [\n  \"administrators\",\n  \"atlassian-addons-admin\"\n  ]\n  }\n  }\n \n    `groups` A list of group names.\n \n  ##### User is in any project role condition #####\n \n  A condition that allows only users with at least one project roles from a list of project roles to execute a transition.\n \n  {\n  \"type\": \"InAnyProjectRoleCondition\",\n  \"configuration\": {\n  \"projectRoles\": [\n  {\n  \"id\": \"10002\"\n  },\n  {\n  \"id\": \"10003\"\n  },\n  {\n  \"id\": \"10012\"\n  },\n  {\n  \"id\": \"10013\"\n  }\n  ]\n  }\n  }\n \n    `projectRoles` A list of objects containing project role IDs.\n \n  ##### User is in custom field condition #####\n \n  A condition that allows only users listed in a given custom field to execute the transition.\n \n  {\n  \"type\": \"UserIsInCustomFieldCondition\",\n  \"configuration\": {\n  \"allowUserInField\": false,\n  \"fieldId\": \"customfield_10010\"\n  }\n  }\n \n    `allowUserInField` If `true` only a user who is listed in `fieldId` can perform the transition, otherwise, only a user who is not listed in `fieldId` can perform the transition.\n    `fieldId` The ID of the field containing the list of users.\n \n  ##### User is in group condition #####\n \n  A condition that allows users belonging to a group to execute a transition.\n \n  {\n  \"type\": \"UserInGroupCondition\",\n  \"configuration\": {\n  \"group\": \"administrators\"\n  }\n  }\n \n    `group` The name of the group.\n \n  ##### User is in group custom field condition #####\n \n  A condition that allows users belonging to a group specified in a custom field to execute a transition.\n \n  {\n  \"type\": \"InGroupCFCondition\",\n  \"configuration\": {\n  \"fieldId\": \"customfield_10012\"\n  }\n  }\n \n    `fieldId` The ID of the field. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:multigrouppicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:grouppicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:select`\n    `com.atlassian.jira.plugin.system.customfieldtypes:multiselect`\n    `com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons`\n    `com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes`\n    `com.pyxis.greenhopper.jira:gh-epic-status`\n \n  ##### User is in project role condition #####\n \n  A condition that allows users with a project role to execute a transition.\n \n  {\n  \"type\": \"InProjectRoleCondition\",\n  \"configuration\": {\n  \"projectRole\": {\n  \"id\": \"10002\"\n  }\n  }\n  }\n \n    `projectRole` An object containing the ID of a project role.\n \n  ##### Value field condition #####\n \n  A conditions that allows a transition to execute if the value of a field is equal to a constant value or simply set.\n \n  {\n  \"type\": \"ValueFieldCondition\",\n  \"configuration\": {\n  \"fieldId\": \"assignee\",\n  \"fieldValue\": \"qm:6e1ecee6-8e64-4db6-8c85-916bb3275f51:54b56885-2bd2-4381-8239-78263442520f\",\n  \"comparisonType\": \"NUMBER\",\n  \"comparator\": \"=\"\n  }\n  }\n \n    `fieldId` The ID of a field used in the comparison.\n    `fieldValue` The expected value of the field.\n    `comparisonType` The type of the comparison. Allowed values: `STRING`, `NUMBER`, `DATE`, `DATE_WITHOUT_TIME`, or `OPTIONID`.\n    `comparator` One of the supported comparator: `>`, `>=`, `=`, `<=`, `<`, `!=`.\n \n  Notes:\n \n    If you choose the comparison type `STRING`, only `=` and `!=` are valid options.\n    You may leave `fieldValue` empty when comparison type is `!=` to indicate that a value is required in the field.\n    For date fields without time format values as `yyyy-MM-dd`, and for those with time as `yyyy-MM-dd HH:mm`. For example, for July 16 2021 use `2021-07-16`, for 8:05 AM use `2021-07-16 08:05`, and for 4 PM: `2021-07-16 16:00`.\n \n  #### Validators ####\n \n  Validators check that any input made to the transition is valid before the transition is performed.\n \n  ##### Date field validator #####\n \n  A validator that compares two dates.\n \n  {\n  \"type\": \"DateFieldValidator\",\n  \"configuration\": {\n  \"comparator\": \">\",\n  \"date1\": \"updated\",\n  \"date2\": \"created\",\n  \"expression\": \"1d\",\n  \"includeTime\": true\n  }\n  }\n \n    `comparator` One of the supported comparator: `>`, `>=`, `=`, `<=`, `<`, or `!=`.\n    `date1` The date field to validate. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:datepicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:datetime`\n    `com.atlassian.jpo:jpo-custom-field-baseline-end`\n    `com.atlassian.jpo:jpo-custom-field-baseline-start`\n    `duedate`\n    `created`\n    `updated`\n    `resolutiondate`\n    `date2` The second date field. Required, if `expression` is not passed. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:datepicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:datetime`\n    `com.atlassian.jpo:jpo-custom-field-baseline-end`\n    `com.atlassian.jpo:jpo-custom-field-baseline-start`\n    `duedate`\n    `created`\n    `updated`\n    `resolutiondate`\n    `expression` An expression specifying an offset. Required, if `date2` is not passed. Offsets are built with a number, with `-` as prefix for the past, and one of these time units: `d` for day, `w` for week, `m` for month, or `y` for year. For example, -2d means two days into the past and 1w means one week into the future. The `now` keyword enables a comparison with the current date.\n    `includeTime` If `true`, then the time part of the data is included for the comparison. If the field doesn't have a time part, 00:00:00 is used.\n \n  ##### Windows date validator #####\n \n  A validator that checks that a date falls on or after a reference date and before or on the reference date plus a number of days.\n \n  {\n  \"type\": \"WindowsDateValidator\",\n  \"configuration\": {\n  \"date1\": \"customfield_10009\",\n  \"date2\": \"created\",\n  \"windowsDays\": 5\n  }\n  }\n \n    `date1` The date field to validate. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:datepicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:datetime`\n    `com.atlassian.jpo:jpo-custom-field-baseline-end`\n    `com.atlassian.jpo:jpo-custom-field-baseline-start`\n    `duedate`\n    `created`\n    `updated`\n    `resolutiondate`\n    `date2` The reference date. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:datepicker`\n    `com.atlassian.jira.plugin.system.customfieldtypes:datetime`\n    `com.atlassian.jpo:jpo-custom-field-baseline-end`\n    `com.atlassian.jpo:jpo-custom-field-baseline-start`\n    `duedate`\n    `created`\n    `updated`\n    `resolutiondate`\n    `windowsDays` A positive integer indicating a number of days.\n \n  ##### Field required validator #####\n \n  A validator that checks fields are not empty. By default, if a field is not included in the current context it's ignored and not validated.\n \n  {\n  \"type\": \"FieldRequiredValidator\",\n  \"configuration\": {\n  \"ignoreContext\": true,\n  \"errorMessage\": \"Hey\",\n  \"fieldIds\": [\n  \"versions\",\n  \"customfield_10037\",\n  \"customfield_10003\"\n  ]\n  }\n  }\n \n    `ignoreContext` If `true`, then the context is ignored and all the fields are validated.\n    `errorMessage` OPTIONAL. The error message displayed when one or more fields are empty. A default error message is shown if an error message is not provided.\n    `fieldIds` The list of fields to validate.\n \n  ##### Field changed validator #####\n \n  A validator that checks that a field value is changed. However, this validation can be ignored for users from a list of groups.\n \n  {\n  \"type\": \"FieldChangedValidator\",\n  \"configuration\": {\n  \"fieldId\": \"comment\",\n  \"errorMessage\": \"Hey\",\n  \"exemptedGroups\": [\n  \"administrators\",\n  \"atlassian-addons-admin\"\n  ]\n  }\n  }\n \n    `fieldId` The ID of a field.\n    `errorMessage` OPTIONAL. The error message displayed if the field is not changed. A default error message is shown if the error message is not provided.\n    `exemptedGroups` OPTIONAL. The list of groups.\n \n  ##### Field has single value validator #####\n \n  A validator that checks that a multi-select field has only one value. Optionally, the validation can ignore values copied from subtasks.\n \n  {\n  \"type\": \"FieldHasSingleValueValidator\",\n  \"configuration\": {\n  \"fieldId\": \"attachment,\n  \"excludeSubtasks\": true\n  }\n  }\n \n    `fieldId` The ID of a field.\n    `excludeSubtasks` If `true`, then values copied from subtasks are ignored.\n \n  ##### Parent status validator #####\n \n  A validator that checks the status of the parent issue of a subtask. Ìf the issue is not a subtask, no validation is performed.\n \n  {\n  \"type\": \"ParentStatusValidator\",\n  \"configuration\": {\n  \"parentStatuses\": [\n  {\n  \"id\":\"1\"\n  },\n  {\n  \"id\":\"2\"\n  }\n  ]\n  }\n  }\n \n    `parentStatus` The list of required parent issue statuses.\n \n  ##### Permission validator #####\n \n  A validator that checks the user has a permission.\n \n  {\n  \"type\": \"PermissionValidator\",\n  \"configuration\": {\n  \"permissionKey\": \"ADMINISTER_PROJECTS\"\n  }\n  }\n \n    `permissionKey` The permission required to perform the transition. Allowed values: [built-in](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permission-schemes/#built-in-permissions) or app defined permissions.\n \n  ##### Previous status validator #####\n \n  A validator that checks if the issue has held a status.\n \n  {\n  \"type\": \"PreviousStatusValidator\",\n  \"configuration\": {\n  \"mostRecentStatusOnly\": false,\n  \"previousStatus\": {\n  \"id\": \"15\"\n  }\n  }\n  }\n \n    `mostRecentStatusOnly` If `true`, then only the issue's preceding status (the one immediately before the current status) is checked.\n    `previousStatus` An object containing the ID of an issue status.\n \n  ##### Regular expression validator #####\n \n  A validator that checks the content of a field against a regular expression.\n \n  {\n  \"type\": \"RegexpFieldValidator\",\n  \"configuration\": {\n  \"regExp\": \"[0-9]\",\n  \"fieldId\": \"customfield_10029\"\n  }\n  }\n \n    `regExp`A regular expression.\n    `fieldId` The ID of a field. Allowed field types:\n \n    `com.atlassian.jira.plugin.system.customfieldtypes:select`\n    `com.atlassian.jira.plugin.system.customfieldtypes:multiselect`\n    `com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons`\n    `com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes`\n    `com.atlassian.jira.plugin.system.customfieldtypes:textarea`\n    `com.atlassian.jira.plugin.system.customfieldtypes:textfield`\n    `com.atlassian.jira.plugin.system.customfieldtypes:url`\n    `com.atlassian.jira.plugin.system.customfieldtypes:float`\n    `com.pyxis.greenhopper.jira:jsw-story-points`\n    `com.pyxis.greenhopper.jira:gh-epic-status`\n    `description`\n    `summary`\n \n  ##### User permission validator #####\n \n  A validator that checks if a user has a permission. Obsolete. You may encounter this validator when getting transition rules and can pass it when updating or creating rules, for example, when you want to duplicate the rules from a workflow on a new workflow.\n \n  {\n  \"type\": \"UserPermissionValidator\",\n  \"configuration\": {\n  \"permissionKey\": \"BROWSE_PROJECTS\",\n  \"nullAllowed\": false,\n  \"username\": \"TestUser\"\n  }\n  }\n \n    `permissionKey` The permission to be validated. Allowed values: [built-in](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permission-schemes/#built-in-permissions) or app defined permissions.\n    `nullAllowed` If `true`, allows the transition when `username` is empty.\n    `username` The username to validate against the `permissionKey`.\n \n  #### Post functions ####\n \n  Post functions carry out any additional processing required after a Jira workflow transition is executed.\n \n  ##### Fire issue event function #####\n \n  A post function that fires an event that is processed by the listeners.\n \n  {\n  \"type\": \"FireIssueEventFunction\",\n  \"configuration\": {\n  \"event\": {\n  \"id\":\"1\"\n  }\n  }\n  }\n \n  Note: If provided, this post function overrides the default `FireIssueEventFunction`. Can be included once in a transition.\n \n    `event` An object containing the ID of the issue event.\n \n  ##### Update issue status #####\n \n  A post function that sets issue status to the linked status of the destination workflow status.\n \n  {\n  \"type\": \"UpdateIssueStatusFunction\"\n  }\n \n  Note: This post function is a default function in global and directed transitions. It can only be added to the initial transition and can only be added once.\n \n  ##### Create comment #####\n \n  A post function that adds a comment entered during the transition to an issue.\n \n  {\n  \"type\": \"CreateCommentFunction\"\n  }\n \n  Note: This post function is a default function in global and directed transitions. It can only be added to the initial transition and can only be added once.\n \n  ##### Store issue #####\n \n  A post function that stores updates to an issue.\n \n  {\n  \"type\": \"IssueStoreFunction\"\n  }\n \n  Note: This post function can only be added to the initial transition and can only be added once.\n \n  ##### Assign to current user function #####\n \n  A post function that assigns the issue to the current user if the current user has the `ASSIGNABLE_USER` permission.\n \n  {\n  \"type\": \"AssignToCurrentUserFunction\"\n  }\n \n  Note: This post function can be included once in a transition.\n \n  ##### Assign to lead function #####\n \n  A post function that assigns the issue to the project or component lead developer.\n \n  {\n  \"type\": \"AssignToLeadFunction\"\n  }\n \n  Note: This post function can be included once in a transition.\n \n  ##### Assign to reporter function #####\n \n  A post function that assigns the issue to the reporter.\n \n  {\n  \"type\": \"AssignToReporterFunction\"\n  }\n \n  Note: This post function can be included once in a transition.\n \n  ##### Clear field value function #####\n \n  A post function that clears the value from a field.\n \n  {\n  \"type\": \"ClearFieldValuePostFunction\",\n  \"configuration\": {\n  \"fieldId\": \"assignee\"\n  }\n  }\n \n    `fieldId` The ID of the field.\n \n  ##### Copy value from other field function #####\n \n  A post function that copies the value of one field to another, either within an issue or from parent to subtask.\n \n  {\n  \"type\": \"CopyValueFromOtherFieldPostFunction\",\n  \"configuration\": {\n  \"sourceFieldId\": \"assignee\",\n  \"destinationFieldId\": \"creator\",\n  \"copyType\": \"same\"\n  }\n  }\n \n    `sourceFieldId` The ID of the source field.\n    `destinationFieldId` The ID of the destination field.\n    `copyType` Use `same` to copy the value from a field inside the issue, or `parent` to copy the value from the parent issue.\n \n  ##### Create Crucible review workflow function (deprecated) #####\n \n  A post function that creates a Crucible review for all unreviewed code for the issue.\n \n  {\n  \"type\": \"CreateCrucibleReviewWorkflowFunction\"\n  }\n \n  Note: This post function can be included once in a transition.\n \n  ##### Set issue security level based on user's project role function #####\n \n  A post function that sets the issue's security level if the current user has a project role.\n \n  {\n  \"type\": \"SetIssueSecurityFromRoleFunction\",\n  \"configuration\": {\n  \"projectRole\": {\n  \"id\":\"10002\"\n  },\n  \"issueSecurityLevel\": {\n  \"id\":\"10000\"\n  }\n  }\n  }\n \n    `projectRole` An object containing the ID of the project role.\n    `issueSecurityLevel` OPTIONAL. The object containing the ID of the security level. If not passed, then the security level is set to `none`.\n \n  ##### Trigger a webhook function #####\n \n  A post function that triggers a webhook.\n \n  {\n  \"type\": \"TriggerWebhookFunction\",\n  \"configuration\": {\n  \"webhook\": {\n  \"id\": \"1\"\n  }\n  }\n  }\n \n    `webhook` An object containing the ID of the webhook listener to trigger.\n \n  ##### Update issue custom field function #####\n \n  A post function that updates the content of an issue custom field.\n \n  {\n  \"type\": \"UpdateIssueCustomFieldPostFunction\",\n  \"configuration\": {\n  \"mode\": \"append\",\n  \"fieldId\": \"customfield_10003\",\n  \"fieldValue\": \"yikes\"\n  }\n  }\n \n    `mode` Use `replace` to override the field content with `fieldValue` or `append` to add `fieldValue` to the end of the field content.\n    `fieldId` The ID of the field.\n    `fieldValue` The update content.\n \n  ##### Update issue field function #####\n \n  A post function that updates a simple issue field.\n \n  {\n  \"type\": \"UpdateIssueFieldFunction\",\n  \"configuration\": {\n  \"fieldId\": \"assignee\",\n  \"fieldValue\": \"5f0c277e70b8a90025a00776\"\n  }\n  }\n \n    `fieldId` The ID of the field. Allowed field types:\n \n    `assignee`\n    `description`\n    `environment`\n    `priority`\n    `resolution`\n    `summary`\n    `timeoriginalestimate`\n    `timeestimate`\n    `timespent`\n    `fieldValue` The update value.\n    If the `fieldId` is `assignee`, the `fieldValue` should be one of these values:\n \n    an account ID.\n    `automatic`.\n    a blank string, which sets the value to `unassigned`.\n \n  #### Connect rules ####\n \n  Connect rules are conditions, validators, and post functions of a transition that are registered by Connect apps. To create a rule registered by the app, the app must be enabled and the rule's module must exist.\n \n  {\n  \"type\": \"appKey__moduleKey\",\n  \"configuration\": {\n  \"value\":\"{\\\"isValid\\\":\\\"true\\\"}\"\n  }\n  }\n \n    `type` A Connect rule key in a form of `appKey__moduleKey`.\n    `value` The stringified JSON configuration of a Connect rule.\n \n  #### Forge rules ####\n \n  Forge transition rules are not yet supported.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowTransitionRuleConfigurations": {
    "comment": "Get workflow transition rule configurations",
    "doc": "Get workflow transition rule configurations\n  Returns a [paginated](#pagination) list of workflows with transition rules. The workflows can be filtered to return only those containing workflow transition rules:\n \n    of one or more transition rule types, such as [workflow post functions](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-post-function/).\n    matching one or more transition rule keys.\n \n  Only workflows containing transition rules created by the calling [Connect](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) or [Forge](https://developer.atlassian.com/cloud/jira/platform/index/#forge-apps) app are returned.\n \n  Due to server-side optimizations, workflows with an empty list of rules may be returned; these workflows can be ignored.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) or [Forge](https://developer.atlassian.com/cloud/jira/platform/index/#forge-apps) apps can use this operation."
  },
  "updateWorkflowTransitionRuleConfigurations": {
    "comment": "Update workflow transition rule configurations",
    "doc": "Update workflow transition rule configurations\n  Updates configuration of workflow transition rules. The following rule types are supported:\n \n    [post functions](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-post-function/)\n    [conditions](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-condition/)\n    [validators](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-validator/)\n \n  Only rules created by the calling [Connect](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) or [Forge](https://developer.atlassian.com/cloud/jira/platform/index/#forge-apps) app can be updated.\n \n  To assist with app migration, this operation can be used to:\n \n    Disable a rule.\n    Add a `tag`. Use this to filter rules in the [Get workflow transition rule configurations](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflow-transition-rules/#api-rest-api-3-workflow-rule-config-get).\n \n  Rules are enabled if the `disabled` parameter is not provided.\n \n  [Permissions](#permissions) required: Only [Connect](https://developer.atlassian.com/cloud/jira/platform/index/#connect-apps) or [Forge](https://developer.atlassian.com/cloud/jira/platform/index/#forge-apps) apps can use this operation."
  },
  "deleteWorkflowTransitionRuleConfigurations": {
    "comment": "Delete workflow transition rule configurations",
    "doc": "Delete workflow transition rule configurations\n  Deletes workflow transition rules from one or more workflows. These rule types are supported:\n \n    [post functions](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-post-function/)\n    [conditions](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-condition/)\n    [validators](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-validator/)\n \n  Only rules created by the calling Connect app can be deleted.\n \n  [Permissions](#permissions) required: Only Connect apps can use this operation."
  },
  "getWorkflowsPaginated": {
    "comment": "Get workflows paginated",
    "doc": "Get workflows paginated\n  Returns a [paginated](#pagination) list of published classic workflows. When workflow names are specified, details of those workflows are returned. Otherwise, all published classic workflows are returned.\n \n  This operation does not return next-gen workflows.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteWorkflowTransitionProperty": {
    "comment": "Delete workflow transition property",
    "doc": "Delete workflow transition property\n  Deletes a property from a workflow transition. Transition properties are used to change the behavior of a transition. For more information, see [Transition properties](https://confluence.atlassian.com/x/zIhKLg#Advancedworkflowconfiguration-transitionproperties) and [Workflow properties](https://confluence.atlassian.com/x/JYlKLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowTransitionProperties": {
    "comment": "Get workflow transition properties",
    "doc": "Get workflow transition properties\n  Returns the properties on a workflow transition. Transition properties are used to change the behavior of a transition. For more information, see [Transition properties](https://confluence.atlassian.com/x/zIhKLg#Advancedworkflowconfiguration-transitionproperties) and [Workflow properties](https://confluence.atlassian.com/x/JYlKLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createWorkflowTransitionProperty": {
    "comment": "Create workflow transition property",
    "doc": "Create workflow transition property\n  Adds a property to a workflow transition. Transition properties are used to change the behavior of a transition. For more information, see [Transition properties](https://confluence.atlassian.com/x/zIhKLg#Advancedworkflowconfiguration-transitionproperties) and [Workflow properties](https://confluence.atlassian.com/x/JYlKLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateWorkflowTransitionProperty": {
    "comment": "Update workflow transition property",
    "doc": "Update workflow transition property\n  Updates a workflow transition by changing the property value. Trying to update a property that does not exist results in a new property being added to the transition. Transition properties are used to change the behavior of a transition. For more information, see [Transition properties](https://confluence.atlassian.com/x/zIhKLg#Advancedworkflowconfiguration-transitionproperties) and [Workflow properties](https://confluence.atlassian.com/x/JYlKLg).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteInactiveWorkflow": {
    "comment": "Delete inactive workflow",
    "doc": "Delete inactive workflow\n  Deletes a workflow.\n \n  The workflow cannot be deleted if it is:\n \n    an active workflow.\n    a system workflow.\n    associated with any workflow scheme.\n    associated with any draft workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "readWorkflows": {
    "comment": "Bulk get workflows",
    "doc": "Bulk get workflows\n  Returns a list of workflows and related statuses by providing workflow names, workflow IDs, or project and issue types.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira global permission to access all, including project-scoped, workflows\n    At least one of the Administer projects and View (read-only) workflow project permissions to access project-scoped workflows"
  },
  "workflowCapabilities": {
    "comment": "Get available workflow capabilities",
    "doc": "Get available workflow capabilities\n  Get the list of workflow capabilities for a specific workflow using either the workflow ID, or the project and issue type ID pair. The response includes the scope of the workflow, defined as global/project-based, and a list of project types that the workflow is scoped to. It also includes all rules organised into their broad categories (conditions, validators, actions, triggers, screens) as well as the source location (Atlassian-provided, Connect, Forge).\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to access all, including global-scoped, workflows\n    Administer projects project permissions to access project-scoped workflows\n \n  The current list of Atlassian-provided rules:\n \n  #### Validators ####\n \n  A validator rule that checks if a user has the required permissions to execute the transition in the workflow.\n \n  ##### Permission validator #####\n \n  A validator rule that checks if a user has the required permissions to execute the transition in the workflow.\n \n  {\n  \"ruleKey\": \"system:check-permission-validator\",\n  \"parameters\": {\n  \"permissionKey\": \"ADMINISTER_PROJECTS\"\n  }\n  }\n \n  Parameters:\n \n    `permissionKey` The permission required to perform the transition. Allowed values: [built-in Jira permissions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permission-schemes/#built-in-permissions).\n \n  ##### Parent or child blocking validator #####\n \n  A validator to block the child issue\\’s transition depending on the parent issue\\’s status.\n \n  {\n  \"ruleKey\" : \"system:parent-or-child-blocking-validator\"\n  \"parameters\" : {\n  \"blocker\" : \"PARENT\"\n  \"statusIds\" : \"1,2,3\"\n  }\n  }\n \n  Parameters:\n \n    `blocker` currently only supports `PARENT`.\n    `statusIds` a comma-separated list of status IDs.\n \n  ##### Previous status validator #####\n \n  A validator that checks if an issue has transitioned through specified previous status(es) before allowing the current transition to occur.\n \n  {\n  \"ruleKey\": \"system:previous-status-validator\",\n  \"parameters\": {\n  \"previousStatusIds\": \"10014\",\n  \"mostRecentStatusOnly\": \"true\"\n  }\n  }\n \n  Parameters:\n \n    `previousStatusIds` a comma-separated list of status IDs, currently only support one ID.\n    `mostRecentStatusOnly` when `true` only considers the most recent status for the condition evaluation. Allowed values: `true`, `false`.\n \n  ##### Validate a field value #####\n \n  A validation that ensures a specific field's value meets the defined criteria before allowing an issue to transition in the workflow.\n \n  Depending on the rule type, the result will vary:\n \n  ###### Field required ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"fieldRequired\",\n  \"fieldsRequired\": \"assignee\",\n  \"ignoreContext\": \"true\",\n  \"errorMessage\": \"An assignee must be set!\"\n  }\n  }\n \n  Parameters:\n \n    `fieldsRequired` the ID of the field that is required. For a custom field, it would look like `customfield_123`.\n    `ignoreContext` controls the impact of context settings on field validation. When set to `true`, the validator doesn't check a required field if its context isn't configured for the current issue. When set to `false`, the validator requires a field even if its context is invalid. Allowed values: `true`, `false`.\n    `errorMessage` is the error message to display if the user does not provide a value during the transition. A default error message will be shown if you don't provide one (Optional).\n \n  ###### Field changed ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"fieldChanged\",\n  \"groupsExemptFromValidation\": \"6862ac20-8672-4f68-896d-4854f5efb79e\",\n  \"fieldKey\": \"versions\",\n  \"errorMessage\": \"Affect versions must be modified before transition\"\n  }\n  }\n \n  Parameters:\n \n    `groupsExemptFromValidation` a comma-separated list of group IDs to be exempt from the validation.\n    `fieldKey` the ID of the field that has changed. For a custom field, it would look like `customfield_123`.\n    `errorMessage` the error message to display if the user does not provide a value during the transition. A default error message will be shown if you don't provide one (Optional).\n \n  ###### Field has a single value ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"fieldHasSingleValue\",\n  \"fieldKey\": \"created\",\n  \"excludeSubtasks\": \"true\"\n  }\n  }\n \n  Parameters:\n \n    `fieldKey` the ID of the field to validate. For a custom field, it would look like `customfield_123`.\n    `excludeSubtasks` Option to exclude values copied from sub-tasks. Allowed values: `true`, `false`.\n \n  ###### Field matches regular expression ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"fieldMatchesRegularExpression\",\n  \"regexp\": \"[0-9]{4}\",\n  \"fieldKey\": \"description\"\n  }\n  }\n \n  Parameters:\n \n    `regexp` the regular expression used to validate the field\\’s content.\n    `fieldKey` the ID of the field to validate. For a custom field, it would look like `customfield_123`.\n \n  ###### Date field comparison ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"dateFieldComparison\",\n  \"date1FieldKey\": \"duedate\",\n  \"date2FieldKey\": \"customfield_10054\",\n  \"includeTime\": \"true\",\n  \"conditionSelected\": \">=\"\n  }\n  }\n \n  Parameters:\n \n    `date1FieldKey` the ID of the first field to compare. For a custom field, it would look like `customfield_123`.\n    `date2FieldKey` the ID of the second field to compare. For a custom field, it would look like `customfield_123`.\n    `includeTime` if `true`, compares both date and time. Allowed values: `true`, `false`.\n    `conditionSelected` the condition to compare with. Allowed values: `>`, `>=`, `=`, `<=`, `<`, `!=`.\n \n  ###### Date range comparison ######\n \n  {\n  \"ruleKey\": \"system:validate-field-value\",\n  \"parameters\": {\n  \"ruleType\": \"windowDateComparison\",\n  \"date1FieldKey\": \"customfield_10009\",\n  \"date2FieldKey\": \"customfield_10054\",\n  \"numberOfDays\": \"3\"\n  }\n  }\n \n  Parameters:\n \n    `date1FieldKey` the ID of the first field to compare. For a custom field, it would look like `customfield_123`.\n    `date2FieldKey` the ID of the second field to compare. For a custom field, it would look like `customfield_123`.\n    `numberOfDays` maximum number of days past the reference date (`date2FieldKey`) to pass validation.\n \n  This rule is composed by aggregating the following legacy rules:\n \n    FieldRequiredValidator\n    FieldChangedValidator\n    FieldHasSingleValueValidator\n    RegexpFieldValidator\n    DateFieldValidator\n    WindowsDateValidator\n \n  ##### Proforma: Forms attached validator #####\n \n  Validates that one or more forms are attached to the issue.\n \n  {\n  \"ruleKey\" : \"system:proforma-forms-attached\"\n  \"parameters\" : {}\n  }\n \n  ##### Proforma: Forms submitted validator #####\n \n  Validates that all forms attached to the issue have been submitted.\n \n  {\n  \"ruleKey\" : \"system:proforma-forms-submitted\"\n  \"parameters\" : {}\n  }\n \n  #### Conditions ####\n \n  Conditions enable workflow rules that govern whether a transition can execute.\n \n  ##### Check field value #####\n \n  A condition rule evaluates as true if a specific field's value meets the defined criteria. This rule ensures that an issue can only transition to the next step in the workflow if the field's value matches the desired condition.\n \n  {\n  \"ruleKey\": \"system:check-field-value\",\n  \"parameters\": {\n  \"fieldId\": \"description\",\n  \"fieldValue\": \"[\\\"Done\\\"]\",\n  \"comparator\": \"=\",\n  \"comparisonType\": \"STRING\"\n  }\n  }\n \n  Parameters:\n \n    `fieldId` The ID of the field to check the value of. For non-system fields, it will look like `customfield_123`. Note: `fieldId` is used interchangeably with the idea of `fieldKey` here, they refer to the same field.\n    `fieldValue` the list of values to check against the field\\’s value.\n    `comparator` The comparison logic. Allowed values: `>`, `>=`, `=`, `<=`, `<`, `!=`.\n    `comparisonType` The type of data being compared. Allowed values: `STRING`, `NUMBER`, `DATE`, `DATE_WITHOUT_TIME`, `OPTIONID`.\n \n  ##### Restrict issue transition #####\n \n  This rule ensures that issue transitions are restricted based on user accounts, roles, group memberships, and permissions, maintaining control over who can transition an issue. This condition evaluates as `true` if any of the following criteria is met.\n \n  {\n  \"ruleKey\": \"system:restrict-issue-transition\",\n  \"parameters\": {\n  \"accountIds\": \"allow-reporter,5e68ac137d64450d01a77fa0\",\n  \"roleIds\": \"10002,10004\",\n  \"groupIds\": \"703ff44a-7dc8-4f4b-9aa6-a65bf3574fa4\",\n  \"permissionKeys\": \"ADMINISTER_PROJECTS\",\n  \"groupCustomFields\": \"customfield_10028\",\n  \"allowUserCustomFields\": \"customfield_10072,customfield_10144,customfield_10007\",\n  \"denyUserCustomFields\": \"customfield_10107\"\n  }\n  }\n \n  Parameters:\n \n    `accountIds` a comma-separated list of the user account IDs. It also allows generic values like: `allow-assignee`, `allow-reporter`, and `accountIds` Note: This is only supported in team-managed projects\n    `roleIds` a comma-separated list of role IDs.\n    `groupIds` a comma-separated list of group IDs.\n    `permissionKeys` a comma-separated list of permission keys. Allowed values: [built-in Jira permissions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permission-schemes/#built-in-permissions).\n    `groupCustomFields` a comma-separated list of group custom field IDs.\n    `allowUserCustomFields` a comma-separated list of user custom field IDs to allow for issue transition.\n    `denyUserCustomFields` a comma-separated list of user custom field IDs to deny for issue transition.\n \n  This rule is composed by aggregating the following legacy rules:\n \n    AllowOnlyAssignee\n    AllowOnlyReporter\n    InAnyProjectRoleCondition\n    InProjectRoleCondition\n    UserInAnyGroupCondition\n    UserInGroupCondition\n    PermissionCondtion\n    InGroupCFCondition\n    UserIsInCustomFieldCondition\n \n  ##### Previous status condition #####\n \n  A condition that evaluates based on an issue's previous status(es) and specific criteria.\n \n  {\n  \"ruleKey\" : \"system:previous-status-condition\"\n  \"parameters\" : {\n  \"previousStatusIds\" : \"10004\",\n  \"not\": \"true\",\n  \"mostRecentStatusOnly\" : \"true\",\n  \"includeCurrentStatus\": \"true\",\n  \"ignoreLoopTransitions\": \"true\"\n  }\n  }\n \n  Parameters:\n \n    `previousStatusIds` a comma-separated list of status IDs, current only support one ID.\n    `not` indicates if the condition should be reversed. When `true` it checks that the issue has not been in the selected statuses. Allowed values: `true`, `false`.\n    `mostRecentStatusOnly` when true only considers the most recent status for the condition evaluation. Allowed values: `true`, `false`.\n    `includeCurrentStatus` includes the current status when evaluating if the issue has been through the selected statuses. Allowed values: `true`, `false`.\n    `ignoreLoopTransitions` ignore loop transitions. Allowed values: `true`, `false`.\n \n  ##### Parent or child blocking condition #####\n \n  A condition to block the parent\\’s issue transition depending on the child\\’s issue status.\n \n  {\n  \"ruleKey\" : \"system:parent-or-child-blocking-condition\"\n  \"parameters\" : {\n  \"blocker\" : \"CHILD\",\n  \"statusIds\" : \"1,2,3\"\n  }\n  }\n \n  Parameters:\n \n    `blocker` currently only supports `CHILD`.\n    `statusIds` a comma-separated list of status IDs.\n \n  ##### Separation of duties #####\n \n  A condition preventing the user from performing, if the user has already performed a transition on the issue.\n \n  {\n  \"ruleKey\": \"system:separation-of-duties\",\n  \"parameters\": {\n  \"fromStatusId\": \"10161\",\n  \"toStatusId\": \"10160\"\n  }\n  }\n \n  Parameters:\n \n    `fromStatusId` represents the status ID from which the issue is transitioning. It ensures that the user performing the current transition has not performed any actions when the issue was in the specified status.\n    `toStatusId` represents the status ID to which the issue is transitioning. It ensures that the user performing the current transition is not the same user who has previously transitioned the issue.\n \n  ##### Restrict transitions #####\n \n  A condition preventing all users from transitioning the issue can also optionally include APIs as well.\n \n  {\n  \"ruleKey\": \"system:restrict-from-all-users\",\n  \"parameters\": {\n  \"restrictMode\": \"users\"\n  }\n  }\n \n  Parameters:\n \n    `restrictMode` restricts the issue transition including/excluding APIs. Allowed values: `\"users\"`, `\"usersAndAPI\"`.\n \n  ##### Jira Service Management block until approved #####\n \n  Block an issue transition until approval. Note: This is only supported in team-managed projects.\n \n  {\n  \"ruleKey\": \"system:jsd-approvals-block-until-approved\",\n  \"parameters\": {\n  \"approvalConfigurationJson\": \"{\"statusExternalUuid...}\"\n  }\n  }\n \n  Parameters:\n \n    `approvalConfigurationJson` a stringified JSON holding the Jira Service Management approval configuration.\n \n  ##### Jira Service Management block until rejected #####\n \n  Block an issue transition until rejected. Note: This is only supported in team-managed projects.\n \n  {\n  \"ruleKey\": \"system:jsd-approvals-block-until-rejected\",\n  \"parameters\": {\n  \"approvalConfigurationJson\": \"{\"statusExternalUuid...}\"\n  }\n  }\n \n  Parameters:\n \n    `approvalConfigurationJson` a stringified JSON holding the Jira Service Management approval configuration.\n \n  ##### Block in progress approval #####\n \n  Condition to block issue transition if there is pending approval. Note: This is only supported in company-managed projects.\n \n  {\n  \"ruleKey\": \"system:block-in-progress-approval\",\n  \"parameters\": {}\n  }\n \n  #### Post functions ####\n \n  Post functions carry out any additional processing required after a workflow transition is executed.\n \n  ##### Change assignee #####\n \n  A post function rule that changes the assignee of an issue after a transition.\n \n  {\n  \"ruleKey\": \"system:change-assignee\",\n  \"parameters\": {\n  \"type\": \"to-selected-user\",\n  \"accountId\": \"example-account-id\"\n  }\n  }\n \n  Parameters:\n \n    `type` the parameter used to determine the new assignee. Allowed values: `to-selected-user`, `to-unassigned`, `to-current-user`, `to-current-user`, `to-default-user`, `to-default-user`\n    `accountId` the account ID of the user to assign the issue to. This parameter is required only when the type is `\"to-selected-user\"`.\n \n  ##### Copy field value #####\n \n  A post function that automates the process of copying values between fields during a specific transition, ensuring data consistency and reducing manual effort.\n \n  {\n  \"ruleKey\": \"system:copy-value-from-other-field\",\n  \"parameters\": {\n  \"sourceFieldKey\": \"description\",\n  \"targetFieldKey\": \"components\",\n  \"issueSource\": \"SAME\"\n  }\n  }\n \n  Parameters:\n \n    `sourceFieldKey` the field key to copy from. For a custom field, it would look like `customfield_123`\n    `targetFieldKey` the field key to copy to. For a custom field, it would look like `customfield_123`\n    `issueSource` `SAME` or `PARENT`. Defaults to `SAME` if no value is provided.\n \n  ##### Update field #####\n \n  A post function that updates or appends a specific field with the given value.\n \n  {\n  \"ruleKey\": \"system:update-field\",\n  \"parameters\": {\n  \"field\": \"customfield_10056\",\n  \"value\": \"asdf\",\n  \"mode\": \"append\"\n  }\n  }\n \n  Parameters:\n \n    `field` the ID of the field to update. For a custom field, it would look like `customfield_123`\n    `value` the value to update the field with.\n    `mode` `append` or `replace`. Determines if a value will be appended to the current value, or if the current value will be replaced.\n \n  ##### Trigger webhook #####\n \n  A post function that automatically triggers a predefined webhook when a transition occurs in the workflow.\n \n  {\n  \"ruleKey\": \"system:trigger-webhook\",\n  \"parameters\": {\n  \"webhookId\": \"1\"\n  }\n  }\n \n  Parameters:\n \n    `webhookId` the ID of the webhook.\n \n  #### Screen ####\n \n  ##### Remind people to update fields #####\n \n  A screen rule that prompts users to update a specific field when they interact with an issue screen during a transition. This rule is useful for ensuring that users provide or modify necessary information before moving an issue to the next step in the workflow.\n \n  {\n  \"ruleKey\": \"system:remind-people-to-update-fields\",\n  \"params\": {\n  \"remindingFieldIds\": \"assignee,customfield_10025\",\n  \"remindingMessage\": \"The message\",\n  \"remindingAlwaysAsk\": \"true\"\n  }\n  }\n \n  Parameters:\n \n    `remindingFieldIds` a comma-separated list of field IDs. Note: `fieldId` is used interchangeably with the idea of `fieldKey` here, they refer to the same field.\n    `remindingMessage` the message to display when prompting the users to update the fields.\n    `remindingAlwaysAsk` always remind to update fields. Allowed values: `true`, `false`.\n \n  ##### Shared transition screen #####\n \n  A common screen that is shared between transitions in a workflow.\n \n  {\n  \"ruleKey\": \"system:transition-screen\",\n  \"params\": {\n  \"screenId\": \"3\"\n  }\n  }\n \n  Parameters:\n \n    `screenId` the ID of the screen.\n \n  #### Connect & Forge ####\n \n  ##### Connect rules #####\n \n  Validator/Condition/Post function for Connect app.\n \n  {\n  \"ruleKey\": \"connect:expression-validator\",\n  \"parameters\": {\n  \"appKey\": \"com.atlassian.app\",\n  \"config\": \"\",\n  \"id\": \"90ce590f-e90c-4cd3-8281-165ce41f2ac3\",\n  \"disabled\": \"false\",\n  \"tag\": \"\"\n  }\n  }\n \n  Parameters:\n \n    `ruleKey` Validator: `connect:expression-validator`, Condition: `connect:expression-condition`, and Post function: `connect:remote-workflow-function`\n    `appKey` the reference to the Connect app\n    `config` a JSON payload string describing the configuration\n    `id` the ID of the rule\n    `disabled` determine if the Connect app is disabled. Allowed values: `true`, `false`.\n    `tag` additional tags for the Connect app\n \n  ##### Forge rules #####\n \n  Validator/Condition/Post function for Forge app.\n \n  {\n  \"ruleKey\": \"forge:expression-validator\",\n  \"parameters\": {\n  \"key\": \"ari:cloud:ecosystem::extension/{appId}/{environmentId}/static/{moduleKey}\",\n  \"config\": \"{\"searchString\":\"workflow validator\"}\",\n  \"id\": \"a865ddf6-bb3f-4a7b-9540-c2f8b3f9f6c2\"\n  }\n  }\n \n  Parameters:\n \n    `ruleKey` Validator: `forge:expression-validator`, Condition: `forge:expression-condition`, and Post function: `forge:workflow-post-function`\n    `key` the identifier for the Forge app\n    `config` the persistent stringified JSON configuration for the Forge rule\n    `id` the ID of the Forge rule"
  },
  "createWorkflows": {
    "comment": "Bulk create workflows",
    "doc": "Bulk create workflows\n  Create workflows and related statuses.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to create all, including global-scoped, workflows\n    Administer projects project permissions to create project-scoped workflows"
  },
  "validateCreateWorkflows": {
    "comment": "Validate create workflows",
    "doc": "Validate create workflows\n  Validate the payload for bulk create workflows.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to create all, including global-scoped, workflows\n    Administer projects project permissions to create project-scoped workflows"
  },
  "updateWorkflows": {
    "comment": "Bulk update workflows",
    "doc": "Bulk update workflows\n  Update workflows and related statuses.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to create all, including global-scoped, workflows\n    Administer projects project permissions to create project-scoped workflows"
  },
  "validateUpdateWorkflows": {
    "comment": "Validate update workflows",
    "doc": "Validate update workflows\n  Validate the payload for bulk update workflows.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to create all, including global-scoped, workflows\n    Administer projects project permissions to create project-scoped workflows"
  },
  "getAllWorkflowSchemes": {
    "comment": "Get all workflow schemes",
    "doc": "Get all workflow schemes\n  Returns a [paginated](#pagination) list of all workflow schemes, not including draft workflow schemes.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createWorkflowScheme": {
    "comment": "Create workflow scheme",
    "doc": "Create workflow scheme\n  Creates a workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowSchemeProjectAssociations": {
    "comment": "Get workflow scheme project associations",
    "doc": "Get workflow scheme project associations\n  Returns a list of the workflow schemes associated with a list of projects. Each returned workflow scheme includes a list of the requested projects associated with it. Any team-managed or non-existent projects in the request are ignored and no errors are returned.\n \n  If the project is associated with the `Default Workflow Scheme` no ID is returned. This is because the way the `Default Workflow Scheme` is stored means it has no ID.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "assignSchemeToProject": {
    "comment": "Assign workflow scheme to project",
    "doc": "Assign workflow scheme to project\n  Assigns a workflow scheme to a project. This operation is performed only when there are no issues in the project.\n \n  Workflow schemes can only be assigned to classic projects.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "readWorkflowSchemes": {
    "comment": "Bulk get workflow schemes",
    "doc": "Bulk get workflow schemes\n  Returns a list of workflow schemes by providing workflow scheme IDs or project IDs.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira global permission to access all, including project-scoped, workflow schemes\n    Administer projects project permissions to access project-scoped workflow schemes"
  },
  "updateSchemes": {
    "comment": "Update workflow scheme",
    "doc": "Update workflow scheme\n  Updates company-managed and team-managed project workflow schemes. This API doesn't have a concept of draft, so any changes made to a workflow scheme are immediately available. When changing the available statuses for issue types, an [asynchronous task](#async) migrates the issues as defined in the provided mappings.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira project permission to update all, including global-scoped, workflow schemes.\n    Administer projects project permission to update project-scoped workflow schemes."
  },
  "updateWorkflowSchemeMappings": {
    "comment": "Get required status mappings for workflow scheme update",
    "doc": "Get required status mappings for workflow scheme update\n  Gets the required status mappings for the desired changes to a workflow scheme. The results are provided per issue type and workflow. When updating a workflow scheme, status mappings can be provided per issue type, per workflow, or both.\n \n  [Permissions](#permissions) required:\n \n    Administer Jira permission to update all, including global-scoped, workflow schemes.\n    Administer projects project permission to update project-scoped workflow schemes."
  },
  "deleteWorkflowScheme": {
    "comment": "Delete workflow scheme",
    "doc": "Delete workflow scheme\n  Deletes a workflow scheme. Note that a workflow scheme cannot be deleted if it is active (that is, being used by at least one project).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowScheme": {
    "comment": "Get workflow scheme",
    "doc": "Get workflow scheme\n  Returns a workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateWorkflowScheme": {
    "comment": "Classic update workflow scheme",
    "doc": "Classic update workflow scheme\n  Updates a company-manged project workflow scheme, including the name, default workflow, issue type to project mappings, and more. If the workflow scheme is active (that is, being used by at least one project), then a draft workflow scheme is created or updated instead, provided that `updateDraftIfNeeded` is set to `true`.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "createWorkflowSchemeDraftFromParent": {
    "comment": "Create draft workflow scheme",
    "doc": "Create draft workflow scheme\n  Create a draft workflow scheme from an active workflow scheme, by copying the active workflow scheme. Note that an active workflow scheme can only have one draft workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteDefaultWorkflow": {
    "comment": "Delete default workflow",
    "doc": "Delete default workflow\n  Resets the default workflow for a workflow scheme. That is, the default workflow is set to Jira's system workflow (the jira workflow).\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` and a draft workflow scheme is created or updated with the default workflow reset. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getDefaultWorkflow": {
    "comment": "Get default workflow",
    "doc": "Get default workflow\n  Returns the default workflow for a workflow scheme. The default workflow is the workflow that is assigned any issue types that have not been mapped to any other workflow. The default workflow has All Unassigned Issue Types listed in its issue types for the workflow scheme in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateDefaultWorkflow": {
    "comment": "Update default workflow",
    "doc": "Update default workflow\n  Sets the default workflow for a workflow scheme.\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` in the request object and a draft workflow scheme is created or updated with the new default workflow. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteWorkflowSchemeDraft": {
    "comment": "Delete draft workflow scheme",
    "doc": "Delete draft workflow scheme\n  Deletes a draft workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowSchemeDraft": {
    "comment": "Get draft workflow scheme",
    "doc": "Get draft workflow scheme\n  Returns the draft workflow scheme for an active workflow scheme. Draft workflow schemes allow changes to be made to the active workflow schemes: When an active workflow scheme is updated, a draft copy is created. The draft is modified, then the changes in the draft are copied back to the active workflow scheme. See [Configuring workflow schemes](https://confluence.atlassian.com/x/tohKLg) for more information.\n  Note that:\n \n    Only active workflow schemes can have draft workflow schemes.\n    An active workflow scheme can only have one draft workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateWorkflowSchemeDraft": {
    "comment": "Update draft workflow scheme",
    "doc": "Update draft workflow scheme\n  Updates a draft workflow scheme. If a draft workflow scheme does not exist for the active workflow scheme, then a draft is created. Note that an active workflow scheme can only have one draft workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteDraftDefaultWorkflow": {
    "comment": "Delete draft default workflow",
    "doc": "Delete draft default workflow\n  Resets the default workflow for a workflow scheme's draft. That is, the default workflow is set to Jira's system workflow (the jira workflow).\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getDraftDefaultWorkflow": {
    "comment": "Get draft default workflow",
    "doc": "Get draft default workflow\n  Returns the default workflow for a workflow scheme's draft. The default workflow is the workflow that is assigned any issue types that have not been mapped to any other workflow. The default workflow has All Unassigned Issue Types listed in its issue types for the workflow scheme in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateDraftDefaultWorkflow": {
    "comment": "Update draft default workflow",
    "doc": "Update draft default workflow\n  Sets the default workflow for a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteWorkflowSchemeDraftIssueType": {
    "comment": "Delete workflow for issue type in draft workflow scheme",
    "doc": "Delete workflow for issue type in draft workflow scheme\n  Deletes the issue type-workflow mapping for an issue type in a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowSchemeDraftIssueType": {
    "comment": "Get workflow for issue type in draft workflow scheme",
    "doc": "Get workflow for issue type in draft workflow scheme\n  Returns the issue type-workflow mapping for an issue type in a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setWorkflowSchemeDraftIssueType": {
    "comment": "Set workflow for issue type in draft workflow scheme",
    "doc": "Set workflow for issue type in draft workflow scheme\n  Sets the workflow for an issue type in a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "publishDraftWorkflowScheme": {
    "comment": "Publish draft workflow scheme",
    "doc": "Publish draft workflow scheme\n  Publishes a draft workflow scheme.\n \n  Where the draft workflow includes new workflow statuses for an issue type, mappings are provided to update issues with the original workflow status to the new workflow status.\n \n  This operation is [asynchronous](#async). Follow the `location` link in the response to determine the status of the task and use [Get task](#api-rest-api-3-task-taskId-get) to obtain updates.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteDraftWorkflowMapping": {
    "comment": "Delete issue types for workflow in draft workflow scheme",
    "doc": "Delete issue types for workflow in draft workflow scheme\n  Deletes the workflow-issue type mapping for a workflow in a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getDraftWorkflow": {
    "comment": "Get issue types for workflows in draft workflow scheme",
    "doc": "Get issue types for workflows in draft workflow scheme\n  Returns the workflow-issue type mappings for a workflow scheme's draft.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateDraftWorkflowMapping": {
    "comment": "Set issue types for workflow in workflow scheme",
    "doc": "Set issue types for workflow in workflow scheme\n  Sets the issue types for a workflow in a workflow scheme's draft. The workflow can also be set as the default workflow for the draft workflow scheme. Unmapped issues types are mapped to the default workflow.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteWorkflowSchemeIssueType": {
    "comment": "Delete workflow for issue type in workflow scheme",
    "doc": "Delete workflow for issue type in workflow scheme\n  Deletes the issue type-workflow mapping for an issue type in a workflow scheme.\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` and a draft workflow scheme is created or updated with the issue type-workflow mapping deleted. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflowSchemeIssueType": {
    "comment": "Get workflow for issue type in workflow scheme",
    "doc": "Get workflow for issue type in workflow scheme\n  Returns the issue type-workflow mapping for an issue type in a workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "setWorkflowSchemeIssueType": {
    "comment": "Set workflow for issue type in workflow scheme",
    "doc": "Set workflow for issue type in workflow scheme\n  Sets the workflow for an issue type in a workflow scheme.\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` in the request body and a draft workflow scheme is created or updated with the new issue type-workflow mapping. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "deleteWorkflowMapping": {
    "comment": "Delete issue types for workflow in workflow scheme",
    "doc": "Delete issue types for workflow in workflow scheme\n  Deletes the workflow-issue type mapping for a workflow in a workflow scheme.\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` and a draft workflow scheme is created or updated with the workflow-issue type mapping deleted. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getWorkflow": {
    "comment": "Get issue types for workflows in workflow scheme",
    "doc": "Get issue types for workflows in workflow scheme\n  Returns the workflow-issue type mappings for a workflow scheme.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "updateWorkflowMapping": {
    "comment": "Set issue types for workflow in workflow scheme",
    "doc": "Set issue types for workflow in workflow scheme\n  Sets the issue types for a workflow in a workflow scheme. The workflow can also be set as the default workflow for the workflow scheme. Unmapped issues types are mapped to the default workflow.\n \n  Note that active workflow schemes cannot be edited. If the workflow scheme is active, set `updateDraftIfNeeded` to `true` in the request body and a draft workflow scheme is created or updated with the new workflow-issue types mappings. The draft workflow scheme can be published in Jira.\n \n  [Permissions](#permissions) required: Administer Jira [global permission](https://confluence.atlassian.com/x/x4dKLg)."
  },
  "getIdsOfWorklogsDeletedSince": {
    "comment": "Get IDs of deleted worklogs",
    "doc": "Get IDs of deleted worklogs\n  Returns a list of IDs and delete timestamps for worklogs deleted after a date and time.\n \n  This resource is paginated, with a limit of 1000 worklogs per page. Each page lists worklogs from oldest to youngest. If the number of items in the date range exceeds 1000, `until` indicates the timestamp of the youngest item on the page. Also, `nextPage` provides the URL for the next page of worklogs. The `lastPage` parameter is set to true on the last page of worklogs.\n \n  This resource does not return worklogs deleted during the minute preceding the request.\n \n  [Permissions](#permissions) required: Permission to access Jira."
  },
  "getWorklogsForIds": {
    "comment": "Get worklogs",
    "doc": "Get worklogs\n  Returns worklog details for a list of worklog IDs.\n \n  The returned list of worklogs is limited to 1000 items.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, worklogs are only returned where either of the following is true:\n \n    the worklog is set as Viewable by All Users.\n    the user is a member of a project role or group with permission to view the worklog."
  },
  "getIdsOfWorklogsModifiedSince": {
    "comment": "Get IDs of updated worklogs",
    "doc": "Get IDs of updated worklogs\n  Returns a list of IDs and update timestamps for worklogs updated after a date and time.\n \n  This resource is paginated, with a limit of 1000 worklogs per page. Each page lists worklogs from oldest to youngest. If the number of items in the date range exceeds 1000, `until` indicates the timestamp of the youngest item on the page. Also, `nextPage` provides the URL for the next page of worklogs. The `lastPage` parameter is set to true on the last page of worklogs.\n \n  This resource does not return worklogs updated during the minute preceding the request.\n \n  [Permissions](#permissions) required: Permission to access Jira, however, worklogs are only returned where either of the following is true:\n \n    the worklog is set as Viewable by All Users.\n    the user is a member of a project role or group with permission to view the worklog."
  },
  "addonPropertiesResourceGetAddonPropertiesGet": {
    "comment": "Get app properties",
    "doc": "Get app properties\n  Gets all the properties of an app.\n \n  [Permissions](#permissions) required: Only a Connect app whose key matches `addonKey` can make this request.\n  Additionally, Forge apps can access Connect app properties (stored against the same `app.connect.key`)."
  },
  "addonPropertiesResourceDeleteAddonPropertyDelete": {
    "comment": "Delete app property",
    "doc": "Delete app property\n  Deletes an app's property.\n \n  [Permissions](#permissions) required: Only a Connect app whose key matches `addonKey` can make this request.\n  Additionally, Forge apps can access Connect app properties (stored against the same `app.connect.key`)."
  },
  "addonPropertiesResourceGetAddonPropertyGet": {
    "comment": "Get app property",
    "doc": "Get app property\n  Returns the key and value of an app's property.\n \n  [Permissions](#permissions) required: Only a Connect app whose key matches `addonKey` can make this request.\n  Additionally, Forge apps can access Connect app properties (stored against the same `app.connect.key`)."
  },
  "addonPropertiesResourcePutAddonPropertyPut": {
    "comment": "Set app property",
    "doc": "Set app property\n  Sets the value of an app's property. Use this resource to store custom data for your app.\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  [Permissions](#permissions) required: Only a Connect app whose key matches `addonKey` can make this request.\n  Additionally, Forge apps can access Connect app properties (stored against the same `app.connect.key`)."
  },
  "dynamicModulesResourceRemoveModulesDelete": {
    "comment": "Remove modules",
    "doc": "Remove modules\n  Remove all or a list of modules registered by the calling app.\n \n  [Permissions](#permissions) required: Only Connect apps can make this request."
  },
  "dynamicModulesResourceGetModulesGet": {
    "comment": "Get modules",
    "doc": "Get modules\n  Returns all modules registered dynamically by the calling app.\n \n  [Permissions](#permissions) required: Only Connect apps can make this request."
  },
  "dynamicModulesResourceRegisterModulesPost": {
    "comment": "Register modules",
    "doc": "Register modules\n  Registers a list of modules.\n \n  [Permissions](#permissions) required: Only Connect apps can make this request."
  },
  "appIssueFieldValueUpdateResourceUpdateIssueFieldsPut": {
    "comment": "Bulk update custom field value",
    "doc": "Bulk update custom field value\n  Updates the value of a custom field added by Connect apps on one or more issues.\n  The values of up to 200 custom fields can be updated.\n \n  [Permissions](#permissions) required: Only Connect apps can make this request"
  },
  "migrationResourceUpdateEntityPropertiesValuePut": {
    "comment": "Bulk update entity properties",
    "doc": "Bulk update entity properties\n  Updates the values of multiple entity properties for an object, up to 50 updates per request. This operation is for use by Connect apps during app migration."
  },
  "migrationResourceWorkflowRuleSearchPost": {
    "comment": "Get workflow transition rule configurations",
    "doc": "Get workflow transition rule configurations\n  Returns configurations for workflow transition rules migrated from server to cloud and owned by the calling Connect app."
  },
  "serviceRegistryResourceServicesGet": {
    "comment": "Retrieve the attributes of service registries",
    "doc": "Retrieve the attributes of service registries\n  Retrieve the attributes of given service registries.\n \n  [Permissions](#permissions) required: Only Connect apps can make this request and the servicesIds belong to the tenant you are requesting"
  },
  "deleteForgeAppProperty": {
    "comment": "Delete app property (Forge)",
    "doc": "Delete app property (Forge)\n  Deletes a Forge app's property.\n \n  [Permissions](#permissions) required: Only Forge apps can make this request.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  },
  "putForgeAppProperty": {
    "comment": "Set app property (Forge)",
    "doc": "Set app property (Forge)\n  Sets the value of a Forge app's property.\n  These values can be retrieved in [Jira expressions](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/)\n  through the `app` [context variable](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/#context-variables).\n \n  For other use cases, use the [Storage API](https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/).\n \n  The value of the request body must be a [valid](http://tools.ietf.org/html/rfc4627), non-empty JSON blob. The maximum length is 32768 characters.\n \n  [Permissions](#permissions) required: Only Forge apps can make this request.\n \n  The new `write:app-data:jira` OAuth scope is 100% optional now, and not using it won't break your app. However, we recommend adding it to your app's scope list because we will eventually make it mandatory."
  }
}