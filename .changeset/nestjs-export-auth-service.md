---
'@mastra/nestjs': patch
---

Fixed `MastraAuthGuard` failing to resolve when used on your own controllers. `MastraModule.register()` and `registerAsync()` now export `AuthService`, so you can protect app routes with Mastra's auth:

```ts
@Controller('api/things')
@UseGuards(MastraAuthGuard)
export class ThingsController {}
```
