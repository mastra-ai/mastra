---
'@mastra/schema-compat': patch
---

Fix the Zod v4 string handler silently dropping unrecognized `string_format` checks. Formats without a textual description (such as `ipv4`, `ipv6`, `datetime`, `date`, `time`, `base64`, `cuid2`, `ulid`, `nanoid`, `jwt`) are now preserved as validation instead of being removed, so schemas using them keep rejecting invalid input. Closes #18634.
