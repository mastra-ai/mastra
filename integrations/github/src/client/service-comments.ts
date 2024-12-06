export const comments = {
  metaRoot: {
    comment: 'GitHub API Root',
    doc: "GitHub API Root\n  Get Hypermedia links to resources accessible in GitHub's REST API",
  },
  appsGetAuthenticated: {
    comment: 'Get the authenticated app',
    doc: 'Get the authenticated app\n  Returns the GitHub App associated with the authentication credentials used. To see how many app installations are associated with this GitHub App, see the `installations_count` in the response. For more details about your app\'s installations, see the "[List installations for the authenticated app](https://docs.github.com/rest/reference/apps#list-installations-for-the-authenticated-app)" endpoint.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsCreateFromManifest: {
    comment: 'Create a GitHub App from a manifest',
    doc: "Create a GitHub App from a manifest\n  Use this endpoint to complete the handshake necessary when implementing the [GitHub App Manifest flow](https://docs.github.com/apps/building-github-apps/creating-github-apps-from-a-manifest/). When you create a GitHub App with the manifest flow, you receive a temporary `code` used to retrieve the GitHub App's `id`, `pem` (private key), and `webhook_secret`.",
  },
  appsGetWebhookConfigForApp: {
    comment: 'Get a webhook configuration for an app',
    doc: 'Get a webhook configuration for an app\n  Returns the webhook configuration for a GitHub App. For more information about configuring a webhook for your app, see "[Creating a GitHub App](/developers/apps/creating-a-github-app)."\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsUpdateWebhookConfigForApp: {
    comment: 'Update a webhook configuration for an app',
    doc: 'Update a webhook configuration for an app\n  Updates the webhook configuration for a GitHub App. For more information about configuring a webhook for your app, see "[Creating a GitHub App](/developers/apps/creating-a-github-app)."\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsListWebhookDeliveries: {
    comment: 'List deliveries for an app webhook',
    doc: 'List deliveries for an app webhook\n  Returns a list of webhook deliveries for the webhook configured for a GitHub App.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsGetWebhookDelivery: {
    comment: 'Get a delivery for an app webhook',
    doc: 'Get a delivery for an app webhook\n  Returns a delivery for the webhook configured for a GitHub App.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsRedeliverWebhookDelivery: {
    comment: 'Redeliver a delivery for an app webhook',
    doc: 'Redeliver a delivery for an app webhook\n  Redeliver a delivery for the webhook configured for a GitHub App.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsListInstallations: {
    comment: 'List installations for the authenticated app',
    doc: 'List installations for the authenticated app\n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.\n \n  The permissions the installation has are included under the `permissions` key.',
  },
  appsDeleteInstallation: {
    comment: 'Delete an installation for the authenticated app',
    doc: 'Delete an installation for the authenticated app\n  Uninstalls a GitHub App on a user, organization, or business account. If you prefer to temporarily suspend an app\'s access to your account\'s resources, then we recommend the "[Suspend an app installation](https://docs.github.com/rest/reference/apps/#suspend-an-app-installation)" endpoint.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsGetInstallation: {
    comment: 'Get an installation for the authenticated app',
    doc: "Get an installation for the authenticated app\n  Enables an authenticated GitHub App to find an installation's information using the installation id.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.",
  },
  appsCreateInstallationAccessToken: {
    comment: 'Create an installation access token for an app',
    doc: "Create an installation access token for an app\n  Creates an installation access token that enables a GitHub App to make authenticated API requests for the app's installation on an organization or individual account. Installation tokens expire one hour from the time you create them. Using an expired token produces a status code of `401 - Unauthorized`, and requires creating a new installation token. By default the installation token has access to all repositories that the installation can access. To restrict the access to specific repositories, you can provide the `repository_ids` when creating the token. When you omit `repository_ids`, the response does not contain the `repositories` key.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.",
  },
  appsUnsuspendInstallation: {
    comment: 'Unsuspend an app installation',
    doc: 'Unsuspend an app installation\n  Removes a GitHub App installation suspension.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  appsSuspendInstallation: {
    comment: 'Suspend an app installation',
    doc: "Suspend an app installation\n  Suspends a GitHub App on a user, organization, or business account, which blocks the app from accessing the account's resources. When a GitHub App is suspended, the app's access to the GitHub API or webhook events is blocked for that account.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.",
  },
  appsDeleteAuthorization: {
    comment: 'Delete an app authorization',
    doc: "Delete an app authorization\n  OAuth application owners can revoke a grant for their OAuth application and a specific user. You must use [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) when accessing this endpoint, using the OAuth application's `client_id` and `client_secret` as the username and password. You must also provide a valid OAuth `access_token` as an input parameter and the grant for the token's owner will be deleted.\n  Deleting an OAuth application's grant will also delete all OAuth tokens associated with the application for the user. Once deleted, the application will have no access to the user's account and will no longer be listed on [the application authorizations settings screen within GitHub](https://github.com/settings/applications#authorized).",
  },
  appsDeleteToken: {
    comment: 'Delete an app token',
    doc: "Delete an app token\n  OAuth application owners can revoke a single token for an OAuth application. You must use [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) when accessing this endpoint, using the OAuth application's `client_id` and `client_secret` as the username and password.",
  },
  appsResetToken: {
    comment: 'Reset a token',
    doc: 'Reset a token\n  OAuth applications can use this API method to reset a valid OAuth token without end-user involvement. Applications must save the "token" property in the response because changes take effect immediately. You must use [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) when accessing this endpoint, using the OAuth application\'s `client_id` and `client_secret` as the username and password. Invalid tokens will return `404 NOT FOUND`.',
  },
  appsCheckToken: {
    comment: 'Check a token',
    doc: 'Check a token\n  OAuth applications can use a special API method for checking OAuth token validity without exceeding the normal rate limits for failed login attempts. Authentication works differently with this particular endpoint. You must use [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) to use this endpoint, where the username is the OAuth application `client_id` and the password is its `client_secret`. Invalid tokens will return `404 NOT FOUND`.',
  },
  appsScopeToken: {
    comment: 'Create a scoped access token',
    doc: 'Create a scoped access token\n  Use a non-scoped user-to-server access token to create a repository scoped and/or permission scoped user-to-server access token. You can specify which repositories the token can access and which permissions are granted to the token. You must use [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) when accessing this endpoint, using the `client_id` and `client_secret` of the GitHub App as the username and password. Invalid tokens will return `404 NOT FOUND`.',
  },
  appsGetBySlug: {
    comment: 'Get an app',
    doc: 'Get an app\n  Note: The `:app_slug` is just the URL-friendly name of your GitHub App. You can find this on the settings page for your GitHub App (e.g., `https://github.com/settings/apps/:app_slug`).\n \n  If the GitHub App you specify is public, you can access this endpoint without authenticating. If the GitHub App you specify is private, you must authenticate with a [personal access token](https://docs.github.com/articles/creating-a-personal-access-token-for-the-command-line/) or an [installation access token](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-an-installation) to access this endpoint.',
  },
  codesOfConductGetAllCodesOfConduct: {
    comment: 'Get all codes of conduct',
    doc: 'Get all codes of conduct',
  },
  codesOfConductGetConductCode: {
    comment: 'Get a code of conduct',
    doc: 'Get a code of conduct',
  },
  emojisGet: {
    comment: 'Get emojis',
    doc: 'Get emojis\n  Lists all the emojis available to use on GitHub.',
  },
  dependabotListAlertsForEnterprise: {
    comment: 'List Dependabot alerts for an enterprise',
    doc: 'List Dependabot alerts for an enterprise\n  Lists Dependabot alerts for repositories that are owned by the specified enterprise.\n  To use this endpoint, you must be a member of the enterprise, and you must use an\n  access token with the `repo` scope or `security_events` scope.\n  Alerts are only returned for organizations in the enterprise for which you are an organization owner or a security manager. For more information about security managers, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."',
  },
  secretScanningListAlertsForEnterprise: {
    comment: 'List secret scanning alerts for an enterprise',
    doc: 'List secret scanning alerts for an enterprise\n  Lists secret scanning alerts for eligible repositories in an enterprise, from newest to oldest.\n  To use this endpoint, you must be a member of the enterprise, and you must use an access token with the `repo` scope or `security_events` scope. Alerts are only returned for organizations in the enterprise for which you are an organization owner or a [security manager](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization).',
  },
  activityListPublicEvents: {
    comment: 'List public events',
    doc: 'List public events\n  We delay the public events feed by five minutes, which means the most recent event returned by the public events API actually occurred at least five minutes ago.',
  },
  activityGetFeeds: {
    comment: 'Get feeds',
    doc: 'Get feeds\n  GitHub provides several timeline resources in [Atom](http://en.wikipedia.org/wiki/Atom_(standard)) format. The Feeds API lists all the feeds available to the authenticated user:\n \n     Timeline: The GitHub global public timeline\n     User: The public timeline for any user, using [URI template](https://docs.github.com/rest/overview/resources-in-the-rest-api#hypermedia)\n     Current user public: The public timeline for the authenticated user\n     Current user: The private timeline for the authenticated user\n     Current user actor: The private timeline for activity created by the authenticated user\n     Current user organizations: The private timeline for the organizations the authenticated user is a member of.\n     Security advisories: A collection of public announcements that provide information about security-related vulnerabilities in software on GitHub.\n \n  Note: Private feeds are only returned when [authenticating via Basic Auth](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) since current feed URIs use the older, non revocable auth tokens.',
  },
  gistsList: {
    comment: 'List gists for the authenticated user',
    doc: "List gists for the authenticated user\n  Lists the authenticated user's gists or if called anonymously, this endpoint returns all public gists:",
  },
  gistsCreate: {
    comment: 'Create a gist',
    doc: 'Create a gist\n  Allows you to add a new gist with one or more files.\n \n  Note: Don\'t name your files "gistfile" with a numerical suffix. This is the format of the automatic naming scheme that Gist uses internally.',
  },
  gistsListPublic: {
    comment: 'List public gists',
    doc: 'List public gists\n  List public gists sorted by most recently updated to least recently updated.\n \n  Note: With [pagination](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination), you can fetch up to 3000 gists. For example, you can fetch 100 pages with 30 gists per page or 30 pages with 100 gists per page.',
  },
  gistsListStarred: {
    comment: 'List starred gists',
    doc: "List starred gists\n  List the authenticated user's starred gists:",
  },
  gistsDelete: {
    comment: 'Delete a gist',
    doc: 'Delete a gist',
  },
  gistsGet: {
    comment: 'Get a gist',
    doc: 'Get a gist',
  },
  gistsUpdate: {
    comment: 'Update a gist',
    doc: "Update a gist\n  Allows you to update a gist's description and to update, delete, or rename gist files. Files from the previous version of the gist that aren't explicitly changed during an edit are unchanged.",
  },
  gistsListComments: {
    comment: 'List gist comments',
    doc: 'List gist comments',
  },
  gistsCreateComment: {
    comment: 'Create a gist comment',
    doc: 'Create a gist comment',
  },
  gistsDeleteComment: {
    comment: 'Delete a gist comment',
    doc: 'Delete a gist comment',
  },
  gistsGetComment: {
    comment: 'Get a gist comment',
    doc: 'Get a gist comment',
  },
  gistsUpdateComment: {
    comment: 'Update a gist comment',
    doc: 'Update a gist comment',
  },
  gistsListCommits: {
    comment: 'List gist commits',
    doc: 'List gist commits',
  },
  gistsListForks: {
    comment: 'List gist forks',
    doc: 'List gist forks',
  },
  gistsFork: {
    comment: 'Fork a gist',
    doc: 'Fork a gist',
  },
  gistsUnstar: {
    comment: 'Unstar a gist',
    doc: 'Unstar a gist',
  },
  gistsCheckIsStarred: {
    comment: 'Check if a gist is starred',
    doc: 'Check if a gist is starred',
  },
  gistsStar: {
    comment: 'Star a gist',
    doc: 'Star a gist\n  Note that you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  gistsGetRevision: {
    comment: 'Get a gist revision',
    doc: 'Get a gist revision',
  },
  gitignoreGetAllTemplates: {
    comment: 'Get all gitignore templates',
    doc: 'Get all gitignore templates\n  List all templates available to pass as an option when [creating a repository](https://docs.github.com/rest/reference/repos#create-a-repository-for-the-authenticated-user).',
  },
  gitignoreGetTemplate: {
    comment: 'Get a gitignore template',
    doc: 'Get a gitignore template\n  The API also allows fetching the source of a single template.\n  Use the raw [media type](https://docs.github.com/rest/overview/media-types/) to get the raw contents.',
  },
  appsListReposAccessibleToInstallation: {
    comment: 'List repositories accessible to the app installation',
    doc: 'List repositories accessible to the app installation\n  List repositories that an app installation can access.\n \n  You must use an [installation access token](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-an-installation) to access this endpoint.',
  },
  appsRevokeInstallationAccessToken: {
    comment: 'Revoke an installation access token',
    doc: 'Revoke an installation access token\n  Revokes the installation token you\'re using to authenticate as an installation and access this endpoint.\n \n  Once an installation token is revoked, the token is invalidated and cannot be used. Other endpoints that require the revoked installation token must have a new installation token to work. You can create a new token using the "[Create an installation access token for an app](https://docs.github.com/rest/reference/apps#create-an-installation-access-token-for-an-app)" endpoint.\n \n  You must use an [installation access token](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-an-installation) to access this endpoint.',
  },
  issuesList: {
    comment: 'List issues assigned to the authenticated user',
    doc: 'List issues assigned to the authenticated user\n  List issues assigned to the authenticated user across all visible repositories including owned repositories, member\n  repositories, and organization repositories. You can use the `filter` query parameter to fetch issues that are not\n  necessarily assigned to you.\n \n \n  Note: GitHub\'s REST API considers every pull request an issue, but not every issue is a pull request. For this\n  reason, "Issues" endpoints may return both issues and pull requests in the response. You can identify pull requests by\n  the `pull_request` key. Be aware that the `id` of a pull request returned from "Issues" endpoints will be an _issue id_. To find out the pull\n  request id, use the "[List pull requests](https://docs.github.com/rest/reference/pulls#list-pull-requests)" endpoint.',
  },
  licensesGetAllCommonlyUsed: {
    comment: 'Get all commonly used licenses',
    doc: 'Get all commonly used licenses',
  },
  licensesGet: {
    comment: 'Get a license',
    doc: 'Get a license',
  },
  markdownRender: {
    comment: 'Render a Markdown document',
    doc: 'Render a Markdown document',
  },
  markdownRenderRaw: {
    comment: 'Render a Markdown document in raw mode',
    doc: 'Render a Markdown document in raw mode\n  You must send Markdown as plain text (using a `Content-Type` header of `text/plain` or `text/x-markdown`) to this endpoint, rather than using JSON format. In raw mode, [GitHub Flavored Markdown](https://github.github.com/gfm/) is not supported and Markdown will be rendered in plain format like a README.md file. Markdown content must be 400 KB or less.',
  },
  appsGetSubscriptionPlanForAccount: {
    comment: 'Get a subscription plan for an account',
    doc: "Get a subscription plan for an account\n  Shows whether the user or organization account actively subscribes to a plan listed by the authenticated GitHub App. When someone submits a plan change that won't be processed until the end of their billing cycle, you will also see the upcoming pending change.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.",
  },
  appsListPlans: {
    comment: 'List plans',
    doc: 'List plans\n  Lists all plans that are part of your GitHub Marketplace listing.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.',
  },
  appsListAccountsForPlan: {
    comment: 'List accounts for a plan',
    doc: "List accounts for a plan\n  Returns user and organization accounts associated with the specified plan, including free plans. For per-seat pricing, you see the list of accounts that have purchased the plan, including the number of seats purchased. When someone submits a plan change that won't be processed until the end of their billing cycle, you will also see the upcoming pending change.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.",
  },
  appsGetSubscriptionPlanForAccountStubbed: {
    comment: 'Get a subscription plan for an account (stubbed)',
    doc: "Get a subscription plan for an account (stubbed)\n  Shows whether the user or organization account actively subscribes to a plan listed by the authenticated GitHub App. When someone submits a plan change that won't be processed until the end of their billing cycle, you will also see the upcoming pending change.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.",
  },
  appsListPlansStubbed: {
    comment: 'List plans (stubbed)',
    doc: 'List plans (stubbed)\n  Lists all plans that are part of your GitHub Marketplace listing.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.',
  },
  appsListAccountsForPlanStubbed: {
    comment: 'List accounts for a plan (stubbed)',
    doc: "List accounts for a plan (stubbed)\n  Returns repository and organization accounts associated with the specified plan, including free plans. For per-seat pricing, you see the list of accounts that have purchased the plan, including the number of seats purchased. When someone submits a plan change that won't be processed until the end of their billing cycle, you will also see the upcoming pending change.\n \n  GitHub Apps must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint. OAuth Apps must use [basic authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication) with their client ID and client secret to access this endpoint.",
  },
  metaGet: {
    comment: 'Get GitHub meta information',
    doc: "Get GitHub meta information\n  Returns meta information about GitHub, including a list of GitHub's IP addresses. For more information, see \"[About GitHub's IP addresses](https://docs.github.com/articles/about-github-s-ip-addresses/).\"\n \n  Note: This endpoint returns both IPv4 and IPv6 addresses. However, not all features support IPv6. You should refer to the specific documentation for each feature to determine if IPv6 is supported.\n \n  Note: The IP addresses shown in the documentation's response are only example values. You must always query the API directly to get the latest list of IP addresses.",
  },
  activityListPublicEventsForRepoNetwork: {
    comment: 'List public events for a network of repositories',
    doc: 'List public events for a network of repositories',
  },
  activityListNotificationsForAuthenticatedUser: {
    comment: 'List notifications for the authenticated user',
    doc: 'List notifications for the authenticated user\n  List all notifications for the current user, sorted by most recently updated.',
  },
  activityMarkNotificationsAsRead: {
    comment: 'Mark notifications as read',
    doc: 'Mark notifications as read\n  Marks all notifications as "read" for the current user. If the number of notifications is too large to complete in one request, you will receive a `202 Accepted` status and GitHub will run an asynchronous process to mark notifications as "read." To check whether any "unread" notifications remain, you can use the [List notifications for the authenticated user](https://docs.github.com/rest/reference/activity#list-notifications-for-the-authenticated-user) endpoint and pass the query parameter `all=false`.',
  },
  activityGetThread: {
    comment: 'Get a thread',
    doc: 'Get a thread\n  Gets information about a notification thread.',
  },
  activityMarkThreadAsRead: {
    comment: 'Mark a thread as read',
    doc: 'Mark a thread as read\n  Marks a thread as "read." Marking a thread as "read" is equivalent to clicking a notification in your notification inbox on GitHub: https://github.com/notifications.',
  },
  activityDeleteThreadSubscription: {
    comment: 'Delete a thread subscription',
    doc: 'Delete a thread subscription\n  Mutes all future notifications for a conversation until you comment on the thread or get an @mention. If you are watching the repository of the thread, you will still receive notifications. To ignore future notifications for a repository you are watching, use the [Set a thread subscription](https://docs.github.com/rest/reference/activity#set-a-thread-subscription) endpoint and set `ignore` to `true`.',
  },
  activityGetThreadSubscriptionForAuthenticatedUser: {
    comment: 'Get a thread subscription for the authenticated user',
    doc: "Get a thread subscription for the authenticated user\n  This checks to see if the current user is subscribed to a thread. You can also [get a repository subscription](https://docs.github.com/rest/reference/activity#get-a-repository-subscription).\n \n  Note that subscriptions are only generated if a user is participating in a conversation--for example, they've replied to the thread, were @mentioned, or manually subscribe to a thread.",
  },
  activitySetThreadSubscription: {
    comment: 'Set a thread subscription',
    doc: 'Set a thread subscription\n  If you are watching a repository, you receive notifications for all threads by default. Use this endpoint to ignore future notifications for threads until you comment on the thread or get an @mention.\n \n  You can also use this endpoint to subscribe to threads that you are currently not receiving notifications for or to subscribed to threads that you have previously ignored.\n \n  Unsubscribing from a conversation in a repository that you are not watching is functionally equivalent to the [Delete a thread subscription](https://docs.github.com/rest/reference/activity#delete-a-thread-subscription) endpoint.',
  },
  metaGetOctocat: {
    comment: 'Get Octocat',
    doc: 'Get Octocat\n  Get the octocat as ASCII art',
  },
  orgsList: {
    comment: 'List organizations',
    doc: 'List organizations\n  Lists all organizations, in the order that they were created on GitHub.\n \n  Note: Pagination is powered exclusively by the `since` parameter. Use the [Link header](https://docs.github.com/rest/overview/resources-in-the-rest-api#link-header) to get the URL for the next page of organizations.',
  },
  orgsGet: {
    comment: 'Get an organization',
    doc: 'Get an organization\n  To see many of the organization response values, you need to be an authenticated organization owner with the `admin:org` scope. When the value of `two_factor_requirement_enabled` is `true`, the organization requires all members, billing managers, and outside collaborators to enable [two-factor authentication](https://docs.github.com/articles/securing-your-account-with-two-factor-authentication-2fa/).\n \n  GitHub Apps with the `Organization plan` permission can use this endpoint to retrieve information about an organization\'s GitHub plan. See "[Authenticating with GitHub Apps](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/)" for details. For an example response, see \'Response with GitHub plan information\' below."',
  },
  orgsUpdate: {
    comment: 'Update an organization',
    doc: "Update an organization\n  Parameter Deprecation Notice: GitHub will replace and discontinue `members_allowed_repository_creation_type` in favor of more granular permissions. The new input parameters are `members_can_create_public_repositories`, `members_can_create_private_repositories` for all organizations and `members_can_create_internal_repositories` for organizations associated with an enterprise account using GitHub Enterprise Cloud or GitHub Enterprise Server 2.20+. For more information, see the [blog post](https://developer.github.com/changes/2019-12-03-internal-visibility-changes).\n \n  Enables an authenticated organization owner with the `admin:org` scope to update the organization's profile and member privileges.",
  },
  actionsGetActionsCacheUsageForOrg: {
    comment: 'Get GitHub Actions cache usage for an organization',
    doc: 'Get GitHub Actions cache usage for an organization\n  Gets the total GitHub Actions cache usage for an organization.\n  The data fetched using this API is refreshed approximately every 5 minutes, so values returned from this endpoint may take at least 5 minutes to get updated.\n  You must authenticate using an access token with the `read:org` scope to use this endpoint. GitHub Apps must have the `organization_admistration:read` permission to use this endpoint.',
  },
  actionsGetActionsCacheUsageByRepoForOrg: {
    comment: 'List repositories with GitHub Actions cache usage for an organization',
    doc: 'List repositories with GitHub Actions cache usage for an organization\n  Lists repositories and their GitHub Actions cache usage for an organization.\n  The data fetched using this API is refreshed approximately every 5 minutes, so values returned from this endpoint may take at least 5 minutes to get updated.\n  You must authenticate using an access token with the `read:org` scope to use this endpoint. GitHub Apps must have the `organization_admistration:read` permission to use this endpoint.',
  },
  oidcGetOidcCustomSubTemplateForOrg: {
    comment: 'Get the customization template for an OIDC subject claim for an organization',
    doc: 'Get the customization template for an OIDC subject claim for an organization\n  Gets the customization template for an OpenID Connect (OIDC) subject claim.\n  You must authenticate using an access token with the `read:org` scope to use this endpoint.\n  GitHub Apps must have the `organization_administration:write` permission to use this endpoint.',
  },
  oidcUpdateOidcCustomSubTemplateForOrg: {
    comment: 'Set the customization template for an OIDC subject claim for an organization',
    doc: 'Set the customization template for an OIDC subject claim for an organization\n  Creates or updates the customization template for an OpenID Connect (OIDC) subject claim.\n  You must authenticate using an access token with the `write:org` scope to use this endpoint.\n  GitHub Apps must have the `admin:org` permission to use this endpoint.',
  },
  actionsGetGithubActionsPermissionsOrganization: {
    comment: 'Get GitHub Actions permissions for an organization',
    doc: 'Get GitHub Actions permissions for an organization\n  Gets the GitHub Actions permissions policy for repositories and allowed actions and reusable workflows in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsSetGithubActionsPermissionsOrganization: {
    comment: 'Set GitHub Actions permissions for an organization',
    doc: 'Set GitHub Actions permissions for an organization\n  Sets the GitHub Actions permissions policy for repositories and allowed actions and reusable workflows in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsListSelectedRepositoriesEnabledGithubActionsOrganization: {
    comment: 'List selected repositories enabled for GitHub Actions in an organization',
    doc: 'List selected repositories enabled for GitHub Actions in an organization\n  Lists the selected repositories that are enabled for GitHub Actions in an organization. To use this endpoint, the organization permission policy for `enabled_repositories` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsSetSelectedRepositoriesEnabledGithubActionsOrganization: {
    comment: 'Set selected repositories enabled for GitHub Actions in an organization',
    doc: 'Set selected repositories enabled for GitHub Actions in an organization\n  Replaces the list of selected repositories that are enabled for GitHub Actions in an organization. To use this endpoint, the organization permission policy for `enabled_repositories` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsDisableSelectedRepositoryGithubActionsOrganization: {
    comment: 'Disable a selected repository for GitHub Actions in an organization',
    doc: 'Disable a selected repository for GitHub Actions in an organization\n  Removes a repository from the list of selected repositories that are enabled for GitHub Actions in an organization. To use this endpoint, the organization permission policy for `enabled_repositories` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsEnableSelectedRepositoryGithubActionsOrganization: {
    comment: 'Enable a selected repository for GitHub Actions in an organization',
    doc: 'Enable a selected repository for GitHub Actions in an organization\n  Adds a repository to the list of selected repositories that are enabled for GitHub Actions in an organization. To use this endpoint, the organization permission policy for `enabled_repositories` must be must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsGetAllowedActionsOrganization: {
    comment: 'Get allowed actions and reusable workflows for an organization',
    doc: 'Get allowed actions and reusable workflows for an organization\n  Gets the selected actions and reusable workflows that are allowed in an organization. To use this endpoint, the organization permission policy for `allowed_actions` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization).""\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsSetAllowedActionsOrganization: {
    comment: 'Set allowed actions and reusable workflows for an organization',
    doc: 'Set allowed actions and reusable workflows for an organization\n  Sets the actions and reusable workflows that are allowed in an organization. To use this endpoint, the organization permission policy for `allowed_actions` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for an organization](#set-github-actions-permissions-for-an-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsGetGithubActionsDefaultWorkflowPermissionsOrganization: {
    comment: 'Get default workflow permissions for an organization',
    doc: 'Get default workflow permissions for an organization\n  Gets the default workflow permissions granted to the `GITHUB_TOKEN` when running workflows in an organization,\n  as well as whether GitHub Actions can submit approving pull request reviews. For more information, see\n  "[Setting the permissions of the GITHUB_TOKEN for your organization](https://docs.github.com/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization#setting-the-permissions-of-the-github_token-for-your-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsSetGithubActionsDefaultWorkflowPermissionsOrganization: {
    comment: 'Set default workflow permissions for an organization',
    doc: 'Set default workflow permissions for an organization\n  Sets the default workflow permissions granted to the `GITHUB_TOKEN` when running workflows in an organization, and sets if GitHub Actions\n  can submit approving pull request reviews. For more information, see\n  "[Setting the permissions of the GITHUB_TOKEN for your organization](https://docs.github.com/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization#setting-the-permissions-of-the-github_token-for-your-organization)."\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this API.',
  },
  actionsListRequiredWorkflows: {
    comment: 'List required workflows',
    doc: 'List required workflows\n  List all required workflows in an organization.\n \n  You must authenticate using an access token with the `read:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsCreateRequiredWorkflow: {
    comment: 'Create a required workflow',
    doc: 'Create a required workflow\n  Create a required workflow in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsDeleteRequiredWorkflow: {
    comment: 'Delete a required workflow',
    doc: 'Delete a required workflow\n  Deletes a required workflow configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsGetRequiredWorkflow: {
    comment: 'Get a required workflow',
    doc: 'Get a required workflow\n  Get a required workflow configured in an organization.\n \n  You must authenticate using an access token with the `read:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsUpdateRequiredWorkflow: {
    comment: 'Update a required workflow',
    doc: 'Update a required workflow\n  Update a required workflow in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsListSelectedRepositoriesRequiredWorkflow: {
    comment: 'List selected repositories for a required workflow',
    doc: 'List selected repositories for a required workflow\n  Lists the selected repositories that are configured for a required workflow in an organization. To use this endpoint, the required workflow must be configured to run on selected repositories.\n \n  You must authenticate using an access token with the `read:org` scope to use this endpoint. GitHub Apps must have the `administration` organization permission to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsSetSelectedReposToRequiredWorkflow: {
    comment: 'Sets repositories for a required workflow',
    doc: 'Sets repositories for a required workflow\n  Sets the repositories for a required workflow that is required for selected repositories.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsRemoveSelectedRepoFromRequiredWorkflow: {
    comment: 'Remove a selected repository from required workflow',
    doc: 'Remove a selected repository from required workflow\n  Removes a repository from a required workflow. To use this endpoint, the required workflow must be configured to run on selected repositories.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsAddSelectedRepoToRequiredWorkflow: {
    comment: 'Add a repository to a required workflow',
    doc: 'Add a repository to a required workflow\n  Adds a repository to a required workflow. To use this endpoint, the required workflow must be configured to run on selected repositories.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsListSelfHostedRunnersForOrg: {
    comment: 'List self-hosted runners for an organization',
    doc: 'List self-hosted runners for an organization\n  Lists all self-hosted runners configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsListRunnerApplicationsForOrg: {
    comment: 'List runner applications for an organization',
    doc: 'List runner applications for an organization\n  Lists binaries for the runner application that you can download and run.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsCreateRegistrationTokenForOrg: {
    comment: 'Create a registration token for an organization',
    doc: 'Create a registration token for an organization\n  Returns a token that you can pass to the `config` script. The token expires after one hour.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  #### Example using registration token\n \n  Configure your self-hosted runner, replacing `TOKEN` with the registration token provided by this endpoint.\n \n  ```\n  ./config.sh --url https://github.com/octo-org --token TOKEN\n  ```',
  },
  actionsCreateRemoveTokenForOrg: {
    comment: 'Create a remove token for an organization',
    doc: 'Create a remove token for an organization\n  Returns a token that you can pass to the `config` script to remove a self-hosted runner from an organization. The token expires after one hour.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n \n  #### Example using remove token\n \n  To remove your self-hosted runner from an organization, replace `TOKEN` with the remove token provided by this\n  endpoint.\n \n  ```\n  ./config.sh remove --token TOKEN\n  ```',
  },
  actionsDeleteSelfHostedRunnerFromOrg: {
    comment: 'Delete a self-hosted runner from an organization',
    doc: 'Delete a self-hosted runner from an organization\n  Forces the removal of a self-hosted runner from an organization. You can use this endpoint to completely remove the runner when the machine you were using no longer exists.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsGetSelfHostedRunnerForOrg: {
    comment: 'Get a self-hosted runner for an organization',
    doc: 'Get a self-hosted runner for an organization\n  Gets a specific self-hosted runner configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsRemoveAllCustomLabelsFromSelfHostedRunnerForOrg: {
    comment: 'Remove all custom labels from a self-hosted runner for an organization',
    doc: 'Remove all custom labels from a self-hosted runner for an organization\n  Remove all custom labels from a self-hosted runner configured in an\n  organization. Returns the remaining read-only labels from the runner.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsListLabelsForSelfHostedRunnerForOrg: {
    comment: 'List labels for a self-hosted runner for an organization',
    doc: 'List labels for a self-hosted runner for an organization\n  Lists all labels for a self-hosted runner configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsAddCustomLabelsToSelfHostedRunnerForOrg: {
    comment: 'Add custom labels to a self-hosted runner for an organization',
    doc: 'Add custom labels to a self-hosted runner for an organization\n  Add custom labels to a self-hosted runner configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsSetCustomLabelsForSelfHostedRunnerForOrg: {
    comment: 'Set custom labels for a self-hosted runner for an organization',
    doc: 'Set custom labels for a self-hosted runner for an organization\n  Remove all previous custom labels and set the new custom labels for a specific\n  self-hosted runner configured in an organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsRemoveCustomLabelFromSelfHostedRunnerForOrg: {
    comment: 'Remove a custom label from a self-hosted runner for an organization',
    doc: 'Remove a custom label from a self-hosted runner for an organization\n  Remove a custom label from a self-hosted runner configured\n  in an organization. Returns the remaining labels from the runner.\n \n  This endpoint returns a `404 Not Found` status if the custom label is not\n  present on the runner.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  actionsListOrgSecrets: {
    comment: 'List organization secrets',
    doc: 'List organization secrets\n  Lists all secrets available in an organization without revealing their encrypted values. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsGetOrgPublicKey: {
    comment: 'Get an organization public key',
    doc: 'Get an organization public key\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsDeleteOrgSecret: {
    comment: 'Delete an organization secret',
    doc: 'Delete an organization secret\n  Deletes a secret in an organization using the secret name. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsGetOrgSecret: {
    comment: 'Get an organization secret',
    doc: 'Get an organization secret\n  Gets a single organization secret without revealing its encrypted value. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsCreateOrUpdateOrgSecret: {
    comment: 'Create or update an organization secret',
    doc: 'Create or update an organization secret\n  Creates or updates an organization secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to\n  use this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  actionsListSelectedReposForOrgSecret: {
    comment: 'List selected repositories for an organization secret',
    doc: 'List selected repositories for an organization secret\n  Lists all repositories that have been selected when the `visibility` for repository access to a secret is set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsSetSelectedReposForOrgSecret: {
    comment: 'Set selected repositories for an organization secret',
    doc: 'Set selected repositories for an organization secret\n  Replaces all repositories for an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/actions#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsRemoveSelectedRepoFromOrgSecret: {
    comment: 'Remove selected repository from an organization secret',
    doc: 'Remove selected repository from an organization secret\n  Removes a repository from an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/actions#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsAddSelectedRepoToOrgSecret: {
    comment: 'Add selected repository to an organization secret',
    doc: 'Add selected repository to an organization secret\n  Adds a repository to an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/actions#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `secrets` organization permission to use this endpoint.',
  },
  actionsListOrgVariables: {
    comment: 'List organization variables',
    doc: 'List organization variables\n  Lists all organization variables. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:read` organization permission to use this endpoint.',
  },
  actionsCreateOrgVariable: {
    comment: 'Create an organization variable',
    doc: 'Create an organization variable\n  Creates an organization variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n  GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  actionsDeleteOrgVariable: {
    comment: 'Delete an organization variable',
    doc: 'Delete an organization variable\n  Deletes an organization variable using the variable name.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n  GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  actionsGetOrgVariable: {
    comment: 'Get an organization variable',
    doc: 'Get an organization variable\n  Gets a specific variable in an organization. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:read` organization permission to use this endpoint.',
  },
  actionsUpdateOrgVariable: {
    comment: 'Update an organization variable',
    doc: 'Update an organization variable\n  Updates an organization variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.\n  GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  actionsListSelectedReposForOrgVariable: {
    comment: 'List selected repositories for an organization variable',
    doc: 'List selected repositories for an organization variable\n  Lists all repositories that can access an organization variable that is available to selected repositories. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:read` organization permission to use this endpoint.',
  },
  actionsSetSelectedReposForOrgVariable: {
    comment: 'Set selected repositories for an organization variable',
    doc: 'Set selected repositories for an organization variable\n  Replaces all repositories for an organization variable that is available to selected repositories. Organization variables that are available to selected repositories have their `visibility` field set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  actionsRemoveSelectedRepoFromOrgVariable: {
    comment: 'Remove selected repository from an organization variable',
    doc: 'Remove selected repository from an organization variable\n  Removes a repository from an organization variable that is available to selected repositories. Organization variables that are available to selected repositories have their `visibility` field set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  actionsAddSelectedRepoToOrgVariable: {
    comment: 'Add selected repository to an organization variable',
    doc: 'Add selected repository to an organization variable\n  Adds a repository to an organization variable that is available to selected repositories. Organization variables that are available to selected repositories have their `visibility` field set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `organization_actions_variables:write` organization permission to use this endpoint.',
  },
  orgsListBlockedUsers: {
    comment: 'List users blocked by an organization',
    doc: 'List users blocked by an organization\n  List the users blocked by an organization.',
  },
  orgsUnblockUser: {
    comment: 'Unblock a user from an organization',
    doc: 'Unblock a user from an organization',
  },
  orgsCheckBlockedUser: {
    comment: 'Check if a user is blocked by an organization',
    doc: 'Check if a user is blocked by an organization',
  },
  orgsBlockUser: {
    comment: 'Block a user from an organization',
    doc: 'Block a user from an organization',
  },
  codeScanningListAlertsForOrg: {
    comment: 'List code scanning alerts for an organization',
    doc: 'List code scanning alerts for an organization\n  Lists code scanning alerts for the default branch for all eligible repositories in an organization. Eligible repositories are repositories that are owned by organizations that you own or for which you are a security manager. For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."\n \n  To use this endpoint, you must be an owner or security manager for the organization, and you must use an access token with the `repo` scope or `security_events` scope.\n \n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `security_events` read permission to use this endpoint.',
  },
  codespacesListInOrganization: {
    comment: 'List codespaces for the organization',
    doc: 'List codespaces for the organization\n  Lists the codespaces associated to a specified organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesSetCodespacesBilling: {
    comment: 'Manage access control for organization codespaces',
    doc: 'Manage access control for organization codespaces\n  Sets which users can access codespaces in an organization. This is synonymous with granting or revoking codespaces billing permissions for users according to the visibility.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesDeleteCodespacesBillingUsers: {
    comment: 'Removes users from Codespaces billing for an organization',
    doc: 'Removes users from Codespaces billing for an organization\n  Codespaces for the specified users will no longer be billed to the organization.\n  To use this endpoint, the billing settings for the organization must be set to `selected_members`. For information on how to change this setting please see [these docs].(https://docs.github.com/rest/codespaces/organizations#manage-access-control-for-organization-codespaces) You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesSetCodespacesBillingUsers: {
    comment: 'Add users to Codespaces billing for an organization',
    doc: 'Add users to Codespaces billing for an organization\n  Codespaces for the specified users will be billed to the organization.\n  To use this endpoint, the billing settings for the organization must be set to `selected_members`. For information on how to change this setting please see [these docs].(https://docs.github.com/rest/codespaces/organizations#manage-access-control-for-organization-codespaces) You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesListOrgSecrets: {
    comment: 'List organization secrets',
    doc: 'List organization secrets\n  Lists all Codespaces secrets available at the organization-level without revealing their encrypted values.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesGetOrgPublicKey: {
    comment: 'Get an organization public key',
    doc: 'Get an organization public key\n  Gets a public key for an organization, which is required in order to encrypt secrets. You need to encrypt the value of a secret before you can create or update secrets. You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesDeleteOrgSecret: {
    comment: 'Delete an organization secret',
    doc: 'Delete an organization secret\n  Deletes an organization secret using the secret name. You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesGetOrgSecret: {
    comment: 'Get an organization secret',
    doc: 'Get an organization secret\n  Gets an organization secret without revealing its encrypted value.\n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesCreateOrUpdateOrgSecret: {
    comment: 'Create or update an organization secret',
    doc: 'Create or update an organization secret\n  Creates or updates an organization secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `admin:org` scope to use this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  codespacesListSelectedReposForOrgSecret: {
    comment: 'List selected repositories for an organization secret',
    doc: 'List selected repositories for an organization secret\n  Lists all repositories that have been selected when the `visibility` for repository access to a secret is set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesSetSelectedReposForOrgSecret: {
    comment: 'Set selected repositories for an organization secret',
    doc: 'Set selected repositories for an organization secret\n  Replaces all repositories for an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/codespaces#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesRemoveSelectedRepoFromOrgSecret: {
    comment: 'Remove selected repository from an organization secret',
    doc: 'Remove selected repository from an organization secret\n  Removes a repository from an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/codespaces#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesAddSelectedRepoToOrgSecret: {
    comment: 'Add selected repository to an organization secret',
    doc: 'Add selected repository to an organization secret\n  Adds a repository to an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/codespaces#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  dependabotListAlertsForOrg: {
    comment: 'List Dependabot alerts for an organization',
    doc: 'List Dependabot alerts for an organization\n  Lists Dependabot alerts for an organization.\n \n  To use this endpoint, you must be an owner or security manager for the organization, and you must use an access token with the `repo` scope or `security_events` scope.\n \n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have Dependabot alerts read permission to use this endpoint.',
  },
  dependabotListOrgSecrets: {
    comment: 'List organization secrets',
    doc: 'List organization secrets\n  Lists all secrets available in an organization without revealing their encrypted values. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotGetOrgPublicKey: {
    comment: 'Get an organization public key',
    doc: 'Get an organization public key\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotDeleteOrgSecret: {
    comment: 'Delete an organization secret',
    doc: 'Delete an organization secret\n  Deletes a secret in an organization using the secret name. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotGetOrgSecret: {
    comment: 'Get an organization secret',
    doc: 'Get an organization secret\n  Gets a single organization secret without revealing its encrypted value. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotCreateOrUpdateOrgSecret: {
    comment: 'Create or update an organization secret',
    doc: 'Create or update an organization secret\n  Creates or updates an organization secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization\n  permission to use this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  dependabotListSelectedReposForOrgSecret: {
    comment: 'List selected repositories for an organization secret',
    doc: 'List selected repositories for an organization secret\n  Lists all repositories that have been selected when the `visibility` for repository access to a secret is set to `selected`. You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotSetSelectedReposForOrgSecret: {
    comment: 'Set selected repositories for an organization secret',
    doc: 'Set selected repositories for an organization secret\n  Replaces all repositories for an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/dependabot#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotRemoveSelectedRepoFromOrgSecret: {
    comment: 'Remove selected repository from an organization secret',
    doc: 'Remove selected repository from an organization secret\n  Removes a repository from an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/dependabot#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  dependabotAddSelectedRepoToOrgSecret: {
    comment: 'Add selected repository to an organization secret',
    doc: 'Add selected repository to an organization secret\n  Adds a repository to an organization secret when the `visibility` for repository access is set to `selected`. The visibility is set when you [Create or update an organization secret](https://docs.github.com/rest/reference/dependabot#create-or-update-an-organization-secret). You must authenticate using an access token with the `admin:org` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` organization permission to use this endpoint.',
  },
  activityListPublicOrgEvents: {
    comment: 'List public organization events',
    doc: 'List public organization events',
  },
  orgsListFailedInvitations: {
    comment: 'List failed organization invitations',
    doc: 'List failed organization invitations\n  The return hash contains `failed_at` and `failed_reason` fields which represent the time at which the invitation failed and the reason for the failure.',
  },
  orgsListWebhooks: {
    comment: 'List organization webhooks',
    doc: 'List organization webhooks',
  },
  orgsCreateWebhook: {
    comment: 'Create an organization webhook',
    doc: "Create an organization webhook\n  Here's how you can create a hook that posts payloads in JSON format:",
  },
  orgsDeleteWebhook: {
    comment: 'Delete an organization webhook',
    doc: 'Delete an organization webhook',
  },
  orgsGetWebhook: {
    comment: 'Get an organization webhook',
    doc: 'Get an organization webhook\n  Returns a webhook configured in an organization. To get only the webhook `config` properties, see "[Get a webhook configuration for an organization](/rest/reference/orgs#get-a-webhook-configuration-for-an-organization)."',
  },
  orgsUpdateWebhook: {
    comment: 'Update an organization webhook',
    doc: 'Update an organization webhook\n  Updates a webhook configured in an organization. When you update a webhook, the `secret` will be overwritten. If you previously had a `secret` set, you must provide the same `secret` or set a new `secret` or the secret will be removed. If you are only updating individual webhook `config` properties, use "[Update a webhook configuration for an organization](/rest/reference/orgs#update-a-webhook-configuration-for-an-organization)."',
  },
  orgsGetWebhookConfigForOrg: {
    comment: 'Get a webhook configuration for an organization',
    doc: 'Get a webhook configuration for an organization\n  Returns the webhook configuration for an organization. To get more information about the webhook, including the `active` state and `events`, use "[Get an organization webhook ](/rest/reference/orgs#get-an-organization-webhook)."\n \n  Access tokens must have the `admin:org_hook` scope, and GitHub Apps must have the `organization_hooks:read` permission.',
  },
  orgsUpdateWebhookConfigForOrg: {
    comment: 'Update a webhook configuration for an organization',
    doc: 'Update a webhook configuration for an organization\n  Updates the webhook configuration for an organization. To update more information about the webhook, including the `active` state and `events`, use "[Update an organization webhook ](/rest/reference/orgs#update-an-organization-webhook)."\n \n  Access tokens must have the `admin:org_hook` scope, and GitHub Apps must have the `organization_hooks:write` permission.',
  },
  orgsListWebhookDeliveries: {
    comment: 'List deliveries for an organization webhook',
    doc: 'List deliveries for an organization webhook\n  Returns a list of webhook deliveries for a webhook configured in an organization.',
  },
  orgsGetWebhookDelivery: {
    comment: 'Get a webhook delivery for an organization webhook',
    doc: 'Get a webhook delivery for an organization webhook\n  Returns a delivery for a webhook configured in an organization.',
  },
  orgsRedeliverWebhookDelivery: {
    comment: 'Redeliver a delivery for an organization webhook',
    doc: 'Redeliver a delivery for an organization webhook\n  Redeliver a delivery for a webhook configured in an organization.',
  },
  orgsPingWebhook: {
    comment: 'Ping an organization webhook',
    doc: 'Ping an organization webhook\n  This will trigger a [ping event](https://docs.github.com/webhooks/#ping-event) to be sent to the hook.',
  },
  appsGetOrgInstallation: {
    comment: 'Get an organization installation for the authenticated app',
    doc: "Get an organization installation for the authenticated app\n  Enables an authenticated GitHub App to find the organization's installation information.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.",
  },
  orgsListAppInstallations: {
    comment: 'List app installations for an organization',
    doc: 'List app installations for an organization\n  Lists all GitHub Apps in an organization. The installation count includes all GitHub Apps installed on repositories in the organization. You must be an organization owner with `admin:read` scope to use this endpoint.',
  },
  interactionsRemoveRestrictionsForOrg: {
    comment: 'Remove interaction restrictions for an organization',
    doc: 'Remove interaction restrictions for an organization\n  Removes all interaction restrictions from public repositories in the given organization. You must be an organization owner to remove restrictions.',
  },
  interactionsGetRestrictionsForOrg: {
    comment: 'Get interaction restrictions for an organization',
    doc: 'Get interaction restrictions for an organization\n  Shows which type of GitHub user can interact with this organization and when the restriction expires. If there is no restrictions, you will see an empty response.',
  },
  interactionsSetRestrictionsForOrg: {
    comment: 'Set interaction restrictions for an organization',
    doc: 'Set interaction restrictions for an organization\n  Temporarily restricts interactions to a certain type of GitHub user in any public repository in the given organization. You must be an organization owner to set these restrictions. Setting the interaction limit at the organization level will overwrite any interaction limits that are set for individual repositories owned by the organization.',
  },
  orgsListPendingInvitations: {
    comment: 'List pending organization invitations',
    doc: 'List pending organization invitations\n  The return hash contains a `role` field which refers to the Organization Invitation role and will be one of the following values: `direct_member`, `admin`, `billing_manager`, or `hiring_manager`. If the invitee is not a GitHub member, the `login` field in the return hash will be `null`.',
  },
  orgsCreateInvitation: {
    comment: 'Create an organization invitation',
    doc: 'Create an organization invitation\n  Invite people to an organization by using their GitHub user ID or their email address. In order to create invitations in an organization, the authenticated user must be an organization owner.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  orgsCancelInvitation: {
    comment: 'Cancel an organization invitation',
    doc: 'Cancel an organization invitation\n  Cancel an organization invitation. In order to cancel an organization invitation, the authenticated user must be an organization owner.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications).',
  },
  orgsListInvitationTeams: {
    comment: 'List organization invitation teams',
    doc: 'List organization invitation teams\n  List all teams associated with an invitation. In order to see invitations in an organization, the authenticated user must be an organization owner.',
  },
  issuesListForOrg: {
    comment: 'List organization issues assigned to the authenticated user',
    doc: 'List organization issues assigned to the authenticated user\n  List issues in an organization assigned to the authenticated user.\n \n  Note: GitHub\'s REST API considers every pull request an issue, but not every issue is a pull request. For this\n  reason, "Issues" endpoints may return both issues and pull requests in the response. You can identify pull requests by\n  the `pull_request` key. Be aware that the `id` of a pull request returned from "Issues" endpoints will be an _issue id_. To find out the pull\n  request id, use the "[List pull requests](https://docs.github.com/rest/reference/pulls#list-pull-requests)" endpoint.',
  },
  orgsListMembers: {
    comment: 'List organization members',
    doc: 'List organization members\n  List all users who are members of an organization. If the authenticated user is also a member of this organization then both concealed and public members will be returned.',
  },
  orgsRemoveMember: {
    comment: 'Remove an organization member',
    doc: "Remove an organization member\n  Removing a user from this list will remove them from all teams and they will no longer have any access to the organization's repositories.",
  },
  orgsCheckMembershipForUser: {
    comment: 'Check organization membership for a user',
    doc: 'Check organization membership for a user\n  Check if a user is, publicly or privately, a member of the organization.',
  },
  codespacesGetCodespacesForUserInOrg: {
    comment: 'List codespaces for a user in organization',
    doc: 'List codespaces for a user in organization\n  Lists the codespaces that a member of an organization has for repositories in that organization.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.',
  },
  codespacesDeleteFromOrganization: {
    comment: 'Delete a codespace from the organization',
    doc: "Delete a codespace from the organization\n  Deletes a user's codespace.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.",
  },
  codespacesStopInOrganization: {
    comment: 'Stop a codespace for an organization user',
    doc: "Stop a codespace for an organization user\n  Stops a user's codespace.\n \n  You must authenticate using an access token with the `admin:org` scope to use this endpoint.",
  },
  orgsRemoveMembershipForUser: {
    comment: 'Remove organization membership for a user',
    doc: "Remove organization membership for a user\n  In order to remove a user's membership with an organization, the authenticated user must be an organization owner.\n \n  If the specified user is an active member of the organization, this will remove them from the organization. If the specified user has been invited to the organization, this will cancel their invitation. The specified user will receive an email notification in both cases.",
  },
  orgsGetMembershipForUser: {
    comment: 'Get organization membership for a user',
    doc: "Get organization membership for a user\n  In order to get a user's membership with an organization, the authenticated user must be an organization member. The `state` parameter in the response can be used to identify the user's membership status.",
  },
  orgsSetMembershipForUser: {
    comment: 'Set organization membership for a user',
    doc: "Set organization membership for a user\n  Only authenticated organization owners can add a member to the organization or update the member's role.\n \n     If the authenticated user is _adding_ a member to the organization, the invited user will receive an email inviting them to the organization. The user's [membership status](https://docs.github.com/rest/reference/orgs#get-organization-membership-for-a-user) will be `pending` until they accept the invitation.\n \n     Authenticated users can _update_ a user's membership by passing the `role` parameter. If the authenticated user changes a member's role to `admin`, the affected user will receive an email notifying them that they've been made an organization owner. If the authenticated user changes an owner's role to `member`, no email will be sent.\n \n  Rate limits\n \n  To prevent abuse, the authenticated user is limited to 50 organization invitations per 24 hour period. If the organization is more than one month old or on a paid plan, the limit is 500 invitations per 24 hour period.",
  },
  migrationsListForOrg: {
    comment: 'List organization migrations',
    doc: 'List organization migrations\n  Lists the most recent migrations, including both exports (which can be started through the REST API) and imports (which cannot be started using the REST API).\n \n  A list of `repositories` is only returned for export migrations.',
  },
  migrationsStartForOrg: {
    comment: 'Start an organization migration',
    doc: 'Start an organization migration\n  Initiates the generation of a migration archive.',
  },
  migrationsGetStatusForOrg: {
    comment: 'Get an organization migration status',
    doc: "Get an organization migration status\n  Fetches the status of a migration.\n \n  The `state` of a migration can be one of the following values:\n \n     `pending`, which means the migration hasn't started yet.\n     `exporting`, which means the migration is in progress.\n     `exported`, which means the migration finished successfully.\n     `failed`, which means the migration failed.",
  },
  migrationsDeleteArchiveForOrg: {
    comment: 'Delete an organization migration archive',
    doc: 'Delete an organization migration archive\n  Deletes a previous migration archive. Migration archives are automatically deleted after seven days.',
  },
  migrationsDownloadArchiveForOrg: {
    comment: 'Download an organization migration archive',
    doc: 'Download an organization migration archive\n  Fetches the URL to a migration archive.',
  },
  migrationsUnlockRepoForOrg: {
    comment: 'Unlock an organization repository',
    doc: 'Unlock an organization repository\n  Unlocks a repository that was locked for migration. You should unlock each migrated repository and [delete them](https://docs.github.com/rest/repos/repos#delete-a-repository) when the migration is complete and you no longer need the source data.',
  },
  migrationsListReposForOrg: {
    comment: 'List repositories in an organization migration',
    doc: 'List repositories in an organization migration\n  List all the repositories for this organization migration.',
  },
  orgsListOutsideCollaborators: {
    comment: 'List outside collaborators for an organization',
    doc: 'List outside collaborators for an organization\n  List all users who are outside collaborators of an organization.',
  },
  orgsRemoveOutsideCollaborator: {
    comment: 'Remove outside collaborator from an organization',
    doc: "Remove outside collaborator from an organization\n  Removing a user from this list will remove them from all the organization's repositories.",
  },
  orgsConvertMemberToOutsideCollaborator: {
    comment: 'Convert an organization member to outside collaborator',
    doc: 'Convert an organization member to outside collaborator\n  When an organization member is converted to an outside collaborator, they\'ll only have access to the repositories that their current team membership allows. The user will no longer be a member of the organization. For more information, see "[Converting an organization member to an outside collaborator](https://docs.github.com/articles/converting-an-organization-member-to-an-outside-collaborator/)". Converting an organization member to an outside collaborator may be restricted by enterprise administrators. For more information, see "[Enforcing repository management policies in your enterprise](https://docs.github.com/admin/policies/enforcing-policies-for-your-enterprise/enforcing-repository-management-policies-in-your-enterprise#enforcing-a-policy-for-inviting-outside-collaborators-to-repositories)."',
  },
  packagesListPackagesForOrganization: {
    comment: 'List packages for an organization',
    doc: 'List packages for an organization\n  Lists packages in an organization readable by the user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageForOrg: {
    comment: 'Delete a package for an organization',
    doc: 'Delete a package for an organization\n  Deletes an entire package in an organization. You cannot delete a public package if any version of the package has more than 5,000 downloads. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must have admin permissions in the organization and authenticate using an access token with the `read:packages` and `delete:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package you want to delete. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetPackageForOrganization: {
    comment: 'Get a package for an organization',
    doc: 'Get a package for an organization\n  Gets a specific package in an organization.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageForOrg: {
    comment: 'Restore a package for an organization',
    doc: 'Restore a package for an organization\n  Restores an entire package in an organization.\n \n  You can restore a deleted package under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must have admin permissions in the organization and authenticate using an access token with the `read:packages` and `write:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package you want to restore. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetAllPackageVersionsForPackageOwnedByOrg: {
    comment: 'List package versions for a package owned by an organization',
    doc: 'List package versions for a package owned by an organization\n  Lists package versions for a package owned by an organization.\n \n  If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageVersionForOrg: {
    comment: 'Delete package version for an organization',
    doc: 'Delete package version for an organization\n  Deletes a specific package version in an organization. If the package is public and the package version has more than 5,000 downloads, you cannot delete the package version. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must have admin permissions in the organization and authenticate using an access token with the `read:packages` and `delete:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package whose version you want to delete. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetPackageVersionForOrganization: {
    comment: 'Get a package version for an organization',
    doc: 'Get a package version for an organization\n  Gets a specific package version in an organization.\n \n  You must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageVersionForOrg: {
    comment: 'Restore package version for an organization',
    doc: 'Restore package version for an organization\n  Restores a specific package version in an organization.\n \n  You can restore a deleted package under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must have admin permissions in the organization and authenticate using an access token with the `read:packages` and `write:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package whose version you want to restore. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  projectsListForOrg: {
    comment: 'List organization projects',
    doc: 'List organization projects\n  Lists the projects in an organization. Returns a `404 Not Found` status if projects are disabled in the organization. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  projectsCreateForOrg: {
    comment: 'Create an organization project',
    doc: 'Create an organization project\n  Creates an organization project board. Returns a `410 Gone` status if projects are disabled in the organization or if the organization does not have existing classic projects. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  orgsListPublicMembers: {
    comment: 'List public organization members',
    doc: 'List public organization members\n  Members of an organization can choose to have their membership publicized or not.',
  },
  orgsRemovePublicMembershipForAuthenticatedUser: {
    comment: 'Remove public organization membership for the authenticated user',
    doc: 'Remove public organization membership for the authenticated user',
  },
  orgsCheckPublicMembershipForUser: {
    comment: 'Check public organization membership for a user',
    doc: 'Check public organization membership for a user',
  },
  orgsSetPublicMembershipForAuthenticatedUser: {
    comment: 'Set public organization membership for the authenticated user',
    doc: 'Set public organization membership for the authenticated user\n  The user can publicize their own membership. (A user cannot publicize the membership for another user.)\n \n  Note that you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  reposListForOrg: {
    comment: 'List organization repositories',
    doc: 'List organization repositories\n  Lists repositories for the specified organization.\n \n  Note: In order to see the `security_and_analysis` block for a repository you must have admin permissions for the repository or be an owner or security manager for the organization that owns the repository. For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."',
  },
  reposCreateInOrg: {
    comment: 'Create an organization repository',
    doc: 'Create an organization repository\n  Creates a new repository in the specified organization. The authenticated user must be a member of the organization.\n \n  OAuth scope requirements\n \n  When using [OAuth](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/), authorizations must include:\n \n     `public_repo` scope or `repo` scope to create a public repository. Note: For GitHub AE, use `repo` scope to create an internal repository.\n     `repo` scope to create a private repository',
  },
  secretScanningListAlertsForOrg: {
    comment: 'List secret scanning alerts for an organization',
    doc: 'List secret scanning alerts for an organization\n  Lists secret scanning alerts for eligible repositories in an organization, from newest to oldest.\n  To use this endpoint, you must be an administrator or security manager for the organization, and you must use an access token with the `repo` scope or `security_events` scope.\n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `secret_scanning_alerts` read permission to use this endpoint.',
  },
  orgsListSecurityManagerTeams: {
    comment: 'List security manager teams',
    doc: 'List security manager teams\n  Lists teams that are security managers for an organization. For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."\n \n  To use this endpoint, you must be an administrator or security manager for the organization, and you must use an access token with the `read:org` scope.\n \n  GitHub Apps must have the `administration` organization read permission to use this endpoint.',
  },
  orgsRemoveSecurityManagerTeam: {
    comment: 'Remove a security manager team',
    doc: 'Remove a security manager team\n  Removes the security manager role from a team for an organization. For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization) team from an organization."\n \n  To use this endpoint, you must be an administrator for the organization, and you must use an access token with the `admin:org` scope.\n \n  GitHub Apps must have the `administration` organization read-write permission to use this endpoint.',
  },
  orgsAddSecurityManagerTeam: {
    comment: 'Add a security manager team',
    doc: 'Add a security manager team\n  Adds a team as a security manager for an organization. For more information, see "[Managing security for an organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization) for an organization."\n \n  To use this endpoint, you must be an administrator for the organization, and you must use an access token with the `write:org` scope.\n \n  GitHub Apps must have the `administration` organization read-write permission to use this endpoint.',
  },
  billingGetGithubActionsBillingOrg: {
    comment: 'Get GitHub Actions billing for an organization',
    doc: 'Get GitHub Actions billing for an organization\n  Gets the summary of the free and paid GitHub Actions minutes used.\n \n  Paid minutes only apply to workflows in private repositories that use GitHub-hosted runners. Minutes used is listed for each GitHub-hosted runner operating system. Any job re-runs are also included in the usage. The usage returned includes any minute multipliers for macOS and Windows runners, and is rounded up to the nearest whole minute. For more information, see "[Managing billing for GitHub Actions](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-actions)".\n \n  Access tokens must have the `repo` or `admin:org` scope.',
  },
  billingGetGithubPackagesBillingOrg: {
    comment: 'Get GitHub Packages billing for an organization',
    doc: 'Get GitHub Packages billing for an organization\n  Gets the free and paid storage used for GitHub Packages in gigabytes.\n \n  Paid minutes only apply to packages stored for private repositories. For more information, see "[Managing billing for GitHub Packages](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-packages)."\n \n  Access tokens must have the `repo` or `admin:org` scope.',
  },
  billingGetSharedStorageBillingOrg: {
    comment: 'Get shared storage billing for an organization',
    doc: 'Get shared storage billing for an organization\n  Gets the estimated paid and estimated total storage used for GitHub Actions and GitHub Packages.\n \n  Paid minutes only apply to packages stored for private repositories. For more information, see "[Managing billing for GitHub Packages](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-packages)."\n \n  Access tokens must have the `repo` or `admin:org` scope.',
  },
  teamsList: {
    comment: 'List teams',
    doc: 'List teams\n  Lists all teams in an organization that are visible to the authenticated user.',
  },
  teamsCreate: {
    comment: 'Create a team',
    doc: 'Create a team\n  To create a team, the authenticated user must be a member or owner of `{org}`. By default, organization members can create teams. Organization owners can limit team creation to organization owners. For more information, see "[Setting team creation permissions](https://docs.github.com/articles/setting-team-creation-permissions-in-your-organization)."\n \n  When you create a new team, you automatically become a team maintainer without explicitly adding yourself to the optional array of `maintainers`. For more information, see "[About teams](https://docs.github.com/github/setting-up-and-managing-organizations-and-teams/about-teams)".',
  },
  teamsDeleteInOrg: {
    comment: 'Delete a team',
    doc: 'Delete a team\n  To delete a team, the authenticated user must be an organization owner or team maintainer.\n \n  If you are an organization owner, deleting a parent team will delete all of its child teams as well.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}`.',
  },
  teamsGetByName: {
    comment: 'Get a team by name',
    doc: 'Get a team by name\n  Gets a team using the team\'s `slug`. To create the `slug`, GitHub replaces special characters in the `name` string, changes all words to lowercase, and replaces spaces with a `-` separator. For example, `"My TEam Näme"` would become `my-team-name`.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}`.',
  },
  teamsUpdateInOrg: {
    comment: 'Update a team',
    doc: 'Update a team\n  To edit a team, the authenticated user must either be an organization owner or a team maintainer.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PATCH /organizations/{org_id}/team/{team_id}`.',
  },
  teamsListDiscussionsInOrg: {
    comment: 'List discussions',
    doc: "List discussions\n  List all discussions on a team's page. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/discussions`.",
  },
  teamsCreateDiscussionInOrg: {
    comment: 'Create a discussion',
    doc: 'Create a discussion\n  Creates a new discussion post on a team\'s page. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `POST /organizations/{org_id}/team/{team_id}/discussions`.',
  },
  teamsDeleteDiscussionInOrg: {
    comment: 'Delete a discussion',
    doc: "Delete a discussion\n  Delete a discussion from a team's page. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}`.",
  },
  teamsGetDiscussionInOrg: {
    comment: 'Get a discussion',
    doc: "Get a discussion\n  Get a specific discussion on a team's page. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}`.",
  },
  teamsUpdateDiscussionInOrg: {
    comment: 'Update a discussion',
    doc: 'Update a discussion\n  Edits the title and body text of a discussion post. Only the parameters you provide are updated. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PATCH /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}`.',
  },
  teamsListDiscussionCommentsInOrg: {
    comment: 'List discussion comments',
    doc: 'List discussion comments\n  List all comments on a team discussion. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}/comments`.',
  },
  teamsCreateDiscussionCommentInOrg: {
    comment: 'Create a discussion comment',
    doc: 'Create a discussion comment\n  Creates a new comment on a team discussion. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `POST /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}/comments`.',
  },
  teamsDeleteDiscussionCommentInOrg: {
    comment: 'Delete a discussion comment',
    doc: 'Delete a discussion comment\n  Deletes a comment on a team discussion. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}/comments/{comment_number}`.',
  },
  teamsGetDiscussionCommentInOrg: {
    comment: 'Get a discussion comment',
    doc: 'Get a discussion comment\n  Get a specific comment on a team discussion. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}/comments/{comment_number}`.',
  },
  teamsUpdateDiscussionCommentInOrg: {
    comment: 'Update a discussion comment',
    doc: 'Update a discussion comment\n  Edits the body text of a discussion comment. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PATCH /organizations/{org_id}/team/{team_id}/discussions/{discussion_number}/comments/{comment_number}`.',
  },
  reactionsListForTeamDiscussionCommentInOrg: {
    comment: 'List reactions for a team discussion comment',
    doc: 'List reactions for a team discussion comment\n  List the reactions to a [team discussion comment](https://docs.github.com/rest/reference/teams#discussion-comments/). OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/:org_id/team/:team_id/discussions/:discussion_number/comments/:comment_number/reactions`.',
  },
  reactionsCreateForTeamDiscussionCommentInOrg: {
    comment: 'Create reaction for a team discussion comment',
    doc: 'Create reaction for a team discussion comment\n  Create a reaction to a [team discussion comment](https://docs.github.com/rest/reference/teams#discussion-comments). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/). A response with an HTTP `200` status means that you already added the reaction type to this team discussion comment.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `POST /organizations/:org_id/team/:team_id/discussions/:discussion_number/comments/:comment_number/reactions`.',
  },
  reactionsDeleteForTeamDiscussionComment: {
    comment: 'Delete team discussion comment reaction',
    doc: 'Delete team discussion comment reaction\n  Note: You can also specify a team or organization with `team_id` and `org_id` using the route `DELETE /organizations/:org_id/team/:team_id/discussions/:discussion_number/comments/:comment_number/reactions/:reaction_id`.\n \n  Delete a reaction to a [team discussion comment](https://docs.github.com/rest/reference/teams#discussion-comments). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  reactionsListForTeamDiscussionInOrg: {
    comment: 'List reactions for a team discussion',
    doc: 'List reactions for a team discussion\n  List the reactions to a [team discussion](https://docs.github.com/rest/reference/teams#discussions). OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/:org_id/team/:team_id/discussions/:discussion_number/reactions`.',
  },
  reactionsCreateForTeamDiscussionInOrg: {
    comment: 'Create reaction for a team discussion',
    doc: 'Create reaction for a team discussion\n  Create a reaction to a [team discussion](https://docs.github.com/rest/reference/teams#discussions). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/). A response with an HTTP `200` status means that you already added the reaction type to this team discussion.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `POST /organizations/:org_id/team/:team_id/discussions/:discussion_number/reactions`.',
  },
  reactionsDeleteForTeamDiscussion: {
    comment: 'Delete team discussion reaction',
    doc: 'Delete team discussion reaction\n  Note: You can also specify a team or organization with `team_id` and `org_id` using the route `DELETE /organizations/:org_id/team/:team_id/discussions/:discussion_number/reactions/:reaction_id`.\n \n  Delete a reaction to a [team discussion](https://docs.github.com/rest/reference/teams#discussions). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  teamsListPendingInvitationsInOrg: {
    comment: 'List pending team invitations',
    doc: 'List pending team invitations\n  The return hash contains a `role` field which refers to the Organization Invitation role and will be one of the following values: `direct_member`, `admin`, `billing_manager`, `hiring_manager`, or `reinstate`. If the invitee is not a GitHub member, the `login` field in the return hash will be `null`.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/invitations`.',
  },
  teamsListMembersInOrg: {
    comment: 'List team members',
    doc: 'List team members\n  Team members will include the members of child teams.\n \n  To list members in a team, the team must be visible to the authenticated user.',
  },
  teamsRemoveMembershipForUserInOrg: {
    comment: 'Remove team membership for a user',
    doc: "Remove team membership for a user\n  To remove a membership between a user and a team, the authenticated user must have 'admin' permissions to the team or be an owner of the organization that the team is associated with. Removing team membership does not delete the user, it just removes their membership from the team.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Note: When you have team synchronization set up for a team with your organization's identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team's membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see \"[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/).\"\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}/memberships/{username}`.",
  },
  teamsGetMembershipForUserInOrg: {
    comment: 'Get team membership for a user',
    doc: "Get team membership for a user\n  Team members will include the members of child teams.\n \n  To get a user's membership with a team, the team must be visible to the authenticated user.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/memberships/{username}`.\n \n  Note:\n  The response contains the `state` of the membership and the member's `role`.\n \n  The `role` for organization owners is set to `maintainer`. For more information about `maintainer` roles, see see [Create a team](https://docs.github.com/rest/reference/teams#create-a-team).",
  },
  teamsAddOrUpdateMembershipForUserInOrg: {
    comment: 'Add or update team membership for a user',
    doc: 'Add or update team membership for a user\n  Adds an organization member to a team. An authenticated organization owner or team maintainer can add organization members to a team.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub\'s products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Note: When you have team synchronization set up for a team with your organization\'s identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team\'s membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see "[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/)."\n \n  An organization owner can add someone who is not part of the team\'s organization to a team. When an organization owner adds someone to a team who is not an organization member, this endpoint will send an invitation to the person via email. This newly-created membership will be in the "pending" state until the person accepts the invitation, at which point the membership will transition to the "active" state and the user will be added as a member of the team.\n \n  If the user is already a member of the team, this endpoint will update the role of the team member\'s role. To update the membership of a team member, the authenticated user must be an organization owner or a team maintainer.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PUT /organizations/{org_id}/team/{team_id}/memberships/{username}`.',
  },
  teamsListProjectsInOrg: {
    comment: 'List team projects',
    doc: 'List team projects\n  Lists the organization projects for a team.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/projects`.',
  },
  teamsRemoveProjectInOrg: {
    comment: 'Remove a project from a team',
    doc: 'Remove a project from a team\n  Removes an organization project from a team. An organization owner or a team maintainer can remove any project from the team. To remove a project from a team as an organization member, the authenticated user must have `read` access to both the team and project, or `admin` access to the team or project. This endpoint removes the project from the team, but does not delete the project.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}/projects/{project_id}`.',
  },
  teamsCheckPermissionsForProjectInOrg: {
    comment: 'Check team permissions for a project',
    doc: 'Check team permissions for a project\n  Checks whether a team has `read`, `write`, or `admin` permissions for an organization project. The response includes projects inherited from a parent team.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/projects/{project_id}`.',
  },
  teamsAddOrUpdateProjectPermissionsInOrg: {
    comment: 'Add or update team project permissions',
    doc: "Add or update team project permissions\n  Adds an organization project to a team. To add a project to a team or update the team's permission on a project, the authenticated user must have `admin` permissions for the project. The project and team must be part of the same organization.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PUT /organizations/{org_id}/team/{team_id}/projects/{project_id}`.",
  },
  teamsListReposInOrg: {
    comment: 'List team repositories',
    doc: "List team repositories\n  Lists a team's repositories visible to the authenticated user.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/repos`.",
  },
  teamsRemoveRepoInOrg: {
    comment: 'Remove a repository from a team',
    doc: 'Remove a repository from a team\n  If the authenticated user is an organization owner or a team maintainer, they can remove any repositories from the team. To remove a repository from a team as an organization member, the authenticated user must have admin access to the repository and must be able to see the team. This does not delete the repository, it just removes it from the team.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `DELETE /organizations/{org_id}/team/{team_id}/repos/{owner}/{repo}`.',
  },
  teamsCheckPermissionsForRepoInOrg: {
    comment: 'Check team permissions for a repository',
    doc: "Check team permissions for a repository\n  Checks whether a team has `admin`, `push`, `maintain`, `triage`, or `pull` permission for a repository. Repositories inherited through a parent team will also be checked.\n \n  You can also get information about the specified repository, including what permissions the team grants on it, by passing the following custom [media type](https://docs.github.com/rest/overview/media-types/) via the `application/vnd.github.v3.repository+json` accept header.\n \n  If a team doesn't have permission for the repository, you will receive a `404 Not Found` response status.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/repos/{owner}/{repo}`.",
  },
  teamsAddOrUpdateRepoPermissionsInOrg: {
    comment: 'Add or update team repository permissions',
    doc: 'Add or update team repository permissions\n  To add a repository to a team or update the team\'s permission on a repository, the authenticated user must have admin access to the repository, and must be able to see the team. The repository must be owned by the organization, or a direct fork of a repository owned by the organization. You will get a `422 Unprocessable Entity` status if you attempt to add a repository to a team that is not owned by the organization. Note that, if you choose not to pass any parameters, you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `PUT /organizations/{org_id}/team/{team_id}/repos/{owner}/{repo}`.\n \n  For more information about the permission levels, see "[Repository permission levels for an organization](https://docs.github.com/github/setting-up-and-managing-organizations-and-teams/repository-permission-levels-for-an-organization#permission-levels-for-repositories-owned-by-an-organization)".',
  },
  teamsListChildInOrg: {
    comment: 'List child teams',
    doc: 'List child teams\n  Lists the child teams of the team specified by `{team_slug}`.\n \n  Note: You can also specify a team by `org_id` and `team_id` using the route `GET /organizations/{org_id}/team/{team_id}/teams`.',
  },
  orgsEnableOrDisableSecurityProductOnAllOrgRepos: {
    comment: 'Enable or disable a security feature for an organization',
    doc: 'Enable or disable a security feature for an organization\n  Enables or disables the specified security feature for all repositories in an organization.\n \n  To use this endpoint, you must be an organization owner or be member of a team with the security manager role.\n  A token with the \'write:org\' scope is also required.\n \n  GitHub Apps must have the `organization_administration:write` permission to use this endpoint.\n \n  For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."',
  },
  projectsDeleteCard: {
    comment: 'Delete a project card',
    doc: 'Delete a project card',
  },
  projectsGetCard: {
    comment: 'Get a project card',
    doc: 'Get a project card',
  },
  projectsUpdateCard: {
    comment: 'Update an existing project card',
    doc: 'Update an existing project card',
  },
  projectsMoveCard: {
    comment: 'Move a project card',
    doc: 'Move a project card',
  },
  projectsDeleteColumn: {
    comment: 'Delete a project column',
    doc: 'Delete a project column',
  },
  projectsGetColumn: {
    comment: 'Get a project column',
    doc: 'Get a project column',
  },
  projectsUpdateColumn: {
    comment: 'Update an existing project column',
    doc: 'Update an existing project column',
  },
  projectsListCards: {
    comment: 'List project cards',
    doc: 'List project cards',
  },
  projectsCreateCard: {
    comment: 'Create a project card',
    doc: 'Create a project card',
  },
  projectsMoveColumn: {
    comment: 'Move a project column',
    doc: 'Move a project column',
  },
  projectsDelete: {
    comment: 'Delete a project',
    doc: 'Delete a project\n  Deletes a project board. Returns a `404 Not Found` status if projects are disabled.',
  },
  projectsGet: {
    comment: 'Get a project',
    doc: 'Get a project\n  Gets a project by its `id`. Returns a `404 Not Found` status if projects are disabled. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  projectsUpdate: {
    comment: 'Update a project',
    doc: "Update a project\n  Updates a project board's information. Returns a `404 Not Found` status if projects are disabled. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.",
  },
  projectsListCollaborators: {
    comment: 'List project collaborators',
    doc: 'List project collaborators\n  Lists the collaborators for an organization project. For a project, the list of collaborators includes outside collaborators, organization members that are direct collaborators, organization members with access through team memberships, organization members with access through default organization permissions, and organization owners. You must be an organization owner or a project `admin` to list collaborators.',
  },
  projectsRemoveCollaborator: {
    comment: 'Remove user as a collaborator',
    doc: 'Remove user as a collaborator\n  Removes a collaborator from an organization project. You must be an organization owner or a project `admin` to remove a collaborator.',
  },
  projectsAddCollaborator: {
    comment: 'Add project collaborator',
    doc: 'Add project collaborator\n  Adds a collaborator to an organization project and sets their permission level. You must be an organization owner or a project `admin` to add a collaborator.',
  },
  projectsGetPermissionForUser: {
    comment: 'Get project permission for a user',
    doc: "Get project permission for a user\n  Returns the collaborator's permission level for an organization project. Possible values for the `permission` key: `admin`, `write`, `read`, `none`. You must be an organization owner or a project `admin` to review a user's permission level.",
  },
  projectsListColumns: {
    comment: 'List project columns',
    doc: 'List project columns',
  },
  projectsCreateColumn: {
    comment: 'Create a project column',
    doc: 'Create a project column',
  },
  rateLimitGet: {
    comment: 'Get rate limit status for the authenticated user',
    doc: "Get rate limit status for the authenticated user\n  Note: Accessing this endpoint does not count against your REST API rate limit.\n \n  Note: The `rate` object is deprecated. If you're writing new API client code or updating existing code, you should use the `core` object instead of the `rate` object. The `core` object contains the same information that is present in the `rate` object.",
  },
  actionsListRepoRequiredWorkflows: {
    comment: 'List repository required workflows',
    doc: 'List repository required workflows\n  Lists the required workflows in a repository. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint. For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsGetRepoRequiredWorkflow: {
    comment: 'Get a required workflow entity for a repository',
    doc: 'Get a required workflow entity for a repository\n  Gets a specific required workflow present in a repository. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint. For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsGetRepoRequiredWorkflowUsage: {
    comment: 'Get required workflow usage',
    doc: 'Get required workflow usage\n  Gets the number of billable minutes used by a specific required workflow during the current billing cycle.\n \n  Billable minutes only apply to required workflows running in private repositories that use GitHub-hosted runners. Usage is listed for each GitHub-hosted runner operating system in milliseconds. Any job re-runs are also included in the usage. The usage does not include the multiplier for macOS and Windows runners and is not rounded up to the nearest whole minute. For more information, see "[Managing billing for GitHub Actions](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-actions)."\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  reposDelete: {
    comment: 'Delete a repository',
    doc: 'Delete a repository\n  Deleting a repository requires admin access. If OAuth is used, the `delete_repo` scope is required.\n \n  If an organization owner has configured the organization to prevent members from deleting organization-owned\n  repositories, you will get a `403 Forbidden` response.',
  },
  reposGet: {
    comment: 'Get a repository',
    doc: 'Get a repository\n  The `parent` and `source` objects are present when the repository is a fork. `parent` is the repository this repository was forked from, `source` is the ultimate source for the network.\n \n  Note: In order to see the `security_and_analysis` block for a repository you must have admin permissions for the repository or be an owner or security manager for the organization that owns the repository. For more information, see "[Managing security managers in your organization](https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/managing-security-managers-in-your-organization)."',
  },
  reposUpdate: {
    comment: 'Update a repository',
    doc: "Update a repository\n  Note: To edit a repository's topics, use the [Replace all repository topics](https://docs.github.com/rest/reference/repos#replace-all-repository-topics) endpoint.",
  },
  actionsListArtifactsForRepo: {
    comment: 'List artifacts for a repository',
    doc: 'List artifacts for a repository\n  Lists all artifacts for a repository. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDeleteArtifact: {
    comment: 'Delete an artifact',
    doc: 'Delete an artifact\n  Deletes an artifact for a workflow run. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsGetArtifact: {
    comment: 'Get an artifact',
    doc: 'Get an artifact\n  Gets a specific artifact for a workflow run. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDownloadArtifact: {
    comment: 'Download an artifact',
    doc: 'Download an artifact\n  Gets a redirect URL to download an archive for a repository. This URL expires after 1 minute. Look for `Location:` in\n  the response header to find the URL for the download. The `:archive_format` must be `zip`. Anyone with read access to\n  the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope.\n  GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsGetActionsCacheUsage: {
    comment: 'Get GitHub Actions cache usage for a repository',
    doc: 'Get GitHub Actions cache usage for a repository\n  Gets GitHub Actions cache usage for a repository.\n  The data fetched using this API is refreshed approximately every 5 minutes, so values returned from this endpoint may take at least 5 minutes to get updated.\n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDeleteActionsCacheByKey: {
    comment: 'Delete GitHub Actions caches for a repository (using a cache key)',
    doc: 'Delete GitHub Actions caches for a repository (using a cache key)\n  Deletes one or more GitHub Actions caches for a repository, using a complete cache key. By default, all caches that match the provided key are deleted, but you can optionally provide a Git ref to restrict deletions to caches that match both the provided key and the Git ref.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n \n  GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsGetActionsCacheList: {
    comment: 'List GitHub Actions caches for a repository',
    doc: 'List GitHub Actions caches for a repository\n  Lists the GitHub Actions caches for a repository.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDeleteActionsCacheById: {
    comment: 'Delete a GitHub Actions cache for a repository (using a cache ID)',
    doc: 'Delete a GitHub Actions cache for a repository (using a cache ID)\n  Deletes a GitHub Actions cache for a repository, using a cache ID.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n \n  GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsGetJobForWorkflowRun: {
    comment: 'Get a job for a workflow run',
    doc: 'Get a job for a workflow run\n  Gets a specific job in a workflow run. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDownloadJobLogsForWorkflowRun: {
    comment: 'Download job logs for a workflow run',
    doc: 'Download job logs for a workflow run\n  Gets a redirect URL to download a plain text file of logs for a workflow job. This link expires after 1 minute. Look\n  for `Location:` in the response header to find the URL for the download. Anyone with read access to the repository can\n  use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must\n  have the `actions:read` permission to use this endpoint.',
  },
  actionsReRunJobForWorkflowRun: {
    comment: 'Re-run a job from a workflow run',
    doc: 'Re-run a job from a workflow run\n  Re-run a job and its dependent jobs in a workflow run. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsGetCustomOidcSubClaimForRepo: {
    comment: 'Get the customization template for an OIDC subject claim for a repository',
    doc: 'Get the customization template for an OIDC subject claim for a repository\n  Gets the customization template for an OpenID Connect (OIDC) subject claim.\n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint. GitHub Apps must have the `organization_administration:read` permission to use this endpoint.',
  },
  actionsSetCustomOidcSubClaimForRepo: {
    comment: 'Set the customization template for an OIDC subject claim for a repository',
    doc: 'Set the customization template for an OIDC subject claim for a repository\n  Sets the customization template and `opt-in` or `opt-out` flag for an OpenID Connect (OIDC) subject claim for a repository.\n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsGetGithubActionsPermissionsRepository: {
    comment: 'Get GitHub Actions permissions for a repository',
    doc: 'Get GitHub Actions permissions for a repository\n  Gets the GitHub Actions permissions policy for a repository, including whether GitHub Actions is enabled and the actions and reusable workflows allowed to run in the repository.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration` repository permission to use this API.',
  },
  actionsSetGithubActionsPermissionsRepository: {
    comment: 'Set GitHub Actions permissions for a repository',
    doc: 'Set GitHub Actions permissions for a repository\n  Sets the GitHub Actions permissions policy for enabling GitHub Actions and allowed actions and reusable workflows in the repository.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration` repository permission to use this API.',
  },
  actionsGetWorkflowAccessToRepository: {
    comment: 'Get the level of access for workflows outside of the repository',
    doc: 'Get the level of access for workflows outside of the repository\n  Gets the level of access that workflows outside of the repository have to actions and reusable workflows in the repository.\n  This endpoint only applies to private repositories.\n  For more information, see "[Allowing access to components in a private repository](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#allowing-access-to-components-in-a-private-repository)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the\n  repository `administration` permission to use this endpoint.',
  },
  actionsSetWorkflowAccessToRepository: {
    comment: 'Set the level of access for workflows outside of the repository',
    doc: 'Set the level of access for workflows outside of the repository\n  Sets the level of access that workflows outside of the repository have to actions and reusable workflows in the repository.\n  This endpoint only applies to private repositories.\n  For more information, see "[Allowing access to components in a private repository](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#allowing-access-to-components-in-a-private-repository)".\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the\n  repository `administration` permission to use this endpoint.',
  },
  actionsGetAllowedActionsRepository: {
    comment: 'Get allowed actions and reusable workflows for a repository',
    doc: 'Get allowed actions and reusable workflows for a repository\n  Gets the settings for selected actions and reusable workflows that are allowed in a repository. To use this endpoint, the repository policy for `allowed_actions` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for a repository](#set-github-actions-permissions-for-a-repository)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration` repository permission to use this API.',
  },
  actionsSetAllowedActionsRepository: {
    comment: 'Set allowed actions and reusable workflows for a repository',
    doc: 'Set allowed actions and reusable workflows for a repository\n  Sets the actions and reusable workflows that are allowed in a repository. To use this endpoint, the repository permission policy for `allowed_actions` must be configured to `selected`. For more information, see "[Set GitHub Actions permissions for a repository](#set-github-actions-permissions-for-a-repository)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration` repository permission to use this API.',
  },
  actionsGetGithubActionsDefaultWorkflowPermissionsRepository: {
    comment: 'Get default workflow permissions for a repository',
    doc: 'Get default workflow permissions for a repository\n  Gets the default workflow permissions granted to the `GITHUB_TOKEN` when running workflows in a repository,\n  as well as if GitHub Actions can submit approving pull request reviews.\n  For more information, see "[Setting the permissions of the GITHUB_TOKEN for your repository](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#setting-the-permissions-of-the-github_token-for-your-repository)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the repository `administration` permission to use this API.',
  },
  actionsSetGithubActionsDefaultWorkflowPermissionsRepository: {
    comment: 'Set default workflow permissions for a repository',
    doc: 'Set default workflow permissions for a repository\n  Sets the default workflow permissions granted to the `GITHUB_TOKEN` when running workflows in a repository, and sets if GitHub Actions\n  can submit approving pull request reviews.\n  For more information, see "[Setting the permissions of the GITHUB_TOKEN for your repository](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#setting-the-permissions-of-the-github_token-for-your-repository)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the repository `administration` permission to use this API.',
  },
  actionsListRequiredWorkflowRuns: {
    comment: 'List workflow runs for a required workflow',
    doc: 'List workflow runs for a required workflow\n  List all workflow runs for a required workflow. You can use parameters to narrow the list of results. For more information about using parameters, see [Parameters](https://docs.github.com/rest/overview/resources-in-the-rest-api#parameters).\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. For more information, see "[Required Workflows](https://docs.github.com/actions/using-workflows/required-workflows)."',
  },
  actionsListSelfHostedRunnersForRepo: {
    comment: 'List self-hosted runners for a repository',
    doc: 'List self-hosted runners for a repository\n  Lists all self-hosted runners configured in a repository. You must authenticate using an access token with the `repo` scope to use this endpoint.',
  },
  actionsListRunnerApplicationsForRepo: {
    comment: 'List runner applications for a repository',
    doc: 'List runner applications for a repository\n  Lists binaries for the runner application that you can download and run.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint.',
  },
  actionsCreateRegistrationTokenForRepo: {
    comment: 'Create a registration token for a repository',
    doc: 'Create a registration token for a repository\n  Returns a token that you can pass to the `config` script. The token expires after one hour. You must authenticate\n  using an access token with the `repo` scope to use this endpoint.\n \n  #### Example using registration token\n \n  Configure your self-hosted runner, replacing `TOKEN` with the registration token provided by this endpoint.\n \n  ```\n  ./config.sh --url https://github.com/octo-org/octo-repo-artifacts --token TOKEN\n  ```',
  },
  actionsCreateRemoveTokenForRepo: {
    comment: 'Create a remove token for a repository',
    doc: 'Create a remove token for a repository\n  Returns a token that you can pass to remove a self-hosted runner from a repository. The token expires after one hour.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n \n  #### Example using remove token\n \n  To remove your self-hosted runner from a repository, replace TOKEN with the remove token provided by this endpoint.\n \n  ```\n  ./config.sh remove --token TOKEN\n  ```',
  },
  actionsDeleteSelfHostedRunnerFromRepo: {
    comment: 'Delete a self-hosted runner from a repository',
    doc: 'Delete a self-hosted runner from a repository\n  Forces the removal of a self-hosted runner from a repository. You can use this endpoint to completely remove the runner when the machine you were using no longer exists.\n \n  You must authenticate using an access token with the `repo`\n  scope to use this endpoint.',
  },
  actionsGetSelfHostedRunnerForRepo: {
    comment: 'Get a self-hosted runner for a repository',
    doc: 'Get a self-hosted runner for a repository\n  Gets a specific self-hosted runner configured in a repository.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsRemoveAllCustomLabelsFromSelfHostedRunnerForRepo: {
    comment: 'Remove all custom labels from a self-hosted runner for a repository',
    doc: 'Remove all custom labels from a self-hosted runner for a repository\n  Remove all custom labels from a self-hosted runner configured in a\n  repository. Returns the remaining read-only labels from the runner.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsListLabelsForSelfHostedRunnerForRepo: {
    comment: 'List labels for a self-hosted runner for a repository',
    doc: 'List labels for a self-hosted runner for a repository\n  Lists all labels for a self-hosted runner configured in a repository.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsAddCustomLabelsToSelfHostedRunnerForRepo: {
    comment: 'Add custom labels to a self-hosted runner for a repository',
    doc: 'Add custom labels to a self-hosted runner for a repository\n  Add custom labels to a self-hosted runner configured in a repository.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsSetCustomLabelsForSelfHostedRunnerForRepo: {
    comment: 'Set custom labels for a self-hosted runner for a repository',
    doc: 'Set custom labels for a self-hosted runner for a repository\n  Remove all previous custom labels and set the new custom labels for a specific\n  self-hosted runner configured in a repository.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsRemoveCustomLabelFromSelfHostedRunnerForRepo: {
    comment: 'Remove a custom label from a self-hosted runner for a repository',
    doc: 'Remove a custom label from a self-hosted runner for a repository\n  Remove a custom label from a self-hosted runner configured\n  in a repository. Returns the remaining labels from the runner.\n \n  This endpoint returns a `404 Not Found` status if the custom label is not\n  present on the runner.\n \n  You must authenticate using an access token with the `repo` scope to use this\n  endpoint.',
  },
  actionsListWorkflowRunsForRepo: {
    comment: 'List workflow runs for a repository',
    doc: 'List workflow runs for a repository\n  Lists all workflow runs for a repository. You can use parameters to narrow the list of results. For more information about using parameters, see [Parameters](https://docs.github.com/rest/overview/resources-in-the-rest-api#parameters).\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDeleteWorkflowRun: {
    comment: 'Delete a workflow run',
    doc: 'Delete a workflow run\n  Delete a specific workflow run. Anyone with write access to the repository can use this endpoint. If the repository is\n  private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:write` permission to use\n  this endpoint.',
  },
  actionsGetWorkflowRun: {
    comment: 'Get a workflow run',
    doc: 'Get a workflow run\n  Gets a specific workflow run. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsGetReviewsForRun: {
    comment: 'Get the review history for a workflow run',
    doc: 'Get the review history for a workflow run\n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsApproveWorkflowRun: {
    comment: 'Approve a workflow run for a fork pull request',
    doc: 'Approve a workflow run for a fork pull request\n  Approves a workflow run for a pull request from a public fork of a first time contributor. For more information, see ["Approving workflow runs from public forks](https://docs.github.com/actions/managing-workflow-runs/approving-workflow-runs-from-public-forks)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsListWorkflowRunArtifacts: {
    comment: 'List workflow run artifacts',
    doc: 'List workflow run artifacts\n  Lists artifacts for a workflow run. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsGetWorkflowRunAttempt: {
    comment: 'Get a workflow run attempt',
    doc: 'Get a workflow run attempt\n  Gets a specific workflow run attempt. Anyone with read access to the repository\n  can use this endpoint. If the repository is private you must use an access token\n  with the `repo` scope. GitHub Apps must have the `actions:read` permission to\n  use this endpoint.',
  },
  actionsListJobsForWorkflowRunAttempt: {
    comment: 'List jobs for a workflow run attempt',
    doc: 'List jobs for a workflow run attempt\n  Lists jobs for a specific workflow run attempt. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint. You can use parameters to narrow the list of results. For more information about using parameters, see [Parameters](https://docs.github.com/rest/overview/resources-in-the-rest-api#parameters).',
  },
  actionsDownloadWorkflowRunAttemptLogs: {
    comment: 'Download workflow run attempt logs',
    doc: 'Download workflow run attempt logs\n  Gets a redirect URL to download an archive of log files for a specific workflow run attempt. This link expires after\n  1 minute. Look for `Location:` in the response header to find the URL for the download. Anyone with read access to\n  the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope.\n  GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsCancelWorkflowRun: {
    comment: 'Cancel a workflow run',
    doc: 'Cancel a workflow run\n  Cancels a workflow run using its `id`. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsListJobsForWorkflowRun: {
    comment: 'List jobs for a workflow run',
    doc: 'List jobs for a workflow run\n  Lists jobs for a workflow run. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint. You can use parameters to narrow the list of results. For more information about using parameters, see [Parameters](https://docs.github.com/rest/overview/resources-in-the-rest-api#parameters).',
  },
  actionsDeleteWorkflowRunLogs: {
    comment: 'Delete workflow run logs',
    doc: 'Delete workflow run logs\n  Deletes all logs for a workflow run. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsDownloadWorkflowRunLogs: {
    comment: 'Download workflow run logs',
    doc: 'Download workflow run logs\n  Gets a redirect URL to download an archive of log files for a workflow run. This link expires after 1 minute. Look for\n  `Location:` in the response header to find the URL for the download. Anyone with read access to the repository can use\n  this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have\n  the `actions:read` permission to use this endpoint.',
  },
  actionsGetPendingDeploymentsForRun: {
    comment: 'Get pending deployments for a workflow run',
    doc: 'Get pending deployments for a workflow run\n  Get all deployment environments for a workflow run that are waiting for protection rules to pass.\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsReviewPendingDeploymentsForRun: {
    comment: 'Review pending deployments for a workflow run',
    doc: 'Review pending deployments for a workflow run\n  Approve or reject pending deployments that are waiting on approval by a required reviewer.\n \n  Required reviewers with read access to the repository contents and deployments can use this endpoint. Required reviewers must authenticate using an access token with the `repo` scope to use this endpoint.',
  },
  actionsReRunWorkflow: {
    comment: 'Re-run a workflow',
    doc: 'Re-run a workflow\n  Re-runs your workflow run using its `id`. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsReRunWorkflowFailedJobs: {
    comment: 'Re-run failed jobs from a workflow run',
    doc: 'Re-run failed jobs from a workflow run\n  Re-run all of the failed jobs and their dependent jobs in a workflow run using the `id` of the workflow run. You must authenticate using an access token with the `repo` scope to use this endpoint.',
  },
  actionsGetWorkflowRunUsage: {
    comment: 'Get workflow run usage',
    doc: 'Get workflow run usage\n  Gets the number of billable minutes and total run time for a specific workflow run. Billable minutes only apply to workflows in private repositories that use GitHub-hosted runners. Usage is listed for each GitHub-hosted runner operating system in milliseconds. Any job re-runs are also included in the usage. The usage does not include the multiplier for macOS and Windows runners and is not rounded up to the nearest whole minute. For more information, see "[Managing billing for GitHub Actions](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-actions)".\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsListRepoSecrets: {
    comment: 'List repository secrets',
    doc: 'List repository secrets\n  Lists all secrets available in a repository without revealing their encrypted values. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsGetRepoPublicKey: {
    comment: 'Get a repository public key',
    doc: 'Get a repository public key\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsDeleteRepoSecret: {
    comment: 'Delete a repository secret',
    doc: 'Delete a repository secret\n  Deletes a secret in a repository using the secret name. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsGetRepoSecret: {
    comment: 'Get a repository secret',
    doc: 'Get a repository secret\n  Gets a single repository secret without revealing its encrypted value. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsCreateOrUpdateRepoSecret: {
    comment: 'Create or update a repository secret',
    doc: 'Create or update a repository secret\n  Creates or updates a repository secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use\n  this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  actionsListRepoVariables: {
    comment: 'List repository variables',
    doc: 'List repository variables\n  Lists all repository variables. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions_variables:read` repository permission to use this endpoint.',
  },
  actionsCreateRepoVariable: {
    comment: 'Create a repository variable',
    doc: 'Create a repository variable\n  Creates a repository variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `actions_variables:write` repository permission to use this endpoint.',
  },
  actionsDeleteRepoVariable: {
    comment: 'Delete a repository variable',
    doc: 'Delete a repository variable\n  Deletes a repository variable using the variable name.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `actions_variables:write` repository permission to use this endpoint.',
  },
  actionsGetRepoVariable: {
    comment: 'Get a repository variable',
    doc: 'Get a repository variable\n  Gets a specific variable in a repository. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions_variables:read` repository permission to use this endpoint.',
  },
  actionsUpdateRepoVariable: {
    comment: 'Update a repository variable',
    doc: 'Update a repository variable\n  Updates a repository variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `actions_variables:write` repository permission to use this endpoint.',
  },
  actionsListRepoWorkflows: {
    comment: 'List repository workflows',
    doc: 'List repository workflows\n  Lists the workflows in a repository. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsGetWorkflow: {
    comment: 'Get a workflow',
    doc: 'Get a workflow\n  Gets a specific workflow. You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  actionsDisableWorkflow: {
    comment: 'Disable a workflow',
    doc: 'Disable a workflow\n  Disables a workflow and sets the `state` of the workflow to `disabled_manually`. You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsCreateWorkflowDispatch: {
    comment: 'Create a workflow dispatch event',
    doc: 'Create a workflow dispatch event\n  You can use this endpoint to manually trigger a GitHub Actions workflow run. You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`.\n \n  You must configure your GitHub Actions workflow to run when the [`workflow_dispatch` webhook](/developers/webhooks-and-events/webhook-events-and-payloads#workflow_dispatch) event occurs. The `inputs` are configured in the workflow file. For more information about how to configure the `workflow_dispatch` event in the workflow file, see "[Events that trigger workflows](/actions/reference/events-that-trigger-workflows#workflow_dispatch)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint. For more information, see "[Creating a personal access token for the command line](https://docs.github.com/articles/creating-a-personal-access-token-for-the-command-line)."',
  },
  actionsEnableWorkflow: {
    comment: 'Enable a workflow',
    doc: 'Enable a workflow\n  Enables a workflow and sets the `state` of the workflow to `active`. You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `actions:write` permission to use this endpoint.',
  },
  actionsListWorkflowRuns: {
    comment: 'List workflow runs for a workflow',
    doc: 'List workflow runs for a workflow\n  List all workflow runs for a workflow. You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`. You can use parameters to narrow the list of results. For more information about using parameters, see [Parameters](https://docs.github.com/rest/overview/resources-in-the-rest-api#parameters).\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope.',
  },
  actionsGetWorkflowUsage: {
    comment: 'Get workflow usage',
    doc: 'Get workflow usage\n  Gets the number of billable minutes used by a specific workflow during the current billing cycle. Billable minutes only apply to workflows in private repositories that use GitHub-hosted runners. Usage is listed for each GitHub-hosted runner operating system in milliseconds. Any job re-runs are also included in the usage. The usage does not include the multiplier for macOS and Windows runners and is not rounded up to the nearest whole minute. For more information, see "[Managing billing for GitHub Actions](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-actions)".\n \n  You can replace `workflow_id` with the workflow file name. For example, you could use `main.yaml`. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  issuesListAssignees: {
    comment: 'List assignees',
    doc: 'List assignees\n  Lists the [available assignees](https://docs.github.com/articles/assigning-issues-and-pull-requests-to-other-github-users/) for issues in a repository.',
  },
  issuesCheckUserCanBeAssigned: {
    comment: 'Check if a user can be assigned',
    doc: 'Check if a user can be assigned\n  Checks if a user has permission to be assigned to an issue in this repository.\n \n  If the `assignee` can be assigned to issues in the repository, a `204` header with no content is returned.\n \n  Otherwise a `404` status code is returned.',
  },
  reposListAutolinks: {
    comment: 'List all autolinks of a repository',
    doc: 'List all autolinks of a repository\n  This returns a list of autolinks configured for the given repository.\n \n  Information about autolinks are only available to repository administrators.',
  },
  reposCreateAutolink: {
    comment: 'Create an autolink reference for a repository',
    doc: 'Create an autolink reference for a repository\n  Users with admin access to the repository can create an autolink.',
  },
  reposDeleteAutolink: {
    comment: 'Delete an autolink reference from a repository',
    doc: 'Delete an autolink reference from a repository\n  This deletes a single autolink reference by ID that was configured for the given repository.\n \n  Information about autolinks are only available to repository administrators.',
  },
  reposGetAutolink: {
    comment: 'Get an autolink reference of a repository',
    doc: 'Get an autolink reference of a repository\n  This returns a single autolink reference by ID that was configured for the given repository.\n \n  Information about autolinks are only available to repository administrators.',
  },
  reposDisableAutomatedSecurityFixes: {
    comment: 'Disable automated security fixes',
    doc: 'Disable automated security fixes\n  Disables automated security fixes for a repository. The authenticated user must have admin access to the repository. For more information, see "[Configuring automated security fixes](https://docs.github.com/articles/configuring-automated-security-fixes)".',
  },
  reposEnableAutomatedSecurityFixes: {
    comment: 'Enable automated security fixes',
    doc: 'Enable automated security fixes\n  Enables automated security fixes for a repository. The authenticated user must have admin access to the repository. For more information, see "[Configuring automated security fixes](https://docs.github.com/articles/configuring-automated-security-fixes)".',
  },
  reposListBranches: {
    comment: 'List branches',
    doc: 'List branches',
  },
  reposGetBranch: {
    comment: 'Get a branch',
    doc: 'Get a branch',
  },
  reposDeleteBranchProtection: {
    comment: 'Delete branch protection',
    doc: "Delete branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposGetBranchProtection: {
    comment: 'Get branch protection',
    doc: "Get branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposUpdateBranchProtection: {
    comment: 'Update branch protection',
    doc: "Update branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Protecting a branch requires admin or owner permissions to the repository.\n \n  Note: Passing new arrays of `users` and `teams` replaces their previous values.\n \n  Note: The list of users, apps, and teams in total is limited to 100 items.",
  },
  reposDeleteAdminBranchProtection: {
    comment: 'Delete admin branch protection',
    doc: "Delete admin branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Removing admin enforcement requires admin or owner permissions to the repository and branch protection to be enabled.",
  },
  reposGetAdminBranchProtection: {
    comment: 'Get admin branch protection',
    doc: "Get admin branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposSetAdminBranchProtection: {
    comment: 'Set admin branch protection',
    doc: "Set admin branch protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Adding admin enforcement requires admin or owner permissions to the repository and branch protection to be enabled.",
  },
  reposDeletePullRequestReviewProtection: {
    comment: 'Delete pull request review protection',
    doc: "Delete pull request review protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposGetPullRequestReviewProtection: {
    comment: 'Get pull request review protection',
    doc: "Get pull request review protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposUpdatePullRequestReviewProtection: {
    comment: 'Update pull request review protection',
    doc: "Update pull request review protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Updating pull request review enforcement requires admin or owner permissions to the repository and branch protection to be enabled.\n \n  Note: Passing new arrays of `users` and `teams` replaces their previous values.",
  },
  reposDeleteCommitSignatureProtection: {
    comment: 'Delete commit signature protection',
    doc: "Delete commit signature protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  When authenticated with admin or owner permissions to the repository, you can use this endpoint to disable required signed commits on a branch. You must enable branch protection to require signed commits.",
  },
  reposGetCommitSignatureProtection: {
    comment: 'Get commit signature protection',
    doc: "Get commit signature protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  When authenticated with admin or owner permissions to the repository, you can use this endpoint to check whether a branch requires signed commits. An enabled status of `true` indicates you must sign commits on this branch. For more information, see [Signing commits with GPG](https://docs.github.com/articles/signing-commits-with-gpg) in GitHub Help.\n \n  Note: You must enable branch protection to require signed commits.",
  },
  reposCreateCommitSignatureProtection: {
    comment: 'Create commit signature protection',
    doc: "Create commit signature protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  When authenticated with admin or owner permissions to the repository, you can use this endpoint to require signed commits on a branch. You must enable branch protection to require signed commits.",
  },
  reposRemoveStatusCheckProtection: {
    comment: 'Remove status check protection',
    doc: "Remove status check protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposGetStatusChecksProtection: {
    comment: 'Get status checks protection',
    doc: "Get status checks protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposUpdateStatusCheckProtection: {
    comment: 'Update status check protection',
    doc: "Update status check protection\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Updating required status checks requires admin or owner permissions to the repository and branch protection to be enabled.",
  },
  reposRemoveStatusCheckContexts: {
    comment: 'Remove status check contexts',
    doc: "Remove status check contexts\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposGetAllStatusCheckContexts: {
    comment: 'Get all status check contexts',
    doc: "Get all status check contexts\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposAddStatusCheckContexts: {
    comment: 'Add status check contexts',
    doc: "Add status check contexts\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposSetStatusCheckContexts: {
    comment: 'Set status check contexts',
    doc: "Set status check contexts\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  reposDeleteAccessRestrictions: {
    comment: 'Delete access restrictions',
    doc: "Delete access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Disables the ability to restrict who can push to this branch.",
  },
  reposGetAccessRestrictions: {
    comment: 'Get access restrictions',
    doc: "Get access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Lists who has access to this protected branch.\n \n  Note: Users, apps, and teams `restrictions` are only available for organization-owned repositories.",
  },
  reposRemoveAppAccessRestrictions: {
    comment: 'Remove app access restrictions',
    doc: "Remove app access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Removes the ability of an app to push to this branch. Only installed GitHub Apps with `write` access to the `contents` permission can be added as authorized actors on a protected branch.",
  },
  reposGetAppsWithAccessToProtectedBranch: {
    comment: 'Get apps with access to the protected branch',
    doc: "Get apps with access to the protected branch\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Lists the GitHub Apps that have push access to this branch. Only installed GitHub Apps with `write` access to the `contents` permission can be added as authorized actors on a protected branch.",
  },
  reposAddAppAccessRestrictions: {
    comment: 'Add app access restrictions',
    doc: "Add app access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Grants the specified apps push access for this branch. Only installed GitHub Apps with `write` access to the `contents` permission can be added as authorized actors on a protected branch.",
  },
  reposSetAppAccessRestrictions: {
    comment: 'Set app access restrictions',
    doc: "Set app access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Replaces the list of apps that have push access to this branch. This removes all apps that previously had push access and grants push access to the new list of apps. Only installed GitHub Apps with `write` access to the `contents` permission can be added as authorized actors on a protected branch.",
  },
  reposRemoveTeamAccessRestrictions: {
    comment: 'Remove team access restrictions',
    doc: "Remove team access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Removes the ability of a team to push to this branch. You can also remove push access for child teams.",
  },
  reposGetTeamsWithAccessToProtectedBranch: {
    comment: 'Get teams with access to the protected branch',
    doc: "Get teams with access to the protected branch\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Lists the teams who have push access to this branch. The list includes child teams.",
  },
  reposAddTeamAccessRestrictions: {
    comment: 'Add team access restrictions',
    doc: "Add team access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Grants the specified teams push access for this branch. You can also give push access to child teams.",
  },
  reposSetTeamAccessRestrictions: {
    comment: 'Set team access restrictions',
    doc: "Set team access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Replaces the list of teams that have push access to this branch. This removes all teams that previously had push access and grants push access to the new list of teams. Team restrictions include child teams.",
  },
  reposRemoveUserAccessRestrictions: {
    comment: 'Remove user access restrictions',
    doc: "Remove user access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Removes the ability of a user to push to this branch.\n \n  | Type    | Description                                                                                                                                   |\n  | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |\n  | `array` | Usernames of the people who should no longer have push access. Note: The list of users, apps, and teams in total is limited to 100 items. |",
  },
  reposGetUsersWithAccessToProtectedBranch: {
    comment: 'Get users with access to the protected branch',
    doc: "Get users with access to the protected branch\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Lists the people who have push access to this branch.",
  },
  reposAddUserAccessRestrictions: {
    comment: 'Add user access restrictions',
    doc: "Add user access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Grants the specified people push access for this branch.\n \n  | Type    | Description                                                                                                                   |\n  | ------- | ----------------------------------------------------------------------------------------------------------------------------- |\n  | `array` | Usernames for people who can have push access. Note: The list of users, apps, and teams in total is limited to 100 items. |",
  },
  reposSetUserAccessRestrictions: {
    comment: 'Set user access restrictions',
    doc: "Set user access restrictions\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Replaces the list of people that have push access to this branch. This removes all people that previously had push access and grants push access to the new list of people.\n \n  | Type    | Description                                                                                                                   |\n  | ------- | ----------------------------------------------------------------------------------------------------------------------------- |\n  | `array` | Usernames for people who can have push access. Note: The list of users, apps, and teams in total is limited to 100 items. |",
  },
  reposRenameBranch: {
    comment: 'Rename a branch',
    doc: 'Rename a branch\n  Renames a branch in a repository.\n \n  Note: Although the API responds immediately, the branch rename process might take some extra time to complete in the background. You won\'t be able to push to the old branch name while the rename process is in progress. For more information, see "[Renaming a branch](https://docs.github.com/github/administering-a-repository/renaming-a-branch)".\n \n  The permissions required to use this endpoint depends on whether you are renaming the default branch.\n \n  To rename a non-default branch:\n \n   Users must have push access.\n   GitHub Apps must have the `contents:write` repository permission.\n \n  To rename the default branch:\n \n   Users must have admin or owner permissions.\n   GitHub Apps must have the `administration:write` repository permission.',
  },
  checksCreate: {
    comment: 'Create a check run',
    doc: 'Create a check run\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array.\n \n  Creates a new check run for a specific commit in a repository. Your GitHub App must have the `checks:write` permission to create check runs.\n \n  In a check suite, GitHub limits the number of check runs with the same name to 1000. Once these check runs exceed 1000, GitHub will start to automatically delete older check runs.',
  },
  checksGet: {
    comment: 'Get a check run',
    doc: 'Get a check run\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array.\n \n  Gets a single check run using its `id`. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to get check runs. OAuth Apps and authenticated users must have the `repo` scope to get check runs in a private repository.',
  },
  checksUpdate: {
    comment: 'Update a check run',
    doc: 'Update a check run\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array.\n \n  Updates a check run for a specific commit in a repository. Your GitHub App must have the `checks:write` permission to edit check runs.',
  },
  checksListAnnotations: {
    comment: 'List check run annotations',
    doc: 'List check run annotations\n  Lists annotations for a check run using the annotation `id`. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to get annotations for a check run. OAuth Apps and authenticated users must have the `repo` scope to get annotations for a check run in a private repository.',
  },
  checksRerequestRun: {
    comment: 'Rerequest a check run',
    doc: 'Rerequest a check run\n  Triggers GitHub to rerequest an existing check run, without pushing new code to a repository. This endpoint will trigger the [`check_run` webhook](https://docs.github.com/webhooks/event-payloads/#check_run) event with the action `rerequested`. When a check run is `rerequested`, its `status` is reset to `queued` and the `conclusion` is cleared.\n \n  To rerequest a check run, your GitHub App must have the `checks:read` permission on a private repository or pull access to a public repository.',
  },
  checksCreateSuite: {
    comment: 'Create a check suite',
    doc: 'Create a check suite\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array and a `null` value for `head_branch`.\n \n  By default, check suites are automatically created when you create a [check run](https://docs.github.com/rest/reference/checks#check-runs). You only need to use this endpoint for manually creating check suites when you\'ve disabled automatic creation using "[Update repository preferences for check suites](https://docs.github.com/rest/reference/checks#update-repository-preferences-for-check-suites)". Your GitHub App must have the `checks:write` permission to create check suites.',
  },
  checksSetSuitesPreferences: {
    comment: 'Update repository preferences for check suites',
    doc: 'Update repository preferences for check suites\n  Changes the default automatic flow when creating check suites. By default, a check suite is automatically created each time code is pushed to a repository. When you disable the automatic creation of check suites, you can manually [Create a check suite](https://docs.github.com/rest/reference/checks#create-a-check-suite). You must have admin permissions in the repository to set preferences for check suites.',
  },
  checksGetSuite: {
    comment: 'Get a check suite',
    doc: 'Get a check suite\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array and a `null` value for `head_branch`.\n \n  Gets a single check suite using its `id`. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to get check suites. OAuth Apps and authenticated users must have the `repo` scope to get check suites in a private repository.',
  },
  checksListForSuite: {
    comment: 'List check runs in a check suite',
    doc: 'List check runs in a check suite\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array.\n \n  Lists check runs for a check suite using its `id`. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to get check runs. OAuth Apps and authenticated users must have the `repo` scope to get check runs in a private repository.',
  },
  checksRerequestSuite: {
    comment: 'Rerequest a check suite',
    doc: 'Rerequest a check suite\n  Triggers GitHub to rerequest an existing check suite, without pushing new code to a repository. This endpoint will trigger the [`check_suite` webhook](https://docs.github.com/webhooks/event-payloads/#check_suite) event with the action `rerequested`. When a check suite is `rerequested`, its `status` is reset to `queued` and the `conclusion` is cleared.\n \n  To rerequest a check suite, your GitHub App must have the `checks:read` permission on a private repository or pull access to a public repository.',
  },
  codeScanningListAlertsForRepo: {
    comment: 'List code scanning alerts for a repository',
    doc: 'List code scanning alerts for a repository\n  Lists code scanning alerts.\n \n  To use this endpoint, you must use an access token with the `security_events` scope or, for alerts from public repositories only, an access token with the `public_repo` scope.\n \n  GitHub Apps must have the `security_events` read\n  permission to use this endpoint.\n \n  The response includes a `most_recent_instance` object.\n  This provides details of the most recent instance of this alert\n  for the default branch (or for the specified Git reference if you used `ref` in the request).',
  },
  codeScanningGetAlert: {
    comment: 'Get a code scanning alert',
    doc: 'Get a code scanning alert\n  Gets a single code scanning alert. You must use an access token with the `security_events` scope to use this endpoint with private repos, the `public_repo` scope also grants permission to read security events on public repos only. GitHub Apps must have the `security_events` read permission to use this endpoint.',
  },
  codeScanningUpdateAlert: {
    comment: 'Update a code scanning alert',
    doc: 'Update a code scanning alert\n  Updates the status of a single code scanning alert. You must use an access token with the `security_events` scope to use this endpoint with private repositories. You can also use tokens with the `public_repo` scope for public repositories only. GitHub Apps must have the `security_events` write permission to use this endpoint.',
  },
  codeScanningListAlertInstances: {
    comment: 'List instances of a code scanning alert',
    doc: 'List instances of a code scanning alert\n  Lists all instances of the specified code scanning alert.\n  You must use an access token with the `security_events` scope to use this endpoint with private repos,\n  the `public_repo` scope also grants permission to read security events on public repos only.\n  GitHub Apps must have the `security_events` read permission to use this endpoint.',
  },
  codeScanningListRecentAnalyses: {
    comment: 'List code scanning analyses for a repository',
    doc: "List code scanning analyses for a repository\n  Lists the details of all code scanning analyses for a repository,\n  starting with the most recent.\n  The response is paginated and you can use the `page` and `per_page` parameters\n  to list the analyses you're interested in.\n  By default 30 analyses are listed per page.\n \n  The `rules_count` field in the response give the number of rules\n  that were run in the analysis.\n  For very old analyses this data is not available,\n  and `0` is returned in this field.\n \n  You must use an access token with the `security_events` scope to use this endpoint with private repos,\n  the `public_repo` scope also grants permission to read security events on public repos only.\n  GitHub Apps must have the `security_events` read permission to use this endpoint.\n \n  Deprecation notice:\n  The `tool_name` field is deprecated and will, in future, not be included in the response for this endpoint. The example response reflects this change. The tool name can now be found inside the `tool` field.",
  },
  codeScanningDeleteAnalysis: {
    comment: 'Delete a code scanning analysis from a repository',
    doc: "Delete a code scanning analysis from a repository\n  Deletes a specified code scanning analysis from a repository. For\n  private repositories, you must use an access token with the `repo` scope. For public repositories,\n  you must use an access token with `public_repo` scope.\n  GitHub Apps must have the `security_events` write permission to use this endpoint.\n \n  You can delete one analysis at a time.\n  To delete a series of analyses, start with the most recent analysis and work backwards.\n  Conceptually, the process is similar to the undo function in a text editor.\n \n  When you list the analyses for a repository,\n  one or more will be identified as deletable in the response:\n \n  ```\n  \"deletable\": true\n  ```\n \n  An analysis is deletable when it's the most recent in a set of analyses.\n  Typically, a repository will have multiple sets of analyses\n  for each enabled code scanning tool,\n  where a set is determined by a unique combination of analysis values:\n \n   `ref`\n   `tool`\n   `category`\n \n  If you attempt to delete an analysis that is not the most recent in a set,\n  you'll get a 400 response with the message:\n \n  ```\n  Analysis specified is not deletable.\n  ```\n \n  The response from a successful `DELETE` operation provides you with\n  two alternative URLs for deleting the next analysis in the set:\n  `next_analysis_url` and `confirm_delete_url`.\n  Use the `next_analysis_url` URL if you want to avoid accidentally deleting the final analysis\n  in a set. This is a useful option if you want to preserve at least one analysis\n  for the specified tool in your repository.\n  Use the `confirm_delete_url` URL if you are content to remove all analyses for a tool.\n  When you delete the last analysis in a set, the value of `next_analysis_url` and `confirm_delete_url`\n  in the 200 response is `null`.\n \n  As an example of the deletion process,\n  let's imagine that you added a workflow that configured a particular code scanning tool\n  to analyze the code in a repository. This tool has added 15 analyses:\n  10 on the default branch, and another 5 on a topic branch.\n  You therefore have two separate sets of analyses for this tool.\n  You've now decided that you want to remove all of the analyses for the tool.\n  To do this you must make 15 separate deletion requests.\n  To start, you must find an analysis that's identified as deletable.\n  Each set of analyses always has one that's identified as deletable.\n  Having found the deletable analysis for one of the two sets,\n  delete this analysis and then continue deleting the next analysis in the set until they're all deleted.\n  Then repeat the process for the second set.\n  The procedure therefore consists of a nested loop:\n \n  Outer loop:\n   List the analyses for the repository, filtered by tool.\n   Parse this list to find a deletable analysis. If found:\n \n  Inner loop:\n   Delete the identified analysis.\n   Parse the response for the value of `confirm_delete_url` and, if found, use this in the next iteration.\n \n  The above process assumes that you want to remove all trace of the tool's analyses from the GitHub user interface, for the specified repository, and it therefore uses the `confirm_delete_url` value. Alternatively, you could use the `next_analysis_url` value, which would leave the last analysis in each set undeleted to avoid removing a tool's analysis entirely.",
  },
  codeScanningGetAnalysis: {
    comment: 'Get a code scanning analysis for a repository',
    doc: 'Get a code scanning analysis for a repository\n  Gets a specified code scanning analysis for a repository.\n  You must use an access token with the `security_events` scope to use this endpoint with private repos,\n  the `public_repo` scope also grants permission to read security events on public repos only.\n  GitHub Apps must have the `security_events` read permission to use this endpoint.\n \n  The default JSON response contains fields that describe the analysis.\n  This includes the Git reference and commit SHA to which the analysis relates,\n  the datetime of the analysis, the name of the code scanning tool,\n  and the number of alerts.\n \n  The `rules_count` field in the default response give the number of rules\n  that were run in the analysis.\n  For very old analyses this data is not available,\n  and `0` is returned in this field.\n \n  If you use the Accept header `application/sarif+json`,\n  the response contains the analysis data that was uploaded.\n  This is formatted as\n  [SARIF version 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/sarif-v2.1.0-cs01.html).',
  },
  codeScanningListCodeqlDatabases: {
    comment: 'List CodeQL databases for a repository',
    doc: 'List CodeQL databases for a repository\n  Lists the CodeQL databases that are available in a repository.\n \n  For private repositories, you must use an access token with the `security_events` scope.\n  For public repositories, you can use tokens with the `security_events` or `public_repo` scope.\n  GitHub Apps must have the `contents` read permission to use this endpoint.',
  },
  codeScanningGetCodeqlDatabase: {
    comment: 'Get a CodeQL database for a repository',
    doc: 'Get a CodeQL database for a repository\n  Gets a CodeQL database for a language in a repository.\n \n  By default this endpoint returns JSON metadata about the CodeQL database. To\n  download the CodeQL database binary content, set the `Accept` header of the request\n  to [`application/zip`](https://docs.github.com/rest/overview/media-types), and make sure\n  your HTTP client is configured to follow redirects or use the `Location` header\n  to make a second request to get the redirect URL.\n \n  For private repositories, you must use an access token with the `security_events` scope.\n  For public repositories, you can use tokens with the `security_events` or `public_repo` scope.\n  GitHub Apps must have the `contents` read permission to use this endpoint.',
  },
  codeScanningUploadSarif: {
    comment: 'Upload an analysis as SARIF data',
    doc: 'Upload an analysis as SARIF data\n  Uploads SARIF data containing the results of a code scanning analysis to make the results available in a repository. You must use an access token with the `security_events` scope to use this endpoint for private repositories. You can also use tokens with the `public_repo` scope for public repositories only. GitHub Apps must have the `security_events` write permission to use this endpoint.\n \n  There are two places where you can upload code scanning results.\n  - If you upload to a pull request, for example `--ref refs/pull/42/merge` or `--ref refs/pull/42/head`, then the results appear as alerts in a pull request check. For more information, see "[Triaging code scanning alerts in pull requests](/code-security/secure-coding/triaging-code-scanning-alerts-in-pull-requests)."\n  - If you upload to a branch, for example `--ref refs/heads/my-branch`, then the results appear in the Security tab for your repository. For more information, see "[Managing code scanning alerts for your repository](/code-security/secure-coding/managing-code-scanning-alerts-for-your-repository#viewing-the-alerts-for-a-repository)."\n \n  You must compress the SARIF-formatted analysis data that you want to upload, using `gzip`, and then encode it as a Base64 format string. For example:\n \n  ```\n  gzip -c analysis-data.sarif | base64 -w0\n  ```\n  <br>\n  SARIF upload supports a maximum number of entries per the following data objects, and an analysis will be rejected if any of these objects is above its maximum value. For some objects, there are additional values over which the entries will be ignored while keeping the most important entries whenever applicable.\n  To get the most out of your analysis when it includes data above the supported limits, try to optimize the analysis configuration. For example, for the CodeQL tool, identify and remove the most noisy queries.\n \n \n  | SARIF data                   | Maximum values | Additional limits                                                            |\n  |----------------------------------|:------------------:|----------------------------------------------------------------------------------|\n  | Runs per file                    |         20         |                                                                                  |\n  | Results per run                  |       25,000       | Only the top 5,000 results will be included, prioritized by severity.            |\n  | Rules per run                    |       25,000       |                                                                                  |\n  | Tool extensions per run          |        100         |                                                                                  |\n  | Thread Flow Locations per result |       10,000       | Only the top 1,000 Thread Flow Locations will be included, using prioritization. |\n  | Location per result\t             |       1,000        | Only 100 locations will be included.                                             |\n  | Tags per rule\t                   |         20         | Only 10 tags will be included.                                                   |\n \n \n  The `202 Accepted` response includes an `id` value.\n  You can use this ID to check the status of the upload by using it in the `/sarifs/{sarif_id}` endpoint.\n  For more information, see "[Get information about a SARIF upload](/rest/reference/code-scanning#get-information-about-a-sarif-upload)."',
  },
  codeScanningGetSarif: {
    comment: 'Get information about a SARIF upload',
    doc: 'Get information about a SARIF upload\n  Gets information about a SARIF upload, including the status and the URL of the analysis that was uploaded so that you can retrieve details of the analysis. For more information, see "[Get a code scanning analysis for a repository](/rest/reference/code-scanning#get-a-code-scanning-analysis-for-a-repository)." You must use an access token with the `security_events` scope to use this endpoint with private repos, the `public_repo` scope also grants permission to read security events on public repos only. GitHub Apps must have the `security_events` read permission to use this endpoint.',
  },
  reposCodeownersErrors: {
    comment: 'List CODEOWNERS errors',
    doc: 'List CODEOWNERS errors\n  List any syntax errors that are detected in the CODEOWNERS\n  file.\n \n  For more information about the correct CODEOWNERS syntax,\n  see "[About code owners](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)."',
  },
  codespacesListInRepositoryForAuthenticatedUser: {
    comment: 'List codespaces in a repository for the authenticated user',
    doc: 'List codespaces in a repository for the authenticated user\n  Lists the codespaces associated to a specified repository and the authenticated user.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces` repository permission to use this endpoint.',
  },
  codespacesCreateWithRepoForAuthenticatedUser: {
    comment: 'Create a codespace in a repository',
    doc: 'Create a codespace in a repository\n  Creates a codespace owned by the authenticated user in the specified repository.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.',
  },
  codespacesListDevcontainersInRepositoryForAuthenticatedUser: {
    comment: 'List devcontainer configurations in a repository for the authenticated user',
    doc: 'List devcontainer configurations in a repository for the authenticated user\n  Lists the devcontainer.json files associated with a specified repository and the authenticated user. These files\n  specify launchpoint configurations for codespaces created within the repository.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_metadata` repository permission to use this endpoint.',
  },
  codespacesRepoMachinesForAuthenticatedUser: {
    comment: 'List available machine types for a repository',
    doc: 'List available machine types for a repository\n  List the machine types available for a given repository based on its configuration.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_metadata` repository permission to use this endpoint.',
  },
  codespacesPreFlightWithRepoForAuthenticatedUser: {
    comment: 'Get default attributes for a codespace',
    doc: 'Get default attributes for a codespace\n  Gets the default attributes for codespaces created by the user with the repository.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.',
  },
  codespacesListRepoSecrets: {
    comment: 'List repository secrets',
    doc: 'List repository secrets\n  Lists all secrets available in a repository without revealing their encrypted values. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have write access to the `codespaces_secrets` repository permission to use this endpoint.',
  },
  codespacesGetRepoPublicKey: {
    comment: 'Get a repository public key',
    doc: 'Get a repository public key\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have write access to the `codespaces_secrets` repository permission to use this endpoint.',
  },
  codespacesDeleteRepoSecret: {
    comment: 'Delete a repository secret',
    doc: 'Delete a repository secret\n  Deletes a secret in a repository using the secret name. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have write access to the `codespaces_secrets` repository permission to use this endpoint.',
  },
  codespacesGetRepoSecret: {
    comment: 'Get a repository secret',
    doc: 'Get a repository secret\n  Gets a single repository secret without revealing its encrypted value. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have write access to the `codespaces_secrets` repository permission to use this endpoint.',
  },
  codespacesCreateOrUpdateRepoSecret: {
    comment: 'Create or update a repository secret',
    doc: 'Create or update a repository secret\n  Creates or updates a repository secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `repo` scope to use this endpoint. GitHub Apps must have write access to the `codespaces_secrets`\n  repository permission to use this endpoint.\n \n  #### Example of encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example of encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example of encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example of encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  reposListCollaborators: {
    comment: 'List repository collaborators',
    doc: 'List repository collaborators\n  For organization-owned repositories, the list of collaborators includes outside collaborators, organization members that are direct collaborators, organization members with access through team memberships, organization members with access through default organization permissions, and organization owners.\n  Organization members with write, maintain, or admin privileges on the organization-owned repository can use this endpoint.\n \n  Team members will include the members of child teams.\n \n  You must authenticate using an access token with the `read:org` and `repo` scopes with push access to use this\n  endpoint. GitHub Apps must have the `members` organization permission and `metadata` repository permission to use this\n  endpoint.',
  },
  reposRemoveCollaborator: {
    comment: 'Remove a repository collaborator',
    doc: 'Remove a repository collaborator',
  },
  reposCheckCollaborator: {
    comment: 'Check if a user is a repository collaborator',
    doc: 'Check if a user is a repository collaborator\n  For organization-owned repositories, the list of collaborators includes outside collaborators, organization members that are direct collaborators, organization members with access through team memberships, organization members with access through default organization permissions, and organization owners.\n \n  Team members will include the members of child teams.\n \n  You must authenticate using an access token with the `read:org` and `repo` scopes with push access to use this\n  endpoint. GitHub Apps must have the `members` organization permission and `metadata` repository permission to use this\n  endpoint.',
  },
  reposAddCollaborator: {
    comment: 'Add a repository collaborator',
    doc: 'Add a repository collaborator\n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.\n \n  Adding an outside collaborator may be restricted by enterprise administrators. For more information, see "[Enforcing repository management policies in your enterprise](https://docs.github.com/admin/policies/enforcing-policies-for-your-enterprise/enforcing-repository-management-policies-in-your-enterprise#enforcing-a-policy-for-inviting-outside-collaborators-to-repositories)."\n \n  For more information on permission levels, see "[Repository permission levels for an organization](https://docs.github.com/github/setting-up-and-managing-organizations-and-teams/repository-permission-levels-for-an-organization#permission-levels-for-repositories-owned-by-an-organization)". There are restrictions on which permissions can be granted to organization members when an organization base role is in place. In this case, the permission being given must be equal to or higher than the org base permission. Otherwise, the request will fail with:\n \n  ```\n  Cannot assign {member} permission of {role name}\n  ```\n \n  Note that, if you choose not to pass any parameters, you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."\n \n  The invitee will receive a notification that they have been invited to the repository, which they must accept or decline. They may do this via the notifications page, the email they receive, or by using the [repository invitations API endpoints](https://docs.github.com/rest/reference/repos#invitations).\n \n  Updating an existing collaborator\'s permission level\n \n  The endpoint can also be used to change the permissions of an existing collaborator without first removing and re-adding the collaborator. To change the permissions, use the same endpoint and pass a different `permission` parameter. The response will be a `204`, with no other indication that the permission level changed.\n \n  Rate limits\n \n  You are limited to sending 50 invitations to a repository per 24 hour period. Note there is no limit if you are inviting organization members to an organization repository.',
  },
  reposGetCollaboratorPermissionLevel: {
    comment: 'Get repository permissions for a user',
    doc: 'Get repository permissions for a user\n  Checks the repository permission of a collaborator. The possible repository permissions are `admin`, `write`, `read`, and `none`.',
  },
  reposListCommitCommentsForRepo: {
    comment: 'List commit comments for a repository',
    doc: 'List commit comments for a repository\n  Commit Comments use [these custom media types](https://docs.github.com/rest/reference/repos#custom-media-types). You can read more about the use of media types in the API [here](https://docs.github.com/rest/overview/media-types/).\n \n  Comments are ordered by ascending ID.',
  },
  reposDeleteCommitComment: {
    comment: 'Delete a commit comment',
    doc: 'Delete a commit comment',
  },
  reposGetCommitComment: {
    comment: 'Get a commit comment',
    doc: 'Get a commit comment',
  },
  reposUpdateCommitComment: {
    comment: 'Update a commit comment',
    doc: 'Update a commit comment',
  },
  reactionsListForCommitComment: {
    comment: 'List reactions for a commit comment',
    doc: 'List reactions for a commit comment\n  List the reactions to a [commit comment](https://docs.github.com/rest/reference/repos#comments).',
  },
  reactionsCreateForCommitComment: {
    comment: 'Create reaction for a commit comment',
    doc: 'Create reaction for a commit comment\n  Create a reaction to a [commit comment](https://docs.github.com/rest/reference/repos#comments). A response with an HTTP `200` status means that you already added the reaction type to this commit comment.',
  },
  reactionsDeleteForCommitComment: {
    comment: 'Delete a commit comment reaction',
    doc: 'Delete a commit comment reaction\n  Note: You can also specify a repository by `repository_id` using the route `DELETE /repositories/:repository_id/comments/:comment_id/reactions/:reaction_id`.\n \n  Delete a reaction to a [commit comment](https://docs.github.com/rest/reference/repos#comments).',
  },
  reposListCommits: {
    comment: 'List commits',
    doc: 'List commits\n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  reposListBranchesForHeadCommit: {
    comment: 'List branches for HEAD commit',
    doc: "List branches for HEAD commit\n  Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Returns all branches where the given commit SHA is the HEAD, or latest commit for the branch.",
  },
  reposListCommentsForCommit: {
    comment: 'List commit comments',
    doc: 'List commit comments\n  Use the `:commit_sha` to specify the commit that will have its comments listed.',
  },
  reposCreateCommitComment: {
    comment: 'Create a commit comment',
    doc: 'Create a commit comment\n  Create a comment for a commit using its `:commit_sha`.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  reposListPullRequestsAssociatedWithCommit: {
    comment: 'List pull requests associated with a commit',
    doc: 'List pull requests associated with a commit\n  Lists the merged pull request that introduced the commit to the repository. If the commit is not present in the default branch, will only return open pull requests associated with the commit.',
  },
  reposGetCommit: {
    comment: 'Get a commit',
    doc: "Get a commit\n  Returns the contents of a single commit reference. You must have `read` access for the repository to use this endpoint.\n \n  Note: If there are more than 300 files in the commit diff, the response will include pagination link headers for the remaining files, up to a limit of 3000 files. Each page contains the static commit information, and the only changes are to the file listing.\n \n  You can pass the appropriate [media type](https://docs.github.com/rest/overview/media-types/#commits-commit-comparison-and-pull-requests) to  fetch `diff` and `patch` formats. Diffs with binary data will have no `patch` property.\n \n  To return only the SHA-1 hash of the commit reference, you can provide the `sha` custom [media type](https://docs.github.com/rest/overview/media-types/#commits-commit-comparison-and-pull-requests) in the `Accept` header. You can use this endpoint to check if a remote reference's SHA-1 hash is the same as your local reference's SHA-1 hash by providing the local SHA-1 reference as the ETag.\n \n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit's signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The \"signing\" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user's account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |",
  },
  checksListForRef: {
    comment: 'List check runs for a Git reference',
    doc: 'List check runs for a Git reference\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array.\n \n  Lists check runs for a commit ref. The `ref` can be a SHA, branch name, or a tag name. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to get check runs. OAuth Apps and authenticated users must have the `repo` scope to get check runs in a private repository.',
  },
  checksListSuitesForRef: {
    comment: 'List check suites for a Git reference',
    doc: 'List check suites for a Git reference\n  Note: The Checks API only looks for pushes in the repository where the check suite or check run were created. Pushes to a branch in a forked repository are not detected and return an empty `pull_requests` array and a `null` value for `head_branch`.\n \n  Lists check suites for a commit `ref`. The `ref` can be a SHA, branch name, or a tag name. GitHub Apps must have the `checks:read` permission on a private repository or pull access to a public repository to list check suites. OAuth Apps and authenticated users must have the `repo` scope to get check suites in a private repository.',
  },
  reposGetCombinedStatusForRef: {
    comment: 'Get the combined status for a specific reference',
    doc: 'Get the combined status for a specific reference\n  Users with pull access in a repository can access a combined view of commit statuses for a given ref. The ref can be a SHA, a branch name, or a tag name.\n \n \n  Additionally, a combined `state` is returned. The `state` is one of:\n \n     failure if any of the contexts report as `error` or `failure`\n     pending if there are no statuses or a context is `pending`\n     success if the latest status for all contexts is `success`',
  },
  reposListCommitStatusesForRef: {
    comment: 'List commit statuses for a reference',
    doc: 'List commit statuses for a reference\n  Users with pull access in a repository can view commit statuses for a given ref. The ref can be a SHA, a branch name, or a tag name. Statuses are returned in reverse chronological order. The first status in the list will be the latest one.\n \n  This resource is also available via a legacy route: `GET /repos/:owner/:repo/statuses/:ref`.',
  },
  reposGetCommunityProfileMetrics: {
    comment: 'Get community profile metrics',
    doc: 'Get community profile metrics\n  Returns all community profile metrics for a repository. The repository cannot be a fork.\n \n  The returned metrics include an overall health score, the repository description, the presence of documentation, the\n  detected code of conduct, the detected license, and the presence of ISSUE\\_TEMPLATE, PULL\\_REQUEST\\_TEMPLATE,\n  README, and CONTRIBUTING files.\n \n  The `health_percentage` score is defined as a percentage of how many of\n  these four documents are present: README, CONTRIBUTING, LICENSE, and\n  CODE_OF_CONDUCT. For example, if all four documents are present, then\n  the `health_percentage` is `100`. If only one is present, then the\n  `health_percentage` is `25`.\n \n  `content_reports_enabled` is only returned for organization-owned repositories.',
  },
  reposCompareCommits: {
    comment: 'Compare two commits',
    doc: 'Compare two commits\n  Compares two commits against one another. You can compare branches in the same repository, or you can compare branches that exist in different repositories within the same repository network, including fork branches. For more information about how to view a repository\'s network, see "[Understanding connections between repositories](https://docs.github.com/repositories/viewing-activity-and-data-for-your-repository/understanding-connections-between-repositories)."\n \n  This endpoint is equivalent to running the `git log BASE...HEAD` command, but it returns commits in a different order. The `git log BASE...HEAD` command returns commits in reverse chronological order, whereas the API returns commits in chronological order. You can pass the appropriate [media type](https://docs.github.com/rest/overview/media-types/#commits-commit-comparison-and-pull-requests) to fetch diff and patch formats.\n \n  The API response includes details about the files that were changed between the two commits. This includes the status of the change (if a file was added, removed, modified, or renamed), and details of the change itself. For example, files with a `renamed` status have a `previous_filename` field showing the previous filename of the file, and files with a `modified` status have a `patch` field showing the changes made to the file.\n \n  When calling this endpoint without any paging parameter (`per_page` or `page`), the returned list is limited to 250 commits, and the last commit in the list is the most recent of the entire comparison.\n \n  Working with large comparisons\n \n  To process a response with a large number of commits, use a query parameter (`per_page` or `page`) to paginate the results. When using pagination:\n \n  - The list of changed files is only shown on the first page of results, but it includes all changed files for the entire comparison.\n  - The results are returned in chronological order, but the last commit in the returned list may not be the most recent one in the entire set if there are more pages of results.\n \n  For more information on working with pagination, see "[Using pagination in the REST API](https://docs.github.com/rest/guides/using-pagination-in-the-rest-api)."\n \n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The `verification` object includes the following fields:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  reposDeleteFile: {
    comment: 'Delete a file',
    doc: 'Delete a file\n  Deletes a file in a repository.\n \n  You can provide an additional `committer` parameter, which is an object containing information about the committer. Or, you can provide an `author` parameter, which is an object containing information about the author.\n \n  The `author` section is optional and is filled in with the `committer` information if omitted. If the `committer` information is omitted, the authenticated user\'s information is used.\n \n  You must provide values for both `name` and `email`, whether you choose to use `author` or `committer`. Otherwise, you\'ll receive a `422` status code.\n \n  Note: If you use this endpoint and the "[Create or update file contents](https://docs.github.com/rest/reference/repos/#create-or-update-file-contents)" endpoint in parallel, the concurrent requests will conflict and you will receive errors. You must use these endpoints serially instead.',
  },
  reposGetContent: {
    comment: 'Get repository content',
    doc: 'Get repository content\n  Gets the contents of a file or directory in a repository. Specify the file path or directory in `:path`. If you omit\n  `:path`, you will receive the contents of the repository\'s root directory. See the description below regarding what the API response includes for directories.\n \n  Files and symlinks support [a custom media type](https://docs.github.com/rest/reference/repos#custom-media-types) for\n  retrieving the raw content or rendered HTML (when supported). All content types support [a custom media\n  type](https://docs.github.com/rest/reference/repos#custom-media-types) to ensure the content is returned in a consistent\n  object format.\n \n  Notes:\n     To get a repository\'s contents recursively, you can [recursively get the tree](https://docs.github.com/rest/reference/git#trees).\n     This API has an upper limit of 1,000 files for a directory. If you need to retrieve more files, use the [Git Trees\n  API](https://docs.github.com/rest/reference/git#get-a-tree).\n    Download URLs expire and are meant to be used just once. To ensure the download URL does not expire, please use the contents API to obtain a fresh download URL for each download.\n  #### Size limits\n  If the requested file\'s size is:\n   1 MB or smaller: All features of this endpoint are supported.\n   Between 1-100 MB: Only the `raw` or `object` [custom media types](https://docs.github.com/rest/repos/contents#custom-media-types-for-repository-contents) are supported. Both will work as normal, except that when using the `object` media type, the `content` field will be an empty string and the `encoding` field will be `"none"`. To get the contents of these larger files, use the `raw` media type.\n   Greater than 100 MB: This endpoint is not supported.\n \n  #### If the content is a directory\n  The response will be an array of objects, one object for each item in the directory.\n  When listing the contents of a directory, submodules have their "type" specified as "file". Logically, the value\n  _should_ be "submodule". This behavior exists in API v3 [for backwards compatibility purposes](https://git.io/v1YCW).\n  In the next major version of the API, the type will be returned as "submodule".\n \n  #### If the content is a symlink\n  If the requested `:path` points to a symlink, and the symlink\'s target is a normal file in the repository, then the\n  API responds with the content of the file (in the format shown in the example. Otherwise, the API responds with an object\n  describing the symlink itself.\n \n  #### If the content is a submodule\n  The `submodule_git_url` identifies the location of the submodule repository, and the `sha` identifies a specific\n  commit within the submodule repository. Git uses the given URL when cloning the submodule repository, and checks out\n  the submodule at that specific commit.\n \n  If the submodule repository is not hosted on github.com, the Git URLs (`git_url` and `_links["git"]`) and the\n  github.com URLs (`html_url` and `_links["html"]`) will have null values.',
  },
  reposCreateOrUpdateFileContents: {
    comment: 'Create or update file contents',
    doc: 'Create or update file contents\n  Creates a new file or replaces an existing file in a repository. You must authenticate using an access token with the `workflow` scope to use this endpoint.\n \n  Note: If you use this endpoint and the "[Delete a file](https://docs.github.com/rest/reference/repos/#delete-file)" endpoint in parallel, the concurrent requests will conflict and you will receive errors. You must use these endpoints serially instead.',
  },
  reposListContributors: {
    comment: 'List repository contributors',
    doc: 'List repository contributors\n  Lists contributors to the specified repository and sorts them by the number of commits per contributor in descending order. This endpoint may return information that is a few hours old because the GitHub REST API caches contributor data to improve performance.\n \n  GitHub identifies contributors by author email address. This endpoint groups contribution counts by GitHub user, which includes all associated email addresses. To improve performance, only the first 500 author email addresses in the repository link to GitHub users. The rest will appear as anonymous contributors without associated GitHub user information.',
  },
  dependabotListAlertsForRepo: {
    comment: 'List Dependabot alerts for a repository',
    doc: 'List Dependabot alerts for a repository\n  You must use an access token with the `security_events` scope to use this endpoint with private repositories.\n  You can also use tokens with the `public_repo` scope for public repositories only.\n  GitHub Apps must have Dependabot alerts read permission to use this endpoint.',
  },
  dependabotGetAlert: {
    comment: 'Get a Dependabot alert',
    doc: 'Get a Dependabot alert\n  You must use an access token with the `security_events` scope to use this endpoint with private repositories.\n  You can also use tokens with the `public_repo` scope for public repositories only.\n  GitHub Apps must have Dependabot alerts read permission to use this endpoint.',
  },
  dependabotUpdateAlert: {
    comment: 'Update a Dependabot alert',
    doc: 'Update a Dependabot alert\n  You must use an access token with the `security_events` scope to use this endpoint with private repositories.\n  You can also use tokens with the `public_repo` scope for public repositories only.\n  GitHub Apps must have Dependabot alerts write permission to use this endpoint.',
  },
  dependabotListRepoSecrets: {
    comment: 'List repository secrets',
    doc: 'List repository secrets\n  Lists all secrets available in a repository without revealing their encrypted values. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` repository permission to use this endpoint.',
  },
  dependabotGetRepoPublicKey: {
    comment: 'Get a repository public key',
    doc: 'Get a repository public key\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `dependabot_secrets` repository permission to use this endpoint.',
  },
  dependabotDeleteRepoSecret: {
    comment: 'Delete a repository secret',
    doc: 'Delete a repository secret\n  Deletes a secret in a repository using the secret name. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` repository permission to use this endpoint.',
  },
  dependabotGetRepoSecret: {
    comment: 'Get a repository secret',
    doc: 'Get a repository secret\n  Gets a single repository secret without revealing its encrypted value. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` repository permission to use this endpoint.',
  },
  dependabotCreateOrUpdateRepoSecret: {
    comment: 'Create or update a repository secret',
    doc: 'Create or update a repository secret\n  Creates or updates a repository secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `repo` scope to use this endpoint. GitHub Apps must have the `dependabot_secrets` repository\n  permission to use this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  dependencyGraphDiffRange: {
    comment: 'Get a diff of the dependencies between commits',
    doc: 'Get a diff of the dependencies between commits\n  Gets the diff of the dependency changes between two commits of a repository, based on the changes to the dependency manifests made in those commits.',
  },
  dependencyGraphCreateRepositorySnapshot: {
    comment: 'Create a snapshot of dependencies for a repository',
    doc: "Create a snapshot of dependencies for a repository\n  Create a new snapshot of a repository's dependencies. You must authenticate using an access token with the `repo` scope to use this endpoint for a repository that the requesting user has access to.",
  },
  reposListDeployments: {
    comment: 'List deployments',
    doc: 'List deployments\n  Simple filtering of deployments is available via query parameters:',
  },
  reposCreateDeployment: {
    comment: 'Create a deployment',
    doc: "Create a deployment\n  Deployments offer a few configurable parameters with certain defaults.\n \n  The `ref` parameter can be any named branch, tag, or SHA. At GitHub we often deploy branches and verify them\n  before we merge a pull request.\n \n  The `environment` parameter allows deployments to be issued to different runtime environments. Teams often have\n  multiple environments for verifying their applications, such as `production`, `staging`, and `qa`. This parameter\n  makes it easier to track which environments have requested deployments. The default environment is `production`.\n \n  The `auto_merge` parameter is used to ensure that the requested ref is not behind the repository's default branch. If\n  the ref _is_ behind the default branch for the repository, we will attempt to merge it for you. If the merge succeeds,\n  the API will return a successful merge commit. If merge conflicts prevent the merge from succeeding, the API will\n  return a failure response.\n \n  By default, [commit statuses](https://docs.github.com/rest/commits/statuses) for every submitted context must be in a `success`\n  state. The `required_contexts` parameter allows you to specify a subset of contexts that must be `success`, or to\n  specify contexts that have not yet been submitted. You are not required to use commit statuses to deploy. If you do\n  not require any contexts or create any commit statuses, the deployment will always succeed.\n \n  The `payload` parameter is available for any extra information that a deployment system might need. It is a JSON text\n  field that will be passed on when a deployment event is dispatched.\n \n  The `task` parameter is used by the deployment system to allow different execution paths. In the web world this might\n  be `deploy:migrations` to run schema changes on the system. In the compiled world this could be a flag to compile an\n  application with debugging enabled.\n \n  Users with `repo` or `repo_deployment` scopes can create a deployment for a given ref.\n \n  #### Merged branch response\n  You will see this response when GitHub automatically merges the base branch into the topic branch instead of creating\n  a deployment. This auto-merge happens when:\n     Auto-merge option is enabled in the repository\n     Topic branch does not include the latest changes on the base branch, which is `master` in the response example\n     There are no merge conflicts\n \n  If there are no new commits in the base branch, a new request to create a deployment should give a successful\n  response.\n \n  #### Merge conflict response\n  This error happens when the `auto_merge` option is enabled and when the default branch (in this case `master`), can't\n  be merged into the branch that's being deployed (in this case `topic-branch`), due to merge conflicts.\n \n  #### Failed commit status checks\n  This error happens when the `required_contexts` parameter indicates that one or more contexts need to have a `success`\n  status for the commit to be deployed, but one or more of the required contexts do not have a state of `success`.",
  },
  reposDeleteDeployment: {
    comment: 'Delete a deployment',
    doc: 'Delete a deployment\n  If the repository only has one deployment, you can delete the deployment regardless of its status. If the repository has more than one deployment, you can only delete inactive deployments. This ensures that repositories with multiple deployments will always have an active deployment. Anyone with `repo` or `repo_deployment` scopes can delete a deployment.\n \n  To set a deployment as inactive, you must:\n \n     Create a new deployment that is active so that the system has a record of the current state, then delete the previously active deployment.\n     Mark the active deployment as inactive by adding any non-successful deployment status.\n \n  For more information, see "[Create a deployment](https://docs.github.com/rest/deployments/deployments/#create-a-deployment)" and "[Create a deployment status](https://docs.github.com/rest/deployments/deployment-statuses#create-a-deployment-status)."',
  },
  reposGetDeployment: {
    comment: 'Get a deployment',
    doc: 'Get a deployment',
  },
  reposListDeploymentStatuses: {
    comment: 'List deployment statuses',
    doc: 'List deployment statuses\n  Users with pull access can view deployment statuses for a deployment:',
  },
  reposCreateDeploymentStatus: {
    comment: 'Create a deployment status',
    doc: 'Create a deployment status\n  Users with `push` access can create deployment statuses for a given deployment.\n \n  GitHub Apps require `read & write` access to "Deployments" and `read-only` access to "Repo contents" (for private repos). OAuth Apps require the `repo_deployment` scope.',
  },
  reposGetDeploymentStatus: {
    comment: 'Get a deployment status',
    doc: 'Get a deployment status\n  Users with pull access can view a deployment status for a deployment:',
  },
  reposCreateDispatchEvent: {
    comment: 'Create a repository dispatch event',
    doc: 'Create a repository dispatch event\n  You can use this endpoint to trigger a webhook event called `repository_dispatch` when you want activity that happens outside of GitHub to trigger a GitHub Actions workflow or GitHub App webhook. You must configure your GitHub Actions workflow or GitHub App to run when the `repository_dispatch` event occurs. For an example `repository_dispatch` webhook payload, see "[RepositoryDispatchEvent](https://docs.github.com/webhooks/event-payloads/#repository_dispatch)."\n \n  The `client_payload` parameter is available for any extra information that your workflow might need. This parameter is a JSON payload that will be passed on when the webhook event is dispatched. For example, the `client_payload` can include a message that a user would like to send using a GitHub Actions workflow. Or the `client_payload` can be used as a test to debug your workflow.\n \n  This endpoint requires write access to the repository by providing either:\n \n  - Personal access tokens with `repo` scope. For more information, see "[Creating a personal access token for the command line](https://docs.github.com/articles/creating-a-personal-access-token-for-the-command-line)" in the GitHub Help documentation.\n  - GitHub Apps with both `metadata:read` and `contents:read&write` permissions.\n \n  This input example shows how you can use the `client_payload` as a test to debug your workflow.',
  },
  reposGetAllEnvironments: {
    comment: 'List environments',
    doc: 'List environments\n  Lists the environments for a repository.\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  reposDeleteAnEnvironment: {
    comment: 'Delete an environment',
    doc: 'Delete an environment\n  You must authenticate using an access token with the repo scope to use this endpoint.',
  },
  reposGetEnvironment: {
    comment: 'Get an environment',
    doc: 'Get an environment\n  Note: To get information about name patterns that branches must match in order to deploy to this environment, see "[Get a deployment branch policy](/rest/deployments/branch-policies#get-a-deployment-branch-policy)."\n \n  Anyone with read access to the repository can use this endpoint. If the\n  repository is private, you must use an access token with the `repo` scope. GitHub\n  Apps must have the `actions:read` permission to use this endpoint.',
  },
  reposCreateOrUpdateEnvironment: {
    comment: 'Create or update an environment',
    doc: 'Create or update an environment\n  Create or update an environment with protection rules, such as required reviewers. For more information about environment protection rules, see "[Environments](/actions/reference/environments#environment-protection-rules)."\n \n  Note: To create or update name patterns that branches must match in order to deploy to this environment, see "[Deployment branch policies](/rest/deployments/branch-policies)."\n \n  Note: To create or update secrets for an environment, see "[Secrets](/rest/reference/actions#secrets)."\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration:write` permission for the repository to use this endpoint.',
  },
  reposListDeploymentBranchPolicies: {
    comment: 'List deployment branch policies',
    doc: 'List deployment branch policies\n  Lists the deployment branch policies for an environment.\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  reposCreateDeploymentBranchPolicy: {
    comment: 'Create a deployment branch policy',
    doc: 'Create a deployment branch policy\n  Creates a deployment branch policy for an environment.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration:write` permission for the repository to use this endpoint.',
  },
  reposDeleteDeploymentBranchPolicy: {
    comment: 'Delete a deployment branch policy',
    doc: 'Delete a deployment branch policy\n  Deletes a deployment branch policy for an environment.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration:write` permission for the repository to use this endpoint.',
  },
  reposGetDeploymentBranchPolicy: {
    comment: 'Get a deployment branch policy',
    doc: 'Get a deployment branch policy\n  Gets a deployment branch policy for an environment.\n \n  Anyone with read access to the repository can use this endpoint. If the repository is private, you must use an access token with the `repo` scope. GitHub Apps must have the `actions:read` permission to use this endpoint.',
  },
  reposUpdateDeploymentBranchPolicy: {
    comment: 'Update a deployment branch policy',
    doc: 'Update a deployment branch policy\n  Updates a deployment branch policy for an environment.\n \n  You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `administration:write` permission for the repository to use this endpoint.',
  },
  activityListRepoEvents: {
    comment: 'List repository events',
    doc: 'List repository events',
  },
  reposListForks: {
    comment: 'List forks',
    doc: 'List forks',
  },
  reposCreateFork: {
    comment: 'Create a fork',
    doc: 'Create a fork\n  Create a fork for the authenticated user.\n \n  Note: Forking a Repository happens asynchronously. You may have to wait a short period of time before you can access the git objects. If this takes longer than 5 minutes, be sure to contact [GitHub Support](https://support.github.com/contact?tags=dotcom-rest-api).',
  },
  gitCreateBlob: {
    comment: 'Create a blob',
    doc: 'Create a blob',
  },
  gitGetBlob: {
    comment: 'Get a blob',
    doc: 'Get a blob\n  The `content` in the response will always be Base64 encoded.\n \n  _Note_: This API supports blobs up to 100 megabytes in size.',
  },
  gitCreateCommit: {
    comment: 'Create a commit',
    doc: 'Create a commit\n  Creates a new Git [commit object](https://git-scm.com/book/en/v1/Git-Internals-Git-Objects#Commit-Objects).\n \n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in the table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  gitGetCommit: {
    comment: 'Get a commit',
    doc: 'Get a commit\n  Gets a Git [commit object](https://git-scm.com/book/en/v1/Git-Internals-Git-Objects#Commit-Objects).\n \n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in the table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  gitListMatchingRefs: {
    comment: 'List matching references',
    doc: 'List matching references\n  Returns an array of references from your Git database that match the supplied name. The `:ref` in the URL must be formatted as `heads/<branch name>` for branches and `tags/<tag name>` for tags. If the `:ref` doesn\'t exist in the repository, but existing refs start with `:ref`, they will be returned as an array.\n \n  When you use this endpoint without providing a `:ref`, it will return an array of all the references from your Git database, including notes and stashes if they exist on the server. Anything in the namespace is returned, not just `heads` and `tags`.\n \n  Note: You need to explicitly [request a pull request](https://docs.github.com/rest/reference/pulls#get-a-pull-request) to trigger a test merge commit, which checks the mergeability of pull requests. For more information, see "[Checking mergeability of pull requests](https://docs.github.com/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests)".\n \n  If you request matching references for a branch named `feature` but the branch `feature` doesn\'t exist, the response can still include other matching head refs that start with the word `feature`, such as `featureA` and `featureB`.',
  },
  gitGetRef: {
    comment: 'Get a reference',
    doc: 'Get a reference\n  Returns a single reference from your Git database. The `:ref` in the URL must be formatted as `heads/<branch name>` for branches and `tags/<tag name>` for tags. If the `:ref` doesn\'t match an existing ref, a `404` is returned.\n \n  Note: You need to explicitly [request a pull request](https://docs.github.com/rest/reference/pulls#get-a-pull-request) to trigger a test merge commit, which checks the mergeability of pull requests. For more information, see "[Checking mergeability of pull requests](https://docs.github.com/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests)".',
  },
  gitCreateRef: {
    comment: 'Create a reference',
    doc: 'Create a reference\n  Creates a reference for your repository. You are unable to create new references for empty repositories, even if the commit SHA-1 hash used exists. Empty repositories are repositories without branches.',
  },
  gitDeleteRef: {
    comment: 'Delete a reference',
    doc: 'Delete a reference',
  },
  gitUpdateRef: {
    comment: 'Update a reference',
    doc: 'Update a reference',
  },
  gitCreateTag: {
    comment: 'Create a tag object',
    doc: 'Create a tag object\n  Note that creating a tag object does not create the reference that makes a tag in Git. If you want to create an annotated tag in Git, you have to do this call to create the tag object, and then [create](https://docs.github.com/rest/reference/git#create-a-reference) the `refs/tags/[tag]` reference. If you want to create a lightweight tag, you only have to [create](https://docs.github.com/rest/reference/git#create-a-reference) the tag reference - this call would be unnecessary.\n \n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  gitGetTag: {
    comment: 'Get a tag',
    doc: 'Get a tag\n  Signature verification object\n \n  The response will include a `verification` object that describes the result of verifying the commit\'s signature. The following fields are included in the `verification` object:\n \n  | Name | Type | Description |\n  | ---- | ---- | ----------- |\n  | `verified` | `boolean` | Indicates whether GitHub considers the signature in this commit to be verified. |\n  | `reason` | `string` | The reason for verified value. Possible values and their meanings are enumerated in table below. |\n  | `signature` | `string` | The signature that was extracted from the commit. |\n  | `payload` | `string` | The value that was signed. |\n \n  These are the possible values for `reason` in the `verification` object:\n \n  | Value | Description |\n  | ----- | ----------- |\n  | `expired_key` | The key that made the signature is expired. |\n  | `not_signing_key` | The "signing" flag is not among the usage flags in the GPG key that made the signature. |\n  | `gpgverify_error` | There was an error communicating with the signature verification service. |\n  | `gpgverify_unavailable` | The signature verification service is currently unavailable. |\n  | `unsigned` | The object does not include a signature. |\n  | `unknown_signature_type` | A non-PGP signature was found in the commit. |\n  | `no_user` | No user was associated with the `committer` email address in the commit. |\n  | `unverified_email` | The `committer` email address in the commit was associated with a user, but the email address is not verified on her/his account. |\n  | `bad_email` | The `committer` email address in the commit is not included in the identities of the PGP key that made the signature. |\n  | `unknown_key` | The key that made the signature has not been registered with any user\'s account. |\n  | `malformed_signature` | There was an error parsing the signature. |\n  | `invalid` | The signature could not be cryptographically verified using the key whose key-id was found in the signature. |\n  | `valid` | None of the above errors applied, so the signature is considered to be verified. |',
  },
  gitCreateTree: {
    comment: 'Create a tree',
    doc: 'Create a tree\n  The tree creation API accepts nested entries. If you specify both a tree and a nested path modifying that tree, this endpoint will overwrite the contents of the tree with the new path contents, and create a new tree structure.\n \n  If you use this endpoint to add, delete, or modify the file contents in a tree, you will need to commit the tree and then update a branch to point to the commit. For more information see "[Create a commit](https://docs.github.com/rest/reference/git#create-a-commit)" and "[Update a reference](https://docs.github.com/rest/reference/git#update-a-reference)."\n \n  Returns an error if you try to delete a file that does not exist.',
  },
  gitGetTree: {
    comment: 'Get a tree',
    doc: 'Get a tree\n  Returns a single tree using the SHA1 value for that tree.\n \n  If `truncated` is `true` in the response then the number of items in the `tree` array exceeded our maximum limit. If you need to fetch more items, use the non-recursive method of fetching trees, and fetch one sub-tree at a time.\n \n \n  Note: The limit for the `tree` array is 100,000 entries with a maximum size of 7 MB when using the `recursive` parameter.',
  },
  reposListWebhooks: {
    comment: 'List repository webhooks',
    doc: 'List repository webhooks\n  Lists webhooks for a repository. `last response` may return null if there have not been any deliveries within 30 days.',
  },
  reposCreateWebhook: {
    comment: 'Create a repository webhook',
    doc: 'Create a repository webhook\n  Repositories can have multiple webhooks installed. Each webhook should have a unique `config`. Multiple webhooks can\n  share the same `config` as long as those webhooks do not have any `events` that overlap.',
  },
  reposDeleteWebhook: {
    comment: 'Delete a repository webhook',
    doc: 'Delete a repository webhook',
  },
  reposGetWebhook: {
    comment: 'Get a repository webhook',
    doc: 'Get a repository webhook\n  Returns a webhook configured in a repository. To get only the webhook `config` properties, see "[Get a webhook configuration for a repository](/rest/reference/repos#get-a-webhook-configuration-for-a-repository)."',
  },
  reposUpdateWebhook: {
    comment: 'Update a repository webhook',
    doc: 'Update a repository webhook\n  Updates a webhook configured in a repository. If you previously had a `secret` set, you must provide the same `secret` or set a new `secret` or the secret will be removed. If you are only updating individual webhook `config` properties, use "[Update a webhook configuration for a repository](/rest/reference/repos#update-a-webhook-configuration-for-a-repository)."',
  },
  reposGetWebhookConfigForRepo: {
    comment: 'Get a webhook configuration for a repository',
    doc: 'Get a webhook configuration for a repository\n  Returns the webhook configuration for a repository. To get more information about the webhook, including the `active` state and `events`, use "[Get a repository webhook](/rest/reference/orgs#get-a-repository-webhook)."\n \n  Access tokens must have the `read:repo_hook` or `repo` scope, and GitHub Apps must have the `repository_hooks:read` permission.',
  },
  reposUpdateWebhookConfigForRepo: {
    comment: 'Update a webhook configuration for a repository',
    doc: 'Update a webhook configuration for a repository\n  Updates the webhook configuration for a repository. To update more information about the webhook, including the `active` state and `events`, use "[Update a repository webhook](/rest/reference/orgs#update-a-repository-webhook)."\n \n  Access tokens must have the `write:repo_hook` or `repo` scope, and GitHub Apps must have the `repository_hooks:write` permission.',
  },
  reposListWebhookDeliveries: {
    comment: 'List deliveries for a repository webhook',
    doc: 'List deliveries for a repository webhook\n  Returns a list of webhook deliveries for a webhook configured in a repository.',
  },
  reposGetWebhookDelivery: {
    comment: 'Get a delivery for a repository webhook',
    doc: 'Get a delivery for a repository webhook\n  Returns a delivery for a webhook configured in a repository.',
  },
  reposRedeliverWebhookDelivery: {
    comment: 'Redeliver a delivery for a repository webhook',
    doc: 'Redeliver a delivery for a repository webhook\n  Redeliver a webhook delivery for a webhook configured in a repository.',
  },
  reposPingWebhook: {
    comment: 'Ping a repository webhook',
    doc: 'Ping a repository webhook\n  This will trigger a [ping event](https://docs.github.com/webhooks/#ping-event) to be sent to the hook.',
  },
  reposTestPushWebhook: {
    comment: 'Test the push repository webhook',
    doc: 'Test the push repository webhook\n  This will trigger the hook with the latest push to the current repository if the hook is subscribed to `push` events. If the hook is not subscribed to `push` events, the server will respond with 204 but no test POST will be generated.\n \n  Note: Previously `/repos/:owner/:repo/hooks/:hook_id/test`',
  },
  migrationsCancelImport: {
    comment: 'Cancel an import',
    doc: 'Cancel an import\n  Stop an import for a repository.',
  },
  migrationsGetImportStatus: {
    comment: 'Get an import status',
    doc: 'Get an import status\n  View the progress of an import.\n \n  Import status\n \n  This section includes details about the possible values of the `status` field of the Import Progress response.\n \n  An import that does not have errors will progress through these steps:\n \n     `detecting` - the "detection" step of the import is in progress because the request did not include a `vcs` parameter. The import is identifying the type of source control present at the URL.\n     `importing` - the "raw" step of the import is in progress. This is where commit data is fetched from the original repository. The import progress response will include `commit_count` (the total number of raw commits that will be imported) and `percent` (0 - 100, the current progress through the import).\n     `mapping` - the "rewrite" step of the import is in progress. This is where SVN branches are converted to Git branches, and where author updates are applied. The import progress response does not include progress information.\n     `pushing` - the "push" step of the import is in progress. This is where the importer updates the repository on GitHub. The import progress response will include `push_percent`, which is the percent value reported by `git push` when it is "Writing objects".\n     `complete` - the import is complete, and the repository is ready on GitHub.\n \n  If there are problems, you will see one of these in the `status` field:\n \n     `auth_failed` - the import requires authentication in order to connect to the original repository. To update authentication for the import, please see the [Update an import](https://docs.github.com/rest/migrations/source-imports#update-an-import) section.\n     `error` - the import encountered an error. The import progress response will include the `failed_step` and an error message. Contact [GitHub Support](https://support.github.com/contact?tags=dotcom-rest-api) for more information.\n     `detection_needs_auth` - the importer requires authentication for the originating repository to continue detection. To update authentication for the import, please see the [Update an import](https://docs.github.com/rest/migrations/source-imports#update-an-import) section.\n     `detection_found_nothing` - the importer didn\'t recognize any source control at the URL. To resolve, [Cancel the import](https://docs.github.com/rest/migrations/source-imports#cancel-an-import) and [retry](https://docs.github.com/rest/migrations/source-imports#start-an-import) with the correct URL.\n     `detection_found_multiple` - the importer found several projects or repositories at the provided URL. When this is the case, the Import Progress response will also include a `project_choices` field with the possible project choices as values. To update project choice, please see the [Update an import](https://docs.github.com/rest/migrations/source-imports#update-an-import) section.\n \n  The project_choices field\n \n  When multiple projects are found at the provided URL, the response hash will include a `project_choices` field, the value of which is an array of hashes each representing a project choice. The exact key/value pairs of the project hashes will differ depending on the version control type.\n \n  Git LFS related fields\n \n  This section includes details about Git LFS related fields that may be present in the Import Progress response.\n \n     `use_lfs` - describes whether the import has been opted in or out of using Git LFS. The value can be `opt_in`, `opt_out`, or `undecided` if no action has been taken.\n     `has_large_files` - the boolean value describing whether files larger than 100MB were found during the `importing` step.\n     `large_files_size` - the total size in gigabytes of files larger than 100MB found in the originating repository.\n     `large_files_count` - the total number of files larger than 100MB found in the originating repository. To see a list of these files, make a "Get Large Files" request.',
  },
  migrationsUpdateImport: {
    comment: 'Update an import',
    doc: 'Update an import\n  An import can be updated with credentials or a project choice by passing in the appropriate parameters in this API\n  request. If no parameters are provided, the import will be restarted.\n \n  Some servers (e.g. TFS servers) can have several projects at a single URL. In those cases the import progress will\n  have the status `detection_found_multiple` and the Import Progress response will include a `project_choices` array.\n  You can select the project to import by providing one of the objects in the `project_choices` array in the update request.',
  },
  migrationsStartImport: {
    comment: 'Start an import',
    doc: 'Start an import\n  Start a source import to a GitHub repository using GitHub Importer. Importing into a GitHub repository with GitHub Actions enabled is not supported and will return a status `422 Unprocessable Entity` response.',
  },
  migrationsGetCommitAuthors: {
    comment: 'Get commit authors',
    doc: 'Get commit authors\n  Each type of source control system represents authors in a different way. For example, a Git commit author has a display name and an email address, but a Subversion commit author just has a username. The GitHub Importer will make the author information valid, but the author might not be correct. For example, it will change the bare Subversion username `hubot` into something like `hubot <hubot@12341234-abab-fefe-8787-fedcba987654>`.\n \n  This endpoint and the [Map a commit author](https://docs.github.com/rest/migrations/source-imports#map-a-commit-author) endpoint allow you to provide correct Git author information.',
  },
  migrationsMapCommitAuthor: {
    comment: 'Map a commit author',
    doc: "Map a commit author\n  Update an author's identity for the import. Your application can continue updating authors any time before you push new commits to the repository.",
  },
  migrationsGetLargeFiles: {
    comment: 'Get large files',
    doc: 'Get large files\n  List files larger than 100MB found during the import',
  },
  migrationsSetLfsPreference: {
    comment: 'Update Git LFS preference',
    doc: 'Update Git LFS preference\n  You can import repositories from Subversion, Mercurial, and TFS that include files larger than 100MB. This ability is powered by [Git LFS](https://git-lfs.com). You can learn more about our LFS feature and working with large files [on our help site](https://docs.github.com/repositories/working-with-files/managing-large-files).',
  },
  appsGetRepoInstallation: {
    comment: 'Get a repository installation for the authenticated app',
    doc: "Get a repository installation for the authenticated app\n  Enables an authenticated GitHub App to find the repository's installation information. The installation's account type will be either an organization or a user account, depending which account the repository belongs to.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.",
  },
  interactionsRemoveRestrictionsForRepo: {
    comment: 'Remove interaction restrictions for a repository',
    doc: 'Remove interaction restrictions for a repository\n  Removes all interaction restrictions from the given repository. You must have owner or admin access to remove restrictions. If the interaction limit is set for the user or organization that owns this repository, you will receive a `409 Conflict` response and will not be able to use this endpoint to change the interaction limit for a single repository.',
  },
  interactionsGetRestrictionsForRepo: {
    comment: 'Get interaction restrictions for a repository',
    doc: 'Get interaction restrictions for a repository\n  Shows which type of GitHub user can interact with this repository and when the restriction expires. If there are no restrictions, you will see an empty response.',
  },
  interactionsSetRestrictionsForRepo: {
    comment: 'Set interaction restrictions for a repository',
    doc: 'Set interaction restrictions for a repository\n  Temporarily restricts interactions to a certain type of GitHub user within the given repository. You must have owner or admin access to set these restrictions. If an interaction limit is set for the user or organization that owns this repository, you will receive a `409 Conflict` response and will not be able to use this endpoint to change the interaction limit for a single repository.',
  },
  reposListInvitations: {
    comment: 'List repository invitations',
    doc: 'List repository invitations\n  When authenticating as a user with admin rights to a repository, this endpoint will list all currently open repository invitations.',
  },
  reposDeleteInvitation: {
    comment: 'Delete a repository invitation',
    doc: 'Delete a repository invitation',
  },
  reposUpdateInvitation: {
    comment: 'Update a repository invitation',
    doc: 'Update a repository invitation',
  },
  issuesListForRepo: {
    comment: 'List repository issues',
    doc: 'List repository issues\n  List issues in a repository. Only open issues will be listed.\n \n  Note: GitHub\'s REST API considers every pull request an issue, but not every issue is a pull request. For this\n  reason, "Issues" endpoints may return both issues and pull requests in the response. You can identify pull requests by\n  the `pull_request` key. Be aware that the `id` of a pull request returned from "Issues" endpoints will be an _issue id_. To find out the pull\n  request id, use the "[List pull requests](https://docs.github.com/rest/reference/pulls#list-pull-requests)" endpoint.',
  },
  issuesCreate: {
    comment: 'Create an issue',
    doc: 'Create an issue\n  Any user with pull access to a repository can create an issue. If [issues are disabled in the repository](https://docs.github.com/articles/disabling-issues/), the API returns a `410 Gone` status.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  issuesListCommentsForRepo: {
    comment: 'List issue comments for a repository',
    doc: 'List issue comments for a repository\n  By default, Issue Comments are ordered by ascending ID.',
  },
  issuesDeleteComment: {
    comment: 'Delete an issue comment',
    doc: 'Delete an issue comment',
  },
  issuesGetComment: {
    comment: 'Get an issue comment',
    doc: 'Get an issue comment',
  },
  issuesUpdateComment: {
    comment: 'Update an issue comment',
    doc: 'Update an issue comment',
  },
  reactionsListForIssueComment: {
    comment: 'List reactions for an issue comment',
    doc: 'List reactions for an issue comment\n  List the reactions to an [issue comment](https://docs.github.com/rest/reference/issues#comments).',
  },
  reactionsCreateForIssueComment: {
    comment: 'Create reaction for an issue comment',
    doc: 'Create reaction for an issue comment\n  Create a reaction to an [issue comment](https://docs.github.com/rest/reference/issues#comments). A response with an HTTP `200` status means that you already added the reaction type to this issue comment.',
  },
  reactionsDeleteForIssueComment: {
    comment: 'Delete an issue comment reaction',
    doc: 'Delete an issue comment reaction\n  Note: You can also specify a repository by `repository_id` using the route `DELETE delete /repositories/:repository_id/issues/comments/:comment_id/reactions/:reaction_id`.\n \n  Delete a reaction to an [issue comment](https://docs.github.com/rest/reference/issues#comments).',
  },
  issuesListEventsForRepo: {
    comment: 'List issue events for a repository',
    doc: 'List issue events for a repository',
  },
  issuesGetEvent: {
    comment: 'Get an issue event',
    doc: 'Get an issue event',
  },
  issuesGet: {
    comment: 'Get an issue',
    doc: 'Get an issue\n  The API returns a [`301 Moved Permanently` status](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-redirects-redirects) if the issue was\n  [transferred](https://docs.github.com/articles/transferring-an-issue-to-another-repository/) to another repository. If\n  the issue was transferred to or deleted from a repository where the authenticated user lacks read access, the API\n  returns a `404 Not Found` status. If the issue was deleted from a repository where the authenticated user has read\n  access, the API returns a `410 Gone` status. To receive webhook events for transferred and deleted issues, subscribe\n  to the [`issues`](https://docs.github.com/webhooks/event-payloads/#issues) webhook.\n \n  Note: GitHub\'s REST API considers every pull request an issue, but not every issue is a pull request. For this\n  reason, "Issues" endpoints may return both issues and pull requests in the response. You can identify pull requests by\n  the `pull_request` key. Be aware that the `id` of a pull request returned from "Issues" endpoints will be an _issue id_. To find out the pull\n  request id, use the "[List pull requests](https://docs.github.com/rest/reference/pulls#list-pull-requests)" endpoint.',
  },
  issuesUpdate: {
    comment: 'Update an issue',
    doc: 'Update an issue\n  Issue owners and users with push access can edit an issue.',
  },
  issuesRemoveAssignees: {
    comment: 'Remove assignees from an issue',
    doc: 'Remove assignees from an issue\n  Removes one or more assignees from an issue.',
  },
  issuesAddAssignees: {
    comment: 'Add assignees to an issue',
    doc: 'Add assignees to an issue\n  Adds up to 10 assignees to an issue. Users already assigned to an issue are not replaced.',
  },
  issuesCheckUserCanBeAssignedToIssue: {
    comment: 'Check if a user can be assigned to a issue',
    doc: 'Check if a user can be assigned to a issue\n  Checks if a user has permission to be assigned to a specific issue.\n \n  If the `assignee` can be assigned to this issue, a `204` status code with no content is returned.\n \n  Otherwise a `404` status code is returned.',
  },
  issuesListComments: {
    comment: 'List issue comments',
    doc: 'List issue comments\n  Issue Comments are ordered by ascending ID.',
  },
  issuesCreateComment: {
    comment: 'Create an issue comment',
    doc: 'Create an issue comment\n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  issuesListEvents: {
    comment: 'List issue events',
    doc: 'List issue events',
  },
  issuesRemoveAllLabels: {
    comment: 'Remove all labels from an issue',
    doc: 'Remove all labels from an issue',
  },
  issuesListLabelsOnIssue: {
    comment: 'List labels for an issue',
    doc: 'List labels for an issue',
  },
  issuesAddLabels: {
    comment: 'Add labels to an issue',
    doc: 'Add labels to an issue',
  },
  issuesSetLabels: {
    comment: 'Set labels for an issue',
    doc: 'Set labels for an issue\n  Removes any previous labels and sets the new labels for an issue.',
  },
  issuesRemoveLabel: {
    comment: 'Remove a label from an issue',
    doc: 'Remove a label from an issue\n  Removes the specified label from the issue, and returns the remaining labels on the issue. This endpoint returns a `404 Not Found` status if the label does not exist.',
  },
  issuesUnlock: {
    comment: 'Unlock an issue',
    doc: "Unlock an issue\n  Users with push access can unlock an issue's conversation.",
  },
  issuesLock: {
    comment: 'Lock an issue',
    doc: 'Lock an issue\n  Users with push access can lock an issue or pull request\'s conversation.\n \n  Note that, if you choose not to pass any parameters, you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  reactionsListForIssue: {
    comment: 'List reactions for an issue',
    doc: 'List reactions for an issue\n  List the reactions to an [issue](https://docs.github.com/rest/reference/issues).',
  },
  reactionsCreateForIssue: {
    comment: 'Create reaction for an issue',
    doc: 'Create reaction for an issue\n  Create a reaction to an [issue](https://docs.github.com/rest/reference/issues/). A response with an HTTP `200` status means that you already added the reaction type to this issue.',
  },
  reactionsDeleteForIssue: {
    comment: 'Delete an issue reaction',
    doc: 'Delete an issue reaction\n  Note: You can also specify a repository by `repository_id` using the route `DELETE /repositories/:repository_id/issues/:issue_number/reactions/:reaction_id`.\n \n  Delete a reaction to an [issue](https://docs.github.com/rest/reference/issues/).',
  },
  issuesListEventsForTimeline: {
    comment: 'List timeline events for an issue',
    doc: 'List timeline events for an issue',
  },
  reposListDeployKeys: {
    comment: 'List deploy keys',
    doc: 'List deploy keys',
  },
  reposCreateDeployKey: {
    comment: 'Create a deploy key',
    doc: 'Create a deploy key\n  You can create a read-only deploy key.',
  },
  reposDeleteDeployKey: {
    comment: 'Delete a deploy key',
    doc: 'Delete a deploy key\n  Deploy keys are immutable. If you need to update a key, remove the key and create a new one instead.',
  },
  reposGetDeployKey: {
    comment: 'Get a deploy key',
    doc: 'Get a deploy key',
  },
  issuesListLabelsForRepo: {
    comment: 'List labels for a repository',
    doc: 'List labels for a repository',
  },
  issuesCreateLabel: {
    comment: 'Create a label',
    doc: 'Create a label',
  },
  issuesDeleteLabel: {
    comment: 'Delete a label',
    doc: 'Delete a label',
  },
  issuesGetLabel: {
    comment: 'Get a label',
    doc: 'Get a label',
  },
  issuesUpdateLabel: {
    comment: 'Update a label',
    doc: 'Update a label',
  },
  reposListLanguages: {
    comment: 'List repository languages',
    doc: 'List repository languages\n  Lists languages for the specified repository. The value shown for each language is the number of bytes of code written in that language.',
  },
  reposDisableLfsForRepo: {
    comment: 'Disable Git LFS for a repository',
    doc: 'Disable Git LFS for a repository\n  Disables Git LFS for a repository. Access tokens must have the `admin:enterprise` scope.',
  },
  reposEnableLfsForRepo: {
    comment: 'Enable Git LFS for a repository',
    doc: 'Enable Git LFS for a repository\n  Enables Git LFS for a repository. Access tokens must have the `admin:enterprise` scope.',
  },
  licensesGetForRepo: {
    comment: 'Get the license for a repository',
    doc: "Get the license for a repository\n  This method returns the contents of the repository's license file, if one is detected.\n \n  Similar to [Get repository content](https://docs.github.com/rest/reference/repos#get-repository-content), this method also supports [custom media types](https://docs.github.com/rest/overview/media-types) for retrieving the raw license content or rendered license HTML.",
  },
  reposMergeUpstream: {
    comment: 'Sync a fork branch with the upstream repository',
    doc: 'Sync a fork branch with the upstream repository\n  Sync a branch of a forked repository to keep it up-to-date with the upstream repository.',
  },
  reposMerge: {
    comment: 'Merge a branch',
    doc: 'Merge a branch',
  },
  issuesListMilestones: {
    comment: 'List milestones',
    doc: 'List milestones',
  },
  issuesCreateMilestone: {
    comment: 'Create a milestone',
    doc: 'Create a milestone',
  },
  issuesDeleteMilestone: {
    comment: 'Delete a milestone',
    doc: 'Delete a milestone',
  },
  issuesGetMilestone: {
    comment: 'Get a milestone',
    doc: 'Get a milestone',
  },
  issuesUpdateMilestone: {
    comment: 'Update a milestone',
    doc: 'Update a milestone',
  },
  issuesListLabelsForMilestone: {
    comment: 'List labels for issues in a milestone',
    doc: 'List labels for issues in a milestone',
  },
  activityListRepoNotificationsForAuthenticatedUser: {
    comment: 'List repository notifications for the authenticated user',
    doc: 'List repository notifications for the authenticated user\n  Lists all notifications for the current user in the specified repository.',
  },
  activityMarkRepoNotificationsAsRead: {
    comment: 'Mark repository notifications as read',
    doc: 'Mark repository notifications as read\n  Marks all notifications in a repository as "read" for the current user. If the number of notifications is too large to complete in one request, you will receive a `202 Accepted` status and GitHub will run an asynchronous process to mark notifications as "read." To check whether any "unread" notifications remain, you can use the [List repository notifications for the authenticated user](https://docs.github.com/rest/reference/activity#list-repository-notifications-for-the-authenticated-user) endpoint and pass the query parameter `all=false`.',
  },
  reposDeletePagesSite: {
    comment: 'Delete a GitHub Pages site',
    doc: "Delete a GitHub Pages site\n  Deletes a GitHub Pages site. For more information, see \"[About GitHub Pages](/github/working-with-github-pages/about-github-pages).\n \n  To use this endpoint, you must be a repository administrator, maintainer, or have the 'manage GitHub Pages settings' permission. A token with the `repo` scope or Pages write permission is required. GitHub Apps must have the `administration:write` and `pages:write` permissions.",
  },
  reposGetPages: {
    comment: 'Get a GitHub Pages site',
    doc: 'Get a GitHub Pages site',
  },
  reposCreatePagesSite: {
    comment: 'Create a GitHub Pages site',
    doc: 'Create a GitHub Pages site\n  Configures a GitHub Pages site. For more information, see "[About GitHub Pages](/github/working-with-github-pages/about-github-pages)."\n \n  To use this endpoint, you must be a repository administrator, maintainer, or have the \'manage GitHub Pages settings\' permission. A token with the `repo` scope or Pages write permission is required. GitHub Apps must have the `administration:write` and `pages:write` permissions.',
  },
  reposUpdateInformationAboutPagesSite: {
    comment: 'Update information about a GitHub Pages site',
    doc: "Update information about a GitHub Pages site\n  Updates information for a GitHub Pages site. For more information, see \"[About GitHub Pages](/github/working-with-github-pages/about-github-pages).\n \n  To use this endpoint, you must be a repository administrator, maintainer, or have the 'manage GitHub Pages settings' permission. A token with the `repo` scope or Pages write permission is required. GitHub Apps must have the `administration:write` and `pages:write` permissions.",
  },
  reposListPagesBuilds: {
    comment: 'List GitHub Pages builds',
    doc: 'List GitHub Pages builds',
  },
  reposRequestPagesBuild: {
    comment: 'Request a GitHub Pages build',
    doc: 'Request a GitHub Pages build\n  You can request that your site be built from the latest revision on the default branch. This has the same effect as pushing a commit to your default branch, but does not require an additional commit. Manually triggering page builds can be helpful when diagnosing build warnings and failures.\n \n  Build requests are limited to one concurrent build per repository and one concurrent build per requester. If you request a build while another is still in progress, the second request will be queued until the first completes.',
  },
  reposGetLatestPagesBuild: {
    comment: 'Get latest Pages build',
    doc: 'Get latest Pages build',
  },
  reposGetPagesBuild: {
    comment: 'Get GitHub Pages build',
    doc: 'Get GitHub Pages build',
  },
  reposCreatePagesDeployment: {
    comment: 'Create a GitHub Pages deployment',
    doc: 'Create a GitHub Pages deployment\n  Create a GitHub Pages deployment for a repository.\n \n  Users must have write permissions. GitHub Apps must have the `pages:write` permission to use this endpoint.',
  },
  reposGetPagesHealthCheck: {
    comment: 'Get a DNS health check for GitHub Pages',
    doc: "Get a DNS health check for GitHub Pages\n  Gets a health check of the DNS settings for the `CNAME` record configured for a repository's GitHub Pages.\n \n  The first request to this endpoint returns a `202 Accepted` status and starts an asynchronous background task to get the results for the domain. After the background task completes, subsequent requests to this endpoint return a `200 OK` status with the health check results in the response.\n \n  To use this endpoint, you must be a repository administrator, maintainer, or have the 'manage GitHub Pages settings' permission. A token with the `repo` scope or Pages write permission is required. GitHub Apps must have the `administrative:write` and `pages:write` permissions.",
  },
  projectsListForRepo: {
    comment: 'List repository projects',
    doc: 'List repository projects\n  Lists the projects in a repository. Returns a `404 Not Found` status if projects are disabled in the repository. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  projectsCreateForRepo: {
    comment: 'Create a repository project',
    doc: 'Create a repository project\n  Creates a repository project board. Returns a `410 Gone` status if projects are disabled in the repository or if the repository does not have existing classic projects. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  pullsList: {
    comment: 'List pull requests',
    doc: "List pull requests\n  Draft pull requests are available in public repositories with GitHub Free and GitHub Free for organizations, GitHub Pro, and legacy per-repository billing plans, and in public and private repositories with GitHub Team and GitHub Enterprise Cloud. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.",
  },
  pullsCreate: {
    comment: 'Create a pull request',
    doc: 'Create a pull request\n  Draft pull requests are available in public repositories with GitHub Free and GitHub Free for organizations, GitHub Pro, and legacy per-repository billing plans, and in public and private repositories with GitHub Team and GitHub Enterprise Cloud. For more information, see [GitHub\'s products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  To open or update a pull request in a public repository, you must have write access to the head or the source branch. For organization-owned repositories, you must be a member of the organization that owns the repository to open or update a pull request.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-rate-limits)" for details.',
  },
  pullsListReviewCommentsForRepo: {
    comment: 'List review comments in a repository',
    doc: 'List review comments in a repository\n  Lists review comments for all pull requests in a repository. By default, review comments are in ascending order by ID.',
  },
  pullsDeleteReviewComment: {
    comment: 'Delete a review comment for a pull request',
    doc: 'Delete a review comment for a pull request\n  Deletes a review comment.',
  },
  pullsGetReviewComment: {
    comment: 'Get a review comment for a pull request',
    doc: 'Get a review comment for a pull request\n  Provides details for a review comment.',
  },
  pullsUpdateReviewComment: {
    comment: 'Update a review comment for a pull request',
    doc: 'Update a review comment for a pull request\n  Enables you to edit a review comment.',
  },
  reactionsListForPullRequestReviewComment: {
    comment: 'List reactions for a pull request review comment',
    doc: 'List reactions for a pull request review comment\n  List the reactions to a [pull request review comment](https://docs.github.com/rest/reference/pulls#review-comments).',
  },
  reactionsCreateForPullRequestReviewComment: {
    comment: 'Create reaction for a pull request review comment',
    doc: 'Create reaction for a pull request review comment\n  Create a reaction to a [pull request review comment](https://docs.github.com/rest/reference/pulls#comments). A response with an HTTP `200` status means that you already added the reaction type to this pull request review comment.',
  },
  reactionsDeleteForPullRequestComment: {
    comment: 'Delete a pull request comment reaction',
    doc: 'Delete a pull request comment reaction\n  Note: You can also specify a repository by `repository_id` using the route `DELETE /repositories/:repository_id/pulls/comments/:comment_id/reactions/:reaction_id.`\n \n  Delete a reaction to a [pull request review comment](https://docs.github.com/rest/reference/pulls#review-comments).',
  },
  pullsGet: {
    comment: 'Get a pull request',
    doc: 'Get a pull request\n  Draft pull requests are available in public repositories with GitHub Free and GitHub Free for organizations, GitHub Pro, and legacy per-repository billing plans, and in public and private repositories with GitHub Team and GitHub Enterprise Cloud. For more information, see [GitHub\'s products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  Lists details of a pull request by providing its number.\n \n  When you get, [create](https://docs.github.com/rest/reference/pulls/#create-a-pull-request), or [edit](https://docs.github.com/rest/reference/pulls#update-a-pull-request) a pull request, GitHub creates a merge commit to test whether the pull request can be automatically merged into the base branch. This test commit is not added to the base branch or the head branch. You can review the status of the test commit using the `mergeable` key. For more information, see "[Checking mergeability of pull requests](https://docs.github.com/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests)".\n \n  The value of the `mergeable` attribute can be `true`, `false`, or `null`. If the value is `null`, then GitHub has started a background job to compute the mergeability. After giving the job time to complete, resubmit the request. When the job finishes, you will see a non-`null` value for the `mergeable` attribute in the response. If `mergeable` is `true`, then `merge_commit_sha` will be the SHA of the _test_ merge commit.\n \n  The value of the `merge_commit_sha` attribute changes depending on the state of the pull request. Before merging a pull request, the `merge_commit_sha` attribute holds the SHA of the _test_ merge commit. After merging a pull request, the `merge_commit_sha` attribute changes depending on how you merged the pull request:\n \n     If merged as a [merge commit](https://docs.github.com/articles/about-merge-methods-on-github/), `merge_commit_sha` represents the SHA of the merge commit.\n     If merged via a [squash](https://docs.github.com/articles/about-merge-methods-on-github/#squashing-your-merge-commits), `merge_commit_sha` represents the SHA of the squashed commit on the base branch.\n     If [rebased](https://docs.github.com/articles/about-merge-methods-on-github/#rebasing-and-merging-your-commits), `merge_commit_sha` represents the commit that the base branch was updated to.\n \n  Pass the appropriate [media type](https://docs.github.com/rest/overview/media-types/#commits-commit-comparison-and-pull-requests) to fetch diff and patch formats.',
  },
  pullsUpdate: {
    comment: 'Update a pull request',
    doc: "Update a pull request\n  Draft pull requests are available in public repositories with GitHub Free and GitHub Free for organizations, GitHub Pro, and legacy per-repository billing plans, and in public and private repositories with GitHub Team and GitHub Enterprise Cloud. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  To open or update a pull request in a public repository, you must have write access to the head or the source branch. For organization-owned repositories, you must be a member of the organization that owns the repository to open or update a pull request.",
  },
  codespacesCreateWithPrForAuthenticatedUser: {
    comment: 'Create a codespace from a pull request',
    doc: 'Create a codespace from a pull request\n  Creates a codespace owned by the authenticated user for the specified pull request.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.',
  },
  pullsListReviewComments: {
    comment: 'List review comments on a pull request',
    doc: 'List review comments on a pull request\n  Lists all review comments for a pull request. By default, review comments are in ascending order by ID.',
  },
  pullsCreateReviewComment: {
    comment: 'Create a review comment for a pull request',
    doc: 'Create a review comment for a pull request\n \n  Creates a review comment in the pull request diff. To add a regular comment to a pull request timeline, see "[Create an issue comment](https://docs.github.com/rest/reference/issues#create-an-issue-comment)." We recommend creating a review comment using `line`, `side`, and optionally `start_line` and `start_side` if your comment applies to more than one line in the pull request diff.\n \n  The `position` parameter is deprecated. If you use `position`, the `line`, `side`, `start_line`, and `start_side` parameters are not required.\n \n  Note: The position value equals the number of lines down from the first "@@" hunk header in the file you want to add a comment. The line just below the "@@" line is position 1, the next line is position 2, and so on. The position in the diff continues to increase through lines of whitespace and additional hunks until the beginning of a new file.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  pullsCreateReplyForReviewComment: {
    comment: 'Create a reply for a review comment',
    doc: 'Create a reply for a review comment\n  Creates a reply to a review comment for a pull request. For the `comment_id`, provide the ID of the review comment you are replying to. This must be the ID of a _top-level review comment_, not a reply to that comment. Replies to replies are not supported.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  pullsListCommits: {
    comment: 'List commits on a pull request',
    doc: 'List commits on a pull request\n  Lists a maximum of 250 commits for a pull request. To receive a complete commit list for pull requests with more than 250 commits, use the [List commits](https://docs.github.com/rest/reference/repos#list-commits) endpoint.',
  },
  pullsListFiles: {
    comment: 'List pull requests files',
    doc: 'List pull requests files\n  Note: Responses include a maximum of 3000 files. The paginated response returns 30 files per page by default.',
  },
  pullsCheckIfMerged: {
    comment: 'Check if a pull request has been merged',
    doc: 'Check if a pull request has been merged',
  },
  pullsMerge: {
    comment: 'Merge a pull request',
    doc: 'Merge a pull request\n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  pullsRemoveRequestedReviewers: {
    comment: 'Remove requested reviewers from a pull request',
    doc: 'Remove requested reviewers from a pull request',
  },
  pullsListRequestedReviewers: {
    comment: 'Get all requested reviewers for a pull request',
    doc: 'Get all requested reviewers for a pull request\n  Gets the users or teams whose review is requested for a pull request. Once a requested reviewer submits a review, they are no longer considered a requested reviewer. Their review will instead be returned by the [List reviews for a pull request](https://docs.github.com/rest/pulls/reviews#list-reviews-for-a-pull-request) operation.',
  },
  pullsRequestReviewers: {
    comment: 'Request reviewers for a pull request',
    doc: 'Request reviewers for a pull request\n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  pullsListReviews: {
    comment: 'List reviews for a pull request',
    doc: 'List reviews for a pull request\n  The list of reviews returns in chronological order.',
  },
  pullsCreateReview: {
    comment: 'Create a review for a pull request',
    doc: 'Create a review for a pull request\n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.\n \n  Pull request reviews created in the `PENDING` state are not submitted and therefore do not include the `submitted_at` property in the response. To create a pending review for a pull request, leave the `event` parameter blank. For more information about submitting a `PENDING` review, see "[Submit a review for a pull request](https://docs.github.com/rest/pulls#submit-a-review-for-a-pull-request)."\n \n  Note: To comment on a specific line in a file, you need to first determine the _position_ of that line in the diff. The GitHub REST API offers the `application/vnd.github.v3.diff` [media type](https://docs.github.com/rest/overview/media-types#commits-commit-comparison-and-pull-requests). To see a pull request diff, add this media type to the `Accept` header of a call to the [single pull request](https://docs.github.com/rest/reference/pulls#get-a-pull-request) endpoint.\n \n  The `position` value equals the number of lines down from the first "@@" hunk header in the file you want to add a comment. The line just below the "@@" line is position 1, the next line is position 2, and so on. The position in the diff continues to increase through lines of whitespace and additional hunks until the beginning of a new file.',
  },
  pullsDeletePendingReview: {
    comment: 'Delete a pending review for a pull request',
    doc: 'Delete a pending review for a pull request',
  },
  pullsGetReview: {
    comment: 'Get a review for a pull request',
    doc: 'Get a review for a pull request',
  },
  pullsUpdateReview: {
    comment: 'Update a review for a pull request',
    doc: 'Update a review for a pull request\n  Update the review summary comment with new text.',
  },
  pullsListCommentsForReview: {
    comment: 'List comments for a pull request review',
    doc: 'List comments for a pull request review\n  List comments for a specific pull request review.',
  },
  pullsDismissReview: {
    comment: 'Dismiss a review for a pull request',
    doc: 'Dismiss a review for a pull request\n  Note: To dismiss a pull request review on a [protected branch](https://docs.github.com/rest/reference/repos#branches), you must be a repository administrator or be included in the list of people or teams who can dismiss pull request reviews.',
  },
  pullsSubmitReview: {
    comment: 'Submit a review for a pull request',
    doc: 'Submit a review for a pull request\n  Submits a pending review for a pull request. For more information about creating a pending review for a pull request, see "[Create a review for a pull request](https://docs.github.com/rest/pulls#create-a-review-for-a-pull-request)."',
  },
  pullsUpdateBranch: {
    comment: 'Update a pull request branch',
    doc: 'Update a pull request branch\n  Updates the pull request branch with the latest upstream changes by merging HEAD from the base branch into the pull request branch.',
  },
  reposGetReadme: {
    comment: 'Get a repository README',
    doc: 'Get a repository README\n  Gets the preferred README for a repository.\n \n  READMEs support [custom media types](https://docs.github.com/rest/reference/repos#custom-media-types) for retrieving the raw content or rendered HTML.',
  },
  reposGetReadmeInDirectory: {
    comment: 'Get a repository README for a directory',
    doc: 'Get a repository README for a directory\n  Gets the README from a repository directory.\n \n  READMEs support [custom media types](https://docs.github.com/rest/reference/repos#custom-media-types) for retrieving the raw content or rendered HTML.',
  },
  reposListReleases: {
    comment: 'List releases',
    doc: 'List releases\n  This returns a list of releases, which does not include regular Git tags that have not been associated with a release. To get a list of Git tags, use the [Repository Tags API](https://docs.github.com/rest/reference/repos#list-repository-tags).\n \n  Information about published releases are available to everyone. Only users with push access will receive listings for draft releases.',
  },
  reposCreateRelease: {
    comment: 'Create a release',
    doc: 'Create a release\n  Users with push access to the repository can create a release.\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  reposDeleteReleaseAsset: {
    comment: 'Delete a release asset',
    doc: 'Delete a release asset',
  },
  reposGetReleaseAsset: {
    comment: 'Get a release asset',
    doc: "Get a release asset\n  To download the asset's binary content, set the `Accept` header of the request to [`application/octet-stream`](https://docs.github.com/rest/overview/media-types). The API will either redirect the client to the location, or stream it directly if possible. API clients should handle both a `200` or `302` response.",
  },
  reposUpdateReleaseAsset: {
    comment: 'Update a release asset',
    doc: 'Update a release asset\n  Users with push access to the repository can edit a release asset.',
  },
  reposGenerateReleaseNotes: {
    comment: 'Generate release notes content for a release',
    doc: 'Generate release notes content for a release\n  Generate a name and body describing a [release](https://docs.github.com/rest/reference/repos#releases). The body content will be markdown formatted and contain information like the changes since last release and users who contributed. The generated release notes are not saved anywhere. They are intended to be generated and used when creating a new release.',
  },
  reposGetLatestRelease: {
    comment: 'Get the latest release',
    doc: 'Get the latest release\n  View the latest published full release for the repository.\n \n  The latest release is the most recent non-prerelease, non-draft release, sorted by the `created_at` attribute. The `created_at` attribute is the date of the commit used for the release, and not the date when the release was drafted or published.',
  },
  reposGetReleaseByTag: {
    comment: 'Get a release by tag name',
    doc: 'Get a release by tag name\n  Get a published release with the specified tag.',
  },
  reposDeleteRelease: {
    comment: 'Delete a release',
    doc: 'Delete a release\n  Users with push access to the repository can delete a release.',
  },
  reposGetRelease: {
    comment: 'Get a release',
    doc: 'Get a release\n  Note: This returns an `upload_url` key corresponding to the endpoint for uploading release assets. This key is a [hypermedia resource](https://docs.github.com/rest/overview/resources-in-the-rest-api#hypermedia).',
  },
  reposUpdateRelease: {
    comment: 'Update a release',
    doc: 'Update a release\n  Users with push access to the repository can edit a release.',
  },
  reposListReleaseAssets: {
    comment: 'List release assets',
    doc: 'List release assets',
  },
  reposUploadReleaseAsset: {
    comment: 'Upload a release asset',
    doc: 'Upload a release asset\n  This endpoint makes use of [a Hypermedia relation](https://docs.github.com/rest/overview/resources-in-the-rest-api#hypermedia) to determine which URL to access. The endpoint you call to upload release assets is specific to your release. Use the `upload_url` returned in\n  the response of the [Create a release endpoint](https://docs.github.com/rest/releases/releases#create-a-release) to upload a release asset.\n \n  You need to use an HTTP client which supports [SNI](http://en.wikipedia.org/wiki/Server_Name_Indication) to make calls to this endpoint.\n \n  Most libraries will set the required `Content-Length` header automatically. Use the required `Content-Type` header to provide the media type of the asset. For a list of media types, see [Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml). For example:\n \n  `application/zip`\n \n  GitHub expects the asset data in its raw binary form, rather than JSON. You will send the raw binary content of the asset as the request body. Everything else about the endpoint is the same as the rest of the API. For example,\n  you\'ll still need to pass your authentication to be able to upload an asset.\n \n  When an upstream failure occurs, you will receive a `502 Bad Gateway` status. This may leave an empty asset with a state of `starter`. It can be safely deleted.\n \n  Notes:\n     GitHub renames asset filenames that have special characters, non-alphanumeric characters, and leading or trailing periods. The "[List assets for a release](https://docs.github.com/rest/reference/repos#list-assets-for-a-release)"\n  endpoint lists the renamed filenames. For more information and help, contact [GitHub Support](https://support.github.com/contact?tags=dotcom-rest-api).\n     To find the `release_id` query the [`GET /repos/{owner}/{repo}/releases/latest` endpoint](https://docs.github.com/rest/releases/releases#get-the-latest-release).\n     If you upload an asset with the same filename as another uploaded asset, you\'ll receive an error and must delete the old file before you can re-upload the new asset.',
  },
  reactionsListForRelease: {
    comment: 'List reactions for a release',
    doc: 'List reactions for a release\n  List the reactions to a [release](https://docs.github.com/rest/reference/repos#releases).',
  },
  reactionsCreateForRelease: {
    comment: 'Create reaction for a release',
    doc: 'Create reaction for a release\n  Create a reaction to a [release](https://docs.github.com/rest/reference/repos#releases). A response with a `Status: 200 OK` means that you already added the reaction type to this release.',
  },
  reactionsDeleteForRelease: {
    comment: 'Delete a release reaction',
    doc: 'Delete a release reaction\n  Note: You can also specify a repository by `repository_id` using the route `DELETE delete /repositories/:repository_id/releases/:release_id/reactions/:reaction_id`.\n \n  Delete a reaction to a [release](https://docs.github.com/rest/reference/repos#releases).',
  },
  secretScanningListAlertsForRepo: {
    comment: 'List secret scanning alerts for a repository',
    doc: 'List secret scanning alerts for a repository\n  Lists secret scanning alerts for an eligible repository, from newest to oldest.\n  To use this endpoint, you must be an administrator for the repository or for the organization that owns the repository, and you must use a personal access token with the `repo` scope or `security_events` scope.\n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `secret_scanning_alerts` read permission to use this endpoint.',
  },
  secretScanningGetAlert: {
    comment: 'Get a secret scanning alert',
    doc: 'Get a secret scanning alert\n  Gets a single secret scanning alert detected in an eligible repository.\n  To use this endpoint, you must be an administrator for the repository or for the organization that owns the repository, and you must use a personal access token with the `repo` scope or `security_events` scope.\n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `secret_scanning_alerts` read permission to use this endpoint.',
  },
  secretScanningUpdateAlert: {
    comment: 'Update a secret scanning alert',
    doc: 'Update a secret scanning alert\n  Updates the status of a secret scanning alert in an eligible repository.\n  To use this endpoint, you must be an administrator for the repository or for the organization that owns the repository, and you must use a personal access token with the `repo` scope or `security_events` scope.\n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `secret_scanning_alerts` write permission to use this endpoint.',
  },
  secretScanningListLocationsForAlert: {
    comment: 'List locations for a secret scanning alert',
    doc: 'List locations for a secret scanning alert\n  Lists all locations for a given secret scanning alert for an eligible repository.\n  To use this endpoint, you must be an administrator for the repository or for the organization that owns the repository, and you must use a personal access token with the `repo` scope or `security_events` scope.\n  For public repositories, you may instead use the `public_repo` scope.\n \n  GitHub Apps must have the `secret_scanning_alerts` read permission to use this endpoint.',
  },
  activityListStargazersForRepo: {
    comment: 'List stargazers',
    doc: 'List stargazers\n  Lists the people that have starred the repository.\n \n  You can also find out _when_ stars were created by passing the following custom [media type](https://docs.github.com/rest/overview/media-types/) via the `Accept` header: `application/vnd.github.star+json`.',
  },
  reposGetCodeFrequencyStats: {
    comment: 'Get the weekly commit activity',
    doc: 'Get the weekly commit activity\n  Returns a weekly aggregate of the number of additions and deletions pushed to a repository.',
  },
  reposGetCommitActivityStats: {
    comment: 'Get the last year of commit activity',
    doc: 'Get the last year of commit activity\n  Returns the last year of commit activity grouped by week. The `days` array is a group of commits per day, starting on `Sunday`.',
  },
  reposGetContributorsStats: {
    comment: 'Get all contributor commit activity',
    doc: 'Get all contributor commit activity\n \n  Returns the `total` number of commits authored by the contributor. In addition, the response includes a Weekly Hash (`weeks` array) with the following information:\n \n     `w` - Start of the week, given as a [Unix timestamp](http://en.wikipedia.org/wiki/Unix_time).\n     `a` - Number of additions\n     `d` - Number of deletions\n     `c` - Number of commits',
  },
  reposGetParticipationStats: {
    comment: 'Get the weekly commit count',
    doc: "Get the weekly commit count\n  Returns the total commit counts for the `owner` and total commit counts in `all`. `all` is everyone combined, including the `owner` in the last 52 weeks. If you'd like to get the commit counts for non-owners, you can subtract `owner` from `all`.\n \n  The array order is oldest week (index 0) to most recent week.",
  },
  reposGetPunchCardStats: {
    comment: 'Get the hourly commit count for each day',
    doc: 'Get the hourly commit count for each day\n  Each array contains the day number, hour number, and number of commits:\n \n     `0-6`: Sunday - Saturday\n     `0-23`: Hour of day\n     Number of commits\n \n  For example, `[2, 14, 25]` indicates that there were 25 total commits, during the 2:00pm hour on Tuesdays. All times are based on the time zone of individual commits.',
  },
  reposCreateCommitStatus: {
    comment: 'Create a commit status',
    doc: 'Create a commit status\n  Users with push access in a repository can create commit statuses for a given SHA.\n \n  Note: there is a limit of 1000 statuses per `sha` and `context` within a repository. Attempts to create more than 1000 statuses will result in a validation error.',
  },
  activityListWatchersForRepo: {
    comment: 'List watchers',
    doc: 'List watchers\n  Lists the people watching the specified repository.',
  },
  activityDeleteRepoSubscription: {
    comment: 'Delete a repository subscription',
    doc: "Delete a repository subscription\n  This endpoint should only be used to stop watching a repository. To control whether or not you wish to receive notifications from a repository, [set the repository's subscription manually](https://docs.github.com/rest/reference/activity#set-a-repository-subscription).",
  },
  activityGetRepoSubscription: {
    comment: 'Get a repository subscription',
    doc: 'Get a repository subscription',
  },
  activitySetRepoSubscription: {
    comment: 'Set a repository subscription',
    doc: "Set a repository subscription\n  If you would like to watch a repository, set `subscribed` to `true`. If you would like to ignore notifications made within a repository, set `ignored` to `true`. If you would like to stop watching a repository, [delete the repository's subscription](https://docs.github.com/rest/reference/activity#delete-a-repository-subscription) completely.",
  },
  reposListTags: {
    comment: 'List repository tags',
    doc: 'List repository tags',
  },
  reposListTagProtection: {
    comment: 'List tag protection states for a repository',
    doc: 'List tag protection states for a repository\n  This returns the tag protection states of a repository.\n \n  This information is only available to repository administrators.',
  },
  reposCreateTagProtection: {
    comment: 'Create a tag protection state for a repository',
    doc: 'Create a tag protection state for a repository\n  This creates a tag protection state for a repository.\n  This endpoint is only available to repository administrators.',
  },
  reposDeleteTagProtection: {
    comment: 'Delete a tag protection state for a repository',
    doc: 'Delete a tag protection state for a repository\n  This deletes a tag protection state for a repository.\n  This endpoint is only available to repository administrators.',
  },
  reposDownloadTarballArchive: {
    comment: 'Download a repository archive (tar)',
    doc: 'Download a repository archive (tar)\n  Gets a redirect URL to download a tar archive for a repository. If you omit `:ref`, the repository’s default branch (usually\n  `main`) will be used. Please make sure your HTTP framework is configured to follow redirects or you will need to use\n  the `Location` header to make a second `GET` request.\n  Note: For private repositories, these links are temporary and expire after five minutes.',
  },
  reposListTeams: {
    comment: 'List repository teams',
    doc: 'List repository teams',
  },
  reposGetAllTopics: {
    comment: 'Get all repository topics',
    doc: 'Get all repository topics',
  },
  reposReplaceAllTopics: {
    comment: 'Replace all repository topics',
    doc: 'Replace all repository topics',
  },
  reposGetClones: {
    comment: 'Get repository clones',
    doc: 'Get repository clones\n  Get the total number of clones and breakdown per day or week for the last 14 days. Timestamps are aligned to UTC midnight of the beginning of the day or week. Week begins on Monday.',
  },
  reposGetTopPaths: {
    comment: 'Get top referral paths',
    doc: 'Get top referral paths\n  Get the top 10 popular contents over the last 14 days.',
  },
  reposGetTopReferrers: {
    comment: 'Get top referral sources',
    doc: 'Get top referral sources\n  Get the top 10 referrers over the last 14 days.',
  },
  reposGetViews: {
    comment: 'Get page views',
    doc: 'Get page views\n  Get the total number of views and breakdown per day or week for the last 14 days. Timestamps are aligned to UTC midnight of the beginning of the day or week. Week begins on Monday.',
  },
  reposTransfer: {
    comment: 'Transfer a repository',
    doc: 'Transfer a repository\n  A transfer request will need to be accepted by the new owner when transferring a personal repository to another user. The response will contain the original `owner`, and the transfer will continue asynchronously. For more details on the requirements to transfer personal and organization-owned repositories, see [about repository transfers](https://docs.github.com/articles/about-repository-transfers/).',
  },
  reposDisableVulnerabilityAlerts: {
    comment: 'Disable vulnerability alerts',
    doc: 'Disable vulnerability alerts\n  Disables dependency alerts and the dependency graph for a repository.\n  The authenticated user must have admin access to the repository. For more information,\n  see "[About security alerts for vulnerable dependencies](https://docs.github.com/articles/about-security-alerts-for-vulnerable-dependencies)".',
  },
  reposCheckVulnerabilityAlerts: {
    comment: 'Check if vulnerability alerts are enabled for a repository',
    doc: 'Check if vulnerability alerts are enabled for a repository\n  Shows whether dependency alerts are enabled or disabled for a repository. The authenticated user must have admin read access to the repository. For more information, see "[About security alerts for vulnerable dependencies](https://docs.github.com/articles/about-security-alerts-for-vulnerable-dependencies)".',
  },
  reposEnableVulnerabilityAlerts: {
    comment: 'Enable vulnerability alerts',
    doc: 'Enable vulnerability alerts\n  Enables dependency alerts and the dependency graph for a repository. The authenticated user must have admin access to the repository. For more information, see "[About security alerts for vulnerable dependencies](https://docs.github.com/articles/about-security-alerts-for-vulnerable-dependencies)".',
  },
  reposDownloadZipballArchive: {
    comment: 'Download a repository archive (zip)',
    doc: 'Download a repository archive (zip)\n  Gets a redirect URL to download a zip archive for a repository. If you omit `:ref`, the repository’s default branch (usually\n  `main`) will be used. Please make sure your HTTP framework is configured to follow redirects or you will need to use\n  the `Location` header to make a second `GET` request.\n \n  Note: For private repositories, these links are temporary and expire after five minutes. If the repository is empty, you will receive a 404 when you follow the redirect.',
  },
  reposCreateUsingTemplate: {
    comment: 'Create a repository using a template',
    doc: "Create a repository using a template\n  Creates a new repository using a repository template. Use the `template_owner` and `template_repo` route parameters to specify the repository to use as the template. If the repository is not public, the authenticated user must own or be a member of an organization that owns the repository. To check if a repository is available to use as a template, get the repository's information using the [Get a repository](https://docs.github.com/rest/reference/repos#get-a-repository) endpoint and check that the `is_template` key is `true`.\n \n  OAuth scope requirements\n \n  When using [OAuth](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/), authorizations must include:\n \n     `public_repo` scope or `repo` scope to create a public repository. Note: For GitHub AE, use `repo` scope to create an internal repository.\n     `repo` scope to create a private repository",
  },
  reposListPublic: {
    comment: 'List public repositories',
    doc: 'List public repositories\n  Lists all public repositories in the order that they were created.\n \n  Note:\n  - For GitHub Enterprise Server, this endpoint will only list repositories available to all users on the enterprise.\n  - Pagination is powered exclusively by the `since` parameter. Use the [Link header](https://docs.github.com/rest/overview/resources-in-the-rest-api#link-header) to get the URL for the next page of repositories.',
  },
  actionsListEnvironmentSecrets: {
    comment: 'List environment secrets',
    doc: 'List environment secrets\n  Lists all secrets available in an environment without revealing their encrypted values. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsGetEnvironmentPublicKey: {
    comment: 'Get an environment public key',
    doc: 'Get an environment public key\n  Get the public key for an environment, which you need to encrypt environment secrets. You need to encrypt a secret before you can create or update secrets. Anyone with read access to the repository can use this endpoint. If the repository is private you must use an access token with the `repo` scope. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsDeleteEnvironmentSecret: {
    comment: 'Delete an environment secret',
    doc: 'Delete an environment secret\n  Deletes a secret in an environment using the secret name. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsGetEnvironmentSecret: {
    comment: 'Get an environment secret',
    doc: 'Get an environment secret\n  Gets a single environment secret without revealing its encrypted value. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use this endpoint.',
  },
  actionsCreateOrUpdateEnvironmentSecret: {
    comment: 'Create or update an environment secret',
    doc: 'Create or update an environment secret\n  Creates or updates an environment secret with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages). You must authenticate using an access\n  token with the `repo` scope to use this endpoint. GitHub Apps must have the `secrets` repository permission to use\n  this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  actionsListEnvironmentVariables: {
    comment: 'List environment variables',
    doc: 'List environment variables\n  Lists all environment variables. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `environments:read` repository permission to use this endpoint.',
  },
  actionsCreateEnvironmentVariable: {
    comment: 'Create an environment variable',
    doc: 'Create an environment variable\n  Create an environment variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `environment:write` repository permission to use this endpoint.',
  },
  actionsDeleteEnvironmentVariable: {
    comment: 'Delete an environment variable',
    doc: 'Delete an environment variable\n  Deletes an environment variable using the variable name.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `environment:write` repository permission to use this endpoint.',
  },
  actionsGetEnvironmentVariable: {
    comment: 'Get an environment variable',
    doc: 'Get an environment variable\n  Gets a specific variable in an environment. You must authenticate using an access token with the `repo` scope to use this endpoint. GitHub Apps must have the `environments:read` repository permission to use this endpoint.',
  },
  actionsUpdateEnvironmentVariable: {
    comment: 'Update an environment variable',
    doc: 'Update an environment variable\n  Updates an environment variable that you can reference in a GitHub Actions workflow.\n  You must authenticate using an access token with the `repo` scope to use this endpoint.\n  GitHub Apps must have the `environment:write` repository permission to use this endpoint.',
  },
  searchCode: {
    comment: 'Search code',
    doc: "Search code\n  Searches for query terms inside of a file. This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for code, you can get text match metadata for the file content and file path fields when you pass the `text-match` media type. For more details about how to receive highlighted search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to find the definition of the `addClass` function inside [jQuery](https://github.com/jquery/jquery) repository, your query would look something like this:\n \n  `q=addClass+in:file+language:js+repo:jquery/jquery`\n \n  This query searches for the keyword `addClass` within a file's contents. The query limits the search to files where the language is JavaScript in the `jquery/jquery` repository.\n \n  #### Considerations for code search\n \n  Due to the complexity of searching code, there are a few restrictions on how searches are performed:\n \n     Only the _default branch_ is considered. In most cases, this will be the `master` branch.\n     Only files smaller than 384 KB are searchable.\n     You must always include at least one search term when searching source code. For example, searching for [`language:go`](https://github.com/search?utf8=%E2%9C%93&q=language%3Ago&type=Code) is not valid, while [`amazing\n  language:go`](https://github.com/search?utf8=%E2%9C%93&q=amazing+language%3Ago&type=Code) is.",
  },
  searchCommits: {
    comment: 'Search commits',
    doc: 'Search commits\n  Find commits via various criteria on the default branch (usually `main`). This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for commits, you can get text match metadata for the message field when you provide the `text-match` media type. For more details about how to receive highlighted search results, see [Text match\n  metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to find commits related to CSS in the [octocat/Spoon-Knife](https://github.com/octocat/Spoon-Knife) repository. Your query would look something like this:\n \n  `q=repo:octocat/Spoon-Knife+css`',
  },
  searchIssuesAndPullRequests: {
    comment: 'Search issues and pull requests',
    doc: 'Search issues and pull requests\n  Find issues by state and keyword. This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for issues, you can get text match metadata for the issue title, issue body, and issue comment body fields when you pass the `text-match` media type. For more details about how to receive highlighted\n  search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to find the oldest unresolved Python bugs on Windows. Your query might look something like this.\n \n  `q=windows+label:bug+language:python+state:open&sort=created&order=asc`\n \n  This query searches for the keyword `windows`, within any open issue that is labeled as `bug`. The search runs across repositories whose primary language is Python. The results are sorted by creation date in ascending order, which means the oldest issues appear first in the search results.\n \n  Note: For [user-to-server](https://docs.github.com/developers/apps/identifying-and-authorizing-users-for-github-apps#user-to-server-requests) GitHub App requests, you can\'t retrieve a combination of issues and pull requests in a single query. Requests that don\'t include the `is:issue` or `is:pull-request` qualifier will receive an HTTP `422 Unprocessable Entity` response. To get results for both issues and pull requests, you must send separate queries for issues and pull requests. For more information about the `is` qualifier, see "[Searching only issues or pull requests](https://docs.github.com/github/searching-for-information-on-github/searching-issues-and-pull-requests#search-only-issues-or-pull-requests)."',
  },
  searchLabels: {
    comment: 'Search labels',
    doc: 'Search labels\n  Find labels in a repository with names or descriptions that match search keywords. Returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for labels, you can get text match metadata for the label name and description fields when you pass the `text-match` media type. For more details about how to receive highlighted search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to find labels in the `linguist` repository that match `bug`, `defect`, or `enhancement`. Your query might look like this:\n \n  `q=bug+defect+enhancement&repository_id=64778136`\n \n  The labels that best match the query appear first in the search results.',
  },
  searchRepos: {
    comment: 'Search repositories',
    doc: 'Search repositories\n  Find repositories via various criteria. This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for repositories, you can get text match metadata for the name and description fields when you pass the `text-match` media type. For more details about how to receive highlighted search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to search for popular Tetris repositories written in assembly code, your query might look like this:\n \n  `q=tetris+language:assembly&sort=stars&order=desc`\n \n  This query searches for repositories with the word `tetris` in the name, the description, or the README. The results are limited to repositories where the primary language is assembly. The results are sorted by stars in descending order, so that the most popular repositories appear first in the search results.',
  },
  searchTopics: {
    comment: 'Search topics',
    doc: 'Search topics\n  Find topics via various criteria. Results are sorted by best match. This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination). See "[Searching topics](https://docs.github.com/articles/searching-topics/)" for a detailed list of qualifiers.\n \n  When searching for topics, you can get text match metadata for the topic\'s short\\_description, description, name, or display\\_name field when you pass the `text-match` media type. For more details about how to receive highlighted search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you want to search for topics related to Ruby that are featured on https://github.com/topics. Your query might look like this:\n \n  `q=ruby+is:featured`\n \n  This query searches for topics with the keyword `ruby` and limits the results to find only topics that are featured. The topics that are the best match for the query appear first in the search results.',
  },
  searchUsers: {
    comment: 'Search users',
    doc: "Search users\n  Find users via various criteria. This method returns up to 100 results [per page](https://docs.github.com/rest/overview/resources-in-the-rest-api#pagination).\n \n  When searching for users, you can get text match metadata for the issue login, public email, and name fields when you pass the `text-match` media type. For more details about highlighting search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata). For more details about how to receive highlighted search results, see [Text match metadata](https://docs.github.com/rest/reference/search#text-match-metadata).\n \n  For example, if you're looking for a list of popular users, you might try this query:\n \n  `q=tom+repos:%3E42+followers:%3E1000`\n \n  This query searches for users with the name `tom`. The results are restricted to users with more than 42 repositories and over 1,000 followers.",
  },
  teamsDeleteLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Delete a team (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Delete a team](https://docs.github.com/rest/reference/teams#delete-a-team) endpoint.\n \n  To delete a team, the authenticated user must be an organization owner or team maintainer.\n \n  If you are an organization owner, deleting a parent team will delete all of its child teams as well.',
  },
  teamsGetLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Get a team (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the [Get a team by name](https://docs.github.com/rest/reference/teams#get-a-team-by-name) endpoint.',
  },
  teamsUpdateLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Update a team (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Update a team](https://docs.github.com/rest/reference/teams#update-a-team) endpoint.\n \n  To edit a team, the authenticated user must either be an organization owner or a team maintainer.\n \n  Note: With nested teams, the `privacy` for parent teams cannot be `secret`.',
  },
  teamsListDiscussionsLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  List discussions (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List discussions`](https://docs.github.com/rest/reference/teams#list-discussions) endpoint.\n \n  List all discussions on a team's page. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  teamsCreateDiscussionLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Create a discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`Create a discussion`](https://docs.github.com/rest/reference/teams#create-a-discussion) endpoint.\n \n  Creates a new discussion post on a team\'s page. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  teamsDeleteDiscussionLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Delete a discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`Delete a discussion`](https://docs.github.com/rest/reference/teams#delete-a-discussion) endpoint.\n \n  Delete a discussion from a team's page. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  teamsGetDiscussionLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Get a discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Get a discussion](https://docs.github.com/rest/reference/teams#get-a-discussion) endpoint.\n \n  Get a specific discussion on a team's page. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  teamsUpdateDiscussionLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Update a discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Update a discussion](https://docs.github.com/rest/reference/teams#update-a-discussion) endpoint.\n \n  Edits the title and body text of a discussion post. Only the parameters you provide are updated. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  teamsListDiscussionCommentsLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List discussion comments (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [List discussion comments](https://docs.github.com/rest/reference/teams#list-discussion-comments) endpoint.\n \n  List all comments on a team discussion. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  teamsCreateDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Create a discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Create a discussion comment](https://docs.github.com/rest/reference/teams#create-a-discussion-comment) endpoint.\n \n  Creates a new comment on a team discussion. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).\n \n  This endpoint triggers [notifications](https://docs.github.com/github/managing-subscriptions-and-notifications-on-github/about-notifications). Creating content too quickly using this endpoint may result in secondary rate limiting. See "[Secondary rate limits](https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits)" and "[Dealing with secondary rate limits](https://docs.github.com/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits)" for details.',
  },
  teamsDeleteDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Delete a discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Delete a discussion comment](https://docs.github.com/rest/reference/teams#delete-a-discussion-comment) endpoint.\n \n  Deletes a comment on a team discussion. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  teamsGetDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Get a discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Get a discussion comment](https://docs.github.com/rest/reference/teams#get-a-discussion-comment) endpoint.\n \n  Get a specific comment on a team discussion. OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  teamsUpdateDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Update a discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Update a discussion comment](https://docs.github.com/rest/reference/teams#update-a-discussion-comment) endpoint.\n \n  Edits the body text of a discussion comment. OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  reactionsListForTeamDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List reactions for a team discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List reactions for a team discussion comment`](https://docs.github.com/rest/reference/reactions#list-reactions-for-a-team-discussion-comment) endpoint.\n \n  List the reactions to a [team discussion comment](https://docs.github.com/rest/reference/teams#discussion-comments). OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  reactionsCreateForTeamDiscussionCommentLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Create reaction for a team discussion comment (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new "[Create reaction for a team discussion comment](https://docs.github.com/rest/reference/reactions#create-reaction-for-a-team-discussion-comment)" endpoint.\n \n  Create a reaction to a [team discussion comment](https://docs.github.com/rest/reference/teams#discussion-comments). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/). A response with an HTTP `200` status means that you already added the reaction type to this team discussion comment.',
  },
  reactionsListForTeamDiscussionLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List reactions for a team discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List reactions for a team discussion`](https://docs.github.com/rest/reference/reactions#list-reactions-for-a-team-discussion) endpoint.\n \n  List the reactions to a [team discussion](https://docs.github.com/rest/reference/teams#discussions). OAuth access tokens require the `read:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  reactionsCreateForTeamDiscussionLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Create reaction for a team discussion (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`Create reaction for a team discussion`](https://docs.github.com/rest/reference/reactions#create-reaction-for-a-team-discussion) endpoint.\n \n  Create a reaction to a [team discussion](https://docs.github.com/rest/reference/teams#discussions). OAuth access tokens require the `write:discussion` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/). A response with an HTTP `200` status means that you already added the reaction type to this team discussion.',
  },
  teamsListPendingInvitationsLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List pending team invitations (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List pending team invitations`](https://docs.github.com/rest/reference/teams#list-pending-team-invitations) endpoint.\n \n  The return hash contains a `role` field which refers to the Organization Invitation role and will be one of the following values: `direct_member`, `admin`, `billing_manager`, `hiring_manager`, or `reinstate`. If the invitee is not a GitHub member, the `login` field in the return hash will be `null`.',
  },
  teamsListMembersLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List team members (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List team members`](https://docs.github.com/rest/reference/teams#list-team-members) endpoint.\n \n  Team members will include the members of child teams.',
  },
  teamsRemoveMemberLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Remove team member (Legacy)\n  The \"Remove team member\" endpoint (described below) is deprecated.\n \n  We recommend using the [Remove team membership for a user](https://docs.github.com/rest/reference/teams#remove-team-membership-for-a-user) endpoint instead. It allows you to remove both active and pending memberships.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  To remove a team member, the authenticated user must have 'admin' permissions to the team or be an owner of the org that the team is associated with. Removing a team member does not delete the user, it just removes them from the team.\n \n  Note: When you have team synchronization set up for a team with your organization's identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team's membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see \"[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/).\"",
  },
  teamsGetMemberLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Get team member (Legacy)\n  The "Get team member" endpoint (described below) is deprecated.\n \n  We recommend using the [Get team membership for a user](https://docs.github.com/rest/reference/teams#get-team-membership-for-a-user) endpoint instead. It allows you to get both active and pending memberships.\n \n  To list members in a team, the team must be visible to the authenticated user.',
  },
  teamsAddMemberLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Add team member (Legacy)\n  The "Add team member" endpoint (described below) is deprecated.\n \n  We recommend using the [Add or update team membership for a user](https://docs.github.com/rest/reference/teams#add-or-update-team-membership-for-a-user) endpoint instead. It allows you to invite new organization members to your teams.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub\'s products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  To add someone to a team, the authenticated user must be an organization owner or a team maintainer in the team they\'re changing. The person being added to the team must be a member of the team\'s organization.\n \n  Note: When you have team synchronization set up for a team with your organization\'s identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team\'s membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see "[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/)."\n \n  Note that you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  teamsRemoveMembershipForUserLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Remove team membership for a user (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Remove team membership for a user](https://docs.github.com/rest/reference/teams#remove-team-membership-for-a-user) endpoint.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub's products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  To remove a membership between a user and a team, the authenticated user must have 'admin' permissions to the team or be an owner of the organization that the team is associated with. Removing team membership does not delete the user, it just removes their membership from the team.\n \n  Note: When you have team synchronization set up for a team with your organization's identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team's membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see \"[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/).\"",
  },
  teamsGetMembershipForUserLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Get team membership for a user (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Get team membership for a user](https://docs.github.com/rest/reference/teams#get-team-membership-for-a-user) endpoint.\n \n  Team members will include the members of child teams.\n \n  To get a user's membership with a team, the team must be visible to the authenticated user.\n \n  Note:\n  The response contains the `state` of the membership and the member's `role`.\n \n  The `role` for organization owners is set to `maintainer`. For more information about `maintainer` roles, see [Create a team](https://docs.github.com/rest/reference/teams#create-a-team).",
  },
  teamsAddOrUpdateMembershipForUserLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Add or update team membership for a user (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Add or update team membership for a user](https://docs.github.com/rest/reference/teams#add-or-update-team-membership-for-a-user) endpoint.\n \n  Team synchronization is available for organizations using GitHub Enterprise Cloud. For more information, see [GitHub\'s products](https://docs.github.com/github/getting-started-with-github/githubs-products) in the GitHub Help documentation.\n \n  If the user is already a member of the team\'s organization, this endpoint will add the user to the team. To add a membership between an organization member and a team, the authenticated user must be an organization owner or a team maintainer.\n \n  Note: When you have team synchronization set up for a team with your organization\'s identity provider (IdP), you will see an error if you attempt to use the API for making changes to the team\'s membership. If you have access to manage group membership in your IdP, you can manage GitHub team membership through your identity provider, which automatically adds and removes team members in an organization. For more information, see "[Synchronizing teams between your identity provider and GitHub](https://docs.github.com/articles/synchronizing-teams-between-your-identity-provider-and-github/)."\n \n  If the user is unaffiliated with the team\'s organization, this endpoint will send an invitation to the user via email. This newly-created membership will be in the "pending" state until the user accepts the invitation, at which point the membership will transition to the "active" state and the user will be added as a member of the team. To add a membership between an unaffiliated user and a team, the authenticated user must be an organization owner.\n \n  If the user is already a member of the team, this endpoint will update the role of the team member\'s role. To update the membership of a team member, the authenticated user must be an organization owner or a team maintainer.',
  },
  teamsListProjectsLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List team projects (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List team projects`](https://docs.github.com/rest/reference/teams#list-team-projects) endpoint.\n \n  Lists the organization projects for a team.',
  },
  teamsRemoveProjectLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Remove a project from a team (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Remove a project from a team](https://docs.github.com/rest/reference/teams#remove-a-project-from-a-team) endpoint.\n \n  Removes an organization project from a team. An organization owner or a team maintainer can remove any project from the team. To remove a project from a team as an organization member, the authenticated user must have `read` access to both the team and project, or `admin` access to the team or project. Note: This endpoint removes the project from the team, but does not delete it.',
  },
  teamsCheckPermissionsForProjectLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Check team permissions for a project (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Check team permissions for a project](https://docs.github.com/rest/reference/teams#check-team-permissions-for-a-project) endpoint.\n \n  Checks whether a team has `read`, `write`, or `admin` permissions for an organization project. The response includes projects inherited from a parent team.',
  },
  teamsAddOrUpdateProjectPermissionsLegacy: {
    comment: '@deprecated',
    doc: "@deprecated\n  Add or update team project permissions (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Add or update team project permissions](https://docs.github.com/rest/reference/teams#add-or-update-team-project-permissions) endpoint.\n \n  Adds an organization project to a team. To add a project to a team or update the team's permission on a project, the authenticated user must have `admin` permissions for the project. The project and team must be part of the same organization.",
  },
  teamsListReposLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List team repositories (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [List team repositories](https://docs.github.com/rest/reference/teams#list-team-repositories) endpoint.',
  },
  teamsRemoveRepoLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Remove a repository from a team (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Remove a repository from a team](https://docs.github.com/rest/reference/teams#remove-a-repository-from-a-team) endpoint.\n \n  If the authenticated user is an organization owner or a team maintainer, they can remove any repositories from the team. To remove a repository from a team as an organization member, the authenticated user must have admin access to the repository and must be able to see the team. NOTE: This does not delete the repository, it just removes it from the team.',
  },
  teamsCheckPermissionsForRepoLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Check team permissions for a repository (Legacy)\n  Note: Repositories inherited through a parent team will also be checked.\n \n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [Check team permissions for a repository](https://docs.github.com/rest/reference/teams#check-team-permissions-for-a-repository) endpoint.\n \n  You can also get information about the specified repository, including what permissions the team grants on it, by passing the following custom [media type](https://docs.github.com/rest/overview/media-types/) via the `Accept` header:',
  },
  teamsAddOrUpdateRepoPermissionsLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  Add or update team repository permissions (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new "[Add or update team repository permissions](https://docs.github.com/rest/reference/teams#add-or-update-team-repository-permissions)" endpoint.\n \n  To add a repository to a team or update the team\'s permission on a repository, the authenticated user must have admin access to the repository, and must be able to see the team. The repository must be owned by the organization, or a direct fork of a repository owned by the organization. You will get a `422 Unprocessable Entity` status if you attempt to add a repository to a team that is not owned by the organization.\n \n  Note that, if you choose not to pass any parameters, you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  teamsListChildLegacy: {
    comment: '@deprecated',
    doc: '@deprecated\n  List child teams (Legacy)\n  Deprecation Notice: This endpoint route is deprecated and will be removed from the Teams API. We recommend migrating your existing code to use the new [`List child teams`](https://docs.github.com/rest/reference/teams#list-child-teams) endpoint.',
  },
  usersGetAuthenticated: {
    comment: 'Get the authenticated user',
    doc: 'Get the authenticated user\n  If the authenticated user is authenticated through basic authentication or OAuth with the `user` scope, then the response lists public and private profile information.\n \n  If the authenticated user is authenticated through OAuth without the `user` scope, then the response lists only public profile information.',
  },
  usersUpdateAuthenticated: {
    comment: 'Update the authenticated user',
    doc: 'Update the authenticated user\n  Note: If your email is set to private and you send an `email` parameter as part of this request to update your profile, your privacy settings are still enforced: the email address will not be displayed on your public profile or via the API.',
  },
  usersListBlockedByAuthenticatedUser: {
    comment: 'List users blocked by the authenticated user',
    doc: "List users blocked by the authenticated user\n  List the users you've blocked on your personal account.",
  },
  usersUnblock: {
    comment: 'Unblock a user',
    doc: 'Unblock a user',
  },
  usersCheckBlocked: {
    comment: 'Check if a user is blocked by the authenticated user',
    doc: 'Check if a user is blocked by the authenticated user',
  },
  usersBlock: {
    comment: 'Block a user',
    doc: 'Block a user',
  },
  codespacesListForAuthenticatedUser: {
    comment: 'List codespaces for the authenticated user',
    doc: "List codespaces for the authenticated user\n  Lists the authenticated user's codespaces.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces` repository permission to use this endpoint.",
  },
  codespacesCreateForAuthenticatedUser: {
    comment: 'Create a codespace for the authenticated user',
    doc: 'Create a codespace for the authenticated user\n  Creates a new codespace, owned by the authenticated user.\n \n  This endpoint requires either a `repository_id` OR a `pull_request` but not both.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.',
  },
  codespacesListSecretsForAuthenticatedUser: {
    comment: 'List secrets for the authenticated user',
    doc: "List secrets for the authenticated user\n  Lists all secrets available for a user's Codespaces without revealing their\n  encrypted values.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_user_secrets` user permission to use this endpoint.",
  },
  codespacesGetPublicKeyForAuthenticatedUser: {
    comment: 'Get public key for the authenticated user',
    doc: 'Get public key for the authenticated user\n  Gets your public key, which you need to encrypt secrets. You need to encrypt a secret before you can create or update secrets.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_user_secrets` user permission to use this endpoint.',
  },
  codespacesDeleteSecretForAuthenticatedUser: {
    comment: 'Delete a secret for the authenticated user',
    doc: "Delete a secret for the authenticated user\n  Deletes a secret from a user's codespaces using the secret name. Deleting the secret will remove access from all codespaces that were allowed to access the secret.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_user_secrets` user permission to use this endpoint.",
  },
  codespacesGetSecretForAuthenticatedUser: {
    comment: 'Get a secret for the authenticated user',
    doc: "Get a secret for the authenticated user\n  Gets a secret available to a user's codespaces without revealing its encrypted value.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_user_secrets` user permission to use this endpoint.",
  },
  codespacesCreateOrUpdateSecretForAuthenticatedUser: {
    comment: 'Create or update a secret for the authenticated user',
    doc: 'Create or update a secret for the authenticated user\n  Creates or updates a secret for a user\'s codespace with an encrypted value. Encrypt your secret using\n  [LibSodium](https://libsodium.gitbook.io/doc/bindings_for_other_languages).\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must also have Codespaces access to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_user_secrets` user permission and `codespaces_secrets` repository permission on all referenced repositories to use this endpoint.\n \n  #### Example encrypting a secret using Node.js\n \n  Encrypt your secret using the [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) library.\n \n  ```\n  const sodium = require(\'libsodium-wrappers\')\n  const secret = \'plain-text-secret\' // replace with the secret you want to encrypt\n  const key = \'base64-encoded-public-key\' // replace with the Base64 encoded public key\n \n  //Check if libsodium is ready and then proceed.\n  sodium.ready.then(() => {\n  // Convert Secret & Base64 key to Uint8Array.\n  let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)\n  let binsec = sodium.from_string(secret)\n \n  //Encrypt the secret using LibSodium\n  let encBytes = sodium.crypto_box_seal(binsec, binkey)\n \n  // Convert encrypted Uint8Array to Base64\n  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)\n \n  console.log(output)\n  });\n  ```\n \n  #### Example encrypting a secret using Python\n \n  Encrypt your secret using [pynacl](https://pynacl.readthedocs.io/en/latest/public/#nacl-public-sealedbox) with Python 3.\n \n  ```\n  from base64 import b64encode\n  from nacl import encoding, public\n \n  def encrypt(public_key: str, secret_value: str) -> str:\n  """Encrypt a Unicode string using the public key."""\n  public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())\n  sealed_box = public.SealedBox(public_key)\n  encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))\n  return b64encode(encrypted).decode("utf-8")\n  ```\n \n  #### Example encrypting a secret using C#\n \n  Encrypt your secret using the [Sodium.Core](https://www.nuget.org/packages/Sodium.Core/) package.\n \n  ```\n  var secretValue = System.Text.Encoding.UTF8.GetBytes("mySecret");\n  var publicKey = Convert.FromBase64String("2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvvcCU=");\n \n  var sealedPublicKeyBox = Sodium.SealedPublicKeyBox.Create(secretValue, publicKey);\n \n  Console.WriteLine(Convert.ToBase64String(sealedPublicKeyBox));\n  ```\n \n  #### Example encrypting a secret using Ruby\n \n  Encrypt your secret using the [rbnacl](https://github.com/RubyCrypto/rbnacl) gem.\n \n  ```ruby\n  require "rbnacl"\n  require "base64"\n \n  key = Base64.decode64("+ZYvJDZMHUfBkJdyq5Zm9SKqeuBQ4sj+6sfjlH4CgG0=")\n  public_key = RbNaCl::PublicKey.new(key)\n \n  box = RbNaCl::Boxes::Sealed.from_public_key(public_key)\n  encrypted_secret = box.encrypt("my_secret")\n \n  # Print the base64 encoded secret\n  puts Base64.strict_encode64(encrypted_secret)\n  ```',
  },
  codespacesListRepositoriesForSecretForAuthenticatedUser: {
    comment: 'List selected repositories for a user secret',
    doc: "List selected repositories for a user secret\n  List the repositories that have been granted the ability to use a user's codespace secret.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_user_secrets` user permission and write access to the `codespaces_secrets` repository permission on all referenced repositories to use this endpoint.",
  },
  codespacesSetRepositoriesForSecretForAuthenticatedUser: {
    comment: 'Set selected repositories for a user secret',
    doc: "Set selected repositories for a user secret\n  Select the repositories that will use a user's codespace secret.\n \n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_user_secrets` user permission and write access to the `codespaces_secrets` repository permission on all referenced repositories to use this endpoint.",
  },
  codespacesRemoveRepositoryForSecretForAuthenticatedUser: {
    comment: 'Remove a selected repository from a user secret',
    doc: "Remove a selected repository from a user secret\n  Removes a repository from the selected repositories for a user's codespace secret.\n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n  GitHub Apps must have write access to the `codespaces_user_secrets` user permission to use this endpoint.",
  },
  codespacesAddRepositoryForSecretForAuthenticatedUser: {
    comment: 'Add a selected repository to a user secret',
    doc: "Add a selected repository to a user secret\n  Adds a repository to the selected repositories for a user's codespace secret.\n  You must authenticate using an access token with the `codespace` or `codespace:secrets` scope to use this endpoint. User must have Codespaces access to use this endpoint.\n  GitHub Apps must have write access to the `codespaces_user_secrets` user permission and write access to the `codespaces_secrets` repository permission on the referenced repository to use this endpoint.",
  },
  codespacesDeleteForAuthenticatedUser: {
    comment: 'Delete a codespace for the authenticated user',
    doc: "Delete a codespace for the authenticated user\n  Deletes a user's codespace.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.",
  },
  codespacesGetForAuthenticatedUser: {
    comment: 'Get a codespace for the authenticated user',
    doc: "Get a codespace for the authenticated user\n  Gets information about a user's codespace.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces` repository permission to use this endpoint.",
  },
  codespacesUpdateForAuthenticatedUser: {
    comment: 'Update a codespace for the authenticated user',
    doc: "Update a codespace for the authenticated user\n  Updates a codespace owned by the authenticated user. Currently only the codespace's machine type and recent folders can be modified using this endpoint.\n \n  If you specify a new machine type it will be applied the next time your codespace is started.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.",
  },
  codespacesExportForAuthenticatedUser: {
    comment: 'Export a codespace for the authenticated user',
    doc: "Export a codespace for the authenticated user\n  Triggers an export of the specified codespace and returns a URL and ID where the status of the export can be monitored.\n \n  If changes cannot be pushed to the codespace's repository, they will be pushed to a new or previously-existing fork instead.\n \n  You must authenticate using a personal access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_lifecycle_admin` repository permission to use this endpoint.",
  },
  codespacesGetExportDetailsForAuthenticatedUser: {
    comment: 'Get details about a codespace export',
    doc: 'Get details about a codespace export\n  Gets information about an export of a codespace.\n \n  You must authenticate using a personal access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_lifecycle_admin` repository permission to use this endpoint.',
  },
  codespacesCodespaceMachinesForAuthenticatedUser: {
    comment: 'List machine types for a codespace',
    doc: 'List machine types for a codespace\n  List the machine types a codespace can transition to use.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have read access to the `codespaces_metadata` repository permission to use this endpoint.',
  },
  codespacesPublishForAuthenticatedUser: {
    comment: 'Create a repository from an unpublished codespace',
    doc: "Create a repository from an unpublished codespace\n  Publishes an unpublished codespace, creating a new repository and assigning it to the codespace.\n \n  The codespace's token is granted write permissions to the repository, allowing the user to push their changes.\n \n  This will fail for a codespace that is already published, meaning it has an associated repository.\n \n  You must authenticate using a personal access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces` repository permission to use this endpoint.",
  },
  codespacesStartForAuthenticatedUser: {
    comment: 'Start a codespace for the authenticated user',
    doc: "Start a codespace for the authenticated user\n  Starts a user's codespace.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_lifecycle_admin` repository permission to use this endpoint.",
  },
  codespacesStopForAuthenticatedUser: {
    comment: 'Stop a codespace for the authenticated user',
    doc: "Stop a codespace for the authenticated user\n  Stops a user's codespace.\n \n  You must authenticate using an access token with the `codespace` scope to use this endpoint.\n \n  GitHub Apps must have write access to the `codespaces_lifecycle_admin` repository permission to use this endpoint.",
  },
  usersSetPrimaryEmailVisibilityForAuthenticatedUser: {
    comment: 'Set primary email visibility for the authenticated user',
    doc: 'Set primary email visibility for the authenticated user\n  Sets the visibility for your primary email addresses.',
  },
  usersDeleteEmailForAuthenticatedUser: {
    comment: 'Delete an email address for the authenticated user',
    doc: 'Delete an email address for the authenticated user\n  This endpoint is accessible with the `user` scope.',
  },
  usersListEmailsForAuthenticatedUser: {
    comment: 'List email addresses for the authenticated user',
    doc: 'List email addresses for the authenticated user\n  Lists all of your email addresses, and specifies which one is visible to the public. This endpoint is accessible with the `user:email` scope.',
  },
  usersAddEmailForAuthenticatedUser: {
    comment: 'Add an email address for the authenticated user',
    doc: 'Add an email address for the authenticated user\n  This endpoint is accessible with the `user` scope.',
  },
  usersListFollowersForAuthenticatedUser: {
    comment: 'List followers of the authenticated user',
    doc: 'List followers of the authenticated user\n  Lists the people following the authenticated user.',
  },
  usersListFollowedByAuthenticatedUser: {
    comment: 'List the people the authenticated user follows',
    doc: 'List the people the authenticated user follows\n  Lists the people who the authenticated user follows.',
  },
  usersUnfollow: {
    comment: 'Unfollow a user',
    doc: 'Unfollow a user\n  Unfollowing a user requires the user to be logged in and authenticated with basic auth or OAuth with the `user:follow` scope.',
  },
  usersCheckPersonIsFollowedByAuthenticated: {
    comment: 'Check if a person is followed by the authenticated user',
    doc: 'Check if a person is followed by the authenticated user',
  },
  usersFollow: {
    comment: 'Follow a user',
    doc: 'Follow a user\n  Note that you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."\n \n  Following a user requires the user to be logged in and authenticated with basic auth or OAuth with the `user:follow` scope.',
  },
  usersListGpgKeysForAuthenticatedUser: {
    comment: 'List GPG keys for the authenticated user',
    doc: "List GPG keys for the authenticated user\n  Lists the current user's GPG keys. Requires that you are authenticated via Basic Auth or via OAuth with at least `read:gpg_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersCreateGpgKeyForAuthenticatedUser: {
    comment: 'Create a GPG key for the authenticated user',
    doc: "Create a GPG key for the authenticated user\n  Adds a GPG key to the authenticated user's GitHub account. Requires that you are authenticated via Basic Auth, or OAuth with at least `write:gpg_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersDeleteGpgKeyForAuthenticatedUser: {
    comment: 'Delete a GPG key for the authenticated user',
    doc: "Delete a GPG key for the authenticated user\n  Removes a GPG key from the authenticated user's GitHub account. Requires that you are authenticated via Basic Auth or via OAuth with at least `admin:gpg_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersGetGpgKeyForAuthenticatedUser: {
    comment: 'Get a GPG key for the authenticated user',
    doc: 'Get a GPG key for the authenticated user\n  View extended details for a single GPG key. Requires that you are authenticated via Basic Auth or via OAuth with at least `read:gpg_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  appsListInstallationsForAuthenticatedUser: {
    comment: 'List app installations accessible to the user access token',
    doc: 'List app installations accessible to the user access token\n  Lists installations of your GitHub App that the authenticated user has explicit permission (`:read`, `:write`, or `:admin`) to access.\n \n  You must use a [user-to-server OAuth access token](https://docs.github.com/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps/#identifying-users-on-your-site), created for a user who has authorized your GitHub App, to access this endpoint.\n \n  The authenticated user has explicit permission to access repositories they own, repositories where they are a collaborator, and repositories that they can access through an organization membership.\n \n  You can find the permissions for the installation under the `permissions` key.',
  },
  appsListInstallationReposForAuthenticatedUser: {
    comment: 'List repositories accessible to the user access token',
    doc: 'List repositories accessible to the user access token\n  List repositories that the authenticated user has explicit permission (`:read`, `:write`, or `:admin`) to access for an installation.\n \n  The authenticated user has explicit permission to access repositories they own, repositories where they are a collaborator, and repositories that they can access through an organization membership.\n \n  You must use a [user-to-server OAuth access token](https://docs.github.com/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps/#identifying-users-on-your-site), created for a user who has authorized your GitHub App, to access this endpoint.\n \n  The access the user has to each repository is included in the hash under the `permissions` key.',
  },
  appsRemoveRepoFromInstallationForAuthenticatedUser: {
    comment: 'Remove a repository from an app installation',
    doc: 'Remove a repository from an app installation\n  Remove a single repository from an installation. The authenticated user must have admin access to the repository.\n \n  You must use a personal access token (which you can create via the [command line](https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token) or [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication)) to access this endpoint.',
  },
  appsAddRepoToInstallationForAuthenticatedUser: {
    comment: 'Add a repository to an app installation',
    doc: 'Add a repository to an app installation\n  Add a single repository to an installation. The authenticated user must have admin access to the repository.\n \n  You must use a personal access token (which you can create via the [command line](https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token) or [Basic Authentication](https://docs.github.com/rest/overview/other-authentication-methods#basic-authentication)) to access this endpoint.',
  },
  interactionsRemoveRestrictionsForAuthenticatedUser: {
    comment: 'Remove interaction restrictions from your public repositories',
    doc: 'Remove interaction restrictions from your public repositories\n  Removes any interaction restrictions from your public repositories.',
  },
  interactionsGetRestrictionsForAuthenticatedUser: {
    comment: 'Get interaction restrictions for your public repositories',
    doc: 'Get interaction restrictions for your public repositories\n  Shows which type of GitHub user can interact with your public repositories and when the restriction expires.',
  },
  interactionsSetRestrictionsForAuthenticatedUser: {
    comment: 'Set interaction restrictions for your public repositories',
    doc: 'Set interaction restrictions for your public repositories\n  Temporarily restricts which type of GitHub user can interact with your public repositories. Setting the interaction limit at the user level will overwrite any interaction limits that are set for individual repositories owned by the user.',
  },
  issuesListForAuthenticatedUser: {
    comment: 'List user account issues assigned to the authenticated user',
    doc: 'List user account issues assigned to the authenticated user\n  List issues across owned and member repositories assigned to the authenticated user.\n \n  Note: GitHub\'s REST API considers every pull request an issue, but not every issue is a pull request. For this\n  reason, "Issues" endpoints may return both issues and pull requests in the response. You can identify pull requests by\n  the `pull_request` key. Be aware that the `id` of a pull request returned from "Issues" endpoints will be an _issue id_. To find out the pull\n  request id, use the "[List pull requests](https://docs.github.com/rest/reference/pulls#list-pull-requests)" endpoint.',
  },
  usersListPublicSshKeysForAuthenticatedUser: {
    comment: 'List public SSH keys for the authenticated user',
    doc: "List public SSH keys for the authenticated user\n  Lists the public SSH keys for the authenticated user's GitHub account. Requires that you are authenticated via Basic Auth or via OAuth with at least `read:public_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersCreatePublicSshKeyForAuthenticatedUser: {
    comment: 'Create a public SSH key for the authenticated user',
    doc: "Create a public SSH key for the authenticated user\n  Adds a public SSH key to the authenticated user's GitHub account. Requires that you are authenticated via Basic Auth, or OAuth with at least `write:public_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersDeletePublicSshKeyForAuthenticatedUser: {
    comment: 'Delete a public SSH key for the authenticated user',
    doc: "Delete a public SSH key for the authenticated user\n  Removes a public SSH key from the authenticated user's GitHub account. Requires that you are authenticated via Basic Auth or via OAuth with at least `admin:public_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).",
  },
  usersGetPublicSshKeyForAuthenticatedUser: {
    comment: 'Get a public SSH key for the authenticated user',
    doc: 'Get a public SSH key for the authenticated user\n  View extended details for a single public SSH key. Requires that you are authenticated via Basic Auth or via OAuth with at least `read:public_key` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/).',
  },
  appsListSubscriptionsForAuthenticatedUser: {
    comment: 'List subscriptions for the authenticated user',
    doc: 'List subscriptions for the authenticated user\n  Lists the active subscriptions for the authenticated user. You must use a [user-to-server OAuth access token](https://docs.github.com/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps/#identifying-users-on-your-site), created for a user who has authorized your GitHub App, to access this endpoint. . OAuth Apps must authenticate using an [OAuth token](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/).',
  },
  appsListSubscriptionsForAuthenticatedUserStubbed: {
    comment: 'List subscriptions for the authenticated user (stubbed)',
    doc: 'List subscriptions for the authenticated user (stubbed)\n  Lists the active subscriptions for the authenticated user. You must use a [user-to-server OAuth access token](https://docs.github.com/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps/#identifying-users-on-your-site), created for a user who has authorized your GitHub App, to access this endpoint. . OAuth Apps must authenticate using an [OAuth token](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/).',
  },
  orgsListMembershipsForAuthenticatedUser: {
    comment: 'List organization memberships for the authenticated user',
    doc: 'List organization memberships for the authenticated user',
  },
  orgsGetMembershipForAuthenticatedUser: {
    comment: 'Get an organization membership for the authenticated user',
    doc: 'Get an organization membership for the authenticated user',
  },
  orgsUpdateMembershipForAuthenticatedUser: {
    comment: 'Update an organization membership for the authenticated user',
    doc: 'Update an organization membership for the authenticated user',
  },
  migrationsListForAuthenticatedUser: {
    comment: 'List user migrations',
    doc: 'List user migrations\n  Lists all migrations a user has started.',
  },
  migrationsStartForAuthenticatedUser: {
    comment: 'Start a user migration',
    doc: 'Start a user migration\n  Initiates the generation of a user migration archive.',
  },
  migrationsGetStatusForAuthenticatedUser: {
    comment: 'Get a user migration status',
    doc: "Get a user migration status\n  Fetches a single user migration. The response includes the `state` of the migration, which can be one of the following values:\n \n     `pending` - the migration hasn't started yet.\n     `exporting` - the migration is in progress.\n     `exported` - the migration finished successfully.\n     `failed` - the migration failed.\n \n  Once the migration has been `exported` you can [download the migration archive](https://docs.github.com/rest/migrations/users#download-a-user-migration-archive).",
  },
  migrationsDeleteArchiveForAuthenticatedUser: {
    comment: 'Delete a user migration archive',
    doc: 'Delete a user migration archive\n  Deletes a previous migration archive. Downloadable migration archives are automatically deleted after seven days. Migration metadata, which is returned in the [List user migrations](https://docs.github.com/rest/migrations/users#list-user-migrations) and [Get a user migration status](https://docs.github.com/rest/migrations/users#get-a-user-migration-status) endpoints, will continue to be available even after an archive is deleted.',
  },
  migrationsGetArchiveForAuthenticatedUser: {
    comment: 'Download a user migration archive',
    doc: "Download a user migration archive\n  Fetches the URL to download the migration archive as a `tar.gz` file. Depending on the resources your repository uses, the migration archive can contain JSON files with data for these objects:\n \n     attachments\n     bases\n     commit\\_comments\n     issue\\_comments\n     issue\\_events\n     issues\n     milestones\n     organizations\n     projects\n     protected\\_branches\n     pull\\_request\\_reviews\n     pull\\_requests\n     releases\n     repositories\n     review\\_comments\n     schema\n     users\n \n  The archive will also contain an `attachments` directory that includes all attachment files uploaded to GitHub.com and a `repositories` directory that contains the repository's Git data.",
  },
  migrationsUnlockRepoForAuthenticatedUser: {
    comment: 'Unlock a user repository',
    doc: 'Unlock a user repository\n  Unlocks a repository. You can lock repositories when you [start a user migration](https://docs.github.com/rest/migrations/users#start-a-user-migration). Once the migration is complete you can unlock each repository to begin using it again or [delete the repository](https://docs.github.com/rest/repos/repos#delete-a-repository) if you no longer need the source data. Returns a status of `404 Not Found` if the repository is not locked.',
  },
  migrationsListReposForAuthenticatedUser: {
    comment: 'List repositories for a user migration',
    doc: 'List repositories for a user migration\n  Lists all the repositories for this user migration.',
  },
  orgsListForAuthenticatedUser: {
    comment: 'List organizations for the authenticated user',
    doc: 'List organizations for the authenticated user\n  List organizations for the authenticated user.\n \n  OAuth scope requirements\n \n  This only lists organizations that your authorization allows you to operate on in some way (e.g., you can list teams with `read:org` scope, you can publicize your organization membership with `user` scope, etc.). Therefore, this API requires at least `user` or `read:org` scope. OAuth requests with insufficient scope receive a `403 Forbidden` response.',
  },
  packagesListPackagesForAuthenticatedUser: {
    comment: "List packages for the authenticated user's namespace",
    doc: 'List packages for the authenticated user\'s namespace\n  Lists packages owned by the authenticated user within the user\'s namespace.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageForAuthenticatedUser: {
    comment: 'Delete a package for the authenticated user',
    doc: 'Delete a package for the authenticated user\n  Deletes a package owned by the authenticated user. You cannot delete a public package if any version of the package has more than 5,000 downloads. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `delete:packages` scopes.\n  If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesGetPackageForAuthenticatedUser: {
    comment: 'Get a package for the authenticated user',
    doc: 'Get a package for the authenticated user\n  Gets a specific package for a package owned by the authenticated user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageForAuthenticatedUser: {
    comment: 'Restore a package for the authenticated user',
    doc: 'Restore a package for the authenticated user\n  Restores a package owned by the authenticated user.\n \n  You can restore a deleted package under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `write:packages` scopes. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesGetAllPackageVersionsForPackageOwnedByAuthenticatedUser: {
    comment: 'List package versions for a package owned by the authenticated user',
    doc: 'List package versions for a package owned by the authenticated user\n  Lists package versions for a package owned by the authenticated user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageVersionForAuthenticatedUser: {
    comment: 'Delete a package version for the authenticated user',
    doc: 'Delete a package version for the authenticated user\n  Deletes a specific package version for a package owned by the authenticated user.  If the package is public and the package version has more than 5,000 downloads, you cannot delete the package version. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must have admin permissions in the organization and authenticate using an access token with the `read:packages` and `delete:packages` scopes.\n  If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesGetPackageVersionForAuthenticatedUser: {
    comment: 'Get a package version for the authenticated user',
    doc: 'Get a package version for the authenticated user\n  Gets a specific package version for a package owned by the authenticated user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageVersionForAuthenticatedUser: {
    comment: 'Restore a package version for the authenticated user',
    doc: 'Restore a package version for the authenticated user\n  Restores a package version owned by the authenticated user.\n \n  You can restore a deleted package version under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `write:packages` scopes. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  projectsCreateForAuthenticatedUser: {
    comment: 'Create a user project',
    doc: 'Create a user project\n  Creates a user project board. Returns a `410 Gone` status if the user does not have existing classic projects. If you do not have sufficient privileges to perform this action, a `401 Unauthorized` or `410 Gone` status is returned.',
  },
  usersListPublicEmailsForAuthenticatedUser: {
    comment: 'List public email addresses for the authenticated user',
    doc: 'List public email addresses for the authenticated user\n  Lists your publicly visible email address, which you can set with the [Set primary email visibility for the authenticated user](https://docs.github.com/rest/reference/users#set-primary-email-visibility-for-the-authenticated-user) endpoint. This endpoint is accessible with the `user:email` scope.',
  },
  reposListForAuthenticatedUser: {
    comment: 'List repositories for the authenticated user',
    doc: 'List repositories for the authenticated user\n  Lists repositories that the authenticated user has explicit permission (`:read`, `:write`, or `:admin`) to access.\n \n  The authenticated user has explicit permission to access repositories they own, repositories where they are a collaborator, and repositories that they can access through an organization membership.',
  },
  reposCreateForAuthenticatedUser: {
    comment: 'Create a repository for the authenticated user',
    doc: 'Create a repository for the authenticated user\n  Creates a new repository for the authenticated user.\n \n  OAuth scope requirements\n \n  When using [OAuth](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/), authorizations must include:\n \n     `public_repo` scope or `repo` scope to create a public repository. Note: For GitHub AE, use `repo` scope to create an internal repository.\n     `repo` scope to create a private repository.',
  },
  reposListInvitationsForAuthenticatedUser: {
    comment: 'List repository invitations for the authenticated user',
    doc: 'List repository invitations for the authenticated user\n  When authenticating as a user, this endpoint will list all currently open repository invitations for that user.',
  },
  reposDeclineInvitationForAuthenticatedUser: {
    comment: 'Decline a repository invitation',
    doc: 'Decline a repository invitation',
  },
  reposAcceptInvitationForAuthenticatedUser: {
    comment: 'Accept a repository invitation',
    doc: 'Accept a repository invitation',
  },
  usersListSshSigningKeysForAuthenticatedUser: {
    comment: 'List SSH signing keys for the authenticated user',
    doc: 'List SSH signing keys for the authenticated user\n  Lists the SSH signing keys for the authenticated user\'s GitHub account. You must authenticate with Basic Authentication, or you must authenticate with OAuth with at least `read:ssh_signing_key` scope. For more information, see "[Understanding scopes for OAuth apps](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/)."',
  },
  usersCreateSshSigningKeyForAuthenticatedUser: {
    comment: 'Create a SSH signing key for the authenticated user',
    doc: 'Create a SSH signing key for the authenticated user\n  Creates an SSH signing key for the authenticated user\'s GitHub account. You must authenticate with Basic Authentication, or you must authenticate with OAuth with at least `write:ssh_signing_key` scope. For more information, see "[Understanding scopes for OAuth apps](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/)."',
  },
  usersDeleteSshSigningKeyForAuthenticatedUser: {
    comment: 'Delete an SSH signing key for the authenticated user',
    doc: 'Delete an SSH signing key for the authenticated user\n  Deletes an SSH signing key from the authenticated user\'s GitHub account. You must authenticate with Basic Authentication, or you must authenticate with OAuth with at least `admin:ssh_signing_key` scope. For more information, see "[Understanding scopes for OAuth apps](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/)."',
  },
  usersGetSshSigningKeyForAuthenticatedUser: {
    comment: 'Get an SSH signing key for the authenticated user',
    doc: 'Get an SSH signing key for the authenticated user\n  Gets extended details for an SSH signing key. You must authenticate with Basic Authentication, or you must authenticate with OAuth with at least `read:ssh_signing_key` scope. For more information, see "[Understanding scopes for OAuth apps](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/)."',
  },
  activityListReposStarredByAuthenticatedUser: {
    comment: 'List repositories starred by the authenticated user',
    doc: 'List repositories starred by the authenticated user\n  Lists repositories the authenticated user has starred.\n \n  You can also find out _when_ stars were created by passing the following custom [media type](https://docs.github.com/rest/overview/media-types/) via the `Accept` header: `application/vnd.github.star+json`.',
  },
  activityUnstarRepoForAuthenticatedUser: {
    comment: 'Unstar a repository for the authenticated user',
    doc: 'Unstar a repository for the authenticated user',
  },
  activityCheckRepoIsStarredByAuthenticatedUser: {
    comment: 'Check if a repository is starred by the authenticated user',
    doc: 'Check if a repository is starred by the authenticated user',
  },
  activityStarRepoForAuthenticatedUser: {
    comment: 'Star a repository for the authenticated user',
    doc: 'Star a repository for the authenticated user\n  Note that you\'ll need to set `Content-Length` to zero when calling out to this endpoint. For more information, see "[HTTP verbs](https://docs.github.com/rest/overview/resources-in-the-rest-api#http-verbs)."',
  },
  activityListWatchedReposForAuthenticatedUser: {
    comment: 'List repositories watched by the authenticated user',
    doc: 'List repositories watched by the authenticated user\n  Lists repositories the authenticated user is watching.',
  },
  teamsListForAuthenticatedUser: {
    comment: 'List teams for the authenticated user',
    doc: 'List teams for the authenticated user\n  List all of the teams across all of the organizations to which the authenticated user belongs. This method requires `user`, `repo`, or `read:org` [scope](https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/) when authenticating via [OAuth](https://docs.github.com/apps/building-oauth-apps/).',
  },
  usersList: {
    comment: 'List users',
    doc: 'List users\n  Lists all users, in the order that they signed up on GitHub. This list includes personal user accounts and organization accounts.\n \n  Note: Pagination is powered exclusively by the `since` parameter. Use the [Link header](https://docs.github.com/rest/overview/resources-in-the-rest-api#link-header) to get the URL for the next page of users.',
  },
  usersGetByUsername: {
    comment: 'Get a user',
    doc: 'Get a user\n  Provides publicly available information about someone with a GitHub account.\n \n  GitHub Apps with the `Plan` user permission can use this endpoint to retrieve information about a user\'s GitHub plan. The GitHub App must be authenticated as a user. See "[Identifying and authorizing users for GitHub Apps](https://docs.github.com/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps/)" for details about authentication. For an example response, see \'Response with GitHub plan information\' below"\n \n  The `email` key in the following response is the publicly visible email address from your GitHub [profile page](https://github.com/settings/profile). When setting up your profile, you can select a primary email address to be “public” which provides an email entry for this endpoint. If you do not set a public email address for `email`, then it will have a value of `null`. You only see publicly visible email addresses when authenticated with GitHub. For more information, see [Authentication](https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication).\n \n  The Emails API enables you to list all of your email addresses, and toggle a primary email to be visible publicly. For more information, see "[Emails API](https://docs.github.com/rest/reference/users#emails)".',
  },
  activityListEventsForAuthenticatedUser: {
    comment: 'List events for the authenticated user',
    doc: "List events for the authenticated user\n  If you are authenticated as the given user, you will see your private events. Otherwise, you'll only see public events.",
  },
  activityListOrgEventsForAuthenticatedUser: {
    comment: 'List organization events for the authenticated user',
    doc: "List organization events for the authenticated user\n  This is the user's organization dashboard. You must be authenticated as the user to view this.",
  },
  activityListPublicEventsForUser: {
    comment: 'List public events for a user',
    doc: 'List public events for a user',
  },
  usersListFollowersForUser: {
    comment: 'List followers of a user',
    doc: 'List followers of a user\n  Lists the people following the specified user.',
  },
  usersListFollowingForUser: {
    comment: 'List the people a user follows',
    doc: 'List the people a user follows\n  Lists the people who the specified user follows.',
  },
  usersCheckFollowingForUser: {
    comment: 'Check if a user follows another user',
    doc: 'Check if a user follows another user',
  },
  gistsListForUser: {
    comment: 'List gists for a user',
    doc: 'List gists for a user\n  Lists public gists for the specified user:',
  },
  usersListGpgKeysForUser: {
    comment: 'List GPG keys for a user',
    doc: 'List GPG keys for a user\n  Lists the GPG keys for a user. This information is accessible by anyone.',
  },
  usersGetContextForUser: {
    comment: 'Get contextual information for a user',
    doc: "Get contextual information for a user\n  Provides hovercard information when authenticated through basic auth or OAuth with the `repo` scope. You can find out more about someone in relation to their pull requests, issues, repositories, and organizations.\n \n  The `subject_type` and `subject_id` parameters provide context for the person's hovercard, which returns more information than without the parameters. For example, if you wanted to find out more about `octocat` who owns the `Spoon-Knife` repository via cURL, it would look like this:\n \n  ```shell\n  curl -u username:token\n  https://api.github.com/users/octocat/hovercard?subject_type=repository&subject_id=1300192\n  ```",
  },
  appsGetUserInstallation: {
    comment: 'Get a user installation for the authenticated app',
    doc: 'Get a user installation for the authenticated app\n  Enables an authenticated GitHub App to find the user’s installation information.\n \n  You must use a [JWT](https://docs.github.com/apps/building-github-apps/authenticating-with-github-apps/#authenticating-as-a-github-app) to access this endpoint.',
  },
  usersListPublicKeysForUser: {
    comment: 'List public keys for a user',
    doc: 'List public keys for a user\n  Lists the _verified_ public SSH keys for a user. This is accessible by anyone.',
  },
  orgsListForUser: {
    comment: 'List organizations for a user',
    doc: 'List organizations for a user\n  List [public organization memberships](https://docs.github.com/articles/publicizing-or-concealing-organization-membership) for the specified user.\n \n  This method only lists _public_ memberships, regardless of authentication. If you need to fetch all of the organization memberships (public and private) for the authenticated user, use the [List organizations for the authenticated user](https://docs.github.com/rest/reference/orgs#list-organizations-for-the-authenticated-user) API instead.',
  },
  packagesListPackagesForUser: {
    comment: 'List packages for a user',
    doc: 'List packages for a user\n  Lists all packages in a user\'s namespace for which the requesting user has access.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageForUser: {
    comment: 'Delete a package for a user',
    doc: 'Delete a package for a user\n  Deletes an entire package for a user. You cannot delete a public package if any version of the package has more than 5,000 downloads. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `delete:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package you want to delete. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetPackageForUser: {
    comment: 'Get a package for a user',
    doc: 'Get a package for a user\n  Gets a specific package metadata for a public package owned by a user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageForUser: {
    comment: 'Restore a package for a user',
    doc: 'Restore a package for a user\n  Restores an entire package for a user.\n \n  You can restore a deleted package under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `write:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package you want to restore. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetAllPackageVersionsForPackageOwnedByUser: {
    comment: 'List package versions for a package owned by a user',
    doc: 'List package versions for a package owned by a user\n  Lists package versions for a public package owned by a specified user.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesDeletePackageVersionForUser: {
    comment: 'Delete package version for a user',
    doc: 'Delete package version for a user\n  Deletes a specific package version for a user. If the package is public and the package version has more than 5,000 downloads, you cannot delete the package version. In this scenario, contact GitHub support for further assistance.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `delete:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package whose version you want to delete. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  packagesGetPackageVersionForUser: {
    comment: 'Get a package version for a user',
    doc: 'Get a package version for a user\n  Gets a specific package version for a public package owned by a specified user.\n \n  At this time, to use this endpoint, you must authenticate using an access token with the `read:packages` scope. If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of GitHub Packages registries that only support repository-scoped permissions, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."',
  },
  packagesRestorePackageVersionForUser: {
    comment: 'Restore package version for a user',
    doc: 'Restore package version for a user\n  Restores a specific package version for a user.\n \n  You can restore a deleted package under the following conditions:\n  - The package was deleted within the last 30 days.\n  - The same package namespace and version is still available and not reused for a new package. If the same package namespace is not available, you will not be able to restore your package. In this scenario, to restore the deleted package, you must delete the new package that uses the deleted package\'s namespace first.\n \n  To use this endpoint, you must authenticate using an access token with the `read:packages` and `write:packages` scopes. In addition:\n  - If the `package_type` belongs to a GitHub Packages registry that only supports repository-scoped permissions, your token must also include the `repo` scope. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#permissions-for-repository-scoped-packages)."\n  - If the `package_type` belongs to a GitHub Packages registry that supports granular permissions, you must have admin permissions to the package whose version you want to restore. For the list of these registries, see "[About permissions for GitHub Packages](https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages#granular-permissions-for-userorganization-scoped-packages)."',
  },
  projectsListForUser: {
    comment: 'List user projects',
    doc: 'List user projects',
  },
  activityListReceivedEventsForUser: {
    comment: 'List events received by the authenticated user',
    doc: "List events received by the authenticated user\n  These are events that you've received by watching repos and following users. If you are authenticated as the given user, you will see private events. Otherwise, you'll only see public events.",
  },
  activityListReceivedPublicEventsForUser: {
    comment: 'List public events received by a user',
    doc: 'List public events received by a user',
  },
  reposListForUser: {
    comment: 'List repositories for a user',
    doc: 'List repositories for a user\n  Lists public repositories for the specified user. Note: For GitHub AE, this endpoint will list internal repositories for the specified user.',
  },
  billingGetGithubActionsBillingUser: {
    comment: 'Get GitHub Actions billing for a user',
    doc: 'Get GitHub Actions billing for a user\n  Gets the summary of the free and paid GitHub Actions minutes used.\n \n  Paid minutes only apply to workflows in private repositories that use GitHub-hosted runners. Minutes used is listed for each GitHub-hosted runner operating system. Any job re-runs are also included in the usage. The usage returned includes any minute multipliers for macOS and Windows runners, and is rounded up to the nearest whole minute. For more information, see "[Managing billing for GitHub Actions](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-actions)".\n \n  Access tokens must have the `user` scope.',
  },
  billingGetGithubPackagesBillingUser: {
    comment: 'Get GitHub Packages billing for a user',
    doc: 'Get GitHub Packages billing for a user\n  Gets the free and paid storage used for GitHub Packages in gigabytes.\n \n  Paid minutes only apply to packages stored for private repositories. For more information, see "[Managing billing for GitHub Packages](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-packages)."\n \n  Access tokens must have the `user` scope.',
  },
  billingGetSharedStorageBillingUser: {
    comment: 'Get shared storage billing for a user',
    doc: 'Get shared storage billing for a user\n  Gets the estimated paid and estimated total storage used for GitHub Actions and GitHub Packages.\n \n  Paid minutes only apply to packages stored for private repositories. For more information, see "[Managing billing for GitHub Packages](https://docs.github.com/github/setting-up-and-managing-billing-and-payments-on-github/managing-billing-for-github-packages)."\n \n  Access tokens must have the `user` scope.',
  },
  usersListSshSigningKeysForUser: {
    comment: 'List SSH signing keys for a user',
    doc: 'List SSH signing keys for a user\n  Lists the SSH signing keys for a user. This operation is accessible by anyone.',
  },
  activityListReposStarredByUser: {
    comment: 'List repositories starred by a user',
    doc: 'List repositories starred by a user\n  Lists repositories a user has starred.\n \n  You can also find out _when_ stars were created by passing the following custom [media type](https://docs.github.com/rest/overview/media-types/) via the `Accept` header: `application/vnd.github.star+json`.',
  },
  activityListReposWatchedByUser: {
    comment: 'List repositories watched by a user',
    doc: 'List repositories watched by a user\n  Lists repositories a user is watching.',
  },
  metaGetAllVersions: {
    comment: 'Get all API versions',
    doc: 'Get all API versions\n  Get all supported GitHub API versions.',
  },
  metaGetZen: {
    comment: 'Get the Zen of GitHub',
    doc: 'Get the Zen of GitHub\n  Get a random sentence from the Zen of GitHub',
  },
};
