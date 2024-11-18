export const comments = {
  "driveAboutGet": {
    "comment": "Gets information about the user, the user's Drive, and system capabilities.",
    "doc": "Gets information about the user, the user's Drive, and system capabilities."
  },
  "driveAppsList": {
    "comment": "Lists a user's installed apps.",
    "doc": "Lists a user's installed apps."
  },
  "driveAppsGet": {
    "comment": "Gets a specific app.",
    "doc": "Gets a specific app."
  },
  "driveChangesList": {
    "comment": "Lists the changes for a user or shared drive.",
    "doc": "Lists the changes for a user or shared drive."
  },
  "driveChangesGetStartPageToken": {
    "comment": "Gets the starting pageToken for listing future changes.",
    "doc": "Gets the starting pageToken for listing future changes."
  },
  "driveChangesWatch": {
    "comment": "Subscribes to changes for a user.",
    "doc": "Subscribes to changes for a user."
  },
  "driveChannelsStop": {
    "comment": "Stops watching resources through this channel.",
    "doc": "Stops watching resources through this channel."
  },
  "driveDrivesList": {
    "comment": "Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/drive/api/guides/search-shareddrives) guide.",
    "doc": "Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/drive/api/guides/search-shareddrives) guide."
  },
  "driveDrivesCreate": {
    "comment": "Creates a shared drive.",
    "doc": "Creates a shared drive."
  },
  "driveDrivesDelete": {
    "comment": "Permanently deletes a shared drive for which the user is an `organizer`. The shared drive cannot contain any untrashed items.",
    "doc": "Permanently deletes a shared drive for which the user is an `organizer`. The shared drive cannot contain any untrashed items."
  },
  "driveDrivesGet": {
    "comment": "Gets a shared drive's metadata by ID.",
    "doc": "Gets a shared drive's metadata by ID."
  },
  "driveDrivesUpdate": {
    "comment": "Updates the metadate for a shared drive.",
    "doc": "Updates the metadate for a shared drive."
  },
  "driveDrivesHide": {
    "comment": "Hides a shared drive from the default view.",
    "doc": "Hides a shared drive from the default view."
  },
  "driveDrivesUnhide": {
    "comment": "Restores a shared drive to the default view.",
    "doc": "Restores a shared drive to the default view."
  },
  "driveFilesList": {
    "comment": "Lists the user's files. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for files & folders](/drive/api/guides/search-files) guide. Note: This method returns all files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.",
    "doc": "Lists the user's files. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for files & folders](/drive/api/guides/search-files) guide. Note: This method returns all files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results."
  },
  "driveFilesCreate": {
    "comment": "Creates a new file. This method supports an upload URI and accepts uploaded media with the following characteristics: - Maximum file size: 5,120 GB - Accepted Media MIME types:`` Note: Specify a valid MIME type, rather than the literal `` value. The literal `` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads). Apps creating shortcuts with `files.create` must specify the MIME type `application/vnd.google-apps.shortcut`. Apps should specify a file extension in the `name` property when inserting files with the API. For example, an operation to insert a JPEG file should specify something like `\"name\": \"cat.jpg\"` in the metadata. Subsequent `GET` requests include the read-only `fileExtension` property populated with the extension originally specified in the `title` property. When a Google Drive user requests to download a file, or when the file is downloaded through the sync client, Drive builds a full filename (with extension) based on the title. In cases where the extension is missing, Drive attempts to determine the extension based on the file's MIME type.",
    "doc": "Creates a new file. This method supports an upload URI and accepts uploaded media with the following characteristics: - Maximum file size: 5,120 GB - Accepted Media MIME types:`` Note: Specify a valid MIME type, rather than the literal `` value. The literal `` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads). Apps creating shortcuts with `files.create` must specify the MIME type `application/vnd.google-apps.shortcut`. Apps should specify a file extension in the `name` property when inserting files with the API. For example, an operation to insert a JPEG file should specify something like `\"name\": \"cat.jpg\"` in the metadata. Subsequent `GET` requests include the read-only `fileExtension` property populated with the extension originally specified in the `title` property. When a Google Drive user requests to download a file, or when the file is downloaded through the sync client, Drive builds a full filename (with extension) based on the title. In cases where the extension is missing, Drive attempts to determine the extension based on the file's MIME type."
  },
  "driveFilesGenerateIds": {
    "comment": "Generates a set of file IDs which can be provided in create or copy requests.",
    "doc": "Generates a set of file IDs which can be provided in create or copy requests."
  },
  "driveFilesEmptyTrash": {
    "comment": "Permanently deletes all of the user's trashed files.",
    "doc": "Permanently deletes all of the user's trashed files."
  },
  "driveFilesDelete": {
    "comment": "Permanently deletes a file owned by the user without moving it to the trash. If the file belongs to a shared drive, the user must be an `organizer` on the parent folder. If the target is a folder, all descendants owned by the user are also deleted.",
    "doc": "Permanently deletes a file owned by the user without moving it to the trash. If the file belongs to a shared drive, the user must be an `organizer` on the parent folder. If the target is a folder, all descendants owned by the user are also deleted."
  },
  "driveFilesGet": {
    "comment": "Gets a file's metadata or content by ID. If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/drive/api/reference/rest/v3/files/export) instead. For more information, see [Download & export files](/drive/api/guides/manage-downloads).",
    "doc": "Gets a file's metadata or content by ID. If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/drive/api/reference/rest/v3/files/export) instead. For more information, see [Download & export files](/drive/api/guides/manage-downloads)."
  },
  "driveFilesUpdate": {
    "comment": "Updates a file's metadata and/or content. When calling this method, only populate fields in the request that you want to modify. When updating fields, some fields might be changed automatically, such as `modifiedDate`. This method supports patch semantics. This method supports an upload URI and accepts uploaded media with the following characteristics: - Maximum file size: 5,120 GB - Accepted Media MIME types:`` Note: Specify a valid MIME type, rather than the literal `` value. The literal `` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads).",
    "doc": "Updates a file's metadata and/or content. When calling this method, only populate fields in the request that you want to modify. When updating fields, some fields might be changed automatically, such as `modifiedDate`. This method supports patch semantics. This method supports an upload URI and accepts uploaded media with the following characteristics: - Maximum file size: 5,120 GB - Accepted Media MIME types:`` Note: Specify a valid MIME type, rather than the literal `` value. The literal `` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads)."
  },
  "driveCommentsList": {
    "comment": "Lists a file's comments.",
    "doc": "Lists a file's comments."
  },
  "driveCommentsCreate": {
    "comment": "Creates a comment on a file.",
    "doc": "Creates a comment on a file."
  },
  "driveCommentsDelete": {
    "comment": "Deletes a comment.",
    "doc": "Deletes a comment."
  },
  "driveCommentsGet": {
    "comment": "Gets a comment by ID.",
    "doc": "Gets a comment by ID."
  },
  "driveCommentsUpdate": {
    "comment": "Updates a comment with patch semantics.",
    "doc": "Updates a comment with patch semantics."
  },
  "driveRepliesList": {
    "comment": "Lists a comment's replies.",
    "doc": "Lists a comment's replies."
  },
  "driveRepliesCreate": {
    "comment": "Creates a reply to a comment.",
    "doc": "Creates a reply to a comment."
  },
  "driveRepliesDelete": {
    "comment": "Deletes a reply.",
    "doc": "Deletes a reply."
  },
  "driveRepliesGet": {
    "comment": "Gets a reply by ID.",
    "doc": "Gets a reply by ID."
  },
  "driveRepliesUpdate": {
    "comment": "Updates a reply with patch semantics.",
    "doc": "Updates a reply with patch semantics."
  },
  "driveFilesCopy": {
    "comment": "Creates a copy of a file and applies any requested updates with patch semantics.",
    "doc": "Creates a copy of a file and applies any requested updates with patch semantics."
  },
  "driveFilesExport": {
    "comment": "Exports a Google Workspace document to the requested MIME type and returns exported byte content. Note that the exported content is limited to 10MB.",
    "doc": "Exports a Google Workspace document to the requested MIME type and returns exported byte content. Note that the exported content is limited to 10MB."
  },
  "driveFilesListLabels": {
    "comment": "Lists the labels on a file.",
    "doc": "Lists the labels on a file."
  },
  "driveFilesModifyLabels": {
    "comment": "Modifies the set of labels applied to a file. Returns a list of the labels that were added or modified.",
    "doc": "Modifies the set of labels applied to a file. Returns a list of the labels that were added or modified."
  },
  "drivePermissionsList": {
    "comment": "Lists a file's or shared drive's permissions.",
    "doc": "Lists a file's or shared drive's permissions."
  },
  "drivePermissionsCreate": {
    "comment": "Creates a permission for a file or shared drive. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied.",
    "doc": "Creates a permission for a file or shared drive. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied."
  },
  "drivePermissionsDelete": {
    "comment": "Deletes a permission. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied.",
    "doc": "Deletes a permission. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied."
  },
  "drivePermissionsGet": {
    "comment": "Gets a permission by ID.",
    "doc": "Gets a permission by ID."
  },
  "drivePermissionsUpdate": {
    "comment": "Updates a permission with patch semantics. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied.",
    "doc": "Updates a permission with patch semantics. Warning: Concurrent permissions operations on the same file are not supported; only the last update is applied."
  },
  "driveRevisionsList": {
    "comment": "Lists a file's revisions.",
    "doc": "Lists a file's revisions."
  },
  "driveRevisionsDelete": {
    "comment": "Permanently deletes a file version. You can only delete revisions for files with binary content in Google Drive, like images or videos. Revisions for other files, like Google Docs or Sheets, and the last remaining file version can't be deleted.",
    "doc": "Permanently deletes a file version. You can only delete revisions for files with binary content in Google Drive, like images or videos. Revisions for other files, like Google Docs or Sheets, and the last remaining file version can't be deleted."
  },
  "driveRevisionsGet": {
    "comment": "Gets a revision's metadata or content by ID.",
    "doc": "Gets a revision's metadata or content by ID."
  },
  "driveRevisionsUpdate": {
    "comment": "Updates a revision with patch semantics.",
    "doc": "Updates a revision with patch semantics."
  },
  "driveFilesWatch": {
    "comment": "Subscribes to changes to a file.",
    "doc": "Subscribes to changes to a file."
  },
  "driveTeamdrivesList": {
    "comment": "Deprecated: Use `drives.list` instead.",
    "doc": "Deprecated: Use `drives.list` instead."
  },
  "driveTeamdrivesCreate": {
    "comment": "Deprecated: Use `drives.create` instead.",
    "doc": "Deprecated: Use `drives.create` instead."
  },
  "driveTeamdrivesDelete": {
    "comment": "Deprecated: Use `drives.delete` instead.",
    "doc": "Deprecated: Use `drives.delete` instead."
  },
  "driveTeamdrivesGet": {
    "comment": "Deprecated: Use `drives.get` instead.",
    "doc": "Deprecated: Use `drives.get` instead."
  },
  "driveTeamdrivesUpdate": {
    "comment": "Deprecated: Use `drives.update` instead.",
    "doc": "Deprecated: Use `drives.update` instead."
  }
}