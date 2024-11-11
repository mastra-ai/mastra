export const comments = {
  "getAttachmentsForObject": {
    "comment": "Get attachments from an object",
    "doc": "Get attachments from an object\n  Returns the compact records for all attachments on the object.\n \n  There are three possible `parent` values for this request: `project`, `project_brief`, and `task`. For a project, an attachment refers to a file uploaded to the \"Key resources\" section in the project Overview. For a project brief, an attachment refers to inline files in the project brief itself. For a task, an attachment refers to a file directly associated to that task."
  },
  "createAttachmentForObject": {
    "comment": "Upload an attachment",
    "doc": "Upload an attachment\n  Upload an attachment.\n \n  This method uploads an attachment on an object and returns the compact\n  record for the created attachment object. This is possible by either:\n \n  - Providing the URL of the external resource being attached, or\n  - Downloading the file content first and then uploading it as any other attachment. Note that it is not possible to attach\n  files from third party services such as Dropbox, Box, Vimeo & Google Drive via the API\n \n  The 100MB size limit on attachments in Asana is enforced on this endpoint.\n \n  This endpoint expects a multipart/form-data encoded request containing the full contents of the file to be uploaded.\n \n  Requests made should follow the HTTP/1.1 specification that line\n  terminators are of the form `CRLF` or `\\r\\n` outlined\n  [here](http://www.w3.org/Protocols/HTTP/1.1/draft-ietf-http-v11-spec-01#Basic-Rules) in order for the server to reliably and properly handle the request."
  },
  "deleteAttachment": {
    "comment": "Delete an attachment",
    "doc": "Delete an attachment\n  Deletes a specific, existing attachment.\n \n  Returns an empty data record."
  },
  "getAttachment": {
    "comment": "Get an attachment",
    "doc": "Get an attachment\n  Get the full record for a single attachment."
  },
  "createBatchRequest": {
    "comment": "Submit parallel requests",
    "doc": "Submit parallel requests\n  Make multiple requests in parallel to Asana's API."
  },
  "createCustomField": {
    "comment": "Create a custom field",
    "doc": "Create a custom field\n  Creates a new custom field in a workspace. Every custom field is required\n  to be created in a specific workspace, and this workspace cannot be\n  changed once set.\n \n  A custom field’s name must be unique within a workspace and not conflict\n  with names of existing task properties such as `Due Date` or `Assignee`.\n  A custom field’s type must be one of `text`, `enum`, `multi_enum`, `number`,\n  `date`, or `people`.\n \n  Returns the full record of the newly created custom field."
  },
  "deleteCustomField": {
    "comment": "Delete a custom field",
    "doc": "Delete a custom field\n  A specific, existing custom field can be deleted by making a DELETE request on the URL for that custom field.\n  Locked custom fields can only be deleted by the user who locked the field.\n  Returns an empty data record."
  },
  "getCustomField": {
    "comment": "Get a custom field",
    "doc": "Get a custom field\n  Get the complete definition of a custom field’s metadata.\n \n  Since custom fields can be defined for one of a number of types, and\n  these types have different data and behaviors, there are fields that are\n  relevant to a particular type. For instance, as noted above, enum_options\n  is only relevant for the enum type and defines the set of choices that\n  the enum could represent. The examples below show some of these\n  type-specific custom field definitions."
  },
  "updateCustomField": {
    "comment": "Update a custom field",
    "doc": "Update a custom field\n  A specific, existing custom field can be updated by making a PUT request on the URL for that custom field. Only the fields provided in the `data` block will be updated; any unspecified fields will remain unchanged\n  When using this method, it is best to specify only those fields you wish to change, or else you may overwrite changes made by another user since you last retrieved the custom field.\n  A custom field’s `type` cannot be updated.\n  An enum custom field’s `enum_options` cannot be updated with this endpoint. Instead see “Work With Enum Options” for information on how to update `enum_options`.\n  Locked custom fields can only be updated by the user who locked the field.\n  Returns the complete updated custom field record."
  },
  "createEnumOptionForCustomField": {
    "comment": "Create an enum option",
    "doc": "Create an enum option\n  Creates an enum option and adds it to this custom field’s list of enum options. A custom field can have at most 500 enum options (including disabled options). By default new enum options are inserted at the end of a custom field’s list.\n  Locked custom fields can only have enum options added by the user who locked the field.\n  Returns the full record of the newly created enum option."
  },
  "insertEnumOptionForCustomField": {
    "comment": "Reorder a custom field's enum",
    "doc": "Reorder a custom field's enum\n  Moves a particular enum option to be either before or after another specified enum option in the custom field.\n  Locked custom fields can only be reordered by the user who locked the field."
  },
  "updateEnumOption": {
    "comment": "Update an enum option",
    "doc": "Update an enum option\n  Updates an existing enum option. Enum custom fields require at least one enabled enum option.\n  Locked custom fields can only be updated by the user who locked the field.\n  Returns the full record of the updated enum option."
  },
  "getEvents": {
    "comment": "Get events on a resource",
    "doc": "Get events on a resource\n  Returns the full record for all events that have occurred since the sync\n  token was created.\n \n  A `GET` request to the endpoint `/[path_to_resource]/events` can be made in\n  lieu of including the resource ID in the data for the request.\n \n  Asana limits a single sync token to 100 events. If more than 100 events exist\n  for a given resource, `has_more: true` will be returned in the response, indicating\n  that there are more events to pull.\n \n  Note: The resource returned will be the resource that triggered the\n  event. This may be different from the one that the events were requested\n  for. For example, a subscription to a project will contain events for\n  tasks contained within the project."
  },
  "getGoalRelationships": {
    "comment": "Get goal relationships",
    "doc": "Get goal relationships\n  Returns compact goal relationship records."
  },
  "getGoalRelationship": {
    "comment": "Get a goal relationship",
    "doc": "Get a goal relationship\n  Returns the complete updated goal relationship record for a single goal relationship."
  },
  "updateGoalRelationship": {
    "comment": "Update a goal relationship",
    "doc": "Update a goal relationship\n  An existing goal relationship can be updated by making a PUT request on the URL for\n  that goal relationship. Only the fields provided in the `data` block will be updated;\n  any unspecified fields will remain unchanged.\n \n  Returns the complete updated goal relationship record."
  },
  "getGoals": {
    "comment": "Get goals",
    "doc": "Get goals\n  Returns compact goal records."
  },
  "createGoal": {
    "comment": "Create a goal",
    "doc": "Create a goal\n  Creates a new goal in a workspace or team.\n \n  Returns the full record of the newly created goal."
  },
  "deleteGoal": {
    "comment": "Delete a goal",
    "doc": "Delete a goal\n  A specific, existing goal can be deleted by making a DELETE request on the URL for that goal.\n \n  Returns an empty data record."
  },
  "getGoal": {
    "comment": "Get a goal",
    "doc": "Get a goal\n  Returns the complete goal record for a single goal."
  },
  "updateGoal": {
    "comment": "Update a goal",
    "doc": "Update a goal\n  An existing goal can be updated by making a PUT request on the URL for\n  that goal. Only the fields provided in the `data` block will be updated;\n  any unspecified fields will remain unchanged.\n \n  Returns the complete updated goal record."
  },
  "addFollowers": {
    "comment": "Add a collaborator to a goal",
    "doc": "Add a collaborator to a goal\n  Adds followers to a goal. Returns the goal the followers were added to.\n  Each goal can be associated with zero or more followers in the system.\n  Requests to add/remove followers, if successful, will return the complete updated goal record, described above."
  },
  "addSupportingRelationship": {
    "comment": "Add a supporting goal relationship",
    "doc": "Add a supporting goal relationship\n  Creates a goal relationship by adding a supporting resource to a given goal.\n \n  Returns the newly created goal relationship record."
  },
  "getParentGoalsForGoal": {
    "comment": "Get parent goals from a goal",
    "doc": "Get parent goals from a goal\n  Returns a compact representation of all of the parent goals of a goal."
  },
  "removeFollowers": {
    "comment": "Remove a collaborator from a goal",
    "doc": "Remove a collaborator from a goal\n  Removes followers from a goal. Returns the goal the followers were removed from.\n  Each goal can be associated with zero or more followers in the system.\n  Requests to add/remove followers, if successful, will return the complete updated goal record, described above."
  },
  "removeSupportingRelationship": {
    "comment": "Removes a supporting goal relationship",
    "doc": "Removes a supporting goal relationship\n  Removes a goal relationship for a given parent goal."
  },
  "createGoalMetric": {
    "comment": "Create a goal metric",
    "doc": "Create a goal metric\n  Creates and adds a goal metric to a specified goal. Note that this replaces an existing goal metric if one already exists."
  },
  "updateGoalMetric": {
    "comment": "Update a goal metric",
    "doc": "Update a goal metric\n  Updates a goal's existing metric's `current_number_value` if one exists,\n  otherwise responds with a 400 status code.\n \n  Returns the complete updated goal metric record."
  },
  "getJob": {
    "comment": "Get a job by id",
    "doc": "Get a job by id\n  Returns the full record for a job."
  },
  "createOrganizationExport": {
    "comment": "Create an organization export request",
    "doc": "Create an organization export request\n  This method creates a request to export an Organization. Asana will complete the export at some point after you create the request."
  },
  "getOrganizationExport": {
    "comment": "Get details on an org export request",
    "doc": "Get details on an org export request\n  Returns details of a previously-requested Organization export."
  },
  "getPortfolioMemberships": {
    "comment": "Get multiple portfolio memberships",
    "doc": "Get multiple portfolio memberships\n  Returns a list of portfolio memberships in compact representation. You must specify `portfolio`, `portfolio` and `user`, or `workspace` and `user`."
  },
  "getPortfolioMembership": {
    "comment": "Get a portfolio membership",
    "doc": "Get a portfolio membership\n  Returns the complete portfolio record for a single portfolio membership."
  },
  "getPortfolios": {
    "comment": "Get multiple portfolios",
    "doc": "Get multiple portfolios\n  Returns a list of the portfolios in compact representation that are owned by the current API user."
  },
  "createPortfolio": {
    "comment": "Create a portfolio",
    "doc": "Create a portfolio\n  Creates a new portfolio in the given workspace with the supplied name.\n \n  Note that portfolios created in the Asana UI may have some state\n  (like the “Priority” custom field) which is automatically added\n  to the portfolio when it is created. Portfolios created via our\n  API will not be created with the same initial state to allow\n  integrations to create their own starting state on a portfolio."
  },
  "deletePortfolio": {
    "comment": "Delete a portfolio",
    "doc": "Delete a portfolio\n  An existing portfolio can be deleted by making a DELETE request on\n  the URL for that portfolio.\n \n  Returns an empty data record."
  },
  "getPortfolio": {
    "comment": "Get a portfolio",
    "doc": "Get a portfolio\n  Returns the complete portfolio record for a single portfolio."
  },
  "updatePortfolio": {
    "comment": "Update a portfolio",
    "doc": "Update a portfolio\n  An existing portfolio can be updated by making a PUT request on the URL for\n  that portfolio. Only the fields provided in the `data` block will be updated;\n  any unspecified fields will remain unchanged.\n \n  Returns the complete updated portfolio record."
  },
  "addCustomFieldSettingForPortfolio": {
    "comment": "Add a custom field to a portfolio",
    "doc": "Add a custom field to a portfolio\n  Custom fields are associated with portfolios by way of custom field settings.  This method creates a setting for the portfolio."
  },
  "addItemForPortfolio": {
    "comment": "Add a portfolio item",
    "doc": "Add a portfolio item\n  Add an item to a portfolio.\n  Returns an empty data block."
  },
  "addMembersForPortfolio": {
    "comment": "Add users to a portfolio",
    "doc": "Add users to a portfolio\n  Adds the specified list of users as members of the portfolio.\n  Returns the updated portfolio record."
  },
  "getCustomFieldSettingsForPortfolio": {
    "comment": "Get a portfolio's custom fields",
    "doc": "Get a portfolio's custom fields\n  Returns a list of all of the custom fields settings on a portfolio, in compact form."
  },
  "getItemsForPortfolio": {
    "comment": "Get portfolio items",
    "doc": "Get portfolio items\n  Get a list of the items in compact form in a portfolio."
  },
  "getPortfolioMembershipsForPortfolio": {
    "comment": "Get memberships from a portfolio",
    "doc": "Get memberships from a portfolio\n  Returns the compact portfolio membership records for the portfolio."
  },
  "removeCustomFieldSettingForPortfolio": {
    "comment": "Remove a custom field from a portfolio",
    "doc": "Remove a custom field from a portfolio\n  Removes a custom field setting from a portfolio."
  },
  "removeItemForPortfolio": {
    "comment": "Remove a portfolio item",
    "doc": "Remove a portfolio item\n  Remove an item from a portfolio.\n  Returns an empty data block."
  },
  "removeMembersForPortfolio": {
    "comment": "Remove users from a portfolio",
    "doc": "Remove users from a portfolio\n  Removes the specified list of users from members of the portfolio.\n  Returns the updated portfolio record."
  },
  "deleteProjectBrief": {
    "comment": "Delete a project brief",
    "doc": "Delete a project brief\n  Deletes a specific, existing project brief.\n \n  Returns an empty data record."
  },
  "getProjectBrief": {
    "comment": "Get a project brief",
    "doc": "Get a project brief\n  Get the full record for a project brief."
  },
  "updateProjectBrief": {
    "comment": "Update a project brief",
    "doc": "Update a project brief\n  An existing project brief can be updated by making a PUT request on the URL for\n  that project brief. Only the fields provided in the `data` block will be updated;\n  any unspecified fields will remain unchanged.\n \n  Returns the complete updated project brief record."
  },
  "getProjectMembership": {
    "comment": "Get a project membership",
    "doc": "Get a project membership\n  Returns the complete project record for a single project membership."
  },
  "deleteProjectStatus": {
    "comment": "Delete a project status",
    "doc": "Delete a project status\n  Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route.\n \n  Deletes a specific, existing project status update.\n \n  Returns an empty data record."
  },
  "getProjectStatus": {
    "comment": "Get a project status",
    "doc": "Get a project status\n  Deprecated: new integrations should prefer the `/status_updates/{status_gid}` route.\n \n  Returns the complete record for a single status update."
  },
  "getProjectTemplates": {
    "comment": "Get multiple project templates",
    "doc": "Get multiple project templates\n  Returns the compact project template records for all project templates in the given team or workspace."
  },
  "getProjectTemplate": {
    "comment": "Get a project template",
    "doc": "Get a project template\n  Returns the complete project template record for a single project template."
  },
  "instantiateProject": {
    "comment": "Instantiate a project from a project template",
    "doc": "Instantiate a project from a project template\n  Creates and returns a job that will asynchronously handle the project instantiation.\n \n  To form this request, it is recommended to first make a request to [get a project template](/docs/get-a-project-template). Then, from the response, copy the `gid` from the object in the `requested_dates` array. This `gid` should be used in `requested_dates` to instantiate a project.\n \n  _Note: The body of this request will differ if your workspace is an organization. To determine if your workspace is an organization, use the [is_organization](/docs/workspace) parameter._"
  },
  "getProjects": {
    "comment": "Get multiple projects",
    "doc": "Get multiple projects\n  Returns the compact project records for some filtered set of projects. Use one or more of the parameters provided to filter the projects returned.\n  Note: This endpoint may timeout for large domains. Try filtering by team!"
  },
  "createProject": {
    "comment": "Create a project",
    "doc": "Create a project\n  Create a new project in a workspace or team.\n \n  Every project is required to be created in a specific workspace or\n  organization, and this cannot be changed once set. Note that you can use\n  the `workspace` parameter regardless of whether or not it is an\n  organization.\n \n  If the workspace for your project is an organization, you must also\n  supply a `team` to share the project with.\n \n  Returns the full record of the newly created project."
  },
  "deleteProject": {
    "comment": "Delete a project",
    "doc": "Delete a project\n  A specific, existing project can be deleted by making a DELETE request on\n  the URL for that project.\n \n  Returns an empty data record."
  },
  "getProject": {
    "comment": "Get a project",
    "doc": "Get a project\n  Returns the complete project record for a single project."
  },
  "updateProject": {
    "comment": "Update a project",
    "doc": "Update a project\n  A specific, existing project can be updated by making a PUT request on\n  the URL for that project. Only the fields provided in the `data` block\n  will be updated; any unspecified fields will remain unchanged.\n \n  When using this method, it is best to specify only those fields you wish\n  to change, or else you may overwrite changes made by another user since\n  you last retrieved the task.\n \n  Returns the complete updated project record."
  },
  "addCustomFieldSettingForProject": {
    "comment": "Add a custom field to a project",
    "doc": "Add a custom field to a project\n  Custom fields are associated with projects by way of custom field settings.  This method creates a setting for the project."
  },
  "addFollowersForProject": {
    "comment": "Add followers to a project",
    "doc": "Add followers to a project\n  Adds the specified list of users as followers to the project. Followers are a subset of members who have opted in to receive \"tasks added\" notifications for a project. Therefore, if the users are not already members of the project, they will also become members as a result of this operation.\n  Returns the updated project record."
  },
  "addMembersForProject": {
    "comment": "Add users to a project",
    "doc": "Add users to a project\n  Adds the specified list of users as members of the project. Note that a user being added as a member may also be added as a follower as a result of this operation. This is because the user's default notification settings (i.e., in the \"Notifcations\" tab of \"My Profile Settings\") will override this endpoint's default behavior of setting \"Tasks added\" notifications to `false`.\n  Returns the updated project record."
  },
  "getCustomFieldSettingsForProject": {
    "comment": "Get a project's custom fields",
    "doc": "Get a project's custom fields\n  Returns a list of all of the custom fields settings on a project, in compact form. Note that, as in all queries to collections which return compact representation, `opt_fields` can be used to include more data than is returned in the compact representation. See the [getting started guide on input/output options](https://developers.asana.com/docs/#input-output-options) for more information."
  },
  "duplicateProject": {
    "comment": "Duplicate a project",
    "doc": "Duplicate a project\n  Creates and returns a job that will asynchronously handle the duplication."
  },
  "createProjectBrief": {
    "comment": "Create a project brief",
    "doc": "Create a project brief\n  Creates a new project brief.\n \n  Returns the full record of the newly created project brief."
  },
  "getProjectMembershipsForProject": {
    "comment": "Get memberships from a project",
    "doc": "Get memberships from a project\n  Returns the compact project membership records for the project."
  },
  "getProjectStatusesForProject": {
    "comment": "Get statuses from a project",
    "doc": "Get statuses from a project\n  Deprecated: new integrations should prefer the `/status_updates` route.\n \n  Returns the compact project status update records for all updates on the project."
  },
  "createProjectStatusForProject": {
    "comment": "Create a project status",
    "doc": "Create a project status\n  Deprecated: new integrations should prefer the `/status_updates` route.\n \n  Creates a new status update on the project.\n \n  Returns the full record of the newly created project status update."
  },
  "removeCustomFieldSettingForProject": {
    "comment": "Remove a custom field from a project",
    "doc": "Remove a custom field from a project\n  Removes a custom field setting from a project."
  },
  "removeFollowersForProject": {
    "comment": "Remove followers from a project",
    "doc": "Remove followers from a project\n  Removes the specified list of users from following the project, this will not affect project membership status.\n  Returns the updated project record."
  },
  "removeMembersForProject": {
    "comment": "Remove users from a project",
    "doc": "Remove users from a project\n  Removes the specified list of users from members of the project.\n  Returns the updated project record."
  },
  "projectSaveAsTemplate": {
    "comment": "Create a project template from a project",
    "doc": "Create a project template from a project\n  Creates and returns a job that will asynchronously handle the project template creation. Note that\n  while the resulting project template can be accessed with the API, it won't be visible in the Asana\n  UI until Project Templates 2.0 is launched in the app. See more in [this forum post](https://forum.asana.com/t/a-new-api-for-project-templates/156432)."
  },
  "getSectionsForProject": {
    "comment": "Get sections in a project",
    "doc": "Get sections in a project\n  Returns the compact records for all sections in the specified project."
  },
  "createSectionForProject": {
    "comment": "Create a section in a project",
    "doc": "Create a section in a project\n  Creates a new section in a project.\n  Returns the full record of the newly created section."
  },
  "insertSectionForProject": {
    "comment": "Move or Insert sections",
    "doc": "Move or Insert sections\n  Move sections relative to each other. One of\n  `before_section` or `after_section` is required.\n \n  Sections cannot be moved between projects.\n \n  Returns an empty data block."
  },
  "getTaskCountsForProject": {
    "comment": "Get task count of a project",
    "doc": "Get task count of a project\n  Get an object that holds task count fields. All fields are excluded by default. You must [opt in](/docs/input-output-options) using `opt_fields` to get any information from this endpoint.\n \n  This endpoint has an additional [rate limit](/docs/standard-rate-limits) and each field counts especially high against our [cost limits](/docs/cost-limits).\n \n  Milestones are just tasks, so they are included in the `num_tasks`, `num_incomplete_tasks`, and `num_completed_tasks` counts."
  },
  "getTasksForProject": {
    "comment": "Get tasks from a project",
    "doc": "Get tasks from a project\n  Returns the compact task records for all tasks within the given project, ordered by their priority within the project. Tasks can exist in more than one project at a time."
  },
  "deleteSection": {
    "comment": "Delete a section",
    "doc": "Delete a section\n  A specific, existing section can be deleted by making a DELETE request on\n  the URL for that section.\n \n  Note that sections must be empty to be deleted.\n \n  The last remaining section cannot be deleted.\n \n  Returns an empty data block."
  },
  "getSection": {
    "comment": "Get a section",
    "doc": "Get a section\n  Returns the complete record for a single section."
  },
  "updateSection": {
    "comment": "Update a section",
    "doc": "Update a section\n  A specific, existing section can be updated by making a PUT request on\n  the URL for that project. Only the fields provided in the `data` block\n  will be updated; any unspecified fields will remain unchanged. (note that\n  at this time, the only field that can be updated is the `name` field.)\n \n  When using this method, it is best to specify only those fields you wish\n  to change, or else you may overwrite changes made by another user since\n  you last retrieved the task.\n \n  Returns the complete updated section record."
  },
  "addTaskForSection": {
    "comment": "Add task to section",
    "doc": "Add task to section\n  Add a task to a specific, existing section. This will remove the task from other sections of the project.\n \n  The task will be inserted at the top of a section unless an insert_before or insert_after parameter is declared.\n \n  This does not work for separators (tasks with the resource_subtype of section)."
  },
  "getTasksForSection": {
    "comment": "Get tasks from a section",
    "doc": "Get tasks from a section\n  Board view only: Returns the compact section records for all tasks within the given section."
  },
  "getStatusesForObject": {
    "comment": "Get status updates from an object",
    "doc": "Get status updates from an object\n  Returns the compact status update records for all updates on the object."
  },
  "createStatusForObject": {
    "comment": "Create a status update",
    "doc": "Create a status update\n  Creates a new status update on an object.\n  Returns the full record of the newly created status update."
  },
  "deleteStatus": {
    "comment": "Delete a status update",
    "doc": "Delete a status update\n  Deletes a specific, existing status update.\n \n  Returns an empty data record."
  },
  "getStatus": {
    "comment": "Get a status update",
    "doc": "Get a status update\n  Returns the complete record for a single status update."
  },
  "deleteStory": {
    "comment": "Delete a story",
    "doc": "Delete a story\n  Deletes a story. A user can only delete stories they have created.\n \n  Returns an empty data record."
  },
  "getStory": {
    "comment": "Get a story",
    "doc": "Get a story\n  Returns the full record for a single story."
  },
  "updateStory": {
    "comment": "Update a story",
    "doc": "Update a story\n  Updates the story and returns the full record for the updated story. Only comment stories can have their text updated, and only comment stories and attachment stories can be pinned. Only one of `text` and `html_text` can be specified."
  },
  "getTags": {
    "comment": "Get multiple tags",
    "doc": "Get multiple tags\n  Returns the compact tag records for some filtered set of tags. Use one or more of the parameters provided to filter the tags returned."
  },
  "createTag": {
    "comment": "Create a tag",
    "doc": "Create a tag\n  Creates a new tag in a workspace or organization.\n \n  Every tag is required to be created in a specific workspace or\n  organization, and this cannot be changed once set. Note that you can use\n  the workspace parameter regardless of whether or not it is an\n  organization.\n \n  Returns the full record of the newly created tag."
  },
  "deleteTag": {
    "comment": "Delete a tag",
    "doc": "Delete a tag\n  A specific, existing tag can be deleted by making a DELETE request on\n  the URL for that tag.\n \n  Returns an empty data record."
  },
  "getTag": {
    "comment": "Get a tag",
    "doc": "Get a tag\n  Returns the complete tag record for a single tag."
  },
  "updateTag": {
    "comment": "Update a tag",
    "doc": "Update a tag\n  Updates the properties of a tag. Only the fields provided in the `data`\n  block will be updated; any unspecified fields will remain unchanged.\n \n  When using this method, it is best to specify only those fields you wish\n  to change, or else you may overwrite changes made by another user since\n  you last retrieved the tag.\n \n  Returns the complete updated tag record."
  },
  "getTasksForTag": {
    "comment": "Get tasks from a tag",
    "doc": "Get tasks from a tag\n  Returns the compact task records for all tasks with the given tag. Tasks can have more than one tag at a time."
  },
  "getTasks": {
    "comment": "Get multiple tasks",
    "doc": "Get multiple tasks\n  Returns the compact task records for some filtered set of tasks. Use one or more of the parameters provided to filter the tasks returned. You must specify a `project` or `tag` if you do not specify `assignee` and `workspace`.\n \n  For more complex task retrieval, use [workspaces/{workspace_gid}/tasks/search](/docs/search-tasks-in-a-workspace)."
  },
  "createTask": {
    "comment": "Create a task",
    "doc": "Create a task\n  Creating a new task is as easy as POSTing to the `/tasks` endpoint with a\n  data block containing the fields you’d like to set on the task. Any\n  unspecified fields will take on default values.\n \n  Every task is required to be created in a specific workspace, and this\n  workspace cannot be changed once set. The workspace need not be set\n  explicitly if you specify `projects` or a `parent` task instead."
  },
  "deleteTask": {
    "comment": "Delete a task",
    "doc": "Delete a task\n  A specific, existing task can be deleted by making a DELETE request on\n  the URL for that task. Deleted tasks go into the “trash” of the user\n  making the delete request. Tasks can be recovered from the trash within a\n  period of 30 days; afterward they are completely removed from the system.\n \n  Returns an empty data record."
  },
  "getTask": {
    "comment": "Get a task",
    "doc": "Get a task\n  Returns the complete task record for a single task."
  },
  "updateTask": {
    "comment": "Update a task",
    "doc": "Update a task\n  A specific, existing task can be updated by making a PUT request on the\n  URL for that task. Only the fields provided in the `data` block will be\n  updated; any unspecified fields will remain unchanged.\n \n  When using this method, it is best to specify only those fields you wish\n  to change, or else you may overwrite changes made by another user since\n  you last retrieved the task.\n \n  Returns the complete updated task record."
  },
  "addDependenciesForTask": {
    "comment": "Set dependencies for a task",
    "doc": "Set dependencies for a task\n  Marks a set of tasks as dependencies of this task, if they are not already dependencies. A task can have at most 30 dependents and dependencies combined."
  },
  "addDependentsForTask": {
    "comment": "Set dependents for a task",
    "doc": "Set dependents for a task\n  Marks a set of tasks as dependents of this task, if they are not already dependents. A task can have at most 30 dependents and dependencies combined."
  },
  "addFollowersForTask": {
    "comment": "Add followers to a task",
    "doc": "Add followers to a task\n  Adds followers to a task. Returns an empty data block.\n  Each task can be associated with zero or more followers in the system.\n  Requests to add/remove followers, if successful, will return the complete updated task record, described above."
  },
  "addProjectForTask": {
    "comment": "Add a project to a task",
    "doc": "Add a project to a task\n  Adds the task to the specified project, in the optional location\n  specified. If no location arguments are given, the task will be added to\n  the end of the project.\n \n  `addProject` can also be used to reorder a task within a project or\n  section that already contains it.\n \n  At most one of `insert_before`, `insert_after`, or `section` should be\n  specified. Inserting into a section in an non-order-dependent way can be\n  done by specifying section, otherwise, to insert within a section in a\n  particular place, specify `insert_before` or `insert_after` and a task\n  within the section to anchor the position of this task.\n \n  Returns an empty data block."
  },
  "addTagForTask": {
    "comment": "Add a tag to a task",
    "doc": "Add a tag to a task\n  Adds a tag to a task. Returns an empty data block."
  },
  "getDependenciesForTask": {
    "comment": "Get dependencies from a task",
    "doc": "Get dependencies from a task\n  Returns the compact representations of all of the dependencies of a task."
  },
  "getDependentsForTask": {
    "comment": "Get dependents from a task",
    "doc": "Get dependents from a task\n  Returns the compact representations of all of the dependents of a task."
  },
  "duplicateTask": {
    "comment": "Duplicate a task",
    "doc": "Duplicate a task\n  Creates and returns a job that will asynchronously handle the duplication."
  },
  "getProjectsForTask": {
    "comment": "Get projects a task is in",
    "doc": "Get projects a task is in\n  Returns a compact representation of all of the projects the task is in."
  },
  "removeDependenciesForTask": {
    "comment": "Unlink dependencies from a task",
    "doc": "Unlink dependencies from a task\n  Unlinks a set of dependencies from this task."
  },
  "removeDependentsForTask": {
    "comment": "Unlink dependents from a task",
    "doc": "Unlink dependents from a task\n  Unlinks a set of dependents from this task."
  },
  "removeFollowerForTask": {
    "comment": "Remove followers from a task",
    "doc": "Remove followers from a task\n  Removes each of the specified followers from the task if they are following. Returns the complete, updated record for the affected task."
  },
  "removeProjectForTask": {
    "comment": "Remove a project from a task",
    "doc": "Remove a project from a task\n  Removes the task from the specified project. The task will still exist in\n  the system, but it will not be in the project anymore.\n \n  Returns an empty data block."
  },
  "removeTagForTask": {
    "comment": "Remove a tag from a task",
    "doc": "Remove a tag from a task\n  Removes a tag from a task. Returns an empty data block."
  },
  "setParentForTask": {
    "comment": "Set the parent of a task",
    "doc": "Set the parent of a task\n  parent, or no parent task at all. Returns an empty data block. When using `insert_before` and `insert_after`, at most one of those two options can be specified, and they must already be subtasks of the parent."
  },
  "getStoriesForTask": {
    "comment": "Get stories from a task",
    "doc": "Get stories from a task\n  Returns the compact records for all stories on the task."
  },
  "createStoryForTask": {
    "comment": "Create a story on a task",
    "doc": "Create a story on a task\n  Adds a story to a task. This endpoint currently only allows for comment\n  stories to be created. The comment will be authored by the currently\n  authenticated user, and timestamped when the server receives the request.\n \n  Returns the full record for the new story added to the task."
  },
  "getSubtasksForTask": {
    "comment": "Get subtasks from a task",
    "doc": "Get subtasks from a task\n  Returns a compact representation of all of the subtasks of a task."
  },
  "createSubtaskForTask": {
    "comment": "Create a subtask",
    "doc": "Create a subtask\n  Creates a new subtask and adds it to the parent task. Returns the full record for the newly created subtask."
  },
  "getTagsForTask": {
    "comment": "Get a task's tags",
    "doc": "Get a task's tags\n  Get a compact representation of all of the tags the task has."
  },
  "getTeamMemberships": {
    "comment": "Get team memberships",
    "doc": "Get team memberships\n  Returns compact team membership records."
  },
  "getTeamMembership": {
    "comment": "Get a team membership",
    "doc": "Get a team membership\n  Returns the complete team membership record for a single team membership."
  },
  "createTeam": {
    "comment": "Create a team",
    "doc": "Create a team\n  Creates a team within the current workspace."
  },
  "updateTeam": {
    "comment": "Update a team",
    "doc": "Update a team\n  Updates a team within the current workspace."
  },
  "getTeam": {
    "comment": "Get a team",
    "doc": "Get a team\n  Returns the full record for a single team."
  },
  "addUserForTeam": {
    "comment": "Add a user to a team",
    "doc": "Add a user to a team\n  The user making this call must be a member of the team in order to add others. The user being added must exist in the same organization as the team.\n \n  Returns the complete team membership record for the newly added user."
  },
  "getProjectTemplatesForTeam": {
    "comment": "Get a team's project templates",
    "doc": "Get a team's project templates\n  Returns the compact project template records for all project templates in the team."
  },
  "getProjectsForTeam": {
    "comment": "Get a team's projects",
    "doc": "Get a team's projects\n  Returns the compact project records for all projects in the team."
  },
  "createProjectForTeam": {
    "comment": "Create a project in a team",
    "doc": "Create a project in a team\n  Creates a project shared with the given team.\n \n  Returns the full record of the newly created project."
  },
  "removeUserForTeam": {
    "comment": "Remove a user from a team",
    "doc": "Remove a user from a team\n  The user making this call must be a member of the team in order to remove themselves or others."
  },
  "getTeamMembershipsForTeam": {
    "comment": "Get memberships from a team",
    "doc": "Get memberships from a team\n  Returns the compact team memberships for the team."
  },
  "getUsersForTeam": {
    "comment": "Get users in a team",
    "doc": "Get users in a team\n  Returns the compact records for all users that are members of the team.\n  Results are sorted alphabetically and limited to 2000. For more results use the `/users` endpoint."
  },
  "getTimePeriods": {
    "comment": "Get time periods",
    "doc": "Get time periods\n  Returns compact time period records."
  },
  "getTimePeriod": {
    "comment": "Get a time period",
    "doc": "Get a time period\n  Returns the full record for a single time period."
  },
  "getUserTaskList": {
    "comment": "Get a user task list",
    "doc": "Get a user task list\n  Returns the full record for a user task list."
  },
  "getTasksForUserTaskList": {
    "comment": "Get tasks from a user task list",
    "doc": "Get tasks from a user task list\n  Returns the compact list of tasks in a user’s My Tasks list.\n  Note: Access control is enforced for this endpoint as with all Asana API endpoints, meaning a user’s private tasks will be filtered out if the API-authenticated user does not have access to them.\n  Note: Both complete and incomplete tasks are returned by default unless they are filtered out (for example, setting `completed_since=now` will return only incomplete tasks, which is the default view for “My Tasks” in Asana.)"
  },
  "getUsers": {
    "comment": "Get multiple users",
    "doc": "Get multiple users\n  Returns the user records for all users in all workspaces and organizations accessible to the authenticated user. Accepts an optional workspace ID parameter.\n  Results are sorted by user ID."
  },
  "getUser": {
    "comment": "Get a user",
    "doc": "Get a user\n  Returns the full user record for the single user with the provided ID."
  },
  "getFavoritesForUser": {
    "comment": "Get a user's favorites",
    "doc": "Get a user's favorites\n  Returns all of a user's favorites in the given workspace, of the given type.\n  Results are given in order (The same order as Asana's sidebar)."
  },
  "getTeamMembershipsForUser": {
    "comment": "Get memberships from a user",
    "doc": "Get memberships from a user\n  Returns the compact team membership records for the user."
  },
  "getTeamsForUser": {
    "comment": "Get teams for a user",
    "doc": "Get teams for a user\n  Returns the compact records for all teams to which the given user is assigned."
  },
  "getUserTaskListForUser": {
    "comment": "Get a user's task list",
    "doc": "Get a user's task list\n  Returns the full record for a user's task list."
  },
  "getWorkspaceMembershipsForUser": {
    "comment": "Get workspace memberships for a user",
    "doc": "Get workspace memberships for a user\n  Returns the compact workspace membership records for the user."
  },
  "getWebhooks": {
    "comment": "Get multiple webhooks",
    "doc": "Get multiple webhooks\n  Get the compact representation of all webhooks your app has registered for the authenticated user in the given workspace."
  },
  "createWebhook": {
    "comment": "Establish a webhook",
    "doc": "Establish a webhook\n  Establishing a webhook is a two-part process. First, a simple HTTP POST\n  request initiates the creation similar to creating any other resource.\n \n  Next, in the middle of this request comes the confirmation handshake.\n  When a webhook is created, we will send a test POST to the target with an\n  `X-Hook-Secret` header. The target must respond with a `200 OK` or `204\n  No Content` and a matching `X-Hook-Secret` header to confirm that this\n  webhook subscription is indeed expected. We strongly recommend storing\n  this secret to be used to verify future webhook event signatures.\n \n  The POST request to create the webhook will then return with the status\n  of the request. If you do not acknowledge the webhook’s confirmation\n  handshake it will fail to setup, and you will receive an error in\n  response to your attempt to create it. This means you need to be able to\n  receive and complete the webhook while the POST request is in-flight\n  (in other words, have a server that can handle requests asynchronously).\n \n  Invalid hostnames like localhost will recieve a 403 Forbidden status code.\n \n  ```\n  # Request\n  curl -H \"Authorization: Bearer <personal_access_token>\" \\\n  -X POST https://app.asana.com/api/1.0/webhooks \\\n  -d \"resource=8675309\" \\\n  -d \"target=https://example.com/receive-webhook/7654\"\n  ```\n \n  ```\n  # Handshake sent to https://example.com/\n  POST /receive-webhook/7654\n  X-Hook-Secret: b537207f20cbfa02357cf448134da559e8bd39d61597dcd5631b8012eae53e81\n  ```\n \n  ```\n  # Handshake response sent by example.com\n  HTTP/1.1 200\n  X-Hook-Secret: b537207f20cbfa02357cf448134da559e8bd39d61597dcd5631b8012eae53e81\n  ```\n \n  ```\n  # Response\n  HTTP/1.1 201\n  {\n  \"data\": {\n  \"gid\": \"43214\",\n  \"resource\": {\n  \"gid\": \"8675309\",\n  \"name\": \"Bugs\"\n  },\n  \"target\": \"https://example.com/receive-webhook/7654\",\n  \"active\": false,\n  \"last_success_at\": null,\n  \"last_failure_at\": null,\n  \"last_failure_content\": null\n  }\n  }\n  ```"
  },
  "deleteWebhook": {
    "comment": "Delete a webhook",
    "doc": "Delete a webhook\n  This method permanently removes a webhook. Note that it may be possible to receive a request that was already in flight after deleting the webhook, but no further requests will be issued."
  },
  "getWebhook": {
    "comment": "Get a webhook",
    "doc": "Get a webhook\n  Returns the full record for the given webhook."
  },
  "updateWebhook": {
    "comment": "Update a webhook",
    "doc": "Update a webhook\n  An existing webhook's filters can be updated by making a PUT request on the URL for that webhook. Note that the webhook's previous `filters` array will be completely overwritten by the `filters` sent in the PUT request."
  },
  "getWorkspaceMembership": {
    "comment": "Get a workspace membership",
    "doc": "Get a workspace membership\n  Returns the complete workspace record for a single workspace membership."
  },
  "getWorkspaces": {
    "comment": "Get multiple workspaces",
    "doc": "Get multiple workspaces\n  Returns the compact records for all workspaces visible to the authorized user."
  },
  "getWorkspace": {
    "comment": "Get a workspace",
    "doc": "Get a workspace\n  Returns the full workspace record for a single workspace."
  },
  "updateWorkspace": {
    "comment": "Update a workspace",
    "doc": "Update a workspace\n  A specific, existing workspace can be updated by making a PUT request on the URL for that workspace. Only the fields provided in the data block will be updated; any unspecified fields will remain unchanged.\n  Currently the only field that can be modified for a workspace is its name.\n  Returns the complete, updated workspace record."
  },
  "addUserForWorkspace": {
    "comment": "Add a user to a workspace or organization",
    "doc": "Add a user to a workspace or organization\n  Add a user to a workspace or organization.\n  The user can be referenced by their globally unique user ID or their email address. Returns the full user record for the invited user."
  },
  "getAuditLogEvents": {
    "comment": "Get audit log events",
    "doc": "Get audit log events\n  Retrieve the audit log events that have been captured in your domain.\n \n  This endpoint will return a list of [AuditLogEvent](/docs/audit-log-event) objects, sorted by creation time in ascending order. Note that the Audit Log API captures events from October 8th, 2021 and later. Queries for events before this date will not return results.\n \n  There are a number of query parameters (below) that can be used to filter the set of [AuditLogEvent](/docs/audit-log-event) objects that are returned in the response. Any combination of query parameters is valid. When no filters are provided, all of the events that have been captured in your domain will match.\n \n  The list of events will always be [paginated](/docs/pagination). The default limit is 1000 events. The next set of events can be retrieved using the `offset` from the previous response. If there are no events that match the provided filters in your domain, the endpoint will return `null` for the `next_page` field. Querying again with the same filters may return new events if they were captured after the last request. Once a response includes a `next_page` with an `offset`, subsequent requests can be made with the latest `offset` to poll for new events that match the provided filters.\n \n  When no `offset` is provided, the response will begin with the oldest events that match the provided filters. It is important to note that [AuditLogEvent](/docs/audit-log-event) objects will be permanently deleted from our systems after 90 days. If you wish to keep a permanent record of these events, we recommend using a SIEM tool to ingest and store these logs."
  },
  "getCustomFieldsForWorkspace": {
    "comment": "Get a workspace's custom fields",
    "doc": "Get a workspace's custom fields\n  Returns a list of the compact representation of all of the custom fields in a workspace."
  },
  "getProjectsForWorkspace": {
    "comment": "Get all projects in a workspace",
    "doc": "Get all projects in a workspace\n  Returns the compact project records for all projects in the workspace.\n  Note: This endpoint may timeout for large domains. Prefer the `/teams/{team_gid}/projects` endpoint."
  },
  "createProjectForWorkspace": {
    "comment": "Create a project in a workspace",
    "doc": "Create a project in a workspace\n  Returns the compact project records for all projects in the workspace.\n \n  If the workspace for your project is an organization, you must also\n  supply a team to share the project with.\n \n  Returns the full record of the newly created project."
  },
  "removeUserForWorkspace": {
    "comment": "Remove a user from a workspace or organization",
    "doc": "Remove a user from a workspace or organization\n  Remove a user from a workspace or organization.\n  The user making this call must be an admin in the workspace. The user can be referenced by their globally unique user ID or their email address.\n  Returns an empty data record."
  },
  "getTagsForWorkspace": {
    "comment": "Get tags in a workspace",
    "doc": "Get tags in a workspace\n  Returns the compact tag records for some filtered set of tags. Use one or more of the parameters provided to filter the tags returned."
  },
  "createTagForWorkspace": {
    "comment": "Create a tag in a workspace",
    "doc": "Create a tag in a workspace\n  Creates a new tag in a workspace or organization.\n \n  Every tag is required to be created in a specific workspace or\n  organization, and this cannot be changed once set. Note that you can use\n  the workspace parameter regardless of whether or not it is an\n  organization.\n \n  Returns the full record of the newly created tag."
  },
  "searchTasksForWorkspace": {
    "comment": "Search tasks in a workspace",
    "doc": "Search tasks in a workspace\n  To mirror the functionality of the Asana web app's advanced search feature, the Asana API has a task search endpoint that allows you to build complex filters to find and retrieve the exact data you need.\n  #### Premium access\n  Like the Asana web product's advance search feature, this search endpoint will only be available to premium Asana users. A user is premium if any of the following is true:\n \n  - The workspace in which the search is being performed is a premium workspace - The user is a member of a premium team inside the workspace\n \n  Even if a user is only a member of a premium team inside a non-premium workspace, search will allow them to find data anywhere in the workspace, not just inside the premium team. Making a search request using credentials of a non-premium user will result in a `402 Payment Required` error.\n  #### Pagination\n  Search results are not stable; repeating the same query multiple times may return the data in a different order, even if the data do not change. Because of this, the traditional [pagination](https://developers.asana.com/docs/#pagination) available elsewhere in the Asana API is not available here. However, you can paginate manually by sorting the search results by their creation time and then modifying each subsequent query to exclude data you have already seen. Page sizes are limited to a maximum of 100 items, and can be specified by the `limit` query parameter.\n  #### Eventual consistency\n  Changes in Asana (regardless of whether they’re made though the web product or the API) are forwarded to our search infrastructure to be indexed. This process can take between 10 and 60 seconds to complete under normal operation, and longer during some production incidents. Making a change to a task that would alter its presence in a particular search query will not be reflected immediately. This is also true of the advanced search feature in the web product.\n  #### Rate limits\n  You may receive a `429 Too Many Requests` response if you hit any of our [rate limits](https://developers.asana.com/docs/#rate-limits).\n  #### Custom field parameters\n  | Parameter name | Custom field type | Accepted type |\n  |---|---|---|\n  | custom_fields.{gid}.is_set | All | Boolean |\n  | custom_fields.{gid}.value | Text | String |\n  | custom_fields.{gid}.value | Number | Number |\n  | custom_fields.{gid}.value | Enum | Enum option ID |\n  | custom_fields.{gid}.starts_with | Text only | String |\n  | custom_fields.{gid}.ends_with | Text only | String |\n  | custom_fields.{gid}.contains | Text only | String |\n  | custom_fields.{gid}.less_than | Number only | Number |\n  | custom_fields.{gid}.greater_than | Number only | Number |\n \n \n  For example, if the gid of the custom field is 12345, these query parameter to find tasks where it is set would be `custom_fields.12345.is_set=true`. To match an exact value for an enum custom field, use the gid of the desired enum option and not the name of the enum option: `custom_fields.12345.value=67890`.\n \n  Not Supported: searching for multiple exact matches of a custom field, searching for multi-enum custom field\n \n  Note: If you specify `projects.any` and `sections.any`, you will receive tasks for the project and tasks for the section. If you're looking for only tasks in a section, omit the `projects.any` from the request."
  },
  "getTeamsForWorkspace": {
    "comment": "Get teams in a workspace",
    "doc": "Get teams in a workspace\n  Returns the compact records for all teams in the workspace visible to the authorized user."
  },
  "typeaheadForWorkspace": {
    "comment": "Get objects via typeahead",
    "doc": "Get objects via typeahead\n  Retrieves objects in the workspace based via an auto-completion/typeahead\n  search algorithm. This feature is meant to provide results quickly, so do\n  not rely on this API to provide extremely accurate search results. The\n  result set is limited to a single page of results with a maximum size, so\n  you won’t be able to fetch large numbers of results.\n \n  The typeahead search API provides search for objects from a single\n  workspace. This endpoint should be used to query for objects when\n  creating an auto-completion/typeahead search feature. This API is meant\n  to provide results quickly and should not be relied upon for accurate or\n  exhaustive search results. The results sets are limited in size and\n  cannot be paginated.\n \n  Queries return a compact representation of each object which is typically\n  the gid and name fields. Interested in a specific set of fields or all of\n  the fields?! Of course you are. Use field selectors to manipulate what\n  data is included in a response.\n \n  Resources with type `user` are returned in order of most contacted to\n  least contacted. This is determined by task assignments, adding the user\n  to projects, and adding the user as a follower to tasks, messages,\n  etc.\n \n  Resources with type `project` are returned in order of recency. This is\n  determined when the user visits the project, is added to the project, and\n  completes tasks in the project.\n \n  Resources with type `task` are returned with priority placed on tasks\n  the user is following, but no guarantee on the order of those tasks.\n \n  Resources with type `project_template` are returned with priority\n  placed on favorited project templates.\n \n  Leaving the `query` string empty or omitted will give you results, still\n  following the resource ordering above. This could be used to list users or\n  projects that are relevant for the requesting user's api token."
  },
  "getUsersForWorkspace": {
    "comment": "Get users in a workspace or organization",
    "doc": "Get users in a workspace or organization\n  Returns the compact records for all users in the specified workspace or organization.\n  Results are sorted alphabetically and limited to 2000. For more results use the `/users` endpoint."
  },
  "getWorkspaceMembershipsForWorkspace": {
    "comment": "Get the workspace memberships for a workspace",
    "doc": "Get the workspace memberships for a workspace\n  Returns the compact workspace membership records for the workspace."
  }
}