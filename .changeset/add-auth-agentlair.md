---
'@mastra/auth-agentlair': minor
---

Add AgentLair auth provider for AI agent identity verification and behavioral trust scoring.

`MastraAgentLairAuth` extends `MastraAuthProvider` to verify EdDSA-signed Agent Authentication Tokens (AATs) against AgentLair's JWKS endpoint. Supports trust-based authorization via behavioral trust scores (0-1000) and trust tiers, along with scope-based access control. Implements `IUserProvider` for Mastra Studio integration.
