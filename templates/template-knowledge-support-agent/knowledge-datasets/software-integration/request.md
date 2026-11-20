# HTTP 401 authentication checks

Original summary of RFC 9110 section 15.5.2, verified 2026-11-20.

An HTTP 401 Unauthorized response means the request lacks valid authentication credentials for the target resource. The server must send a WWW-Authenticate header with at least one applicable challenge. Record the status and challenge scheme. Check whether the request used the intended authentication method and keep credential values private. A 401 leaves credential expiration and the proper repair unconfirmed. Confirm a successful authorized response before claiming resolution.

Source: https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized
