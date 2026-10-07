---
'@mastra/factory': patch
---

Fixed Factory sessions failing with `Thread … belongs to resource … but resource … was provided` when the server maps signed-in users to a resource with `mapUserToResourceId`. Factory now gives its auth provider an `authorizeUserResource` policy: a signed-in caller who is allowed to open a Factory session (same organization, and the owner if the session is private) runs it under the session's own resource. The same applies to a project's supervisor session for members of the organization that owns the project. A policy you already set on the provider is left alone.
