---
'@internal/playground': minor
---

Added support for passing an authorization token to Studio through an `auth_header` URL parameter. Open Studio with `?auth_header=<token>` and the token is used as the `Authorization` header for every API request in that session, removed from the address bar, and kept out of local storage so it stays transient.

```
http://localhost:4111/?auth_header=Bearer%20your-token
```
