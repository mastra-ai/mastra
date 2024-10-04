export const comments = {
  "getFile": {
    "comment": "Get file JSON",
    "doc": "Get file JSON\n  Returns the document identified by `file_key` as a JSON object. The file key can be parsed from any Figma file url: `https://www.figma.com/file/{file_key}/{title}`.\n \n  The `document` property contains a node of type `DOCUMENT`.\n \n  The `components` property contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from."
  },
  "getFileNodes": {
    "comment": "Get file JSON for specific nodes",
    "doc": "Get file JSON for specific nodes\n  Returns the nodes referenced to by `ids` as a JSON object. The nodes are retrieved from the Figma file referenced to by `file_key`.\n \n  The node ID and file key can be parsed from any Figma node url: `https://www.figma.com/file/{file_key}/{title}?node-id={id}`\n \n  The `name`, `lastModified`, `thumbnailUrl`, `editorType`, and `version` attributes are all metadata of the specified file.\n \n  The `linkAccess` field describes the file link share permission level. There are 5 types of permissions a shared link can have: `\"inherit\"`, `\"view\"`, `\"edit\"`, `\"org_view\"`, and `\"org_edit\"`. `\"inherit\"` is the default permission applied to files created in a team project, and will inherit the project's permissions. `\"org_view\"` and `\"org_edit\"` restrict the link to org users.\n \n  The `document` attribute contains a Node of type `DOCUMENT`.\n \n  The `components` key contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.\n \n  By default, no vector data is returned. To return vector data, pass the geometry=paths parameter to the endpoint.\n  Each node can also inherit properties from applicable styles. The styles key contains a mapping from style IDs to style metadata.\n \n  Important: the nodes map may contain values that are `null`. This may be due to the node id not existing within the specified file."
  },
  "getImages": {
    "comment": "Render images of file nodes",
    "doc": "Render images of file nodes\n  Renders images from a file.\n \n  If no error occurs, `\"images\"` will be populated with a map from node IDs to URLs of the rendered images, and `\"status\"` will be omitted. The image assets will expire after 30 days. Images up to 32 megapixels can be exported. Any images that are larger will be scaled down.\n \n  Important: the image map may contain values that are `null`. This indicates that rendering of that specific node has failed. This may be due to the node id not existing, or other reasons such has the node having no renderable components. It is guaranteed that any node that was requested for rendering will be represented in this map whether or not the render succeeded.\n \n  To render multiple images from the same file, use the `ids` query parameter to specify multiple node ids.\n \n  ```\n  GET /v1/images/:key?ids=1:2,1:3,1:4\n  ```"
  },
  "getImageFills": {
    "comment": "Get image fills",
    "doc": "Get image fills\n  Returns download links for all images present in image fills in a document. Image fills are how Figma represents any user supplied images. When you drag an image into Figma, we create a rectangle with a single fill that represents the image, and the user is able to transform the rectangle (and properties on the fill) as they wish.\n \n  This endpoint returns a mapping from image references to the URLs at which the images may be download. Image URLs will expire after no more than 14 days. Image references are located in the output of the GET files endpoint under the `imageRef` attribute in a `Paint`."
  },
  "getTeamProjects": {
    "comment": "Get projects in a team",
    "doc": "Get projects in a team\n  You can use this endpoint to get a list of all the Projects within the specified team. This will only return projects visible to the authenticated user or owner of the developer token. Note: it is not currently possible to programmatically obtain the team id of a user just from a token. To obtain a team id, navigate to a team page of a team you are a part of. The team id will be present in the URL after the word team and before your team name."
  },
  "getProjectFiles": {
    "comment": "Get files in a project",
    "doc": "Get files in a project\n  Get a list of all the Files within the specified project."
  },
  "getFileVersions": {
    "comment": "Get versions of a file",
    "doc": "Get versions of a file\n  This endpoint fetches the version history of a file, allowing you to see the progression of a file over time. You can then use this information to render a specific version of the file, via another endpoint."
  },
  "getComments": {
    "comment": "Get comments in a file",
    "doc": "Get comments in a file\n  Gets a list of comments left on the file."
  },
  "postComment": {
    "comment": "Add a comment to a file",
    "doc": "Add a comment to a file\n  Posts a new comment on the file."
  },
  "deleteComment": {
    "comment": "Delete a comment",
    "doc": "Delete a comment\n  Deletes a specific comment. Only the person who made the comment is allowed to delete it."
  },
  "getCommentReactions": {
    "comment": "Get reactions for a comment",
    "doc": "Get reactions for a comment\n  Gets a paginated list of reactions left on the comment."
  },
  "postCommentReaction": {
    "comment": "Add a reaction to a comment",
    "doc": "Add a reaction to a comment\n  Posts a new comment reaction on a file comment."
  },
  "deleteCommentReaction": {
    "comment": "Delete a reaction",
    "doc": "Delete a reaction\n  Deletes a specific comment reaction. Only the person who made the reaction is allowed to delete it."
  },
  "getMe": {
    "comment": "Get current user",
    "doc": "Get current user\n  Returns the user information for the currently authenticated user."
  },
  "getTeamComponents": {
    "comment": "Get team components",
    "doc": "Get team components\n  Get a paginated list of published components within a team library."
  },
  "getFileComponents": {
    "comment": "Get file components",
    "doc": "Get file components\n  Get a list of published components within a file library."
  },
  "getComponent": {
    "comment": "Get component",
    "doc": "Get component\n  Get metadata on a component by key."
  },
  "getTeamComponentSets": {
    "comment": "Get team component sets",
    "doc": "Get team component sets\n  Get a paginated list of published component sets within a team library."
  },
  "getFileComponentSets": {
    "comment": "Get file component sets",
    "doc": "Get file component sets\n  Get a list of published component sets within a file library."
  },
  "getComponentSet": {
    "comment": "Get component set",
    "doc": "Get component set\n  Get metadata on a component set by key."
  },
  "getTeamStyles": {
    "comment": "Get team styles",
    "doc": "Get team styles\n  Get a paginated list of published styles within a team library."
  },
  "getFileStyles": {
    "comment": "Get file styles",
    "doc": "Get file styles\n  Get a list of published styles within a file library."
  },
  "getStyle": {
    "comment": "Get style",
    "doc": "Get style\n  Get metadata on a style by key."
  },
  "postWebhook": {
    "comment": "Create a webhook",
    "doc": "Create a webhook\n  Create a new webhook which will call the specified endpoint when the event triggers. By default, this webhook will automatically send a PING event to the endpoint when it is created. If this behavior is not desired, you can create the webhook and set the status to PAUSED and reactivate it later."
  },
  "getWebhook": {
    "comment": "Get a webhook",
    "doc": "Get a webhook\n  Get a webhook by ID."
  },
  "putWebhook": {
    "comment": "Update a webhook",
    "doc": "Update a webhook\n  Update a webhook by ID."
  },
  "deleteWebhook": {
    "comment": "Delete a webhook",
    "doc": "Delete a webhook\n  Deletes the specified webhook. This operation cannot be reversed."
  },
  "getTeamWebhooks": {
    "comment": "Get team webhooks",
    "doc": "Get team webhooks\n  Returns all webhooks registered under the specified team."
  },
  "getWebhookRequests": {
    "comment": "Get webhook requests",
    "doc": "Get webhook requests\n  Returns all webhook requests sent within the last week. Useful for debugging."
  },
  "getActivityLogs": {
    "comment": "Get activity logs",
    "doc": "Get activity logs\n  Returns a list of activity log events"
  },
  "getPayments": {
    "comment": "Get payments",
    "doc": "Get payments\n  There are two methods to query for a user's payment information on a plugin, widget, or Community file. The first method, using plugin payment tokens, is typically used when making queries from a plugin's or widget's code. The second method, providing a user ID and resource ID, is typically used when making queries from anywhere else.\n \n  Note that you can only query for resources that you own. In most cases, this means that you can only query resources that you originally created."
  },
  "getLocalVariables": {
    "comment": "Get local variables",
    "doc": "Get local variables\n  This API is available to full members of Enterprise orgs.\n \n  The `GET /v1/files/:file_key/variables/local` endpoint lets you enumerate local variables created in the file and remote variables used in the file. Remote variables are referenced by their `subscribed_id`.\n \n  As a part of the Variables related API additions, the `GET /v1/files/:file_key` endpoint now returns a `boundVariables` property, containing the `variableId` of the bound variable. The `GET /v1/files/:file_key/variables/local` endpoint can be used to get the full variable or variable collection object.\n \n  Note that `GET /v1/files/:file_key/variables/published` does not return modes. Instead, you will need to use the `GET /v1/files/:file_key/variables/local` endpoint, in the same file, to examine the mode values."
  },
  "getPublishedVariables": {
    "comment": "Get published variables",
    "doc": "Get published variables\n  This API is available to full members of Enterprise orgs.\n \n  The `GET /v1/files/:file_key/variables/published` endpoint returns the variables that are published from the given file.\n \n  The response for this endpoint contains some key differences compared to the `GET /v1/files/:file_key/variables/local` endpoint:\n \n  - Each variable and variable collection contains a `subscribed_id`.\n  - Modes are omitted for published variable collections\n \n  Published variables have two ids: an id that is assigned in the file where it is created (`id`), and an id that is used by subscribing files (`subscribed_id`). The `id` and `key` are stable over the lifetime of the variable. The `subscribed_id` changes every time the variable is modified and published. The same is true for variable collections.\n \n  The `updatedAt` fields are ISO 8601 timestamps that indicate the last time that a change to a variable was published. For variable collections, this timestamp will change any time a variable in the collection is changed."
  },
  "postVariables": {
    "comment": "Create/modify/delete variables",
    "doc": "Create/modify/delete variables\n  This API is available to full members of Enterprise orgs with Editor seats.\n \n  The `POST /v1/files/:file_key/variables` endpoint lets you bulk create, update, and delete variables and variable collections.\n \n  The request body supports the following 4 top-level arrays. Changes from these arrays will be applied in the below order, and within each array, by array order.\n \n  - variableCollections: For creating, updating, and deleting variable collections\n  - variableModes: For creating, updating, and deleting modes within variable collections\n  - Each collection can have a maximum of 40 modes\n  - Mode names cannot be longer than 40 characters\n  - variables: For creating, updating, and deleting variables\n  - Each collection can have a maximum of 5000 variables\n  - Variable names must be unique within a collection and cannot contain certain special characters such as `.{}`\n  - variableModeValues: For setting a variable value under a specific mode.\n  - When setting aliases, a variable cannot be aliased to itself or form an alias cycle\n \n  Temporary ids can be used to reference an object later in the same POST request body. They can be used at create time in the `id` property of variable collections, modes, variables, and in the `initialModeId` property of variable collections. They are scoped to a single request body, and must be unique within the body. The mapping of temporary ids to real ids is returned in the response.\n \n  This endpoint has the following key behaviors:\n \n  - The request body must be 4MB or less.\n  - Must include an `action` property for collections, modes, and variables to tell the API whether to create, update, or delete the object.\n  - When creating a collection, mode, or variable, you can include a temporary `id` that can be referenced in dependent objects in the same request. For example, you can create a new collection with the id `\"my_new_collection\"`. You can then set `variableCollectionId` to `\"my_new_collection\"` in new modes or variables. Temporary ids must be unique in the request body.\n  - New collections always come with one mode. You can reference this mode by setting `initialModeId` to a temporary id in the request body. This is useful if you want to set values for variables in the mode in the `variableModeValues` array.\n  - The `tempIdToRealId` array returns a mapping of the temporary ids in the request, to the real ids of the newly created objects.\n  - When adding new modes or variables, default variable values will be applied, consistent with what happens in the UI.\n  - Everything to be created, updated, and deleted in the request body is treated as one atomic operation. If there is any validation failure, you will get a 400 status code response, and no changes will be persisted.\n  - You will not be able to update remote variables or variable collections. You can only update variables in the file where they were originally created."
  },
  "getDevResources": {
    "comment": "Get dev resources",
    "doc": "Get dev resources\n  Get dev resources in a file"
  },
  "postDevResources": {
    "comment": "Create dev resources",
    "doc": "Create dev resources\n  Bulk create dev resources across multiple files.\n  Dev resources that are successfully created will show up in the links_created array in the response.\n \n  If there are any dev resources that cannot be created, you may still get a 200 response. These resources will show up in the errors array. Some reasons a dev resource cannot be created include:\n \n  - Resource points to a `file_key` that cannot be found.\n  - The node already has the maximum of 10 dev resources.\n  - Another dev resource for the node has the same url."
  },
  "putDevResources": {
    "comment": "Update dev resources",
    "doc": "Update dev resources\n  Bulk update dev resources across multiple files.\n \n  Ids for dev resources that are successfully updated will show up in the `links_updated` array in the response.\n \n  If there are any dev resources that cannot be updated, you may still get a 200 response. These resources will show up in the `errors` array."
  },
  "deleteDevResource": {
    "comment": "Delete dev resource",
    "doc": "Delete dev resource\n  Delete a dev resource from a file"
  },
  "getLibraryAnalyticsActions": {
    "comment": "Get library analytics action data.",
    "doc": "Get library analytics action data.\n  Returns a list of library analytics actions data broken down by the requested dimension."
  },
  "getLibraryAnalyticsUsages": {
    "comment": "Get library analytics usage data.",
    "doc": "Get library analytics usage data.\n  Returns a list of library analytics usage data broken down by the requested dimension."
  }
}