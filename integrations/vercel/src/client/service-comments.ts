export const comments = {
  "emailLogin": {
    "comment": "Login with email",
    "doc": "Login with email\n  Request a new login for a user to get a token. This will respond with a verification token and send an email to confirm the request. Once confirmed you can use the verification token to get an authentication token."
  },
  "verifyToken": {
    "comment": "Verify a login request to get an authentication token",
    "doc": "Verify a login request to get an authentication token\n  Verify the user accepted the login request and get a authentication token. The user email address and the token received after requesting the login must be added to the URL as a query string with the names `email` and `token`."
  },
  "getAllChecks": {
    "comment": "Retrieve a list of all checks",
    "doc": "Retrieve a list of all checks\n  List all of the checks created for a deployment."
  },
  "createCheck": {
    "comment": "Creates a new Check",
    "doc": "Creates a new Check\n  Creates a new check. This endpoint must be called with an OAuth2 or it will produce a 400 error."
  },
  "getCheck": {
    "comment": "Get a single check",
    "doc": "Get a single check\n  Return a detailed response for a single check."
  },
  "updateCheck": {
    "comment": "Update a check",
    "doc": "Update a check\n  Update an existing check. This endpoint must be called with an OAuth2 or it will produce a 400 error."
  },
  "rerequestCheck": {
    "comment": "Rerequest a check",
    "doc": "Rerequest a check\n  Rerequest a selected check that has failed."
  },
  "updateRecord": {
    "comment": "Update an existing DNS record",
    "doc": "Update an existing DNS record\n  Updates an existing DNS record for a domain name."
  },
  "getEdgeConfigs": {
    "comment": "Get Edge Configs",
    "doc": "Get Edge Configs\n  Returns all Edge Configs."
  },
  "createEdgeConfig": {
    "comment": "Create an Edge Config",
    "doc": "Create an Edge Config\n  Creates an Edge Config."
  },
  "deleteEdgeConfig": {
    "comment": "Delete an Edge Config",
    "doc": "Delete an Edge Config\n  Delete an Edge Config by id."
  },
  "getEdgeConfig": {
    "comment": "Get an Edge Config",
    "doc": "Get an Edge Config\n  Returns an Edge Config."
  },
  "updateEdgeConfig": {
    "comment": "Update an Edge Config",
    "doc": "Update an Edge Config\n  Updates an Edge Config."
  },
  "getEdgeConfigItem": {
    "comment": "Get an Edge Config item",
    "doc": "Get an Edge Config item\n  Returns a specific Edge Config Item."
  },
  "getEdgeConfigItems": {
    "comment": "Get Edge Config items",
    "doc": "Get Edge Config items\n  Returns all items of an Edge Config."
  },
  "patchtEdgeConfigItems": {
    "comment": "Update Edge Config items in batch",
    "doc": "Update Edge Config items in batch\n  Update multiple Edge Config Items in batch."
  },
  "createEdgeConfigToken": {
    "comment": "Create an Edge Config token",
    "doc": "Create an Edge Config token\n  Adds a token to an existing Edge Config."
  },
  "getEdgeConfigToken": {
    "comment": "Get Edge Config token meta data",
    "doc": "Get Edge Config token meta data\n  Return meta data about an Edge Config token."
  },
  "deleteEdgeConfigTokens": {
    "comment": "Delete one or more Edge Config tokens",
    "doc": "Delete one or more Edge Config tokens\n  Deletes one or more tokens of an existing Edge Config."
  },
  "getEdgeConfigTokens": {
    "comment": "Get all tokens of an Edge Config",
    "doc": "Get all tokens of an Edge Config\n  Returns all tokens of an Edge Config."
  },
  "deleteConfiguration": {
    "comment": "Delete an integration configuration",
    "doc": "Delete an integration configuration\n  Allows to remove the configuration with the `id` provided in the parameters. The configuration and all of its resources will be removed. This includes Webhooks, LogDrains and Project Env variables."
  },
  "getConfiguration": {
    "comment": "Retrieve an integration configuration",
    "doc": "Retrieve an integration configuration\n  Allows to retrieve a the configuration with the provided id in case it exists. The authenticated user or team must be the owner of the config in order to access it."
  },
  "getConfigurations": {
    "comment": "Get configurations for the authenticated user or team",
    "doc": "Get configurations for the authenticated user or team\n  Allows to retrieve all configurations for an authenticated integration. When the `project` view is used, configurations generated for the authorization flow will be filtered out of the results."
  },
  "gitNamespaces": {
    "comment": "List git namespaces by provider",
    "doc": "List git namespaces by provider\n  Lists git namespaces for a supported provider. Supported providers are `github`, `gitlab` and `bitbucket`. If the provider is not provided, it will try to obtain it from the user that authenticated the request."
  },
  "deleteIntegrationLogDrain": {
    "comment": "Deletes the Integration log drain with the provided `id`",
    "doc": "Deletes the Integration log drain with the provided `id`\n  Deletes the Integration log drain with the provided `id`. When using an OAuth2 Token, the log drain can be deleted only if the integration owns it."
  },
  "getV1IntegrationsSearchRepo": {
    "comment": "List git repositories linked to namespace by provider",
    "doc": "List git repositories linked to namespace by provider\n  Lists git repositories linked to a namespace `id` for a supported provider. A specific namespace `id` can be obtained via the `git-namespaces`  endpoint. Supported providers are `github`, `gitlab` and `bitbucket`. If the provider or namespace is not provided, it will try to obtain it from the user that authenticated the request."
  },
  "getConfigurableLogDrains": {
    "comment": "Retrieves a list of Configurable Log Drains",
    "doc": "Retrieves a list of Configurable Log Drains\n  Retrieves a list of Configurable Log Drains. This endpoint must be called with a team AccessToken (integration OAuth2 clients are not allowed). Only log drains owned by the authenticated team can be accessed."
  },
  "createConfigurableLogDrain": {
    "comment": "Creates a Configurable Log Drain",
    "doc": "Creates a Configurable Log Drain\n  Creates a configurable log drain. This endpoint must be called with a team AccessToken (integration OAuth2 clients are not allowed)"
  },
  "deleteConfigurableLogDrain": {
    "comment": "Deletes a Configurable Log Drain",
    "doc": "Deletes a Configurable Log Drain\n  Deletes a Configurable Log Drain. This endpoint must be called with a team AccessToken (integration OAuth2 clients are not allowed). Only log drains owned by the authenticated team can be deleted."
  },
  "getConfigurableLogDrain": {
    "comment": "Retrieves a Configurable Log Drain",
    "doc": "Retrieves a Configurable Log Drain\n  Retrieves a Configurable Log Drain. This endpoint must be called with a team AccessToken (integration OAuth2 clients are not allowed). Only log drains owned by the authenticated team can be accessed."
  },
  "getProjectEnv": {
    "comment": "Retrieve the decrypted value of an environment variable of a project by id",
    "doc": "Retrieve the decrypted value of an environment variable of a project by id\n  Retrieve the environment variable for a given project."
  },
  "createTeam": {
    "comment": "Create a Team",
    "doc": "Create a Team\n  Create a new Team under your account. You need to send a POST request with the desired Team slug, and optionally the Team name."
  },
  "deleteTeam": {
    "comment": "Delete a Team",
    "doc": "Delete a Team\n  Delete a team under your account. You need to send a `DELETE` request with the desired team `id`. An optional array of reasons for deletion may also be sent."
  },
  "deleteTeamInviteCode": {
    "comment": "Delete a Team invite code",
    "doc": "Delete a Team invite code\n  Delete an active Team invite code."
  },
  "inviteUserToTeam": {
    "comment": "Invite a user",
    "doc": "Invite a user\n  Invite a user to join the team specified in the URL. The authenticated user needs to be an `OWNER` in order to successfully invoke this endpoint. The user can be specified with an email or an ID. If both email and ID are provided, ID will take priority."
  },
  "joinTeam": {
    "comment": "Join a team",
    "doc": "Join a team\n  Join a team with a provided invite code or team ID."
  },
  "removeTeamMember": {
    "comment": "Remove a Team Member",
    "doc": "Remove a Team Member\n  Remove a Team Member from the Team, or dismiss a user that requested access, or leave a team."
  },
  "updateTeamMember": {
    "comment": "Update a Team Member",
    "doc": "Update a Team Member\n  Update the membership of a Team Member on the Team specified by `teamId`, such as changing the _role_ of the member, or confirming a request to join the Team for an unconfirmed member. The authenticated user must be an `OWNER` of the Team."
  },
  "requestAccessToTeam": {
    "comment": "Request access to a team",
    "doc": "Request access to a team\n  Request access to a team as a member. An owner has to approve the request. Only 10 users can request access to a team at the same time."
  },
  "getTeamAccessRequest": {
    "comment": "Get access request status",
    "doc": "Get access request status\n  Check the status of a join request. It'll respond with a 404 if the request has been declined. If no `userId` path segment was provided, this endpoint will instead return the status of the authenticated user."
  },
  "requestDelete": {
    "comment": "Delete User Account",
    "doc": "Delete User Account\n  Initiates the deletion process for the currently authenticated User, by sending a deletion confirmation email. The email contains a link that the user needs to visit in order to proceed with the deletion process."
  },
  "getWebhooks": {
    "comment": "Get a list of webhooks",
    "doc": "Get a list of webhooks\n  Get a list of webhooks"
  },
  "createWebhook": {
    "comment": "Creates a webhook",
    "doc": "Creates a webhook\n  Creates a webhook"
  },
  "deleteWebhook": {
    "comment": "Deletes a webhook",
    "doc": "Deletes a webhook\n  Deletes a webhook"
  },
  "getWebhook": {
    "comment": "Get a webhook",
    "doc": "Get a webhook\n  Get a webhook"
  },
  "addProjectDomain": {
    "comment": "Add a domain to a project",
    "doc": "Add a domain to a project\n  Add a domain to the project by passing its domain name and by specifying the project by either passing the project `id` or `name` in the URL. If the domain is not yet verified to be used on this project, the request will return `verified = false`, and the domain will need to be verified according to the `verification` challenge via `POST /projects/:idOrName/domains/:domain/verify`. If the domain already exists on the project, the request will fail with a `400` status code."
  },
  "createProjectEnv": {
    "comment": "Create one or more environment variables",
    "doc": "Create one or more environment variables\n  Create one ore more environment variables for a project by passing its `key`, `value`, `type` and `target` and by specifying the project by either passing the project `id` or `name` in the URL."
  },
  "listDeploymentBuilds": {
    "comment": "List Deployment Builds",
    "doc": "List Deployment Builds\n  Retrieves the list of builds given their deployment's unique identifier."
  },
  "cancelDeployment": {
    "comment": "Cancel a deployment",
    "doc": "Cancel a deployment\n  This endpoint allows you to cancel a deployment which is currently building, by supplying its `id` in the URL."
  },
  "createDeployment": {
    "comment": "Create a new deployment",
    "doc": "Create a new deployment\n  Create a new deployment with all the required and intended data. If the deployment is not a git deployment, all files must be provided with the request, either referenced or inlined. Additionally, a deployment id can be specified to redeploy a previous deployment."
  },
  "getDeployment": {
    "comment": "Get a deployment by ID or URL",
    "doc": "Get a deployment by ID or URL\n  Retrieves information for a deployment either by supplying its ID (`id` property) or Hostname (`url` property). Additional details will be included when the authenticated user is an owner of the deployment."
  },
  "deleteDeployment": {
    "comment": "Delete a Deployment",
    "doc": "Delete a Deployment\n  This API allows you to delete a deployment, either by supplying its `id` in the URL or the `url` of the deployment as a query parameter. You can obtain the ID, for example, by listing all deployments."
  },
  "deleteAlias": {
    "comment": "Delete an Alias",
    "doc": "Delete an Alias\n  Delete an Alias with the specified ID."
  },
  "getDeploymentEvents": {
    "comment": "Get deployment events",
    "doc": "Get deployment events\n  Get the build logs of a deployment by deployment ID and build ID. It can work as an infinite stream of logs or as a JSON endpoint depending on the input parameters."
  },
  "listDeploymentAliases": {
    "comment": "List Deployment Aliases",
    "doc": "List Deployment Aliases\n  Retrieves all Aliases for the Deployment with the given ID. The authenticated User must own the deployment."
  },
  "assignAlias": {
    "comment": "Assign an Alias",
    "doc": "Assign an Alias\n  Creates a new alias for the deployment with the given deployment ID. The authenticated user must own this deployment. If the desired alias is already assigned to another deployment, then it will be removed from the old deployment and assigned to the new one."
  },
  "createRecord": {
    "comment": "Create a DNS record",
    "doc": "Create a DNS record\n  Creates a DNS record for a domain."
  },
  "removeRecord": {
    "comment": "Delete a DNS record",
    "doc": "Delete a DNS record\n  Removes an existing DNS record from a domain name."
  },
  "uploadFile": {
    "comment": "Upload Deployment Files",
    "doc": "Upload Deployment Files\n  Before you create a deployment you need to upload the required files for that deployment. To do it, you need to first upload each file to this endpoint. Once that's completed, you can create a new deployment with the uploaded files. The file content must be placed inside the body of the request. In the case of a successful response you'll receive a status code 200 with an empty body."
  },
  "getIntegrationLogDrains": {
    "comment": "Retrieves a list of Integration log drains",
    "doc": "Retrieves a list of Integration log drains\n  Retrieves a list of all Integration log drains that are defined for the authorized account. When using an OAuth2 token, the list is limited to log drains created by the authenticated integration."
  },
  "createLogDrain": {
    "comment": "Creates a new Integration Log Drain",
    "doc": "Creates a new Integration Log Drain\n  Creates an Integration log drain. This endpoint must be called with an OAuth2 client (integration), since log drains are tied to integrations. If it is called with a different token type it will produce a 400 error."
  },
  "deleteSecret": {
    "comment": "Delete a secret",
    "doc": "Delete a secret\n  This deletes the user's secret defined in the URL."
  },
  "renameSecret": {
    "comment": "Change secret name",
    "doc": "Change secret name\n  Enables to edit the name of a user's secret. The name has to be unique to that user's secrets."
  },
  "createSecret": {
    "comment": "Create a new secret",
    "doc": "Create a new secret\n  Allows to create a new secret."
  },
  "getTeams": {
    "comment": "List all teams",
    "doc": "List all teams\n  Get a paginated list of all the Teams the authenticated User is a member of."
  },
  "getTeam": {
    "comment": "Get a Team",
    "doc": "Get a Team\n  Get information for the Team specified by the `teamId` parameter."
  },
  "patchTeam": {
    "comment": "Update a Team",
    "doc": "Update a Team\n  Update the information of a Team specified by the `teamId` parameter. The request body should contain the information that will be updated on the Team."
  },
  "getTeamMembers": {
    "comment": "List team members",
    "doc": "List team members\n  Get a paginated list of team members for the provided team."
  },
  "getAuthUser": {
    "comment": "Get the User",
    "doc": "Get the User\n  Retrieves information related to the currently authenticated User."
  },
  "listUserEvents": {
    "comment": "List User Events",
    "doc": "List User Events\n  Retrieves a list of \"events\" generated by the User on Vercel. Events are generated when the User performs a particular action, such as logging in, creating a deployment, and joining a Team (just to name a few). When the `teamId` parameter is supplied, then the events that are returned will be in relation to the Team that was specified."
  },
  "getSecrets": {
    "comment": "List secrets",
    "doc": "List secrets\n  Retrieves the active Vercel secrets for the authenticated user. By default it returns 20 secrets. The rest can be retrieved using the pagination options. The body will contain an entry for each secret."
  },
  "getSecret": {
    "comment": "Get a single secret",
    "doc": "Get a single secret\n  Retrieves the information for a specific secret by passing either the secret id or name in the URL."
  },
  "createAuthToken": {
    "comment": "Create an Auth Token",
    "doc": "Create an Auth Token\n  Creates and returns a new authentication token for the currently authenticated User. The `bearerToken` property is only provided once, in the response body, so be sure to save it on the client for use with API requests."
  },
  "deleteAuthToken": {
    "comment": "Delete an authentication token",
    "doc": "Delete an authentication token\n  Invalidate an authentication token, such that it will no longer be valid for future HTTP requests."
  },
  "listAliases": {
    "comment": "List aliases",
    "doc": "List aliases\n  Retrieves a list of aliases for the authenticated User or Team. When `domain` is provided, only aliases for that domain will be returned. When `projectId` is provided, it will only return the given project aliases."
  },
  "getAlias": {
    "comment": "Get an Alias",
    "doc": "Get an Alias\n  Retrieves an Alias for the given host name or alias ID."
  },
  "buyDomain": {
    "comment": "Purchase a domain",
    "doc": "Purchase a domain\n  Allows to purchase the specified domain."
  },
  "checkDomainPrice": {
    "comment": "Check the price for a domain",
    "doc": "Check the price for a domain\n  Check the price to purchase a domain and how long a single purchase period is."
  },
  "checkDomainStatus": {
    "comment": "Check a Domain Availability",
    "doc": "Check a Domain Availability\n  Check if a domain name is available for purchase."
  },
  "getRecords": {
    "comment": "List existing DNS records",
    "doc": "List existing DNS records\n  Retrieves a list of DNS records created for a domain name. By default it returns 20 records if no limit is provided. The rest can be retrieved using the pagination options."
  },
  "getDomains": {
    "comment": "List all the domains",
    "doc": "List all the domains\n  Retrieves a list of domains registered for the authenticating user. By default it returns the last 20 domains if no limit is provided."
  },
  "createOrTransferDomain": {
    "comment": "Register or transfer-in a new Domain",
    "doc": "Register or transfer-in a new Domain\n  This endpoint is used for registering a new domain name with Vercel for the authenticating user, and also for initiating a domain transfer request from an external Registrar to Vercel."
  },
  "getDomain": {
    "comment": "Get Information for a Single Domain",
    "doc": "Get Information for a Single Domain\n  Get information for a single domain in an account or team."
  },
  "listAuthTokens": {
    "comment": "List Auth Tokens",
    "doc": "List Auth Tokens\n  Retrieve a list of the current User's authentication tokens."
  },
  "getAuthToken": {
    "comment": "Get Auth Token Metadata",
    "doc": "Get Auth Token Metadata\n  Retrieve metadata about an authentication token belonging to the currently authenticated User."
  },
  "getDeployments": {
    "comment": "List deployments",
    "doc": "List deployments\n  List deployments under the account corresponding to the API token. If a deployment hasn't finished uploading (is incomplete), the `url` property will have a value of `null`."
  },
  "listDeploymentFiles": {
    "comment": "List Deployment Files",
    "doc": "List Deployment Files\n  Allows to retrieve the file structure of a deployment by supplying the deployment unique identifier."
  },
  "getDeploymentFileContents": {
    "comment": "Get Deployment File Contents",
    "doc": "Get Deployment File Contents\n  Allows to retrieve the content of a file by supplying the file identifier and the deployment unique identifier. The response body will contain the raw content of the file."
  },
  "deleteDomain": {
    "comment": "Remove a domain by name",
    "doc": "Remove a domain by name\n  Delete a previously registered domain name from Vercel. Deleting a domain will automatically remove any associated aliases."
  },
  "getDomainConfig": {
    "comment": "Get a Domain's configuration",
    "doc": "Get a Domain's configuration\n  Get a Domain's configuration."
  },
  "issueCert": {
    "comment": "Issue a new cert",
    "doc": "Issue a new cert\n  Issue a new cert"
  },
  "uploadCert": {
    "comment": "Upload a cert",
    "doc": "Upload a cert\n  Upload a cert"
  },
  "removeCert": {
    "comment": "Remove cert",
    "doc": "Remove cert\n  Remove cert"
  },
  "getCertById": {
    "comment": "Get cert by id",
    "doc": "Get cert by id\n  Get cert by id"
  },
  "artifactQuery": {
    "comment": "Query information about an artifact",
    "doc": "Query information about an artifact\n  Query information about an array of artifacts."
  },
  "recordEvents": {
    "comment": "Record an artifacts cache usage event",
    "doc": "Record an artifacts cache usage event\n  Records an artifacts cache usage event. The body of this request is an array of cache usage events. The supported event types are `HIT` and `MISS`. The source is either `LOCAL` the cache event was on the users filesystem cache or `REMOTE` if the cache event is for a remote cache. When the event is a `HIT` the request also accepts a number `duration` which is the time taken to generate the artifact in the cache."
  },
  "status": {
    "comment": "Get status of Remote Caching for this principal",
    "doc": "Get status of Remote Caching for this principal\n  Check the status of Remote Caching for this principal. Returns a JSON-encoded status indicating if Remote Caching is enabled, disabled, or disabled due to usage limits."
  },
  "downloadArtifact": {
    "comment": "Download a cache artifact",
    "doc": "Download a cache artifact\n  Downloads a cache artifact indentified by its `hash` specified on the request path. The artifact is downloaded as an octet-stream. The client should verify the content-length header and response body."
  },
  "artifactExists": {
    "comment": "Check if a cache artifact exists",
    "doc": "Check if a cache artifact exists\n  Check that a cache artifact with the given `hash` exists. This request returns response headers only and is equivalent to a `GET` request to this endpoint where the response contains no body."
  },
  "uploadArtifact": {
    "comment": "Upload a cache artifact",
    "doc": "Upload a cache artifact\n  Uploads a cache artifact identified by the `hash` specified on the path. The cache artifact can then be downloaded with the provided `hash`."
  },
  "getProjects": {
    "comment": "Retrieve a list of projects",
    "doc": "Retrieve a list of projects\n  Allows to retrieve the list of projects of the authenticated user. The list will be paginated and the provided query parameters allow filtering the returned projects."
  },
  "createProject": {
    "comment": "Create a new project",
    "doc": "Create a new project\n  Allows to create a new project with the provided configuration. It only requires the project `name` but more configuration can be provided to override the defaults."
  },
  "deleteProject": {
    "comment": "Delete a Project",
    "doc": "Delete a Project\n  Delete a specific project by passing either the project `id` or `name` in the URL."
  },
  "getProject": {
    "comment": "Find a project by id or name",
    "doc": "Find a project by id or name\n  Get the information for a specific project by passing either the project `id` or `name` in the URL."
  },
  "updateProject": {
    "comment": "Update an existing project",
    "doc": "Update an existing project\n  Update the fields of a project using either its `name` or `id`."
  },
  "getProjectDomains": {
    "comment": "Retrieve project domains by project by id or name",
    "doc": "Retrieve project domains by project by id or name\n  Retrieve the domains associated with a given project by passing either the project `id` or `name` in the URL."
  },
  "removeProjectDomain": {
    "comment": "Remove a domain from a project",
    "doc": "Remove a domain from a project\n  Remove a domain from a project by passing the domain name and by specifying the project by either passing the project `id` or `name` in the URL."
  },
  "getProjectDomain": {
    "comment": "Get a project domain",
    "doc": "Get a project domain\n  Get project domain by project id/name and domain name."
  },
  "updateProjectDomain": {
    "comment": "Update a project domain",
    "doc": "Update a project domain\n  Update a project domain's configuration, including the name, git branch and redirect of the domain."
  },
  "verifyProjectDomain": {
    "comment": "Verify project domain",
    "doc": "Verify project domain\n  Attempts to verify a project domain with `verified = false` by checking the correctness of the project domain's `verification` challenge."
  },
  "filterProjectEnvs": {
    "comment": "Retrieve the environment variables of a project by id or name",
    "doc": "Retrieve the environment variables of a project by id or name\n  Retrieve the environment variables for a given project by passing either the project `id` or `name` in the URL."
  },
  "removeProjectEnv": {
    "comment": "Remove an environment variable",
    "doc": "Remove an environment variable\n  Delete a specific environment variable for a given project by passing the environment variable identifier and either passing the project `id` or `name` in the URL."
  },
  "editProjectEnv": {
    "comment": "Edit an environment variable",
    "doc": "Edit an environment variable\n  Edit a specific environment variable for a given project by passing the environment variable identifier and either passing the project `id` or `name` in the URL."
  }
}