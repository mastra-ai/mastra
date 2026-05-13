---
'@mastra/koa': patch
---

Fixed a startup crash when registering custom API routes on subclassed Koa adapters. Upgrading from 1.4.x to 1.5.x caused `TypeError: Cannot read properties of undefined (reading 'length')` during route registration.
