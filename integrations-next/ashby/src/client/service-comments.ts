export const comments = {
  "apiKeyGetInfo": {
    "comment": "apiKey.info",
    "doc": "apiKey.info\n  Retrieve information about the API key being used to make the request.\n \n  Requires the [`apiKeysRead`](authentication#permissions-apikeyinfo) permission."
  },
  "applicationChangeSource": {
    "comment": "application.changeSource",
    "doc": "application.changeSource\n  Change the source of an application.\n \n  Requires the [`candidatesWrite`](authentication#permissions-applicationchangesource) permission."
  },
  "applicationChangeStage": {
    "comment": "application.changeStage",
    "doc": "application.changeStage\n  Change the stage of an application\n \n  Requires the [`candidatesWrite`](authentication#permissions-applicationchangestage) permission."
  },
  "applicationConsiderCandidate": {
    "comment": "application.create",
    "doc": "application.create\n  Consider a candidate for a job\n \n  Requires the [`candidatesWrite`](authentication#permissions-applicationcreate) permission."
  },
  "applicationGetDetails": {
    "comment": "application.info",
    "doc": "application.info\n  Fetch application details by application id or by submitted form instance id (which is return by the `applicationForm.submit` endpoint). If both applicationId and submittedFormInstanceId are provided, we will lookup by applicationId.\n \n  Requires the [`candidatesRead`](authentication#permissions-applicationinfo) permission."
  },
  "applicationGetAllSchedules": {
    "comment": "application.list",
    "doc": "application.list\n  Gets all applications schedules in the organization.\n \n  Requires the [`candidatesRead`](authentication#permissions-applicationlist) permission."
  },
  "applicationFeedbackListAll": {
    "comment": "applicationFeedback.list",
    "doc": "applicationFeedback.list\n  List all feedback associated with an application.\n \n  Requires the [`candidatesRead`](authentication#permissions-applicationfeedbacklist) permission.\n \n  The `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field."
  },
  "applicationFeedbackSubmitFeedback": {
    "comment": "applicationFeedback.submit",
    "doc": "applicationFeedback.submit\n  Application feedback forms support a variety of field types.\n \n  Requires the [`candidatesWrite`](authentication#permissions-applicationfeedbacksubmit) permission.\n \n  The values accepted for each field depend on the type of field that's being filled out:                                                                                                                                                                                                                 |\n  - `Boolean` - A boolean value\n  - `Date` - A date string in the format YYYY-MM-DD\n  - `Email` - A valid email address\n  - `Number` - An integer\n  - `RichText` - We do not support submitting rich text documents via the API but we do support submitting plain text values for these fields. Plain text values must be submitted in the format `{ type: \"PlainText\", value: \"A plain text string\" }`\n  - `Score` - An integer between 1 and 4 submitted in the format `{ score: 4 }`\n  - `Phone`, `String` A string\n  - `ValueSelect` - A string that matches the value of one of the ValueSelect field's selectable options\n  - `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field's selectable options\n \n  The `submittedValues` field in the response contains the submitted feedback in an object where the key is the path of the field and the value is the value submitted for that field."
  },
  "applicationFormSubmitForm": {
    "comment": "applicationForm.submit",
    "doc": "applicationForm.submit\n  Submit an application for a job posting.\n \n  Requires the [`candidatesWrite`](authentication#permissions-applicationformsubmit) permission.\n \n  The Content-Type of this request must be `multipart/form-data`.\n \n  Note: The requests generated from this documentation will not work for this endpoint."
  },
  "approvalDefinitionUpdateEntityScope": {
    "comment": "approvalDefinition.update",
    "doc": "approvalDefinition.update\n  Create or update an approval definition for a specific entity that requires approval. The entity requiring approval must be within scope of an approval in Ashby that is marked as being managed by the API.\n \n  Requires the [`approvalsWrite`](authentication#permissions-approvaldefinitionupdate) permission."
  },
  "archiveReasonList": {
    "comment": "archiveReason.list",
    "doc": "archiveReason.list\n  Lists archive reasons\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-archivereasonlist) permission."
  },
  "assessmentAddCompletedToCandidate": {
    "comment": "assessment.addCompletedToCandidate",
    "doc": "assessment.addCompletedToCandidate\n  Add a completed assessment to a candidate\n \n  Requires the [`candidatesWrite`](authentication#permissions-assessmentaddcompletedtocandidate) permission."
  },
  "assessmentPartnerStart": {
    "comment": "assessment.start (Implemented by Partner)",
    "doc": "assessment.start (Implemented by Partner)\n  The API for starting an assessment—implemented by the partner, but called by Ashby"
  },
  "assessmentListPartnerSupport": {
    "comment": "assessment.list (Implemented by Partner)",
    "doc": "assessment.list (Implemented by Partner)\n  The API for listing assessments that the partner supports — implemented by the partner, but called by Ashby"
  },
  "assessmentUpdateStatus": {
    "comment": "assessment.update",
    "doc": "assessment.update\n  Update Ashby about the status of a started assessment\n \n  Requires the [`candidatesWrite`](authentication#permissions-assessmentupdate) permission."
  },
  "assessmentCancelPartnerAssessment": {
    "comment": "assessment.cancel (Implemented by Partner)",
    "doc": "assessment.cancel (Implemented by Partner)\n  (Optional) Cancels an assessment— implemented by the partner, but called by Ashby"
  },
  "candidateAddTag": {
    "comment": "candidate.addTag",
    "doc": "candidate.addTag\n  Adds a tag to a candidate\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidateaddtag) permission."
  },
  "candidateAnonymizeCandidate": {
    "comment": "candidate.anonymize",
    "doc": "candidate.anonymize\n  Anonymizes a candidate.\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidateanonymize) permission.\n \n  Note: this action cannot be reversed and requires all of a candidate's applications to be in the archived or hired state."
  },
  "candidateCreateNewCandidate": {
    "comment": "candidate.create",
    "doc": "candidate.create\n  Creates a new candidate\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidatecreate) permission."
  },
  "candidateCreateNote": {
    "comment": "candidate.createNote",
    "doc": "candidate.createNote\n  Creates a note on a candidate.\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidatecreatenote) permission.\n \n  For notes submitted with a type of `text/html`, we support the elements listed below. Any unsupported elements will be stripped out of the note's content before posting.\n  - Bold `<b>`\n  - Italic `<i>`\n  - Underline `<u>`\n  - Links `<a>`\n  - Bulleted Lists - `<ul>`, `<li>`\n  - Ordered Lists - `<ol>`, `<li>`\n  - Code - `<code>`\n  - Code Block - `<pre>`"
  },
  "candidateGetById": {
    "comment": "candidate.info",
    "doc": "candidate.info\n  Gets a single candidate by id.\n \n  Requires the [`candidatesRead`](authentication#permissions-candidateinfo) permission."
  },
  "candidateListAll": {
    "comment": "candidate.list",
    "doc": "candidate.list\n  Lists all candidates in an organization\n \n  Requires the [`candidatesRead`](authentication#permissions-candidatelist) permission."
  },
  "candidateGetAllNotes": {
    "comment": "candidate.listNotes",
    "doc": "candidate.listNotes\n  Lists all notes on a candidate\n \n  Requires the [`candidatesRead`](authentication#permissions-candidatelistnotes) permission."
  },
  "candidateSearchByEmailAndName": {
    "comment": "candidate.search",
    "doc": "candidate.search\n  Search for candidates by email and / or name.\n \n  Requires the [`candidatesRead`](authentication#permissions-candidatesearch) permission.\n \n  Responses are limited to 100 results. Consider refining your search or using /candidate.list to paginate through all candidates, if you approach this limit. This API is for use cases where you intend operate on a final small set of candidates, like building a candidate autocomplete.\n \n  Note: When multiple search parameters are provided, the parameters are combined with the `AND` operator."
  },
  "candidateUpdateExistingCandidate": {
    "comment": "candidate.update",
    "doc": "candidate.update\n  Updates an existing candidate\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidateupdate) permission."
  },
  "candidateAttachFile": {
    "comment": "candidate.uploadFile",
    "doc": "candidate.uploadFile\n  Uploads a file to attach to the candidate's profile.\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidateuploadfile) permission.\n \n  The `Content-Type` of this request must be `multipart/form-data`."
  },
  "candidateUploadResumeData": {
    "comment": "candidate.uploadResume",
    "doc": "candidate.uploadResume\n  Uploads a candidate's resume, parses it, and updates their information.\n \n  Requires the [`candidatesWrite`](authentication#permissions-candidateuploadresume) permission.\n \n  The `Content-Type` of this request must be `multipart/form-data`.\n \n  Note: Existing candidate data always takes precedence over data found by parsing the resume. Resume data only populates candidate data, if it's data that was missing in the candidate model."
  },
  "candidateTagCreateNewTag": {
    "comment": "candidateTag.create",
    "doc": "candidateTag.create\n  Creates a candidate tag.\n \n  Requires the [`hiringProcessMetadataWrite`](authentication#permissions-candidatetagcreate) permission."
  },
  "candidateTagListAll": {
    "comment": "candidateTag.list",
    "doc": "candidateTag.list\n  Lists all candidate tags\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-candidatetaglist) permission."
  },
  "customFieldCreateNewField": {
    "comment": "customField.create",
    "doc": "customField.create\n  Create a new custom field\n \n  Requires the [`hiringProcessMetadataWrite`](authentication#permissions-customfieldcreate) permission."
  },
  "customFieldGetAll": {
    "comment": "customField.list",
    "doc": "customField.list\n  Lists all custom fields\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-customfieldlist) permission."
  },
  "customFieldSetValue": {
    "comment": "customField.setValue",
    "doc": "customField.setValue\n  Set the value of a custom field\n \n  Requires the [`candidatesWrite`](authentication#permissions-customfieldsetvalue) permission.\n \n  The values accepted in the `fieldValue` param depend on the type of field that's being updated. See below for more details:\n  - Boolean - A boolean value\n  - Date - An ISO Date string\n  - Email, LongText, Phone, String - String\n  - ValueSelect - A string that matches the value of one of the ValueSelect field's options\n  - MultiValueSelect - An array of strings that exist in the MultiValueSelect field's options\n  - Number - A number"
  },
  "departmentTeamCreateNewDepartment": {
    "comment": "department.create",
    "doc": "department.create\n  Creates a department\n \n  Requires the [`organizationWrite`](authentication#permissions-departmentcreate) permission."
  },
  "departmentGetById": {
    "comment": "department.info",
    "doc": "department.info\n  Fetch department details by id\n \n  Requires the [`organizationRead`](authentication#permissions-departmentinfo) permission."
  },
  "departmentGetAllDepartments": {
    "comment": "department.list",
    "doc": "department.list\n  Lists all departments\n \n  Requires the [`organizationRead`](authentication#permissions-departmentlist) permission."
  },
  "fileGetUrlCandidate": {
    "comment": "file.info",
    "doc": "file.info\n  Retrieve the url of a file associated with a candidate\n \n  Requires the [`candidatesRead`](authentication#permissions-fileinfo) permission."
  },
  "feedbackFormDefinitionGetById": {
    "comment": "feedbackFormDefinition.info",
    "doc": "feedbackFormDefinition.info\n  Returns a single feedback form by id\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitioninfo) permission."
  },
  "feedbackFormDefinitionListAll": {
    "comment": "feedbackFormDefinition.list",
    "doc": "feedbackFormDefinition.list\n  Lists all feedback forms\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-feedbackformdefinitionlist) permission."
  },
  "hiringTeamAddMember": {
    "comment": "hiringTeam.addMember",
    "doc": "hiringTeam.addMember\n  Adds an Ashby user to the hiring team at the application or job-level.\n \n  Requires the [`organizationWrite`](authentication#permissions-hiringteamaddmember) permission.\n \n  Hiring team members can be added to a hiring team at the application level or at the job level."
  },
  "hiringTeamRoleListRoles": {
    "comment": "hiringTeamRole.list",
    "doc": "hiringTeamRole.list\n  Lists the possible hiring team roles in an organization\n \n  Requires the [`organizationRead`](authentication#permissions-hiringteamrolelist) permission."
  },
  "interviewGetById": {
    "comment": "interview.info",
    "doc": "interview.info\n  Fetch interview details by id\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewinfo) permission."
  },
  "interviewGetAll": {
    "comment": "interview.list",
    "doc": "interview.list\n  List all interviews\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewlist) permission."
  },
  "interviewEventListAssociatedEvents": {
    "comment": "interviewEvent.list",
    "doc": "interviewEvent.list\n  Lists interview events associated with an interview schedule\n \n  Requires the [`interviewsRead`](authentication#permissions-intervieweventlist) permission."
  },
  "interviewPlanGetAll": {
    "comment": "interviewPlan.list",
    "doc": "interviewPlan.list\n  List all interview plans.\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewplanlist) permission."
  },
  "interviewScheduleCancelById": {
    "comment": "interviewSchedule.cancel",
    "doc": "interviewSchedule.cancel\n  Cancel an interview schedule by id\n \n  Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecancel) permission."
  },
  "interviewScheduleCreateScheduledInterview": {
    "comment": "interviewSchedule.create",
    "doc": "interviewSchedule.create\n  Create a scheduled interview in Ashby\n \n  Requires the [`interviewsWrite`](authentication#permissions-interviewschedulecreate) permission."
  },
  "interviewScheduleGetAllSchedules": {
    "comment": "interviewSchedule.list",
    "doc": "interviewSchedule.list\n  Gets all interview schedules in the organization.\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewschedulelist) permission."
  },
  "interviewScheduleUpdateEvent": {
    "comment": "interviewSchedule.update",
    "doc": "interviewSchedule.update\n  Update an interview schedule. This endpoint allows you to add, cancel, or update interview events associated with an interview schedule.\n \n  Requires the [`interviewsWrite`](authentication#permissions-interviewscheduleupdate) permission.\n \n  In order to update an interview event on a schedule, the event's `interviewEventId` must be included when sending your request.\n  `interviewEventId`s are included in the response of the `interviewSchedule.create` endpoint."
  },
  "interviewStageListAllInOrder": {
    "comment": "interviewStage.list",
    "doc": "interviewStage.list\n  List all interview stages for an interview plan in order.\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewstagelist) permission."
  },
  "interviewStageGetById": {
    "comment": "interviewStage.info",
    "doc": "interviewStage.info\n  Fetch interview stage details by id\n \n  Requires the [`interviewsRead`](authentication#permissions-interviewstageinfo) permission."
  },
  "jobNewCreate": {
    "comment": "job.create",
    "doc": "job.create\n  Creates a new job\n \n  Requires the [`jobsWrite`](authentication#permissions-jobcreate) permission."
  },
  "jobGetById": {
    "comment": "job.info",
    "doc": "job.info\n  Returns details about a single job by id\n \n  Requires the [`jobsRead`](authentication#permissions-jobinfo) permission."
  },
  "jobGetList": {
    "comment": "job.list",
    "doc": "job.list\n  List all open, closed, and archived jobs.\n \n  Requires the [`jobsRead`](authentication#permissions-joblist) permission.\n \n  To include draft jobs, `Draft` must be specified in the `status` param."
  },
  "jobSetStatusById": {
    "comment": "job.setStatus",
    "doc": "job.setStatus\n  Sets the status on a job by id.\n \n  Requires the [`jobsWrite`](authentication#permissions-jobsetstatus) permission.\n \n  All jobs are drafts when they're first created. There are a few validations around the stages a job can be transitioned to:\n  - Drafts can be changed to Open or Archived\n  - Open jobs can be changed to Closed\n  - Closed jobs can be changed to Draft or Archived\n  - Archived jobs can be changed to a Draft"
  },
  "jobUpdateExisting": {
    "comment": "job.update",
    "doc": "job.update\n  Updates an existing job\n \n  Requires the [`jobsWrite`](authentication#permissions-jobupdate) permission."
  },
  "jobSearchByTitle": {
    "comment": "job.search",
    "doc": "job.search\n  Searches for jobs by title\n \n  Requires the [`jobsRead`](authentication#permissions-jobsearch) permission."
  },
  "jobInterviewPlanGetInfo": {
    "comment": "jobInterviewPlan.info",
    "doc": "jobInterviewPlan.info\n  Returns a job's interview plan, including activities and interviews that need to be scheduled at each stage\n \n  Requires the [`jobsRead`](authentication#permissions-jobinterviewplaninfo) permission."
  },
  "jobPostingGetIndividual": {
    "comment": "jobPosting.info",
    "doc": "jobPosting.info\n  Retrieve an individual job posting\n \n  Requires the [`jobsRead`](authentication#permissions-jobpostinginfo) permission.\n \n  Result fields:\n  - `linkedData` - Object that can be used to populate \"rich results\" in search engines. [See more info here](https://developers.google.com/search/docs/data-types/job-posting).\n  - `applicationFormDefinition` -\tSee the guide on [Creating a custom careers page](https://developers.ashbyhq.com/docs/creating-a-custom-careers-page)."
  },
  "jobPostingGetAllPublished": {
    "comment": "jobPosting.list",
    "doc": "jobPosting.list\n  Lists all published job postings\n \n  Requires the [`jobsRead`](authentication#permissions-jobpostinglist) permission.\n \n  Important: By default, this endpoint includes all listed and unlisted job postings. Unlisted job postings should not be displayed publicly.\n  If you are using the API to publicly expose job postings, set the `listedOnly` parameter to `true` when calling this API so that you only fetch listed job postings that can be displayed publicly."
  },
  "jobPostingUpdateExisting": {
    "comment": "jobPosting.update",
    "doc": "jobPosting.update\n  Updates an existing job posting.\n \n  Requires the [`jobsWrite`](authentication#permissions-jobpostingupdate) permission.\n \n  Note on updating the description: The `descriptionHtml` field returned in `jobPosting.info` may contain content that is not modifiable through the API. Only the content of the `descriptionParts.descriptionBody` field of the `jobPosting.info` endpoint is modifiable through this call."
  },
  "locationCreateHierarchy": {
    "comment": "location.create",
    "doc": "location.create\n  Creates a location or location hierarchy.\n \n  Requires the [`organizationWrite`](authentication#permissions-locationcreate) permission."
  },
  "locationDetailsById": {
    "comment": "location.info",
    "doc": "location.info\n  Gets details for a single location by id.\n \n  Requires the [`organizationRead`](authentication#permissions-locationinfo) permission."
  },
  "locationGetList": {
    "comment": "location.list",
    "doc": "location.list\n  List all locations. Regions are not returned.\n \n  Requires the [`organizationRead`](authentication#permissions-locationlist) permission."
  },
  "offerCreateNew": {
    "comment": "offer.create",
    "doc": "offer.create\n  Creates a new Offer\n \n  Requires the [`offersWrite`](authentication#permissions-offercreate) permission.\n \n  Offer forms support a variety of field types. The values accepted for each field depend on the type of field that's being filled out:\n  - `Boolean` - A boolean value.\n  - `Currency` - An object in the format `{ currencyCode: \"USD\", value: 100000 }` where currencyCode is a valid ISO 4217 currency code and value is an integer.\n  - `Date` - A valid ISO Date string.\n  - `Number` - An integer.\n  - `String` - A string.\n  - `ValueSelect` - A string that matches the value of one of the ValueSelect field's selectable options.\n  - `MultiValueSelect` - An array of strings that exist in the MultiValueSelect field's selectable options."
  },
  "offerGetDetailsById": {
    "comment": "offer.info",
    "doc": "offer.info\n  Returns details about a single offer by id\n \n  Requires the [`offersRead`](authentication#permissions-offerinfo) permission."
  },
  "offerGetList": {
    "comment": "offer.list",
    "doc": "offer.list\n  Get a list of all offers with their latest version\n \n  Requires the [`offersRead`](authentication#permissions-offerlist) permission."
  },
  "offerStartCreationInstance": {
    "comment": "offer.start",
    "doc": "offer.start\n  The offer.start endpoint creates and returns an offer version instance that can be filled out and submitted\n  using the `offer.create` endpoint.\n \n  Requires the [`offersWrite`](authentication#permissions-offerstart) permission.\n \n  In order to create a new offer version for a candidate with an in-progress\n  offer process, you can call the `offer.start` endpoint and then call the `offer.create` endpoint to fill out the\n  newly created offer version form."
  },
  "offerProcessStartProcessForCandidate": {
    "comment": "offerProcess.start",
    "doc": "offerProcess.start\n  Starts an offer process for a candidate.\n \n  Requires the [`offersWrite`](authentication#permissions-offerprocessstart) permission."
  },
  "openingsGetByUuid": {
    "comment": "opening.info",
    "doc": "opening.info\n  Retrieves an opening by its UUID.\n \n  Requires the [`jobsRead`](authentication#permissions-openinginfo) permission."
  },
  "openingsGetList": {
    "comment": "opening.list",
    "doc": "opening.list\n  Lists openings.\n \n  Requires the [`jobsRead`](authentication#permissions-openinglist) permission."
  },
  "openingsSearchByIdentifier": {
    "comment": "opening.search",
    "doc": "opening.search\n  Searches for openings by identifier.\n \n  Requires the [`jobsRead`](authentication#permissions-openingsearch) permission."
  },
  "openingsCreateInstance": {
    "comment": "opening.create",
    "doc": "opening.create\n  Creates an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingcreate) permission."
  },
  "openingsAddJobAction": {
    "comment": "opening.addJob",
    "doc": "opening.addJob\n  Adds a job to an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingaddjob) permission."
  },
  "openingsRemoveJob": {
    "comment": "opening.removeJob",
    "doc": "opening.removeJob\n  Removes a job from an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingremovejob) permission."
  },
  "openingsSetState": {
    "comment": "opening.setOpeningState",
    "doc": "opening.setOpeningState\n  Sets the state of an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingsetopeningstate) permission."
  },
  "openingsSetArchived": {
    "comment": "opening.setArchived",
    "doc": "opening.setArchived\n  Sets the archived state of an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingsetarchived) permission."
  },
  "openingsUpdateOpening": {
    "comment": "opening.update",
    "doc": "opening.update\n  Updates an opening.\n \n  Requires the [`jobsWrite`](authentication#permissions-openingupdate) permission."
  },
  "referralCreateNew": {
    "comment": "referral.create",
    "doc": "referral.create\n  Creates a referral\n \n  Requires the [`candidatesWrite`](authentication#permissions-referralcreate) permission."
  },
  "referralFormGetDefaultForm": {
    "comment": "referralForm.info",
    "doc": "referralForm.info\n  Fetches the default referral form or creates a default referral form if none exists.\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-referralforminfo) permission."
  },
  "sourceGetAll": {
    "comment": "source.list",
    "doc": "source.list\n  List all sources\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-sourcelist) permission."
  },
  "surveyFormDefinitionGetDetailsById": {
    "comment": "surveyFormDefinition.info",
    "doc": "surveyFormDefinition.info\n  Returns details about a single survey form definition by id\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitioninfo) permission."
  },
  "surveyFormDefinitionGetAll": {
    "comment": "surveyFormDefinition.list",
    "doc": "surveyFormDefinition.list\n  Lists all survey form definitions.\n \n  Requires the [`hiringProcessMetadataRead`](authentication#permissions-surveyformdefinitionlist) permission."
  },
  "surveyRequestGenerateUrl": {
    "comment": "surveyRequest.create",
    "doc": "surveyRequest.create\n  This endpoint generates a survey request and returns a survey URL. You can send this URL to a candidate to allow them to complete a survey.\n \n  Requires the [`candidatesWrite`](authentication#permissions-surveyrequestcreate) permission.\n \n  Note that calling this endpoint will not automatically email the survey to the candidate. It simply creates the request and gives you a URL to share with a candidate."
  },
  "surveySubmissionListBySurveyType": {
    "comment": "surveySubmission.list",
    "doc": "surveySubmission.list\n  Lists all survey submissions of a given `surveyType`.\n \n  Requires the [`candidatesRead`](authentication#permissions-surveySubmissionList) permission."
  },
  "userGetById": {
    "comment": "user.info",
    "doc": "user.info\n  Get an Ashby user by id\n \n  Requires the [`organizationRead`](authentication#permissions-userinfo) permission."
  },
  "userGetAshbyUsers": {
    "comment": "user.list",
    "doc": "user.list\n  Get a list of all Ashby users\n \n  Requires the [`organizationRead`](authentication#permissions-userlist) permission.\n \n  The `globalRole` property in the response specifies the user's access level in Ashby.\n  For more details on the permissions granted with each role, see our [documentation here](https://ashbyhq.notion.site/Ashby-Permissions-a48eda7c07ad46f0bcd2b3f39301a9de#c64a4db5e7f4432bbe6691b91d3f0c62)."
  },
  "userSearchByEmail": {
    "comment": "user.search",
    "doc": "user.search\n  Search for an Ashby user by email address\n \n  Requires the [`organizationRead`](authentication#permissions-usersearch) permission."
  },
  "webhookCreateSetting": {
    "comment": "webhook.create",
    "doc": "webhook.create\n  Creates a webhook setting.\n \n  Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) scope."
  },
  "webhookUpdateSetting": {
    "comment": "webhook.update",
    "doc": "webhook.update\n  Updates a webhook setting. One of `enabled`, `requestUrl`, or `secretToken` must be provided.\n \n  Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission."
  },
  "webhookRemoveSetting": {
    "comment": "webhook.delete",
    "doc": "webhook.delete\n  Deletes a webhook setting.\n \n  Requires the [`apiKeysWrite`](authentication#permissions-webhookcreate) permission."
  }
}