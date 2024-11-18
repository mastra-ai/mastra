export const comments = {
  "post2AccountSetProfilePhoto": {
    "comment": "set_profile_photo",
    "doc": "set_profile_photo\n  [set_profile_photo](https://www.dropbox.com/developers/documentation/http/documentation#account-set_profile_photo)\n \n  scope: `account_info.write`\n \n  Sets a user's profile photo."
  },
  "post2AuthTokenFromOauth1": {
    "comment": "token/from_oauth1",
    "doc": "token/from_oauth1\n  [token/from_oauth1](https://www.dropbox.com/developers/documentation/http/documentation#auth-token-from_oauth1)\n \n  scope: `None`\n \n  Creates an OAuth 2.0 access token from the supplied OAuth 1.0 access token."
  },
  "post2AuthTokenRevoke": {
    "comment": "token/revoke",
    "doc": "token/revoke\n  [token/revoke](https://www.dropbox.com/developers/documentation/http/documentation#auth-token-revoke)\n \n  scope: `None`\n \n  Disables the access token used to authenticate the call."
  },
  "post2CheckApp": {
    "comment": "app",
    "doc": "app\n  [app](https://www.dropbox.com/developers/documentation/http/documentation#check-app)\n \n  scope: `None`\n \n  This endpoint performs App Authentication, validating the supplied app key and secret, and returns the supplied string, to allow you to test your code and connection to the Dropbox API. It has no other effect. If you receive an HTTP 200 response with the supplied query, it indicates at least part of the Dropbox API infrastructure is working and that the app key and secret valid."
  },
  "post2CheckUser": {
    "comment": "user",
    "doc": "user\n  [user](https://www.dropbox.com/developers/documentation/http/documentation#check-user)\n \n  scope: `None`\n \n  This endpoint performs User Authentication, validating the supplied access token, and returns the supplied string, to allow you to test your code and connection to the Dropbox API. It has no other effect. If you receive an HTTP 200 response with the supplied query, it indicates at least part of the Dropbox API infrastructure is working and that the access token is valid."
  },
  "post2ContactsDeleteManualContacts": {
    "comment": "delete_manual_contacts",
    "doc": "delete_manual_contacts\n  [delete_manual_contacts](https://www.dropbox.com/developers/documentation/http/documentation#contacts-delete_manual_contacts)\n \n  scope: `contacts.write`\n \n  Removes all manually added contacts. You'll still keep contacts who are on your team or who you imported. New contacts will be added when you share."
  },
  "post2ContactsDeleteManualContactsBatch": {
    "comment": "delete_manual_contacts_batch",
    "doc": "delete_manual_contacts_batch\n  [delete_manual_contacts_batch](https://www.dropbox.com/developers/documentation/http/documentation#contacts-delete_manual_contacts_batch)\n \n  scope: `contacts.write`\n \n  Removes manually added contacts from the given list."
  },
  "post2FilePropertiesPropertiesAdd": {
    "comment": "properties/add",
    "doc": "properties/add\n  [properties/add](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-add)\n \n  scope: `files.metadata.write`\n \n  Add property groups to a Dropbox file. See `templates/add_for_user` or `templates/add_for_team` to create new templates."
  },
  "post2FilePropertiesPropertiesOverwrite": {
    "comment": "properties/overwrite",
    "doc": "properties/overwrite\n  [properties/overwrite](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-overwrite)\n \n  scope: `files.metadata.write`\n \n  Overwrite property groups associated with a file. This endpoint should be used instead of `properties/update` when property groups are being updated via a \"snapshot\" instead of via a \"delta\". In other words, this endpoint will delete all omitted fields from a property group, whereas `properties/update` will only delete fields that are explicitly marked for deletion."
  },
  "post2FilePropertiesPropertiesRemove": {
    "comment": "properties/remove",
    "doc": "properties/remove\n  [properties/remove](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-remove)\n \n  scope: `files.metadata.write`\n \n  Permanently removes the specified property group from the file. To remove specific property field key value pairs, see `properties/update`. To update a template, see `templates/update_for_user` or `templates/update_for_team`. To remove a template, see `templates/remove_for_user` or `templates/remove_for_team`."
  },
  "post2FilePropertiesPropertiesSearch": {
    "comment": "properties/search",
    "doc": "properties/search\n  [properties/search](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-search)\n \n  scope: `files.metadata.read`\n \n  Search across property templates for particular property field values."
  },
  "post2FilePropertiesPropertiesSearchContinue": {
    "comment": "properties/search/continue",
    "doc": "properties/search/continue\n  [properties/search/continue](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-search-continue)\n \n  scope: `files.metadata.read`\n \n  Once a cursor has been retrieved from `properties/search`, use this to paginate through all search results."
  },
  "post2FilePropertiesPropertiesUpdate": {
    "comment": "properties/update",
    "doc": "properties/update\n  [properties/update](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-properties-update)\n \n  scope: `files.metadata.write`\n \n  Add, update or remove properties associated with the supplied file and templates. This endpoint should be used instead of `properties/overwrite` when property groups are being updated via a \"delta\" instead of via a \"snapshot\" . In other words, this endpoint will not delete any omitted fields from a property group, whereas `properties/overwrite` will delete any fields that are omitted from a property group."
  },
  "post2FilePropertiesTemplatesAddForTeam": {
    "comment": "templates/add_for_team",
    "doc": "templates/add_for_team\n  [templates/add_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-add_for_team)\n \n  scope: `files.team_metadata.write`\n \n  Add a template associated with a team. See `properties/add` to add properties to a file or folder.\n  Note: this endpoint will create team-owned templates."
  },
  "post2FilePropertiesTemplatesAddForUser": {
    "comment": "templates/add_for_user",
    "doc": "templates/add_for_user\n  [templates/add_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-add_for_user)\n \n  scope: `files.metadata.write`\n \n  Add a template associated with a user. See `properties/add` to add properties to a file. This endpoint can't be called on a team member or admin's behalf."
  },
  "post2FilePropertiesTemplatesGetForTeam": {
    "comment": "templates/get_for_team",
    "doc": "templates/get_for_team\n  [templates/get_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-get_for_team)\n \n  scope: `files.team_metadata.write`\n \n  Get the schema for a specified template."
  },
  "post2FilePropertiesTemplatesGetForUser": {
    "comment": "templates/get_for_user",
    "doc": "templates/get_for_user\n  [templates/get_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-get_for_user)\n \n  scope: `files.metadata.read`\n \n  Get the schema for a specified template. This endpoint can't be called on a team member or admin's behalf."
  },
  "post2FilePropertiesTemplatesListForTeam": {
    "comment": "templates/list_for_team",
    "doc": "templates/list_for_team\n  [templates/list_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-list_for_team)\n \n  scope: `files.team_metadata.write`\n \n  Get the template identifiers for a team. To get the schema of each template use `templates/get_for_team`."
  },
  "post2FilePropertiesTemplatesListForUser": {
    "comment": "templates/list_for_user",
    "doc": "templates/list_for_user\n  [templates/list_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-list_for_user)\n \n  scope: `files.metadata.read`\n \n  Get the template identifiers for a team. To get the schema of each template use `templates/get_for_user`. This endpoint can't be called on a team member or admin's behalf."
  },
  "post2FilePropertiesTemplatesRemoveForTeam": {
    "comment": "templates/remove_for_team",
    "doc": "templates/remove_for_team\n  [templates/remove_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-remove_for_team)\n \n  scope: `files.team_metadata.write`\n \n  Permanently removes the specified template created from `templates/add_for_user`. All properties associated with the template will also be removed. This action cannot be undone."
  },
  "post2FilePropertiesTemplatesRemoveForUser": {
    "comment": "templates/remove_for_user",
    "doc": "templates/remove_for_user\n  [templates/remove_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-remove_for_user)\n \n  scope: `files.metadata.write`\n \n  Permanently removes the specified template created from `templates/add_for_user`. All properties associated with the template will also be removed. This action cannot be undone."
  },
  "post2FilePropertiesTemplatesUpdateForTeam": {
    "comment": "templates/update_for_team",
    "doc": "templates/update_for_team\n  [templates/update_for_team](https://www.dropbox.com/developers/documentation/http/teams#file_properties-templates-update_for_team)\n \n  scope: `files.team_metadata.write`\n \n  Update a template associated with a team. This route can update the template name, the template description and add optional properties to templates."
  },
  "post2FilePropertiesTemplatesUpdateForUser": {
    "comment": "templates/update_for_user",
    "doc": "templates/update_for_user\n  [templates/update_for_user](https://www.dropbox.com/developers/documentation/http/documentation#file_properties-templates-update_for_user)\n \n  scope: `files.metadata.write`\n \n  Update a template associated with a user. This route can update the template name, the template description and add optional properties to templates. This endpoint can't be called on a team member or admin's behalf."
  },
  "post2FileRequestsCount": {
    "comment": "count",
    "doc": "count\n  [count](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-count)\n \n  scope: `file_requests.read`\n \n  Returns the total number of file requests owned by this user. Includes both open and closed file requests."
  },
  "post2FileRequestsCreate": {
    "comment": "create",
    "doc": "create\n  [create](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-create)\n \n  scope: `file_requests.write`\n \n  Creates a file request for this user."
  },
  "post2FileRequestsDelete": {
    "comment": "delete",
    "doc": "delete\n  [delete](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-delete)\n \n  scope: `file_requests.write`\n \n  Delete a batch of closed file requests."
  },
  "post2FileRequestsDeleteAllClosed": {
    "comment": "delete_all_closed",
    "doc": "delete_all_closed\n  [delete_all_closed](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-delete_all_closed)\n \n  scope: `file_requests.write`\n \n  Delete all closed file requests owned by this user."
  },
  "post2FileRequestsGet": {
    "comment": "get",
    "doc": "get\n  [get](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-get)\n \n  scope: `file_requests.read`\n \n  Returns the specified file request."
  },
  "post2FileRequestsListV2": {
    "comment": "list",
    "doc": "list\n  [list](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-list)\n \n  scope: `file_requests.read`\n \n  Returns a list of file requests owned by this user. For apps with the app folder permission, this will only return file requests with destinations in the app folder."
  },
  "post2FileRequestsListContinue": {
    "comment": "list/continue",
    "doc": "list/continue\n  [list/continue](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-list-continue)\n \n  scope: `file_requests.read`\n \n  Once a cursor has been retrieved from `list:2`, use this to paginate through all file requests. The cursor must come from a previous call to `list:2` or `list/continue`."
  },
  "post2FileRequestsUpdate": {
    "comment": "update",
    "doc": "update\n  [update](https://www.dropbox.com/developers/documentation/http/documentation#file_requests-update)\n \n  scope: `file_requests.write`\n \n  Update a file request."
  },
  "post2FilesCopyV2": {
    "comment": "copy",
    "doc": "copy\n  [copy](https://www.dropbox.com/developers/documentation/http/documentation#files-copy)\n \n  scope: `files.content.write`\n \n  Copy a file or folder to a different location in the user's Dropbox.\n  If the source path is a folder all its contents will be copied."
  },
  "post2FilesCopyBatchV2": {
    "comment": "copy_batch",
    "doc": "copy_batch\n  [copy_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_batch)\n \n  scope: `files.content.write`\n \n  Copy multiple files or folders to different locations at once in the user's Dropbox.\n  This route will replace `copy_batch:1`. The main difference is this route will return status for each entry, while `copy_batch:1` raises failure if any entry fails.\n  This route will either finish synchronously, or return a job ID and do the async copy job in background. Please use `copy_batch/check:2` to check the job status."
  },
  "post2FilesCopyBatchCheckV2": {
    "comment": "copy_batch/check",
    "doc": "copy_batch/check\n  [copy_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_batch-check)\n \n  scope: `files.content.write`\n \n  Returns the status of an asynchronous job for `copy_batch:2`. It returns list of results for each entry."
  },
  "post2FilesCopyReferenceGet": {
    "comment": "copy_reference/get",
    "doc": "copy_reference/get\n  [copy_reference/get](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_reference-get)\n \n  scope: `files.content.write`\n \n  Get a copy reference to a file or folder. This reference string can be used to save that file or folder to another user's Dropbox by passing it to `copy_reference/save`."
  },
  "post2FilesCopyReferenceSave": {
    "comment": "copy_reference/save",
    "doc": "copy_reference/save\n  [copy_reference/save](https://www.dropbox.com/developers/documentation/http/documentation#files-copy_reference-save)\n \n  scope: `files.content.write`\n \n  Save a copy reference returned by `copy_reference/get` to the user's Dropbox."
  },
  "post2FilesCreateFolderV2": {
    "comment": "create_folder",
    "doc": "create_folder\n  [create_folder](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder)\n \n  scope: `files.content.write`\n \n  Create a folder at a given path."
  },
  "post2FilesCreateFolderBatch": {
    "comment": "create_folder_batch",
    "doc": "create_folder_batch\n  [create_folder_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder_batch)\n \n  scope: `files.content.write`\n \n  Create multiple folders at once.\n  This route is asynchronous for large batches, which returns a job ID immediately and runs the create folder batch asynchronously. Otherwise, creates the folders and returns the result synchronously for smaller inputs. You can force asynchronous behaviour by using the `CreateFolderBatchArg.force_async` flag.  Use `create_folder_batch/check` to check the job status."
  },
  "post2FilesCreateFolderBatchCheck": {
    "comment": "create_folder_batch/check",
    "doc": "create_folder_batch/check\n  [create_folder_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-create_folder_batch-check)\n \n  scope: `files.content.write`\n \n  Returns the status of an asynchronous job for `create_folder_batch`. If success, it returns list of result for each entry."
  },
  "post2FilesDeleteV2": {
    "comment": "delete",
    "doc": "delete\n  [delete](https://www.dropbox.com/developers/documentation/http/documentation#files-delete)\n \n  scope: `files.content.write`\n \n  Delete the file or folder at a given path.\n  If the path is a folder, all its contents will be deleted too.\n  A successful response indicates that the file or folder was deleted. The returned metadata will be the corresponding `FileMetadata` or `FolderMetadata` for the item at time of deletion, and not a `DeletedMetadata` object."
  },
  "post2FilesDeleteBatch": {
    "comment": "delete_batch",
    "doc": "delete_batch\n  [delete_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-delete_batch)\n \n  scope: `files.content.write`\n \n  Delete multiple files/folders at once.\n  This route is asynchronous, which returns a job ID immediately and runs the delete batch asynchronously. Use `delete_batch/check` to check the job status."
  },
  "post2FilesDeleteBatchCheck": {
    "comment": "delete_batch/check",
    "doc": "delete_batch/check\n  [delete_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-delete_batch-check)\n \n  scope: `files.content.write`\n \n  Returns the status of an asynchronous job for `delete_batch`. If success, it returns list of result for each entry."
  },
  "post2FilesDownload": {
    "comment": "download",
    "doc": "download\n  [download](https://www.dropbox.com/developers/documentation/http/documentation#files-download)\n \n  scope: `files.content.read`\n \n  Download a file from a user's Dropbox."
  },
  "post2FilesDownloadZip": {
    "comment": "download_zip",
    "doc": "download_zip\n  [download_zip](https://www.dropbox.com/developers/documentation/http/documentation#files-download_zip)\n \n  scope: `files.content.read`\n \n  Download a folder from the user's Dropbox, as a zip file. The folder must be less than 20 GB in size and have fewer than 10,000 total files. The input cannot be a single file. Any single file must be less than 4GB in size."
  },
  "post2FilesExport": {
    "comment": "export",
    "doc": "export\n  [export](https://www.dropbox.com/developers/documentation/http/documentation#files-export)\n \n  scope: `files.content.read`\n \n  Export a file from a user's Dropbox. This route only supports exporting files that cannot be downloaded directly  and whose `ExportResult.file_metadata` has `ExportInfo.export_as` populated."
  },
  "post2FilesGetFileLockBatch": {
    "comment": "get_file_lock_batch",
    "doc": "get_file_lock_batch\n  [get_file_lock_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-get_file_lock_batch)\n \n  scope: `files.content.read`\n \n  Return the lock metadata for the given list of paths."
  },
  "post2FilesGetMetadata": {
    "comment": "get_metadata",
    "doc": "get_metadata\n  [get_metadata](https://www.dropbox.com/developers/documentation/http/documentation#files-get_metadata)\n \n  scope: `files.metadata.read`\n \n  Returns the metadata for a file or folder.\n  Note: Metadata for the root folder is unsupported."
  },
  "post2FilesGetPreview": {
    "comment": "get_preview",
    "doc": "get_preview\n  [get_preview](https://www.dropbox.com/developers/documentation/http/documentation#files-get_preview)\n \n  scope: `files.content.read`\n \n  Get a preview for a file.\n  Currently, PDF previews are generated for files with the following extensions: .ai, .doc, .docm, .docx, .eps, .gdoc, .gslides, .odp, .odt, .pps, .ppsm, .ppsx, .ppt, .pptm, .pptx, .rtf.\n  HTML previews are generated for files with the following extensions: .csv, .ods, .xls, .xlsm, .gsheet, .xlsx.\n  Other formats will return an unsupported extension error."
  },
  "post2FilesGetTemporaryLink": {
    "comment": "get_temporary_link",
    "doc": "get_temporary_link\n  [get_temporary_link](https://www.dropbox.com/developers/documentation/http/documentation#files-get_temporary_link)\n \n  scope: `files.content.read`\n \n  Get a temporary link to stream content of a file. This link will expire in four hours and afterwards you will get 410 Gone. This URL should not be used to display content directly in the browser. The Content-Type of the link is determined automatically by the file's mime type."
  },
  "post2FilesGetTemporaryUploadLink": {
    "comment": "get_temporary_upload_link",
    "doc": "get_temporary_upload_link\n  [get_temporary_upload_link](https://www.dropbox.com/developers/documentation/http/documentation#files-get_temporary_upload_link)\n \n  scope: `files.content.write`\n \n  Get a one-time use temporary upload link to upload a file to a Dropbox location.\n \n  This endpoint acts as a delayed `upload`. The returned temporary upload link may be used to make a POST request with the data to be uploaded. The upload will then be perfomed with the `CommitInfo` previously provided to `get_temporary_upload_link` but evaluated only upon consumption. Hence, errors stemming from invalid `CommitInfo` with respect to the state of the user's Dropbox will only be communicated at consumption time. Additionally, these errors are surfaced as generic HTTP 409 Conflict responses, potentially hiding issue details. The maximum temporary upload link duration is 4 hours. Upon consumption or expiration, a new link will have to be generated. Multiple links may exist for a specific upload path at any given time.\n \n  The POST request on the temporary upload link must have its Content-Type set to \"application/octet-stream\".\n \n  Example temporary upload link consumption request:\n \n  curl -X POST https://content.dropboxapi.com/apitul/1/bNi2uIYF51cVBND\n  --header \"Content-Type: application/octet-stream\"\n  --data-binary @local_file.txt\n \n  A successful temporary upload link consumption request returns the content hash of the uploaded data in JSON format.\n \n  Example succesful temporary upload link consumption response:\n  {\"content-hash\": \"599d71033d700ac892a0e48fa61b125d2f5994\"}\n \n  An unsuccessful temporary upload link consumption request returns any of the following status codes:\n \n  HTTP 400 Bad Request: Content-Type is not one of application/octet-stream and text/plain or request is invalid.\n  HTTP 409 Conflict: The temporary upload link does not exist or is currently unavailable, the upload failed, or another error happened.\n  HTTP 410 Gone: The temporary upload link is expired or consumed.\n \n  Example unsuccessful temporary upload link consumption response:\n  Temporary upload link has been recently consumed."
  },
  "post2FilesGetThumbnailV2": {
    "comment": "get_thumbnail",
    "doc": "get_thumbnail\n  [get_thumbnail](https://www.dropbox.com/developers/documentation/http/documentation#files-get_thumbnail)\n \n  scope: `files.content.read`\n \n  Get a thumbnail for a file."
  },
  "post2FilesGetThumbnailBatch": {
    "comment": "get_thumbnail_batch",
    "doc": "get_thumbnail_batch\n  [get_thumbnail_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-get_thumbnail_batch)\n \n  scope: `files.content.read`\n \n  Get thumbnails for a list of images. We allow up to 25 thumbnails in a single batch.\n  This method currently supports files with the following file extensions: jpg, jpeg, png, tiff, tif, gif and bmp. Photos that are larger than 20MB in size won't be converted to a thumbnail."
  },
  "post2FilesListFolder": {
    "comment": "list_folder",
    "doc": "list_folder\n  [list_folder](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder)\n \n  scope: `files.metadata.read`\n \n  Starts returning the contents of a folder. If the result's `ListFolderResult.has_more` field is `true`, call `list_folder/continue` with the returned `ListFolderResult.cursor` to retrieve more entries.\n  If you're using `ListFolderArg.recursive` set to `true` to keep a local cache of the contents of a Dropbox account, iterate through each entry in order and process them as follows to keep your local state in sync:\n  For each `FileMetadata`, store the new entry at the given path in your local state. If the required parent folders don't exist yet, create them. If there's already something else at the given path, replace it and remove all its children.\n  For each `FolderMetadata`, store the new entry at the given path in your local state. If the required parent folders don't exist yet, create them. If there's already something else at the given path, replace it but leave the children as they are. Check the new entry's `FolderSharingInfo.read_only` and set all its children's read-only statuses to match.\n  For each `DeletedMetadata`, if your local state has something at the given path, remove it and all its children. If there's nothing at the given path, ignore this entry.\n  Note: `auth.RateLimitError` may be returned if multiple `list_folder` or `list_folder/continue` calls with same parameters are made simultaneously by same API app for same user. If your app implements retry logic, please hold off the retry until the previous request finishes."
  },
  "post2FilesListFolderContinue": {
    "comment": "list_folder/continue",
    "doc": "list_folder/continue\n  [list_folder/continue](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-continue)\n \n  scope: `files.metadata.read`\n \n  Once a cursor has been retrieved from `list_folder`, use this to paginate through all files and retrieve updates to the folder, following the same rules as documented for `list_folder`."
  },
  "post2FilesListFolderGetLatestCursor": {
    "comment": "list_folder/get_latest_cursor",
    "doc": "list_folder/get_latest_cursor\n  [list_folder/get_latest_cursor](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-get_latest_cursor)\n \n  scope: `files.metadata.read`\n \n  A way to quickly get a cursor for the folder's state. Unlike `list_folder`, `list_folder/get_latest_cursor` doesn't return any entries. This endpoint is for app which only needs to know about new files and modifications and doesn't need to know about files that already exist in Dropbox."
  },
  "post2FilesListFolderLongpoll": {
    "comment": "list_folder/longpoll",
    "doc": "list_folder/longpoll\n  [list_folder/longpoll](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-longpoll)\n \n  scope: `files.metadata.read`\n \n  A longpoll endpoint to wait for changes on an account. In conjunction with `list_folder/continue`, this call gives you a low-latency way to monitor an account for file changes. The connection will block until there are changes available or a timeout occurs. This endpoint is useful mostly for client-side apps. If you're looking for server-side notifications, check out our [webhooks documentation](https://www.dropbox.com/developers/reference/webhooks)."
  },
  "post2FilesListRevisions": {
    "comment": "list_revisions",
    "doc": "list_revisions\n  [list_revisions](https://www.dropbox.com/developers/documentation/http/documentation#files-list_revisions)\n \n  scope: `files.metadata.read`\n \n  Returns revisions for files based on a file path or a file id. The file path or file id is identified from the latest file entry at the given file path or id. This end point allows your app to query either by file path or file id by setting the mode parameter appropriately.\n  In the `ListRevisionsMode.path` (default) mode, all revisions at the same file path as the latest file entry are returned. If revisions with the same file id are desired, then mode must be set to `ListRevisionsMode.id`. The `ListRevisionsMode.id` mode is useful to retrieve revisions for a given file across moves or renames."
  },
  "post2FilesLockFileBatch": {
    "comment": "lock_file_batch",
    "doc": "lock_file_batch\n  [lock_file_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-lock_file_batch)\n \n  scope: `files.content.write`\n \n  Lock the files at the given paths. A locked file will be writable only by the lock holder. A successful response indicates that the file has been locked. Returns a list of the locked file paths and their metadata after this operation."
  },
  "post2FilesMoveV2": {
    "comment": "move",
    "doc": "move\n  [move](https://www.dropbox.com/developers/documentation/http/documentation#files-move)\n \n  scope: `files.content.write`\n \n  Move a file or folder to a different location in the user's Dropbox.\n  If the source path is a folder all its contents will be moved.\n  Note that we do not currently support case-only renaming."
  },
  "post2FilesMoveBatchV2": {
    "comment": "move_batch",
    "doc": "move_batch\n  [move_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-move_batch)\n \n  scope: `files.content.write`\n \n  Move multiple files or folders to different locations at once in the user's Dropbox. Note that we do not currently support case-only renaming.\n  This route will replace `move_batch:1`. The main difference is this route will return status for each entry, while `move_batch:1` raises failure if any entry fails.\n  This route will either finish synchronously, or return a job ID and do the async move job in background. Please use `move_batch/check:2` to check the job status."
  },
  "post2FilesMoveBatchCheckV2": {
    "comment": "move_batch/check",
    "doc": "move_batch/check\n  [move_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-move_batch-check)\n \n  scope: `files.content.write`\n \n  Returns the status of an asynchronous job for `move_batch:2`. It returns list of results for each entry."
  },
  "post2FilesPermanentlyDelete": {
    "comment": "permanently_delete",
    "doc": "permanently_delete\n  [permanently_delete](https://www.dropbox.com/developers/documentation/http/documentation#files-permanently_delete)\n \n  scope: `files.permanent_delete`\n \n  Permanently delete the file or folder at a given path (see https://www.dropbox.com/en/help/40).\n  Note: This endpoint is only available for Dropbox Business apps."
  },
  "post2FilesRestore": {
    "comment": "restore",
    "doc": "restore\n  [restore](https://www.dropbox.com/developers/documentation/http/documentation#files-restore)\n \n  scope: `files.content.write`\n \n  Restore a specific revision of a file to the given path."
  },
  "post2FilesSaveUrl": {
    "comment": "save_url",
    "doc": "save_url\n  [save_url](https://www.dropbox.com/developers/documentation/http/documentation#files-save_url)\n \n  scope: `files.content.write`\n \n  Save the data from a specified URL into a file in user's Dropbox.\n  Note that the transfer from the URL must complete within 5 minutes, or the operation will time out and the job will fail.\n  If the given path already exists, the file will be renamed to avoid the conflict (e.g. myfile (1).txt)."
  },
  "post2FilesSaveUrlCheckJobStatus": {
    "comment": "save_url/check_job_status",
    "doc": "save_url/check_job_status\n  [save_url/check_job_status](https://www.dropbox.com/developers/documentation/http/documentation#files-save_url-check_job_status)\n \n  scope: `files.content.write`\n \n  Check the status of a `save_url` job."
  },
  "post2FilesSearchV2": {
    "comment": "search",
    "doc": "search\n  [search](https://www.dropbox.com/developers/documentation/http/documentation#files-search)\n \n  scope: `files.metadata.read`\n \n  Searches for files and folders.\n  Note: `search:2` along with `search/continue:2` can only be used to retrieve a maximum of 10,000 matches.\n  Recent changes may not immediately be reflected in search results due to a short delay in indexing. Duplicate results may be returned across pages. Some results may not be returned."
  },
  "post2FilesSearchContinueV2": {
    "comment": "search/continue",
    "doc": "search/continue\n  [search/continue](https://www.dropbox.com/developers/documentation/http/documentation#files-search-continue)\n \n  scope: `files.metadata.read`\n \n  Fetches the next page of search results returned from `search:2`.\n  Note: `search:2` along with `search/continue:2` can only be used to retrieve a maximum of 10,000 matches.\n  Recent changes may not immediately be reflected in search results due to a short delay in indexing. Duplicate results may be returned across pages. Some results may not be returned."
  },
  "post2FilesUnlockFileBatch": {
    "comment": "unlock_file_batch",
    "doc": "unlock_file_batch\n  [unlock_file_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-unlock_file_batch)\n \n  scope: `files.content.write`\n \n  Unlock the files at the given paths. A locked file can only be unlocked by the lock holder or, if a business account, a team admin. A successful response indicates that the file has been unlocked. Returns a list of the unlocked file paths and their metadata after this operation."
  },
  "post2FilesUpload": {
    "comment": "upload",
    "doc": "upload\n  [upload](https://www.dropbox.com/developers/documentation/http/documentation#files-upload)\n \n  scope: `files.content.write`\n \n  Create a new file with the contents provided in the request.\n  Do not use this to upload a file larger than 150 MB. Instead, create an upload session with `upload_session/start`.\n  Calls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)."
  },
  "post2FilesUploadSessionAppendV2": {
    "comment": "upload_session/append",
    "doc": "upload_session/append\n  [upload_session/append](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-append)\n \n  scope: `files.content.write`\n \n  Append more data to an upload session.\n  When the parameter close is set, this call will close the session.\n  A single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\n  Calls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)."
  },
  "post2FilesUploadSessionFinish": {
    "comment": "upload_session/finish",
    "doc": "upload_session/finish\n  [upload_session/finish](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish)\n \n  scope: `files.content.write`\n \n  Finish an upload session and save the uploaded data to the given file path.\n  A single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\n  Calls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)."
  },
  "post2FilesUploadSessionFinishBatch": {
    "comment": "upload_session/finish_batch",
    "doc": "upload_session/finish_batch\n  [upload_session/finish_batch](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish_batch)\n \n  scope: `files.content.write`\n \n  This route helps you commit many files at once into a user's Dropbox. Use `upload_session/start` and `upload_session/append:2` to upload file contents. We recommend uploading many files in parallel to increase throughput. Once the file contents have been uploaded, rather than calling `upload_session/finish`, use this route to finish all your upload sessions in a single request.\n  `UploadSessionStartArg.close` or `UploadSessionAppendArg.close` needs to be true for the last `upload_session/start` or `upload_session/append:2` call. The maximum size of a file one can upload to an upload session is 350 GB.\n  This route will return a job_id immediately and do the async commit job in background. Use `upload_session/finish_batch/check` to check the job status.\n  For the same account, this route should be executed serially. That means you should not start the next job before current job finishes. We allow up to 1000 entries in a single request.\n  Calls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)."
  },
  "post2FilesUploadSessionFinishBatchCheck": {
    "comment": "upload_session/finish_batch/check",
    "doc": "upload_session/finish_batch/check\n  [upload_session/finish_batch/check](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-finish_batch-check)\n \n  scope: `files.content.write`\n \n  Returns the status of an asynchronous job for `upload_session/finish_batch`. If success, it returns list of result for each entry."
  },
  "post2FilesUploadSessionStart": {
    "comment": "upload_session/start",
    "doc": "upload_session/start\n  [upload_session/start](https://www.dropbox.com/developers/documentation/http/documentation#files-upload_session-start)\n \n  scope: `files.content.write`\n \n  Upload sessions allow you to upload a single file in one or more requests, for example where the size of the file is greater than 150 MB.  This call starts a new upload session with the given data. You can then use `upload_session/append:2` to add more data and `upload_session/finish` to save all the data to a file in Dropbox.\n  A single request should not upload more than 150 MB. The maximum size of a file one can upload to an upload session is 350 GB.\n  An upload session can be used for a maximum of 48 hours. Attempting to use an `UploadSessionStartResult.session_id` with `upload_session/append:2` or `upload_session/finish` more than 48 hours after its creation will return a `UploadSessionLookupError.not_found`.\n  Calls to this endpoint will count as data transport calls for any Dropbox Business teams with a limit on the number of data transport calls allowed per month. For more information, see the [Data transport limit page](https://www.dropbox.com/developers/reference/data-transport-limit)"
  },
  "post2SharingAddFileMember": {
    "comment": "add_file_member",
    "doc": "add_file_member\n  [add_file_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-add_file_member)\n \n  scope: `sharing.write`\n \n  Adds specified members to a file."
  },
  "post2SharingAddFolderMember": {
    "comment": "add_folder_member",
    "doc": "add_folder_member\n  [add_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-add_folder_member)\n \n  scope: `sharing.write`\n \n  Allows an owner or editor (if the ACL update policy allows) of a shared folder to add another member.\n  For the new member to get access to all the functionality for this folder, you will need to call `mount_folder` on their behalf."
  },
  "post2SharingCheckJobStatus": {
    "comment": "check_job_status",
    "doc": "check_job_status\n  [check_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_job_status)\n \n  scope: `sharing.write`\n \n  Returns the status of an asynchronous job."
  },
  "post2SharingCheckRemoveMemberJobStatus": {
    "comment": "check_remove_member_job_status",
    "doc": "check_remove_member_job_status\n  [check_remove_member_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_remove_member_job_status)\n \n  scope: `sharing.write`\n \n  Returns the status of an asynchronous job for sharing a folder."
  },
  "post2SharingCheckShareJobStatus": {
    "comment": "check_share_job_status",
    "doc": "check_share_job_status\n  [check_share_job_status](https://www.dropbox.com/developers/documentation/http/documentation#sharing-check_share_job_status)\n \n  scope: `sharing.write`\n \n  Returns the status of an asynchronous job for sharing a folder."
  },
  "post2SharingGetFileMetadata": {
    "comment": "get_file_metadata",
    "doc": "get_file_metadata\n  [get_file_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_file_metadata)\n \n  scope: `sharing.read`\n \n  Returns shared file metadata."
  },
  "post2SharingGetFileMetadataBatch": {
    "comment": "get_file_metadata/batch",
    "doc": "get_file_metadata/batch\n  [get_file_metadata/batch](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_file_metadata-batch)\n \n  scope: `sharing.read`\n \n  Returns shared file metadata."
  },
  "post2SharingGetFolderMetadata": {
    "comment": "get_folder_metadata",
    "doc": "get_folder_metadata\n  [get_folder_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_folder_metadata)\n \n  scope: `sharing.read`\n \n  Returns shared folder metadata by its folder ID."
  },
  "post2SharingGetSharedLinkFile": {
    "comment": "get_shared_link_file",
    "doc": "get_shared_link_file\n  [get_shared_link_file](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_file)\n \n  scope: `sharing.read`\n \n  Download the shared link's file from a user's Dropbox."
  },
  "post2SharingGetSharedLinkMetadata": {
    "comment": "get_shared_link_metadata",
    "doc": "get_shared_link_metadata\n  [get_shared_link_metadata](https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_metadata)\n \n  scope: `sharing.read`\n \n  Get the shared link's metadata."
  },
  "post2SharingListFileMembers": {
    "comment": "list_file_members",
    "doc": "list_file_members\n  [list_file_members](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members)\n \n  scope: `sharing.read`\n \n  Use to obtain the members who have been invited to a file, both inherited and uninherited members."
  },
  "post2SharingListFileMembersBatch": {
    "comment": "list_file_members/batch",
    "doc": "list_file_members/batch\n  [list_file_members/batch](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members-batch)\n \n  scope: `sharing.read`\n \n  Get members of multiple files at once. The arguments to this route are more limited, and the limit on query result size per file is more strict. To customize the results more, use the individual file endpoint.\n  Inherited users and groups are not included in the result, and permissions are not returned for this endpoint."
  },
  "post2SharingListFileMembersContinue": {
    "comment": "list_file_members/continue",
    "doc": "list_file_members/continue\n  [list_file_members/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_file_members-continue)\n \n  scope: `sharing.read`\n \n  Once a cursor has been retrieved from `list_file_members` or `list_file_members/batch`, use this to paginate through all shared file members."
  },
  "post2SharingListFolderMembersContinue": {
    "comment": "list_folder_members/continue",
    "doc": "list_folder_members/continue\n  [list_folder_members/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folder_members-continue)\n \n  scope: `sharing.read`\n \n  Once a cursor has been retrieved from `list_folder_members`, use this to paginate through all shared folder members."
  },
  "post2SharingListFolders": {
    "comment": "list_folders",
    "doc": "list_folders\n  [list_folders](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folders)\n \n  scope: `sharing.read`\n \n  Return the list of all shared folders the current user has access to."
  },
  "post2SharingListFoldersContinue": {
    "comment": "list_folders/continue",
    "doc": "list_folders/continue\n  [list_folders/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_folders-continue)\n \n  scope: `sharing.read`\n \n  Once a cursor has been retrieved from `list_folders`, use this to paginate through all shared folders. The cursor must come from a previous call to `list_folders` or `list_folders/continue`."
  },
  "post2SharingListMountableFolders": {
    "comment": "list_mountable_folders",
    "doc": "list_mountable_folders\n  [list_mountable_folders](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_mountable_folders)\n \n  scope: `sharing.read`\n \n  Return the list of all shared folders the current user can mount or unmount."
  },
  "post2SharingListMountableFoldersContinue": {
    "comment": "list_mountable_folders/continue",
    "doc": "list_mountable_folders/continue\n  [list_mountable_folders/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_mountable_folders-continue)\n \n  scope: `sharing.read`\n \n  Once a cursor has been retrieved from `list_mountable_folders`, use this to paginate through all mountable shared folders. The cursor must come from a previous call to `list_mountable_folders` or `list_mountable_folders/continue`."
  },
  "post2SharingListReceivedFiles": {
    "comment": "list_received_files",
    "doc": "list_received_files\n  [list_received_files](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_received_files)\n \n  scope: `sharing.read`\n \n  Returns a list of all files shared with current user.\n  Does not include files the user has received via shared folders, and does  not include unclaimed invitations."
  },
  "post2SharingListReceivedFilesContinue": {
    "comment": "list_received_files/continue",
    "doc": "list_received_files/continue\n  [list_received_files/continue](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_received_files-continue)\n \n  scope: `sharing.read`\n \n  Get more results with a cursor from `list_received_files`."
  },
  "post2SharingListSharedLinks": {
    "comment": "list_shared_links",
    "doc": "list_shared_links\n  [list_shared_links](https://www.dropbox.com/developers/documentation/http/documentation#sharing-list_shared_links)\n \n  scope: `sharing.read`\n \n  List shared links of this user.\n  If no path is given, returns a list of all shared links for the current user.\n  If a non-empty path is given, returns a list of all shared links that allow access to the given path - direct links to the given path and links to parent folders of the given path. Links to parent folders can be suppressed by setting direct_only to true."
  },
  "post2SharingModifySharedLinkSettings": {
    "comment": "modify_shared_link_settings",
    "doc": "modify_shared_link_settings\n  [modify_shared_link_settings](https://www.dropbox.com/developers/documentation/http/documentation#sharing-modify_shared_link_settings)\n \n  scope: `sharing.write`\n \n  Modify the shared link's settings.\n  If the requested visibility conflict with the shared links policy of the team or the shared folder (in case the linked file is part of a shared folder) then the `LinkPermissions.resolved_visibility` of the returned `SharedLinkMetadata` will reflect the actual visibility of the shared link and the `LinkPermissions.requested_visibility` will reflect the requested visibility."
  },
  "post2SharingMountFolder": {
    "comment": "mount_folder",
    "doc": "mount_folder\n  [mount_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-mount_folder)\n \n  scope: `sharing.write`\n \n  The current user mounts the designated folder.\n  Mount a shared folder for a user after they have been added as a member. Once mounted, the shared folder will appear in their Dropbox."
  },
  "post2SharingRelinquishFileMembership": {
    "comment": "relinquish_file_membership",
    "doc": "relinquish_file_membership\n  [relinquish_file_membership](https://www.dropbox.com/developers/documentation/http/documentation#sharing-relinquish_file_membership)\n \n  scope: `sharing.write`\n \n  The current user relinquishes their membership in the designated file. Note that the current user may still have inherited access to this file through the parent folder."
  },
  "post2SharingRelinquishFolderMembership": {
    "comment": "relinquish_folder_membership",
    "doc": "relinquish_folder_membership\n  [relinquish_folder_membership](https://www.dropbox.com/developers/documentation/http/documentation#sharing-relinquish_folder_membership)\n \n  scope: `sharing.write`\n \n  The current user relinquishes their membership in the designated shared folder and will no longer have access to the folder.  A folder owner cannot relinquish membership in their own folder.\n  This will run synchronously if leave_a_copy is false, and asynchronously if leave_a_copy is true."
  },
  "post2SharingRemoveFileMember2": {
    "comment": "remove_file_member_2",
    "doc": "remove_file_member_2\n  [remove_file_member_2](https://www.dropbox.com/developers/documentation/http/documentation#sharing-remove_file_member_2)\n \n  scope: `sharing.write`\n \n  Removes a specified member from the file."
  },
  "post2SharingRemoveFolderMember": {
    "comment": "remove_folder_member",
    "doc": "remove_folder_member\n  [remove_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-remove_folder_member)\n \n  scope: `sharing.write`\n \n  Allows an owner or editor (if the ACL update policy allows) of a shared folder to remove another member."
  },
  "post2SharingRevokeSharedLink": {
    "comment": "revoke_shared_link",
    "doc": "revoke_shared_link\n  [revoke_shared_link](https://www.dropbox.com/developers/documentation/http/documentation#sharing-revoke_shared_link)\n \n  scope: `sharing.write`\n \n  Revoke a shared link.\n  Note that even after revoking a shared link to a file, the file may be accessible if there are shared links leading to any of the file parent folders. To list all shared links that enable access to a specific file, you can use the `list_shared_links` with the file as the `ListSharedLinksArg.path` argument."
  },
  "post2SharingSetAccessInheritance": {
    "comment": "set_access_inheritance",
    "doc": "set_access_inheritance\n  [set_access_inheritance](https://www.dropbox.com/developers/documentation/http/documentation#sharing-set_access_inheritance)\n \n  scope: `sharing.write`\n \n  Change the inheritance policy of an existing Shared Folder. Only permitted for shared folders in a shared team root.\n  If a `ShareFolderLaunch.async_job_id` is returned, you'll need to call `check_share_job_status` until the action completes to get the metadata for the folder."
  },
  "post2SharingShareFolder": {
    "comment": "share_folder",
    "doc": "share_folder\n  [share_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-share_folder)\n \n  scope: `sharing.write`\n \n  Share a folder with collaborators.\n  Most sharing will be completed synchronously. Large folders will be completed asynchronously. To make testing the async case repeatable, set `ShareFolderArg.force_async`.\n  If a `ShareFolderLaunch.async_job_id` is returned, you'll need to call `check_share_job_status` until the action completes to get the metadata for the folder."
  },
  "post2SharingTransferFolder": {
    "comment": "transfer_folder",
    "doc": "transfer_folder\n  [transfer_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-transfer_folder)\n \n  scope: `sharing.write`\n \n  Transfer ownership of a shared folder to a member of the shared folder.\n  User must have `AccessLevel.owner` access to the shared folder to perform a transfer."
  },
  "post2SharingUnmountFolder": {
    "comment": "unmount_folder",
    "doc": "unmount_folder\n  [unmount_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unmount_folder)\n \n  scope: `sharing.write`\n \n  The current user unmounts the designated folder. They can re-mount the folder at a later time using `mount_folder`."
  },
  "post2SharingUnshareFile": {
    "comment": "unshare_file",
    "doc": "unshare_file\n  [unshare_file](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unshare_file)\n \n  scope: `sharing.write`\n \n  Remove all members from this file. Does not remove inherited members."
  },
  "post2SharingUnshareFolder": {
    "comment": "unshare_folder",
    "doc": "unshare_folder\n  [unshare_folder](https://www.dropbox.com/developers/documentation/http/documentation#sharing-unshare_folder)\n \n  scope: `sharing.write`\n \n  Allows a shared folder owner to unshare the folder.\n  You'll need to call `check_job_status` to determine if the action has completed successfully."
  },
  "post2SharingUpdateFileMember": {
    "comment": "update_file_member",
    "doc": "update_file_member\n  [update_file_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_file_member)\n \n  scope: `sharing.write`\n \n  Changes a member's access on a shared file."
  },
  "post2SharingUpdateFolderMember": {
    "comment": "update_folder_member",
    "doc": "update_folder_member\n  [update_folder_member](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_folder_member)\n \n  scope: `sharing.write`\n \n  Allows an owner or editor of a shared folder to update another member's permissions."
  },
  "post2SharingUpdateFolderPolicy": {
    "comment": "update_folder_policy",
    "doc": "update_folder_policy\n  [update_folder_policy](https://www.dropbox.com/developers/documentation/http/documentation#sharing-update_folder_policy)\n \n  scope: `sharing.write`\n \n  Update the sharing policies for a shared folder.\n  User must have `AccessLevel.owner` access to the shared folder to update its policies."
  },
  "post2TeamDevicesListMemberDevices": {
    "comment": "devices/list_member_devices",
    "doc": "devices/list_member_devices\n  [devices/list_member_devices](https://www.dropbox.com/developers/documentation/http/teams#team-devices-list_member_devices)\n \n  scope: `sessions.list`\n \n  List all device sessions of a team's member."
  },
  "post2TeamDevicesListMembersDevices": {
    "comment": "devices/list_members_devices",
    "doc": "devices/list_members_devices\n  [devices/list_members_devices](https://www.dropbox.com/developers/documentation/http/teams#team-devices-list_members_devices)\n \n  scope: `sessions.list`\n \n  List all device sessions of a team.\n  Permission : Team member file access."
  },
  "post2TeamDevicesRevokeDeviceSession": {
    "comment": "devices/revoke_device_session",
    "doc": "devices/revoke_device_session\n  [devices/revoke_device_session](https://www.dropbox.com/developers/documentation/http/teams#team-devices-revoke_device_session)\n \n  scope: `sessions.modify`\n \n  Revoke a device session of a team's member."
  },
  "post2TeamDevicesRevokeDeviceSessionBatch": {
    "comment": "devices/revoke_device_session_batch",
    "doc": "devices/revoke_device_session_batch\n  [devices/revoke_device_session_batch](https://www.dropbox.com/developers/documentation/http/teams#team-devices-revoke_device_session_batch)\n \n  scope: `sessions.modify`\n \n  Revoke a list of device sessions of team members."
  },
  "post2TeamGroupsCreate": {
    "comment": "groups/create",
    "doc": "groups/create\n  [groups/create](https://www.dropbox.com/developers/documentation/http/teams#team-groups-create)\n \n  scope: `groups.write`\n \n  Creates a new, empty group, with a requested name.\n  Permission : Team member management."
  },
  "post2TeamGroupsDelete": {
    "comment": "groups/delete",
    "doc": "groups/delete\n  [groups/delete](https://www.dropbox.com/developers/documentation/http/teams#team-groups-delete)\n \n  scope: `groups.write`\n \n  Deletes a group.\n  The group is deleted immediately. However the revoking of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\n  Permission : Team member management."
  },
  "post2TeamGroupsGetInfo": {
    "comment": "groups/get_info",
    "doc": "groups/get_info\n  [groups/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-groups-get_info)\n \n  scope: `groups.read`\n \n  Retrieves information about one or more groups. Note that the optional field  `GroupFullInfo.members` is not returned for system-managed groups.\n  Permission : Team Information."
  },
  "post2TeamGroupsJobStatusGet": {
    "comment": "groups/job_status/get",
    "doc": "groups/job_status/get\n  [groups/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-groups-job_status-get)\n \n  scope: `groups.write`\n \n  Once an async_job_id is returned from `groups/delete`, `groups/members/add` , or `groups/members/remove` use this method to poll the status of granting/revoking group members' access to group-owned resources.\n  Permission : Team member management."
  },
  "post2TeamGroupsList": {
    "comment": "groups/list",
    "doc": "groups/list\n  [groups/list](https://www.dropbox.com/developers/documentation/http/teams#team-groups-list)\n \n  scope: `groups.read`\n \n  Lists groups on a team.\n  Permission : Team Information."
  },
  "post2TeamGroupsListContinue": {
    "comment": "groups/list/continue",
    "doc": "groups/list/continue\n  [groups/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-groups-list-continue)\n \n  scope: `groups.read`\n \n  Once a cursor has been retrieved from `groups/list`, use this to paginate through all groups.\n  Permission : Team Information."
  },
  "post2TeamGroupsMembersAdd": {
    "comment": "groups/members/add",
    "doc": "groups/members/add\n  [groups/members/add](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-add)\n \n  scope: `groups.write`\n \n  Adds members to a group.\n  The members are added immediately. However the granting of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\n  Permission : Team member management."
  },
  "post2TeamGroupsMembersList": {
    "comment": "groups/members/list",
    "doc": "groups/members/list\n  [groups/members/list](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-list)\n \n  scope: `groups.read`\n \n  Lists members of a group.\n  Permission : Team Information."
  },
  "post2TeamGroupsMembersListContinue": {
    "comment": "groups/members/list/continue",
    "doc": "groups/members/list/continue\n  [groups/members/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-list-continue)\n \n  scope: `groups.read`\n \n  Once a cursor has been retrieved from `groups/members/list`, use this to paginate through all members of the group.\n  Permission : Team information."
  },
  "post2TeamGroupsMembersRemove": {
    "comment": "groups/members/remove",
    "doc": "groups/members/remove\n  [groups/members/remove](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-remove)\n \n  scope: `groups.write`\n \n  Removes members from a group.\n  The members are removed immediately. However the revoking of group-owned resources may take additional time. Use the `groups/job_status/get` to determine whether this process has completed.\n  This method permits removing the only owner of a group, even in cases where this is not possible via the web client.\n  Permission : Team member management."
  },
  "post2TeamGroupsMembersSetAccessType": {
    "comment": "groups/members/set_access_type",
    "doc": "groups/members/set_access_type\n  [groups/members/set_access_type](https://www.dropbox.com/developers/documentation/http/teams#team-groups-members-set_access_type)\n \n  scope: `groups.write`\n \n  Sets a member's access type in a group.\n  Permission : Team member management."
  },
  "post2TeamGroupsUpdate": {
    "comment": "groups/update",
    "doc": "groups/update\n  [groups/update](https://www.dropbox.com/developers/documentation/http/teams#team-groups-update)\n \n  scope: `groups.write`\n \n  Updates a group's name and/or external ID.\n  Permission : Team member management."
  },
  "post2TeamLegalHoldsCreatePolicy": {
    "comment": "legal_holds/create_policy",
    "doc": "legal_holds/create_policy\n  [legal_holds/create_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-create_policy)\n \n  scope: `team_data.member`\n \n  Creates new legal hold policy. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsGetPolicy": {
    "comment": "legal_holds/get_policy",
    "doc": "legal_holds/get_policy\n  [legal_holds/get_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-get_policy)\n \n  scope: `team_data.member`\n \n  Gets a legal hold by Id. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsListHeldRevisions": {
    "comment": "legal_holds/list_held_revisions",
    "doc": "legal_holds/list_held_revisions\n  [legal_holds/list_held_revisions](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_held_revisions)\n \n  scope: `team_data.member`\n \n  List the file metadata that's under the hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsListHeldRevisionsContinue": {
    "comment": "legal_holds/list_held_revisions_continue",
    "doc": "legal_holds/list_held_revisions_continue\n  [legal_holds/list_held_revisions_continue](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_held_revisions_continue)\n \n  scope: `team_data.member`\n \n  Continue listing the file metadata that's under the hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsListPolicies": {
    "comment": "legal_holds/list_policies",
    "doc": "legal_holds/list_policies\n  [legal_holds/list_policies](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-list_policies)\n \n  scope: `team_data.member`\n \n  Lists legal holds on a team. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsReleasePolicy": {
    "comment": "legal_holds/release_policy",
    "doc": "legal_holds/release_policy\n  [legal_holds/release_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-release_policy)\n \n  scope: `team_data.member`\n \n  Releases a legal hold by Id. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLegalHoldsUpdatePolicy": {
    "comment": "legal_holds/update_policy",
    "doc": "legal_holds/update_policy\n  [legal_holds/update_policy](https://www.dropbox.com/developers/documentation/http/teams#team-legal_holds-update_policy)\n \n  scope: `team_data.member`\n \n  Updates a legal hold. Note: Legal Holds is a paid add-on. Not all teams have the feature.\n  Permission : Team member file access."
  },
  "post2TeamLinkedAppsListMemberLinkedApps": {
    "comment": "linked_apps/list_member_linked_apps",
    "doc": "linked_apps/list_member_linked_apps\n  [linked_apps/list_member_linked_apps](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-list_member_linked_apps)\n \n  scope: `sessions.list`\n \n  List all linked applications of the team member.\n  Note, this endpoint does not list any team-linked applications."
  },
  "post2TeamLinkedAppsListMembersLinkedApps": {
    "comment": "linked_apps/list_members_linked_apps",
    "doc": "linked_apps/list_members_linked_apps\n  [linked_apps/list_members_linked_apps](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-list_members_linked_apps)\n \n  scope: `sessions.list`\n \n  List all applications linked to the team members' accounts.\n  Note, this endpoint does not list any team-linked applications."
  },
  "post2TeamLinkedAppsRevokeLinkedApp": {
    "comment": "linked_apps/revoke_linked_app",
    "doc": "linked_apps/revoke_linked_app\n  [linked_apps/revoke_linked_app](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-revoke_linked_app)\n \n  scope: `sessions.modify`\n \n  Revoke a linked application of the team member."
  },
  "post2TeamLinkedAppsRevokeLinkedAppBatch": {
    "comment": "linked_apps/revoke_linked_app_batch",
    "doc": "linked_apps/revoke_linked_app_batch\n  [linked_apps/revoke_linked_app_batch](https://www.dropbox.com/developers/documentation/http/teams#team-linked_apps-revoke_linked_app_batch)\n \n  scope: `sessions.modify`\n \n  Revoke a list of linked applications of the team members."
  },
  "post2TeamMemberSpaceLimitsExcludedUsersAdd": {
    "comment": "member_space_limits/excluded_users/add",
    "doc": "member_space_limits/excluded_users/add\n  [member_space_limits/excluded_users/add](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-add)\n \n  scope: `members.write`\n \n  Add users to member space limits excluded users list."
  },
  "post2TeamMemberSpaceLimitsExcludedUsersList": {
    "comment": "member_space_limits/excluded_users/list",
    "doc": "member_space_limits/excluded_users/list\n  [member_space_limits/excluded_users/list](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-list)\n \n  scope: `members.read`\n \n  List member space limits excluded users."
  },
  "post2TeamMemberSpaceLimitsExcludedUsersListContinue": {
    "comment": "member_space_limits/excluded_users/list/continue",
    "doc": "member_space_limits/excluded_users/list/continue\n  [member_space_limits/excluded_users/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-list-continue)\n \n  scope: `members.read`\n \n  Continue listing member space limits excluded users."
  },
  "post2TeamMemberSpaceLimitsExcludedUsersRemove": {
    "comment": "member_space_limits/excluded_users/remove",
    "doc": "member_space_limits/excluded_users/remove\n  [member_space_limits/excluded_users/remove](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-excluded_users-remove)\n \n  scope: `members.write`\n \n  Remove users from member space limits excluded users list."
  },
  "post2TeamMemberSpaceLimitsGetCustomQuota": {
    "comment": "member_space_limits/get_custom_quota",
    "doc": "member_space_limits/get_custom_quota\n  [member_space_limits/get_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-get_custom_quota)\n \n  scope: `members.read`\n \n  Get users custom quota. Returns none as the custom quota if none was set. A maximum of 1000 members can be specified in a single call."
  },
  "post2TeamMemberSpaceLimitsRemoveCustomQuota": {
    "comment": "member_space_limits/remove_custom_quota",
    "doc": "member_space_limits/remove_custom_quota\n  [member_space_limits/remove_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-remove_custom_quota)\n \n  scope: `members.write`\n \n  Remove users custom quota. A maximum of 1000 members can be specified in a single call."
  },
  "post2TeamMemberSpaceLimitsSetCustomQuota": {
    "comment": "member_space_limits/set_custom_quota",
    "doc": "member_space_limits/set_custom_quota\n  [member_space_limits/set_custom_quota](https://www.dropbox.com/developers/documentation/http/teams#team-member_space_limits-set_custom_quota)\n \n  scope: `members.read`\n \n  Set users custom quota. Custom quota has to be at least 15GB. A maximum of 1000 members can be specified in a single call."
  },
  "post2TeamMembersAdd": {
    "comment": "members/add",
    "doc": "members/add\n  [members/add](https://www.dropbox.com/developers/documentation/http/teams#team-members-add)\n \n  scope: `members.write`\n \n  Adds members to a team.\n  Permission : Team member management\n  A maximum of 20 members can be specified in a single call.\n  If no Dropbox account exists with the email address specified, a new Dropbox account will be created with the given email address, and that account will be invited to the team.\n  If a personal Dropbox account exists with the email address specified in the call, this call will create a placeholder Dropbox account for the user on the team and send an email inviting the user to migrate their existing personal account onto the team.\n  Team member management apps are required to set an initial given_name and surname for a user to use in the team invitation and for 'Perform as team member' actions taken on the user before they become 'active'."
  },
  "post2TeamMembersAddJobStatusGet": {
    "comment": "members/add/job_status/get",
    "doc": "members/add/job_status/get\n  [members/add/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-members-add-job_status-get)\n \n  scope: `members.write`\n \n  Once an async_job_id is returned from `members/add` , use this to poll the status of the asynchronous request.\n  Permission : Team member management."
  },
  "post2TeamMembersDeleteProfilePhoto": {
    "comment": "members/delete_profile_photo",
    "doc": "members/delete_profile_photo\n  [members/delete_profile_photo](https://www.dropbox.com/developers/documentation/http/teams#team-members-delete_profile_photo)\n \n  scope: `members.write`\n \n  Deletes a team member's profile photo.\n  Permission : Team member management."
  },
  "post2TeamMembersGetInfo": {
    "comment": "members/get_info",
    "doc": "members/get_info\n  [members/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-members-get_info)\n \n  scope: `members.read`\n \n  Returns information about multiple team members.\n  Permission : Team information\n  This endpoint will return `MembersGetInfoItem.id_not_found`, for IDs (or emails) that cannot be matched to a valid team member."
  },
  "post2TeamMembersList": {
    "comment": "members/list",
    "doc": "members/list\n  [members/list](https://www.dropbox.com/developers/documentation/http/teams#team-members-list)\n \n  scope: `members.read`\n \n  Lists members of a team.\n  Permission : Team information."
  },
  "post2TeamMembersListContinue": {
    "comment": "members/list/continue",
    "doc": "members/list/continue\n  [members/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-members-list-continue)\n \n  scope: `members.read`\n \n  Once a cursor has been retrieved from `members/list`, use this to paginate through all team members.\n  Permission : Team information."
  },
  "post2TeamMembersMoveFormerMemberFiles": {
    "comment": "members/move_former_member_files",
    "doc": "members/move_former_member_files\n  [members/move_former_member_files](https://www.dropbox.com/developers/documentation/http/teams#team-members-move_former_member_files)\n \n  scope: `members.write`\n \n  Moves removed member's files to a different member. This endpoint initiates an asynchronous job. To obtain the final result of the job, the client should periodically poll `members/move_former_member_files/job_status/check`.\n  Permission : Team member management."
  },
  "post2TeamMembersMoveFormerMemberFilesJobStatusCheck": {
    "comment": "members/move_former_member_files/job_status/check",
    "doc": "members/move_former_member_files/job_status/check\n  [members/move_former_member_files/job_status/check](https://www.dropbox.com/developers/documentation/http/teams#team-members-move_former_member_files-job_status-check)\n \n  scope: `members.write`\n \n  Once an async_job_id is returned from `members/move_former_member_files` , use this to poll the status of the asynchronous request.\n  Permission : Team member management."
  },
  "post2TeamMembersRecover": {
    "comment": "members/recover",
    "doc": "members/recover\n  [members/recover](https://www.dropbox.com/developers/documentation/http/teams#team-members-recover)\n \n  scope: `members.delete`\n \n  Recover a deleted member.\n  Permission : Team member management\n  Exactly one of team_member_id, email, or external_id must be provided to identify the user account."
  },
  "post2TeamMembersRemove": {
    "comment": "members/remove",
    "doc": "members/remove\n  [members/remove](https://www.dropbox.com/developers/documentation/http/teams#team-members-remove)\n \n  scope: `members.delete`\n \n  Removes a member from a team.\n  Permission : Team member management\n  Exactly one of team_member_id, email, or external_id must be provided to identify the user account.\n  Accounts can be recovered via `members/recover` for a 7 day period or until the account has been permanently deleted or transferred to another account (whichever comes first). Calling `members/add` while a user is still recoverable on your team will return with `MemberAddResult.user_already_on_team`.\n  Accounts can have their files transferred via the admin console for a limited time, based on the version history length associated with the team (180 days for most teams).\n  This endpoint may initiate an asynchronous job. To obtain the final result of the job, the client should periodically poll `members/remove/job_status/get`."
  },
  "post2TeamMembersRemoveJobStatusGet": {
    "comment": "members/remove/job_status/get",
    "doc": "members/remove/job_status/get\n  [members/remove/job_status/get](https://www.dropbox.com/developers/documentation/http/teams#team-members-remove-job_status-get)\n \n  scope: `members.delete`\n \n  Once an async_job_id is returned from `members/remove` , use this to poll the status of the asynchronous request.\n  Permission : Team member management."
  },
  "post2TeamMembersSecondaryEmailsAdd": {
    "comment": "members/secondary_emails/add",
    "doc": "members/secondary_emails/add\n  [members/secondary_emails/add](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-add)\n \n  scope: `members.write`\n \n  Add secondary emails to users.\n  Permission : Team member management.\n  Emails that are on verified domains will be verified automatically. For each email address not on a verified domain a verification email will be sent."
  },
  "post2TeamMembersSecondaryEmailsDelete": {
    "comment": "members/secondary_emails/delete",
    "doc": "members/secondary_emails/delete\n  [members/secondary_emails/delete](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-delete)\n \n  scope: `members.write`\n \n  Delete secondary emails from users\n  Permission : Team member management.\n  Users will be notified of deletions of verified secondary emails at both the secondary email and their primary email."
  },
  "post2TeamMembersSecondaryEmailsResendVerificationEmails": {
    "comment": "members/secondary_emails/resend_verification_emails",
    "doc": "members/secondary_emails/resend_verification_emails\n  [members/secondary_emails/resend_verification_emails](https://www.dropbox.com/developers/documentation/http/teams#team-members-secondary_emails-resend_verification_emails)\n \n  scope: `members.write`\n \n  Resend secondary email verification emails.\n  Permission : Team member management."
  },
  "post2TeamMembersSendWelcomeEmail": {
    "comment": "members/send_welcome_email",
    "doc": "members/send_welcome_email\n  [members/send_welcome_email](https://www.dropbox.com/developers/documentation/http/teams#team-members-send_welcome_email)\n \n  scope: `members.write`\n \n  Sends welcome email to pending team member.\n  Permission : Team member management\n  Exactly one of team_member_id, email, or external_id must be provided to identify the user account.\n  No-op if team member is not pending."
  },
  "post2TeamMembersSetAdminPermissions": {
    "comment": "members/set_admin_permissions",
    "doc": "members/set_admin_permissions\n  [members/set_admin_permissions](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_admin_permissions)\n \n  scope: `members.write`\n \n  Updates a team member's permissions.\n  Permission : Team member management."
  },
  "post2TeamMembersSetProfile": {
    "comment": "members/set_profile",
    "doc": "members/set_profile\n  [members/set_profile](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_profile)\n \n  scope: `members.write`\n \n  Updates a team member's profile.\n  Permission : Team member management."
  },
  "post2TeamMembersSetProfilePhoto": {
    "comment": "members/set_profile_photo",
    "doc": "members/set_profile_photo\n  [members/set_profile_photo](https://www.dropbox.com/developers/documentation/http/teams#team-members-set_profile_photo)\n \n  scope: `members.write`\n \n  Updates a team member's profile photo.\n  Permission : Team member management."
  },
  "post2TeamMembersSuspend": {
    "comment": "members/suspend",
    "doc": "members/suspend\n  [members/suspend](https://www.dropbox.com/developers/documentation/http/teams#team-members-suspend)\n \n  scope: `members.write`\n \n  Suspend a member from a team.\n  Permission : Team member management\n  Exactly one of team_member_id, email, or external_id must be provided to identify the user account."
  },
  "post2TeamMembersUnsuspend": {
    "comment": "members/unsuspend",
    "doc": "members/unsuspend\n  [members/unsuspend](https://www.dropbox.com/developers/documentation/http/teams#team-members-unsuspend)\n \n  scope: `members.write`\n \n  Unsuspend a member from a team.\n  Permission : Team member management\n  Exactly one of team_member_id, email, or external_id must be provided to identify the user account."
  },
  "post2TeamNamespacesList": {
    "comment": "namespaces/list",
    "doc": "namespaces/list\n  [namespaces/list](https://www.dropbox.com/developers/documentation/http/teams#team-namespaces-list)\n \n  scope: `team_data.member`\n \n  Returns a list of all team-accessible namespaces. This list includes team folders, shared folders containing team members, team members' home namespaces, and team members' app folders. Home namespaces and app folders are always owned by this team or members of the team, but shared folders may be owned by other users or other teams. Duplicates may occur in the list."
  },
  "post2TeamNamespacesListContinue": {
    "comment": "namespaces/list/continue",
    "doc": "namespaces/list/continue\n  [namespaces/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-namespaces-list-continue)\n \n  scope: `team_data.member`\n \n  Once a cursor has been retrieved from `namespaces/list`, use this to paginate through all team-accessible namespaces. Duplicates may occur in the list."
  },
  "post2TeamReportsGetActivity": {
    "comment": "reports/get_activity",
    "doc": "reports/get_activity\n  [reports/get_activity](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_activity)\n \n  scope: `team_info.read`\n \n  Retrieves reporting data about a team's user activity."
  },
  "post2TeamReportsGetDevices": {
    "comment": "reports/get_devices",
    "doc": "reports/get_devices\n  [reports/get_devices](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_devices)\n \n  scope: `team_info.read`\n \n  Retrieves reporting data about a team's linked devices."
  },
  "post2TeamReportsGetMembership": {
    "comment": "reports/get_membership",
    "doc": "reports/get_membership\n  [reports/get_membership](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_membership)\n \n  scope: `team_info.read`\n \n  Retrieves reporting data about a team's membership."
  },
  "post2TeamReportsGetStorage": {
    "comment": "reports/get_storage",
    "doc": "reports/get_storage\n  [reports/get_storage](https://www.dropbox.com/developers/documentation/http/teams#team-reports-get_storage)\n \n  scope: `team_info.read`\n \n  Retrieves reporting data about a team's storage usage."
  },
  "post2TeamTeamFolderActivate": {
    "comment": "team_folder/activate",
    "doc": "team_folder/activate\n  [team_folder/activate](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-activate)\n \n  scope: `team_data.team_space`\n \n  Sets an archived team folder's status to active.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderArchive": {
    "comment": "team_folder/archive",
    "doc": "team_folder/archive\n  [team_folder/archive](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-archive)\n \n  scope: `team_data.team_space`\n \n  Sets an active team folder's status to archived and removes all folder and file members.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderArchiveCheck": {
    "comment": "team_folder/archive/check",
    "doc": "team_folder/archive/check\n  [team_folder/archive/check](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-archive-check)\n \n  scope: `team_data.team_space`\n \n  Returns the status of an asynchronous job for archiving a team folder.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderCreate": {
    "comment": "team_folder/create",
    "doc": "team_folder/create\n  [team_folder/create](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-create)\n \n  scope: `team_data.team_space`\n \n  Creates a new, active, team folder with no members.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderGetInfo": {
    "comment": "team_folder/get_info",
    "doc": "team_folder/get_info\n  [team_folder/get_info](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-get_info)\n \n  scope: `team_data.team_space`\n \n  Retrieves metadata for team folders.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderList": {
    "comment": "team_folder/list",
    "doc": "team_folder/list\n  [team_folder/list](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-list)\n \n  scope: `team_data.team_space`\n \n  Lists all team folders.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderListContinue": {
    "comment": "team_folder/list/continue",
    "doc": "team_folder/list/continue\n  [team_folder/list/continue](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-list-continue)\n \n  scope: `team_data.team_space`\n \n  Once a cursor has been retrieved from `team_folder/list`, use this to paginate through all team folders.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderPermanentlyDelete": {
    "comment": "team_folder/permanently_delete",
    "doc": "team_folder/permanently_delete\n  [team_folder/permanently_delete](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-permanently_delete)\n \n  scope: `team_data.team_space`\n \n  Permanently deletes an archived team folder.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderRename": {
    "comment": "team_folder/rename",
    "doc": "team_folder/rename\n  [team_folder/rename](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-rename)\n \n  scope: `team_data.team_space`\n \n  Changes an active team folder's name.\n  Permission : Team member file access."
  },
  "post2TeamTeamFolderUpdateSyncSettings": {
    "comment": "team_folder/update_sync_settings",
    "doc": "team_folder/update_sync_settings\n  [team_folder/update_sync_settings](https://www.dropbox.com/developers/documentation/http/teams#team-team_folder-update_sync_settings)\n \n  scope: `team_data.team_space`\n \n  Updates the sync settings on a team folder or its contents.  Use of this endpoint requires that the team has team selective sync enabled."
  },
  "post2TeamFeaturesGetValues": {
    "comment": "features/get_values",
    "doc": "features/get_values\n  [features/get_values](https://www.dropbox.com/developers/documentation/http/teams#team-features-get_values)\n \n  scope: `team_info.read`\n \n  Get the values for one or more featues. This route allows you to check your account's capability for what feature you can access or what value you have for certain features.\n  Permission : Team information."
  },
  "post2TeamGetInfo": {
    "comment": "get_info",
    "doc": "get_info\n  [get_info](https://www.dropbox.com/developers/documentation/http/teams#team-get_info)\n \n  scope: `team_info.read`\n \n  Retrieves information about a team."
  },
  "post2TeamTokenGetAuthenticatedAdmin": {
    "comment": "token/get_authenticated_admin",
    "doc": "token/get_authenticated_admin\n  [token/get_authenticated_admin](https://www.dropbox.com/developers/documentation/http/teams#team-token-get_authenticated_admin)\n \n  scope: `team_info.read`\n \n  Returns the member profile of the admin who generated the team access token used to make the call."
  },
  "post2TeamLogGetEvents": {
    "comment": "get_events",
    "doc": "get_events\n  [get_events](https://www.dropbox.com/developers/documentation/http/teams#team_log-get_events)\n \n  scope: `events.read`\n \n  Retrieves team events. If the result's `GetTeamEventsResult.has_more` field is `true`, call `get_events/continue` with the returned cursor to retrieve more entries. If end_time is not specified in your request, you may use the returned cursor to poll `get_events/continue` for new events.\n  Many attributes note 'may be missing due to historical data gap'.\n  Note that the file_operations category and & analogous paper events are not available on all Dropbox Business [plans](http://www.dropbox.com/business/plans-comparison). Use [features/get_values](http://www.dropbox.com/developers/documentation/http/teams#team-features-get_values) to check for this feature.\n  Permission : Team Auditing."
  },
  "post2TeamLogGetEventsContinue": {
    "comment": "get_events/continue",
    "doc": "get_events/continue\n  [get_events/continue](https://www.dropbox.com/developers/documentation/http/teams#team_log-get_events-continue)\n \n  scope: `events.read`\n \n  Once a cursor has been retrieved from `get_events`, use this to paginate through all events.\n  Permission : Team Auditing."
  },
  "post2UsersFeaturesGetValues": {
    "comment": "features/get_values",
    "doc": "features/get_values\n  [features/get_values](https://www.dropbox.com/developers/documentation/http/documentation#users-features-get_values)\n \n  scope: `account_info.read`\n \n  Get a list of feature values that may be configured for the current account."
  },
  "post2UsersGetAccount": {
    "comment": "get_account",
    "doc": "get_account\n  [get_account](https://www.dropbox.com/developers/documentation/http/documentation#users-get_account)\n \n  scope: `sharing.read`\n \n  Get information about a user's account."
  },
  "post2UsersGetAccountBatch": {
    "comment": "get_account_batch",
    "doc": "get_account_batch\n  [get_account_batch](https://www.dropbox.com/developers/documentation/http/documentation#users-get_account_batch)\n \n  scope: `sharing.read`\n \n  Get information about multiple user accounts.  At most 300 accounts may be queried per request."
  },
  "post2UsersGetCurrentAccount": {
    "comment": "get_current_account",
    "doc": "get_current_account\n  [get_current_account](https://www.dropbox.com/developers/documentation/http/documentation#users-get_current_account)\n \n  scope: `account_info.read`\n \n  Get information about the current user's account."
  },
  "post2UsersGetSpaceUsage": {
    "comment": "get_space_usage",
    "doc": "get_space_usage\n  [get_space_usage](https://www.dropbox.com/developers/documentation/http/documentation#users-get_space_usage)\n \n  scope: `account_info.read`\n \n  Get the space usage information for the current user's account."
  }
}