export const comments = {
  "getV2AccountStagesJson": {
    "comment": "List account stages",
    "doc": "List account stages\n  Fetches multiple account stage records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2AccountStagesByIdJson": {
    "comment": "Fetch an account stage",
    "doc": "Fetch an account stage\n  Fetches an account stage, by ID only."
  },
  "getV2AccountTiersJson": {
    "comment": "List Account Tiers",
    "doc": "List Account Tiers\n  Fetches multiple account tier records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2AccountTiersByIdJson": {
    "comment": "Fetch an account tier",
    "doc": "Fetch an account tier\n  Fetches an account tier, by ID only."
  },
  "postV2AccountUpsertsJson": {
    "comment": "Upsert an account",
    "doc": "Upsert an account\n  Upserts an account record. The upsert_key dictates how the upsert will be performed. The create and update behavior\n  is exactly the same as the individual create and update endpoints."
  },
  "getV2AccountsJson": {
    "comment": "List accounts",
    "doc": "List accounts\n  Fetches multiple account records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2AccountsJson": {
    "comment": "Create an account",
    "doc": "Create an account\n  Creates an account.\n \n  \"domain\" must be unique on the current team."
  },
  "deleteV2AccountsByIdJson": {
    "comment": "Delete an account",
    "doc": "Delete an account\n  Deletes an account. This operation is not reversible without contacting support.\n  This operation can be called multiple times successfully.\n \n  Deleting an account will remove all connected people from that account."
  },
  "getV2AccountsByIdJson": {
    "comment": "Fetch an account",
    "doc": "Fetch an account\n  Fetches an account, by ID only."
  },
  "putV2AccountsByIdJson": {
    "comment": "Update an existing Account",
    "doc": "Update an existing Account\n  Updates an account.\n \n  \"domain\" must be unique on the current team."
  },
  "getV2ActionDetailsCallInstructionsJson": {
    "comment": "List call instructions",
    "doc": "List call instructions\n  Fetches multiple call instruction records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2ActionDetailsCallInstructionsByIdJson": {
    "comment": "Fetch a call instructions",
    "doc": "Fetch a call instructions\n  Fetches a call instruction, by ID only."
  },
  "getV2ActionsJson": {
    "comment": "List actions",
    "doc": "List actions\n  Fetches multiple action records. The records can be filtered, paged, and sorted according to\n  the respective parameters. Only actions that are currently \"in_progess\" will be returned by\n  this endpoint.\n \n  If the requester is not an admin, this endpoint will only return actions belonging to the requester.\n  If the request is an admin, this endpoint will return actions for the entire team. Additionaly, an admin\n  may use the user_guid parameter to request actions that belong to specific users on the team."
  },
  "getV2ActionsByIdJson": {
    "comment": "Fetch an action",
    "doc": "Fetch an action\n  Fetches an action, by ID only.\n  This endpoint will only return actions that are in_progress or pending_activity.\n  Once an action is complete, the request for that action will return a 404 status code."
  },
  "postV2ActivitiesJson": {
    "comment": "Create an activity",
    "doc": "Create an activity\n  Creates an activity. An activity will mark the associated action as completed. Currently,\n  only certain action types can have an activity explicitly created for them."
  },
  "getV2ActivitiesCallsJson": {
    "comment": "List calls",
    "doc": "List calls\n  Fetches multiple call records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2ActivitiesCallsJson": {
    "comment": "Create a call",
    "doc": "Create a call\n  Creates a call. The parameters of this endpoint can be used to create an action\n  and ensure that the CRM Task is mapped correctly."
  },
  "getV2ActivitiesCallsByIdJson": {
    "comment": "Fetch a call",
    "doc": "Fetch a call\n  Fetches a call, by ID only."
  },
  "getV2ActivitiesEmailsJson": {
    "comment": "List emails",
    "doc": "List emails\n  Fetches multiple email records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2ActivitiesEmailsByIdJson": {
    "comment": "Fetch an email",
    "doc": "Fetch an email\n  Fetches an email, by ID only."
  },
  "getV2ActivityHistories": {
    "comment": "List Past Activities",
    "doc": "List Past Activities\n  Fetches all of the customer's past activities for your application. Returns all the Activities that are found on the Salesloft Activity Feed. <a href=\"/activity-history.html\" target=\"_blank\" rel=\"noopener noreferrer\">Visit here for more details</a>."
  },
  "getV2BulkJobs": {
    "comment": "List bulk jobs",
    "doc": "List bulk jobs\n  Fetches multiple bulk job records. The records can be filtered, paged, and sorted according to the respective parameters."
  },
  "postV2BulkJobs": {
    "comment": "Create a bulk job",
    "doc": "Create a bulk job\n  Creates a bulk job. The type of the bulk job must be included when created.\n \n  For additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href=\"/bulk.html\" target=\"_blank\" rel=\"noopener noreferrer\">bulk job details page</a>."
  },
  "getV2BulkJobsByBulkJobsIdJobData": {
    "comment": "List job data for a bulk job",
    "doc": "List job data for a bulk job\n  Fetches multiple job data records for a given bulk job. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records."
  },
  "postV2BulkJobsByBulkJobsIdJobData": {
    "comment": "Create job data for a bulk job",
    "doc": "Create job data for a bulk job\n  Upload job data for the specified bulk job. Upload an array of objects, where element contains the parameters necessary to execute the individual calls. Each call to this endpoint can handle up to 5,000 records at a time. There is no limit to how many times you can create job data for a given bulk job.\n \n  For additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href=\"/bulk.html\" target=\"_blank\" rel=\"noopener noreferrer\">bulk job details page</a>."
  },
  "getV2BulkJobsByBulkJobsIdResults": {
    "comment": "List job data for a completed bulk job.",
    "doc": "List job data for a completed bulk job.\n  Fetches multiple job data records for a completed bulk job. Note that until a bulk job's state is set to `done` the returned `data` will be an empty array. Pagination is not supported, but cursor based polling is via use of the `id[gt]` filter. Pass the last id seen (i.e. `id[gt]=1234`) in order to get the next batch of records."
  },
  "getV2BulkJobsById": {
    "comment": "Fetch a bulk job",
    "doc": "Fetch a bulk job\n  Fetches a bulk job, by ID only."
  },
  "putV2BulkJobsById": {
    "comment": "Update a bulk job",
    "doc": "Update a bulk job\n  Updates a bulk job's name and / or marks a bulk job as 'ready_to_execute'.  May only be updated if the bulk job is still in an \"open\" state.\n \n  For additional information on creating bulk jobs, the types of supported bulk jobs, and examples of the bulk job flow, visit the <a href=\"/bulk.html\" target=\"_blank\" rel=\"noopener noreferrer\">bulk job details page</a>."
  },
  "getV2CadenceExportsByIdJson": {
    "comment": "Export a cadence",
    "doc": "Export a cadence\n  Exports a cadence as JSON."
  },
  "postV2CadenceImportsJson": {
    "comment": "Import cadences from JSON",
    "doc": "Import cadences from JSON\n  New cadences can be created or steps can be imported onto existing cadences which do not have steps.\n  <a href=\"/cadence-imports.html\" target=\"_blank\" rel=\"noopener noreferrer\">Visit here for more details</a>."
  },
  "getV2CadenceMembershipsJson": {
    "comment": "List cadence memberships",
    "doc": "List cadence memberships\n  Fetches multiple cadence membership records. The records can be filtered, paged, and sorted according to\n  the respective parameters. A cadence membership is the association between a person and their current and\n  historical time on a cadence. Cadence membership records are mutable and change over time. If a person is\n  added to a cadence and re-added to the same cadence in the future, there is a single membership record."
  },
  "postV2CadenceMembershipsJson": {
    "comment": "Create a cadence membership",
    "doc": "Create a cadence membership\n  Adds a person to a cadence. person_id and cadence_id are required, and must be visible to the authenticated user. user_id will\n  default to the authenticated user, but can be set to any visible user on the authenticated team.\n \n  A person cannot be added to a cadence on behalf of a teammate unless the cadence is a team cadence, the cadence is owned by\n  the teammate, or the teammate has the Personal Cadence Admin permission."
  },
  "deleteV2CadenceMembershipsByIdJson": {
    "comment": "Delete a cadence membership",
    "doc": "Delete a cadence membership\n  Cadence Membership"
  },
  "getV2CadenceMembershipsByIdJson": {
    "comment": "Fetch a cadence membership",
    "doc": "Fetch a cadence membership\n  Fetches a cadence membership, by ID only."
  },
  "getV2CadencesJson": {
    "comment": "List cadences",
    "doc": "List cadences\n  Fetches multiple cadence records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2CadencesByIdJson": {
    "comment": "Fetch a cadence",
    "doc": "Fetch a cadence\n  Fetches a cadence, by ID only."
  },
  "getV2CalendarEvents": {
    "comment": "List calendar events",
    "doc": "List calendar events\n  Returns all calendar events, paginated and filtered by the date."
  },
  "postV2CalendarEventsUpsert": {
    "comment": "Upsert a calendar event",
    "doc": "Upsert a calendar event\n    Upserts a calendar event object.\n  Upsert key is a combination of `id` and `i_cal_uid` scoped to the given `calendar_id`.\n  Bulk operations:\n  This endpoint is used for bulk operations, see https://developers.salesloft.com/bulk.html for integration instructions.\n  Use `calendar/events/upsert` as an event type, and this spec as a data spec.\n  This endpoint should be used directly for the time sensitive calendar event updates."
  },
  "getV2CallDataRecordsJson": {
    "comment": "List call data records",
    "doc": "List call data records\n  Fetches multiple call data records. The records can be filtered, paged, and sorted according to\n  the respective parameters.\n \n  Call data records are records of all inbound and outbound calls through Salesloft. A call data record may\n  be associated with a call, but does not have to be."
  },
  "getV2CallDataRecordsByIdJson": {
    "comment": "Fetch a call data record",
    "doc": "Fetch a call data record\n  Fetches a call data record, by ID only."
  },
  "getV2CallDispositionsJson": {
    "comment": "List call dispositions",
    "doc": "List call dispositions\n  Fetches multiple call disposition records. The records can be sorted according to\n  the respective parameters. Call dispositions must be configured in application. This will\n  change in the future, but please contact us if you have a pressing use case."
  },
  "getV2CallSentimentsJson": {
    "comment": "List call sentiments",
    "doc": "List call sentiments\n  Fetches multiple call sentiment records. The records can be sorted according to\n  the respective parameters. Call sentiments must be configured in application. This will\n  change in the future, but please contact us if you have a pressing use case."
  },
  "postV2ConversationsCalls": {
    "comment": "Create Conversations Call",
    "doc": "Create Conversations Call\n  Enqueue a Conversations Call for processing"
  },
  "getV2CrmActivitiesJson": {
    "comment": "List crm activities",
    "doc": "List crm activities\n  Fetches multiple crm activity records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2CrmActivitiesByIdJson": {
    "comment": "Fetch a crm activity",
    "doc": "Fetch a crm activity\n  Fetches a crm activity, by ID only."
  },
  "getV2CrmActivityFieldsJson": {
    "comment": "List crm activity fields",
    "doc": "List crm activity fields\n  Fetches multiple crm activity field records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2CrmUsersJson": {
    "comment": "List crm users",
    "doc": "List crm users\n  Crm Users"
  },
  "getV2CustomFieldsJson": {
    "comment": "List custom fields",
    "doc": "List custom fields\n  Fetches multiple custom field records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2CustomFieldsJson": {
    "comment": "Create a custom field",
    "doc": "Create a custom field\n  Creates a custom field."
  },
  "deleteV2CustomFieldsByIdJson": {
    "comment": "Delete a custom field",
    "doc": "Delete a custom field\n  Deletes a custom field."
  },
  "getV2CustomFieldsByIdJson": {
    "comment": "Fetch a custom field",
    "doc": "Fetch a custom field\n  Fetches a custom field, by ID only."
  },
  "putV2CustomFieldsByIdJson": {
    "comment": "Update a custom field",
    "doc": "Update a custom field\n  Update a custom field."
  },
  "getV2CustomRolesJson": {
    "comment": "List custom roles",
    "doc": "List custom roles\n  Fetches multiple custom role records. The records can be filtered, and sorted according to\n  the respective parameters. A custom role is any role that is not Admin or User."
  },
  "getV2CustomRolesByIdJson": {
    "comment": "Fetch a custom role",
    "doc": "Fetch a custom role\n  Fetches a custom role, by ID only."
  },
  "getV2EmailTemplateAttachmentsJson": {
    "comment": "List email template attachments",
    "doc": "List email template attachments\n  Fetches multiple email template attachment records. The records can be filtered and paged according to\n  the respective parameters."
  },
  "getV2EmailTemplatesJson": {
    "comment": "List email templates",
    "doc": "List email templates\n  Fetches multiple email template records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2EmailTemplatesByIdJson": {
    "comment": "Fetch an email template",
    "doc": "Fetch an email template\n  Fetches an email template, by ID only."
  },
  "postV2ExternalEmailsJson": {
    "comment": "Create an External Email",
    "doc": "Create an External Email\n  Creates an external email object."
  },
  "getV2GroupsJson": {
    "comment": "List groups",
    "doc": "List groups\n  Fetches multiple group records. The records can be filtered, and sorted according to\n  the respective parameters."
  },
  "getV2GroupsByIdJson": {
    "comment": "Fetch a group",
    "doc": "Fetch a group\n  Fetches a group, by ID only."
  },
  "getV2ImportsJson": {
    "comment": "List imports",
    "doc": "List imports\n  Fetches multiple imports."
  },
  "postV2ImportsJson": {
    "comment": "Create an import",
    "doc": "Create an import\n  Creates an import."
  },
  "deleteV2ImportsByIdJson": {
    "comment": "Delete an import",
    "doc": "Delete an import\n  Deletes an import, by ID only. The associated people can be deleted as part of the deletion process.\n \n  Admin users can access imports for the entire team, but non-admin users can only access their own imports."
  },
  "getV2ImportsByIdJson": {
    "comment": "Fetch an import",
    "doc": "Fetch an import\n  Fetches an import, by ID only.\n \n  Admin users can access imports for the entire team, but non-admin users can only access their own imports."
  },
  "putV2ImportsByIdJson": {
    "comment": "Update an import",
    "doc": "Update an import\n  Updates an import, by ID only.\n \n  Admin users can access imports for the entire team, but non-admin users can only access their own imports."
  },
  "postV2LiveWebsiteTrackingParametersJson": {
    "comment": "Create an Live Website Tracking Parameter",
    "doc": "Create an Live Website Tracking Parameter\n  Creates a Live Website Tracking parameter to identify a person"
  },
  "getV2MeJson": {
    "comment": "Fetch current user",
    "doc": "Fetch current user\n  Authenticated user information. This endpoint does not accept any parameters as it is\n  represents your authenticated user. The \"Users\" resource provides user information\n  for other users on the team."
  },
  "getV2MeetingsJson": {
    "comment": "List meetings",
    "doc": "List meetings\n  Fetches multiple meeting records. The records can be filtered, paged, and sorted according to the respective parameters.\n  Meetings resource is responsible for events created via the Salesloft platform using calendaring features.\n  These events can relate to cadences, people, and accounts."
  },
  "postV2MeetingsSettingsSearchesJson": {
    "comment": "List meeting settings",
    "doc": "List meeting settings\n  Fetches multiple meeting setting records. The records can be filtered, paged, and sorted according to the respective parameters."
  },
  "putV2MeetingsSettingsByIdJson": {
    "comment": "Update a meeting setting",
    "doc": "Update a meeting setting\n  Updates a meeting setting, by ID only."
  },
  "putV2MeetingsByIdJson": {
    "comment": "Update a meeting",
    "doc": "Update a meeting\n  Updates a meeting, by ID only."
  },
  "getV2MimeEmailPayloadsByIdJson": {
    "comment": "Fetch the MIME content for email",
    "doc": "Fetch the MIME content for email\n  Fetch the MIME content for email."
  },
  "getV2NotesJson": {
    "comment": "List notes",
    "doc": "List notes\n  Fetches multiple note records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2NotesJson": {
    "comment": "Create a note",
    "doc": "Create a note\n  Creates a note."
  },
  "deleteV2NotesByIdJson": {
    "comment": "Delete a note",
    "doc": "Delete a note\n  Deletes a note owned by authorized account.\n  This operation is not reversible without contacting support.\n  This operation can be called multiple times successfully."
  },
  "getV2NotesByIdJson": {
    "comment": "Fetch a note",
    "doc": "Fetch a note\n  Fetches a note, by ID only."
  },
  "putV2NotesByIdJson": {
    "comment": "Update a note",
    "doc": "Update a note\n  Updates a note. Any changes to the note or associated records will not reflect in your CRM."
  },
  "postV2OngoingActionsJson": {
    "comment": "Create an ongoing action",
    "doc": "Create an ongoing action\n  Creates an ongoing action. An ongoing action is an action that is not yet completed,\n  but progress has been made towards the completion. The user should not need to do\n  anything for an ongoing action to be completed. An ongoing action can be later completed\n  by creating an activity.\n \n  Ongoing actions are marked as status=pending_activity."
  },
  "getV2PendingEmailsJson": {
    "comment": "Fetches a list of emails ready to be sent by an external email service. Only emails sent with an External Email Client will appear here.",
    "doc": "Fetches a list of emails ready to be sent by an external email service. Only emails sent with an External Email Client will appear here.\n  Fetches a list of emails ready to be sent by an external email service."
  },
  "putV2PendingEmailsByIdJson": {
    "comment": "Updates the status of an email sent by an External Email Client",
    "doc": "Updates the status of an email sent by an External Email Client\n  Updates the status of an email sent by an External Email Client. Does not affect lofted emails."
  },
  "getV2PeopleJson": {
    "comment": "List people",
    "doc": "List people\n  Fetches multiple person records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2PeopleJson": {
    "comment": "Create a person",
    "doc": "Create a person\n  Creates a person. Either email_address or phone/last_name must be provided as a unique lookup\n  on the team."
  },
  "deleteV2PeopleByIdJson": {
    "comment": "Delete a person",
    "doc": "Delete a person\n  Deletes a person. This operation is not reversible without contacting support.\n  This operation can be called multiple times successfully."
  },
  "getV2PeopleByIdJson": {
    "comment": "Fetch a person",
    "doc": "Fetch a person\n  Fetches a person, by ID only."
  },
  "putV2PeopleByIdJson": {
    "comment": "Update a person",
    "doc": "Update a person\n  Updates a person."
  },
  "getV2PersonStagesJson": {
    "comment": "List person stages",
    "doc": "List person stages\n  Fetches multiple person stage records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2PersonStagesJson": {
    "comment": "Create a person stage",
    "doc": "Create a person stage\n  Creates a person stage."
  },
  "deleteV2PersonStagesByIdJson": {
    "comment": "Delete an person stage",
    "doc": "Delete an person stage\n  Deletes a person stage. This operation is not reversible without contacting support.\n  This operation can be called multiple times successfully."
  },
  "getV2PersonStagesByIdJson": {
    "comment": "Fetch a person stage",
    "doc": "Fetch a person stage\n  Fetches a person stage, by ID only."
  },
  "putV2PersonStagesByIdJson": {
    "comment": "Update a person stage",
    "doc": "Update a person stage\n  Updates a person stage."
  },
  "postV2PersonUpsertsJson": {
    "comment": "Upsert a person",
    "doc": "Upsert a person\n  Upserts a person record. The upsert_key dictates how the upsert will be performed. The create and update behavior\n  is exactly the same as the individual create and update endpoints."
  },
  "getV2PhoneNumberAssignmentsJson": {
    "comment": "List phone number assignments",
    "doc": "List phone number assignments\n  Fetches multiple phone number assignment records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2PhoneNumberAssignmentsByIdJson": {
    "comment": "Fetch a phone number assignment",
    "doc": "Fetch a phone number assignment\n  Fetches a phone number assignment, by ID only."
  },
  "getV2PhoneNumbersCallerIdsJson": {
    "comment": "List caller ids",
    "doc": "List caller ids\n  Each entry is a possible caller ID match for the number. Multiple\n  entries may be returned if the phone number is present on more than one\n  person in the system.  Phone number should be in E.164 format."
  },
  "getV2PhoneNumbersRecordingSettingsByIdJson": {
    "comment": "Fetch recording setting",
    "doc": "Fetch recording setting\n  Fetches the recording status for a given phone number, based on Do Not Record and Recording Governance for your team.\n  Phone number should be in E.164 format."
  },
  "getV2SavedListViewsJson": {
    "comment": "List saved list views",
    "doc": "List saved list views\n  Fetches multiple saved list view records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2SavedListViewsJson": {
    "comment": "Create a saved list view",
    "doc": "Create a saved list view\n  Creates a saved list view."
  },
  "deleteV2SavedListViewsByIdJson": {
    "comment": "Delete a saved list view",
    "doc": "Delete a saved list view\n  Deletes a saved list view. This operation is not reversible without contacting support.\n  This operation can be called multiple times successfully."
  },
  "getV2SavedListViewsByIdJson": {
    "comment": "Fetch a saved list view",
    "doc": "Fetch a saved list view\n  Fetches a saved list view, by ID only."
  },
  "putV2SavedListViewsByIdJson": {
    "comment": "Update a saved list view",
    "doc": "Update a saved list view\n  Updates a saved list view."
  },
  "getV2StepsJson": {
    "comment": "List steps",
    "doc": "List steps\n  Fetches multiple step records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2StepsByIdJson": {
    "comment": "Fetch a step",
    "doc": "Fetch a step\n  Fetches a step, by ID only."
  },
  "getV2SuccessesJson": {
    "comment": "List successes",
    "doc": "List successes\n  Fetches multiple success records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "getV2TagsJson": {
    "comment": "List team tags",
    "doc": "List team tags\n  Fetches a list of the tags used for a team. The records can be filtered, paged, and sorted according to\n  the respective parameters.\n \n  Tags can be applied to mulitple resource types."
  },
  "getV2TasksJson": {
    "comment": "List tasks",
    "doc": "List tasks\n  Fetches multiple task records. The records can be filtered, paged, and sorted according to\n  the respective parameters."
  },
  "postV2TasksJson": {
    "comment": "Create a Task",
    "doc": "Create a Task\n  Creates a task."
  },
  "getV2TasksByIdJson": {
    "comment": "Fetch a task",
    "doc": "Fetch a task\n  Fetches a task, by ID only."
  },
  "putV2TasksByIdJson": {
    "comment": "Update a Task",
    "doc": "Update a Task\n  Updates a task."
  },
  "getV2TeamJson": {
    "comment": "Fetch current team",
    "doc": "Fetch current team\n  Fetches the team of the authenticated user."
  },
  "getV2TeamTemplateAttachmentsJson": {
    "comment": "List team template attachments",
    "doc": "List team template attachments\n  Fetches multiple team template attachment records. The records can be filtered and paged according to\n  the respective parameters."
  },
  "getV2TeamTemplatesJson": {
    "comment": "List team templates",
    "doc": "List team templates\n  Fetches multiple team template records. The records can be filtered, paged, and sorted according to\n  the respective parameters.\n \n  Team templates are templates that are available team-wide. Admins may use\n  team templates to create original content for the entire team, monitor version control to ensure templates are always up to date,\n  and track template performance across the entire organization. All metrics on a team template reflect usage across the team; individual metrics can be found with the email_templates API endpoint."
  },
  "getV2TeamTemplatesByIdJson": {
    "comment": "Fetch a team template",
    "doc": "Fetch a team template\n  Fetches a team template, by ID only."
  },
  "postV2ThirdPartyLiveFeedItems": {
    "comment": "Create a live feed item",
    "doc": "Create a live feed item\n  Creates a live feed item that can be sent to users. May only be used by whitelisted Frontend Integrations. Reference the Salesloft App Directory and Frontend Integrations sections for additional details."
  },
  "getV2UsersJson": {
    "comment": "List users",
    "doc": "List users\n  Non Admin: Lists only your user, or all on team depending on group visibility policy\n  Team Admin: Lists users associated with your team"
  },
  "getV2UsersByIdJson": {
    "comment": "Fetch a user",
    "doc": "Fetch a user\n  Fetches a user, by ID only."
  },
  "putV2UsersByIdJson": {
    "comment": "Update a user",
    "doc": "Update a user\n  Updates a user."
  },
  "getV2WebhookSubscriptions": {
    "comment": "List webhook subscriptions",
    "doc": "List webhook subscriptions\n  Fetches all of the customer's webhook subscriptions for your application."
  },
  "postV2WebhookSubscriptions": {
    "comment": "Create a webhook subscription",
    "doc": "Create a webhook subscription\n  Creates a webhook subscription. Visit the <a href=\"/webhooks.html\" target=\"_blank\" rel=\"noopener noreferrer\">webhooks page</a> for additional details and a list of available webhooks.\n  Request must be made with a valid Oauth token or API key."
  },
  "deleteV2WebhookSubscriptionsById": {
    "comment": "Delete a webhook subscription",
    "doc": "Delete a webhook subscription\n  Deletes a webhook subscription. This operation is not reversible without contacting support. This operation can be called multiple times successfully."
  },
  "getV2WebhookSubscriptionsById": {
    "comment": "Fetch a webhook subscription",
    "doc": "Fetch a webhook subscription\n  Fetches a webhook subscription, by ID only."
  },
  "putV2WebhookSubscriptionsById": {
    "comment": "Update a webhook subscription",
    "doc": "Update a webhook subscription\n  Updates a webhook subscription.\n  Request must be made with a valid Oauth token or API key."
  }
}