---
'@mastra/loggers': minor
---

Add redact option to PinoLogger for PII protection

Exposes Pino's native `redact` option in `PinoLogger`, allowing sensitive data to be automatically redacted from logs.

```typescript
import { PinoLogger } from "@mastra/loggers";

const logger = new PinoLogger({
  name: "MyApp",
  redact: {
    paths: ["*.password", "*.token", "*.apiKey", "*.email"],
    censor: "[REDACTED]",
  },
});

logger.info("User login", { username: "john", password: "secret123" });
// Output: { username: "john", password: "[REDACTED]", msg: "User login" }
```

