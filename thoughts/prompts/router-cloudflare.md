# LANE 13 - Cloudflare Edge Router (Future, P2)

Create implementation plan for LANE 13: @mastra/router-cloudflare Cloudflare edge router.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete (for EdgeRouterProvider interface).
**Priority**: P2 (Future Enhancement)

This includes:
- routers/cloudflare/ package setup
- CloudflareEdgeRouter implementing EdgeRouterProvider interface
- Cloudflare Tunnel integration:
  - Tunnel creation and management
  - Ingress rule configuration (route subdomain → localhost:port)
  - DNS record management (CNAME to tunnel)
- Authentication:
  - API token management
  - Account/zone configuration
- Tunnel connector management:
  - Managed mode (Cloudflare manages cloudflared)
  - Self-hosted mode (run cloudflared alongside admin)
- Health checking via Cloudflare
- TLS certificate management (automatic via Cloudflare)
- Route management:
  - registerRoute(config) - add ingress rule + DNS record
  - updateRoute(routeId, config) - update ingress rule target
  - removeRoute(routeId) - remove ingress rule + DNS record
  - checkRouteHealth(routeId) - verify route is accessible

Key files:
```
routers/cloudflare/
├── src/
│   ├── index.ts
│   ├── router.ts
│   ├── types.ts
│   ├── tunnel/
│   │   ├── manager.ts
│   │   ├── ingress.ts
│   │   └── connector.ts
│   ├── dns/
│   │   ├── records.ts
│   │   └── zones.ts
│   ├── api/
│   │   ├── client.ts
│   │   └── auth.ts
│   └── health.ts
├── package.json
└── tsconfig.json
```

Architecture:
```
Internet → Cloudflare Edge → Tunnel → cloudflared → localhost:port → Mastra Server
```

Save plan to: thoughts/shared/plans/2025-01-23-router-cloudflare.md
