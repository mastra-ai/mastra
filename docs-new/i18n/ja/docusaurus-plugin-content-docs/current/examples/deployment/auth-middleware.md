---
title: 認証用ミドルウェア
description: "    const token = authHeader.split(' ')[1];"
---

```typescript showLineNumbers
{
  handler: async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('未認証', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    // トークンを検証

    await next();
  },
  path: '/api/*',
}
```
