export const comments = {
  "getV2Objects": {
    "comment": "List objects",
    "doc": "List objects\n  Lists all system-defined and user-defined objects in your workspace.\n \n  Required scopes: `object_configuration:read`."
  },
  "postV2Objects": {
    "comment": "Create an object",
    "doc": "Create an object\n  Creates a new custom object in your workspace.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "getV2ObjectsByObject": {
    "comment": "Get an object",
    "doc": "Get an object\n  Gets a single object by its `object_id` or slug.\n \n  Required scopes: `object_configuration:read`."
  },
  "patchV2ObjectsByObject": {
    "comment": "Update an object",
    "doc": "Update an object\n  Updates a single object. The object to be updated is identified by its `object_id`.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "getV2ByTargetByIdentifierAttributes": {
    "comment": "List attributes",
    "doc": "List attributes\n  Lists all attributes defined on a specific object or list. Attributes are returned in the order that they are sorted by in the UI.\n \n  Required scopes: `object_configuration:read`."
  },
  "postV2ByTargetByIdentifierAttributes": {
    "comment": "Create an attribute",
    "doc": "Create an attribute\n  Creates a new attribute on either an object or a list.\n \n  To create an attribute on an object, you must also have the `object_configuration:read-write` scope.\n \n  To create an attribute on a list, you must also have the `list_configuration:read-write` scope."
  },
  "getV2ByTargetByIdentifierAttributesByAttribute": {
    "comment": "Get an attribute",
    "doc": "Get an attribute\n  Gets information about a single attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read`."
  },
  "patchV2ByTargetByIdentifierAttributesByAttribute": {
    "comment": "Update an attribute",
    "doc": "Update an attribute\n  Updates a single attribute on a given object or list.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "getV2ByTargetByIdentifierAttributesByAttributeOptions": {
    "comment": "List select options",
    "doc": "List select options\n  Lists all select options for a particular attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read`."
  },
  "postV2ByTargetByIdentifierAttributesByAttributeOptions": {
    "comment": "Create a select option",
    "doc": "Create a select option\n  Adds a select option to a select attribute on an object or a list.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "patchV2ByTargetByIdentifierAttributesByAttributeOptionsByOption": {
    "comment": "Update a select option",
    "doc": "Update a select option\n  Updates a select option on an attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "getV2ByTargetByIdentifierAttributesByAttributeStatuses": {
    "comment": "List statuses",
    "doc": "List statuses\n  Lists all statuses for a particular status attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read`."
  },
  "postV2ByTargetByIdentifierAttributesByAttributeStatuses": {
    "comment": "Create a status",
    "doc": "Create a status\n  Add a new status to a status attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "patchV2ByTargetByIdentifierAttributesByAttributeStatusesByStatus": {
    "comment": "Update a status",
    "doc": "Update a status\n  Update a status on an status attribute on either an object or a list.\n \n  Required scopes: `object_configuration:read-write`."
  },
  "postV2ObjectsByObjectRecordsQuery": {
    "comment": "List records",
    "doc": "List records\n  Lists people, company or other records, with the option to filter and sort results.\n \n  Required scopes: `record_permission:read`, `object_configuration:read`."
  },
  "postV2ObjectsByObjectRecords": {
    "comment": "Create a record",
    "doc": "Create a record\n  Creates a new person, company or other record. This endpoint will throw on conflicts of unique attributes. If you would prefer to update records on conflicts, please use the [Assert record endpoint](/reference/put_v2-objects-object-records) instead.\n \n  Required scopes: `record_permission:read-write`, `object_configuration:read`."
  },
  "putV2ObjectsByObjectRecords": {
    "comment": "Assert a record",
    "doc": "Assert a record\n  Use this endpoint to create or update people, companies and other records. A matching attribute is used to search for existing records. If a record is found with the same value for the matching attribute, that record will be updated. If no record with the same value for the matching attribute is found, a new record will be created instead. If you would like to avoid matching, please use the [Create record endpoint](/reference/post_v2-objects-object-records).\n \n  If the matching attribute is a multiselect attribute, new values will be added and existing values will not be deleted. For any other multiselect attribute, all values will be either created or deleted as necessary to match the list of supplied values.\n \n  Required scopes: `record_permission:read-write`, `object_configuration:read`."
  },
  "getV2ObjectsByObjectRecordsByRecordId": {
    "comment": "Get a record",
    "doc": "Get a record\n  Gets a single person, company or other record by its `record_id`.\n \n  Required scopes: `record_permission:read`, `object_configuration:read`."
  },
  "patchV2ObjectsByObjectRecordsByRecordId": {
    "comment": "Update a record",
    "doc": "Update a record\n  Use this endpoint to update people, companies and other records by `record_id`. If the update payload includes multiselect attributes, the values supplied will be created and prepended to the list of values that already exist (if any). Use the [Assert record endpoint](/reference/put_v2-objects-object-records) to overwrite or remove multiselect attribute values.\n \n  Required scopes: `record_permission:read-write`, `object_configuration:read`."
  },
  "deleteV2ObjectsByObjectRecordsByRecordId": {
    "comment": "Delete a record",
    "doc": "Delete a record\n  Deletes a single record (e.g. a company or person) by ID.\n \n  Required scopes: `object_configuration:read`, `record_permission:read-write`."
  },
  "getV2ObjectsByObjectRecordsByRecordIdAttributesByAttributeValues": {
    "comment": "List record attribute values",
    "doc": "List record attribute values\n  Gets all values for a given attribute on a record. If the attribute is historic, this endpoint has the ability to return all historic values using the `show_historic` query param.\n \n  Required scopes: `record_permission:read`, `object_configuration:read`."
  },
  "getV2ObjectsByObjectRecordsByRecordIdEntries": {
    "comment": "List record entries",
    "doc": "List record entries\n  List all entries, across all lists, for which this record is the parent.\n \n  Required scopes: `record_permission:read`, `object_configuration:read`, `list_entry:read`."
  },
  "getV2Lists": {
    "comment": "List all lists",
    "doc": "List all lists\n  List all lists that your access token has access to. lists are returned in the order that they are sorted in the sidebar.\n \n  Required scopes: `list_configuration:read`."
  },
  "postV2Lists": {
    "comment": "Create a list",
    "doc": "Create a list\n  Creates a new list.\n \n  Once you have your list, add attributes to it using the [Create attribute](/reference/post_v2-target-identifier-attributes) API, and add records to it using the [Add records to list](/reference/post_v2-lists-list-entries) API.\n \n  New lists must specify which records can be added with the `parent_object` parameter which accepts either an object slug or an object ID. Permissions for the list are controlled with the `workspace_access` and `workspace_member_access` parameters.\n \n  Please note that new lists must have either `workspace_access` set to `\"full-access\"` or one or more element of `workspace_member_access` with a `\"full-access\"` level. It is also possible to receive a `403` billing error if your workspace is not on a plan that supports either advanced workspace or workspace member-level access for lists.\n \n  Required scopes: `list_configuration:read-write`."
  },
  "getV2ListsByList": {
    "comment": "Get a list",
    "doc": "Get a list\n  Gets a single list in your workspace that your access token has access to.\n \n  Required scopes: `list_configuration:read`."
  },
  "patchV2ListsByList": {
    "comment": "Update a list",
    "doc": "Update a list\n  Updates an existing list. Permissions for the list are controlled with the `workspace_access` and `workspace_member_access` parameters. Please note that lists must have either `workspace_access` set to `\"full-access\"` or one or more element of `workspace_member_access` with a `\"full-access\"` level. It is also possible to receive a `403` billing error if your workspace is not on a plan that supports either advanced workspace or workspace member level access for lists. Changing the parent object of a list is not possible through the API as it can have unintended side-effects that should be considered carefully. If you wish to carry out a parent object change you should do so through the UI.\n \n  Required scopes: `list_configuration:read-write`."
  },
  "postV2ListsByListEntriesQuery": {
    "comment": "List entries",
    "doc": "List entries\n  Lists entries in a given list, with the option to filter and sort results.\n \n  Required scopes: `list_entry:read`, `list_configuration:read`."
  },
  "postV2ListsByListEntries": {
    "comment": "Create an entry (add record to list)",
    "doc": "Create an entry (add record to list)\n  Adds a record to a list as a new list entry. This endpoint will throw on conflicts of unique attributes. Multiple list entries are allowed for the same parent record\n \n  Required scopes: `list_entry:read-write`, `list_configuration:read`."
  },
  "putV2ListsByListEntries": {
    "comment": "Assert a list entry by parent",
    "doc": "Assert a list entry by parent\n  Use this endpoint to create or update a list entry for a given parent record. If an entry with the specified parent record is found, that entry will be updated. If no such entry is found, a new entry will be created instead. If there are multiple entries with the same parent record, this endpoint with return the \"MULTIPLE_MATCH_RESULTS\" error. When writing to multi-select attributes, all values will be either created or deleted as necessary to match the list of values supplied in the request body.\n \n  Required scopes: `list_entry:read-write`, `list_configuration:read`."
  },
  "getV2ListsByListEntriesByEntryId": {
    "comment": "Get a list entry",
    "doc": "Get a list entry\n  Gets a single list entry by its `entry_id`.\n \n  Required scopes: `list_entry:read`, `list_configuration:read`."
  },
  "patchV2ListsByListEntriesByEntryId": {
    "comment": "Update a list entry (append multiselect values)",
    "doc": "Update a list entry (append multiselect values)\n  Use this endpoint to update list entries by `entry_id`. If the update payload includes multiselect attributes, the values supplied will be created and prepended to the list of values that already exist (if any). Use the `PUT` endpoint to overwrite or remove multiselect attribute values.\n \n  Required scopes: `list_entry:read-write`, `list_configuration:read`."
  },
  "putV2ListsByListEntriesByEntryId": {
    "comment": "Update a list entry (overwrite multiselect values)",
    "doc": "Update a list entry (overwrite multiselect values)\n  Use this endpoint to update list entries by `entry_id`. If the update payload includes multiselect attributes, the values supplied will overwrite/remove the list of values that already exist (if any). Use the `PATCH` endpoint to add multiselect attribute values without removing those value that already exist.\n \n  Required scopes: `list_entry:read-write`, `list_configuration:read`."
  },
  "deleteV2ListsByListEntriesByEntryId": {
    "comment": "Delete a list entry",
    "doc": "Delete a list entry\n  Deletes a single list entry by its `entry_id`.\n \n  Required scopes: `list_entry:read-write`, `list_configuration:read`."
  },
  "getV2ListsByListEntriesByEntryIdAttributesByAttributeValues": {
    "comment": "List attribute values for a list entry",
    "doc": "List attribute values for a list entry\n  Gets all values for a given attribute on a list entry. If the attribute is historic, this endpoint has the ability to return all historic values using the `show_historic` query param.\n \n  Required scopes: `list_entry:read`, `list_configuration:read`."
  },
  "getV2WorkspaceMembers": {
    "comment": "List workspace members",
    "doc": "List workspace members\n  Lists all workspace members in the workspace.\n \n  Required scopes: `user_management:read`."
  },
  "getV2WorkspaceMembersByWorkspaceMemberId": {
    "comment": "Get a workspace member",
    "doc": "Get a workspace member\n  Gets a single workspace member by ID.\n \n  Required scopes: `user_management:read`."
  },
  "getV2Notes": {
    "comment": "List notes",
    "doc": "List notes\n  List notes for all records or for a specific record.\n \n  Required scopes: `note:read`, `object_configuration:read`, `record_permission:read`."
  },
  "postV2Notes": {
    "comment": "Create a note",
    "doc": "Create a note\n  Creates a new note for a given record.\n \n  At present, notes can only be created from plaintext without formatting.\n \n  Required scopes: `note:read-write`, `object_configuration:read`, `record_permission:read`."
  },
  "getV2NotesByNoteId": {
    "comment": "Get a note",
    "doc": "Get a note\n  Get a single note by ID.\n \n  Required scopes: `note:read`, `object_configuration:read`, `record_permission:read`."
  },
  "deleteV2NotesByNoteId": {
    "comment": "Delete a note",
    "doc": "Delete a note\n  Delete a single note by ID.\n \n  Required scopes: `note:read-write`."
  },
  "getV2Tasks": {
    "comment": "List tasks",
    "doc": "List tasks\n  List all tasks. Results are sorted by creation date, from oldest to newest.\n \n  Required scopes: `task:read`, `object_configuration:read`, `record_permission:read`, `user_management:read`."
  },
  "postV2Tasks": {
    "comment": "Create a task",
    "doc": "Create a task\n  Creates a new task.\n \n  At present, tasks can only be created from plaintext without record reference formatting.\n \n  Required scopes: `task:read-write`, `object_configuration:read`, `record_permission:read`, `user_management:read`."
  },
  "getV2TasksByTaskId": {
    "comment": "Get a task",
    "doc": "Get a task\n  Get a single task by ID.\n \n  Required scopes: `task:read`, `object_configuration:read`, `record_permission:read`, `user_management:read`."
  },
  "patchV2TasksByTaskId": {
    "comment": "Update a task",
    "doc": "Update a task\n  Updates an existing task by `task_id`. At present, only the `deadline_at`, `is_completed`, `linked_records`, and `assignees` fields can be updated.\n \n  Required scopes: `task:read-write`, `object_configuration:read`, `record_permission:read`, `user_management:read`."
  },
  "deleteV2TasksByTaskId": {
    "comment": "Delete a task",
    "doc": "Delete a task\n  Delete a task by ID.\n \n  Required scopes: `task:read-write`."
  },
  "getV2Threads": {
    "comment": "List threads",
    "doc": "List threads\n  List threads of comments on a record or list entry.\n \n  To view threads on records, you will need the `object_configuration:read` and `record_permission:read` scopes.\n \n  To view threads on list entries, you will need the `list_configuration:read` and `list_entry:read` scopes.\n \n  Required scopes: `comment:read`."
  },
  "getV2ThreadsByThreadId": {
    "comment": "Get a thread",
    "doc": "Get a thread\n  Get all comments in a thread.\n \n  To view threads on records, you will need the `object_configuration:read` and `record_permission:read` scopes.\n \n  To view threads on list entries, you will need the `list_configuration:read` and `list_entry:read` scopes.\n \n  Required scopes: `comment:read`."
  },
  "postV2Comments": {
    "comment": "Create a comment",
    "doc": "Create a comment\n  Creates a new comment related to an existing thread, record or entry.\n \n  To create comments on records, you will need the `object_configuration:read` and `record_permission:read` scopes.\n \n  To create comments on list entries, you will need the `list_configuration:read` and `list_entry:read` scopes.\n \n  Required scopes: `comment:read-write`."
  },
  "getV2CommentsByCommentId": {
    "comment": "Get a comment",
    "doc": "Get a comment\n  Get a single comment by ID.\n \n  To view comments on records, you will need the `object_configuration:read` and `record_permission:read` scopes.\n \n  To view comments on list entries, you will need the `list_configuration:read` and `list_entry:read` scopes.\n \n  Required scopes: `comment:read`."
  },
  "deleteV2CommentsByCommentId": {
    "comment": "Delete a comment",
    "doc": "Delete a comment\n  Deletes a comment by ID. If deleting a comment at the head of a thread, all messages in the thread are also deleted.\n \n  Required scopes: `comment:read-write`."
  },
  "getV2Webhooks": {
    "comment": "List webhooks",
    "doc": "List webhooks\n  Get all of the webhooks in your workspace.\n \n  Required scopes: `webhook:read`."
  },
  "postV2Webhooks": {
    "comment": "Create a webhook",
    "doc": "Create a webhook\n  Create a webhook and associated subscriptions.\n \n  Required scopes: `webhook:read-write`."
  },
  "getV2WebhooksByWebhookId": {
    "comment": "Get a webhook",
    "doc": "Get a webhook\n  Get a single webhook.\n \n  Required scopes: `webhook:read`."
  },
  "patchV2WebhooksByWebhookId": {
    "comment": "Update a webhook",
    "doc": "Update a webhook\n  Update a webhook and associated subscriptions.\n \n  Required scopes: `webhook:read-write`."
  },
  "deleteV2WebhooksByWebhookId": {
    "comment": "Delete a webhook",
    "doc": "Delete a webhook\n  Delete a webhook by ID.\n \n  Required scopes: `webhook:read-write`."
  },
  "getV2Self": {
    "comment": "Identify",
    "doc": "Identify\n  Identify the current access token, the workspace it is linked to, and any permissions it has."
  }
}