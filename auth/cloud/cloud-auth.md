---

TL;DR

- OAuth 2.0 + PKCE flow against Mastra Cloud
- Cookie-based sessions with Bearer token fallback
- RBAC via role→permission mapping

---

HIGH-LEVEL FLOW

flowchart TB
subgraph Client
Browser[Browser/Client]
end

      subgraph "Your Server"
          Provider[MastraCloudAuthProvider]
          RBAC[MastraRBACCloud]
      end

      subgraph "Mastra Cloud"
          AuthAPI[/auth/* endpoints]
      end

      Browser -->|1. GET /login| Provider
      Provider -->|2. Redirect w/ PKCE| AuthAPI
      AuthAPI -->|3. User authenticates| AuthAPI
      AuthAPI -->|4. Redirect /callback| Provider
      Provider -->|5. Exchange code| AuthAPI
      Provider -->|6. Verify token| AuthAPI
      Provider -->|7. Set session cookie| Browser

      Browser -->|8. API request + cookie| Provider
      Provider -->|9. Verify session| AuthAPI
      Provider -->|10. Check permission| RBAC

---

MODULE STRUCTURE

graph LR
subgraph Public["Public API"]
MCA[MastraCloudAuth]
MCAP[MastraCloudAuthProvider]
RBAC[MastraRBACCloud]
end

      subgraph Internal["Internal Modules"]
          OAuth[oauth/]
          PKCE[pkce/]
          Session[session/]
      end

      MCAP --> MCA
      MCA --> OAuth
      MCA --> PKCE
      MCA --> Session

      OAuth --> PKCE

---

LOGIN FLOW (PKCE)

sequenceDiagram
participant B as Browser
participant S as Server (Provider)
participant C as Mastra Cloud

      B->>S: GET /auth/login
      S->>S: Generate verifier + challenge
      S->>S: Generate CSRF token
      S->>S: Encode state (CSRF + returnTo)
      S->>B: Set PKCE cookie (5m) + Redirect
      B->>C: /auth/oss?challenge=X&state=Y
      C->>C: User login (WorkOS)
      C->>B: Redirect /callback?code=Z&state=Y
      B->>S: GET /callback?code=Z&state=Y
      S->>S: Validate PKCE cookie
      S->>S: Verify CSRF in state
      S->>C: POST /auth/callback (code + verifier)
      C-->>S: { accessToken }
      S->>C: POST /auth/verify (Bearer token)
      C-->>S: { user, role }
      S->>B: Set session cookie (24h) + Redirect

---

AUTHENTICATION FLOW (Per Request)

sequenceDiagram
participant B as Browser
participant S as Server (Provider)
participant C as Mastra Cloud
participant R as RBAC

      B->>S: API Request + Session Cookie
      S->>S: Parse cookie → token
      S->>C: POST /auth/verify (token)
      C-->>S: { user, role }
      S->>R: hasPermission(user, "agents:read")
      R-->>S: true/false
      alt Has Permission
          S-->>B: 200 + Response
      else No Permission
          S-->>B: 403 Forbidden
      end

---

CLASS HIERARCHY

classDiagram
class MastraAuthProvider {
<<abstract>>
+authenticateToken()
+authorizeUser()
+getLoginUrl()
+handleCallback()
}

      class MastraCloudAuthProvider {
          -client: MastraCloudAuth
          +authenticateToken(req)
          +getLoginUrl(returnTo)
          +handleCallback(req)
          +logout(req)
      }

      class MastraCloudAuth {
          -cloudUrl: string
          -clientId: string
          -redirectUrl: string
          +getLoginUrl(returnTo)
          +handleCallback(req)
          +verifyToken(token)
          +destroySession(token)
      }

      class MastraRBACCloud {
          -roleMapping: Map
          +getRoles(user)
          +getPermissions(user)
          +hasPermission(user, perm)
      }

      MastraAuthProvider <|-- MastraCloudAuthProvider
      MastraCloudAuthProvider --> MastraCloudAuth

---

KEY ENDPOINTS (Mastra Cloud)
┌────────────────────────┬──────────────────────────────┐
│ Endpoint │ Purpose │
├────────────────────────┼──────────────────────────────┤
│ /auth/oss │ OAuth authorization redirect │
├────────────────────────┼──────────────────────────────┤
│ /auth/callback │ Code → token exchange │
├────────────────────────┼──────────────────────────────┤
│ /auth/verify │ Token → user info │
├────────────────────────┼──────────────────────────────┤
│ /auth/session/validate │ Session validity check │
├────────────────────────┼──────────────────────────────┤
│ /auth/session/destroy │ Server-side logout │
├────────────────────────┼──────────────────────────────┤
│ /auth/logout │ Logout redirect URL │
└────────────────────────┴──────────────────────────────┘

---

COOKIE LIFECYCLE

timeline
title Cookie Lifecycle
section PKCE Cookie (5 min)
Login Start : Set cookie with verifier + CSRF
Callback : Read & validate cookie
After Callback : Clear cookie
section Session Cookie (24 hr)
Callback Success : Set cookie with access token
Each Request : Read & verify token
Logout : Clear cookie

---

SECURITY LAYERS

1. PKCE - Prevents code interception attacks
2. CSRF - State param with random token
3. Open Redirect - returnTo URL validation
4. HttpOnly cookies - No JS access
5. SameSite=Lax - CSRF protection
6. Secure flag - HTTPS in prod
