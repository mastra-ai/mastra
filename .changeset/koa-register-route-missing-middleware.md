---
'@mastra/koa': patch
---

Fixed a startup crash in the Koa adapter when `registerRoute()` was called with a host that doesn't expose Koa's internal `middleware` array (for example a router, sub-app, or a subclass that calls `super.registerRoute()` with a custom wrapper). Previously this threw `TypeError: Cannot read properties of undefined (reading 'length')` during route registration, breaking apps that had registered custom routes after upgrading from `1.4.x`. The dispatcher-group cache now tolerates a missing `middleware` array and falls back to reusing the cached group.
