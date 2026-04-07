---
'@mastra/playground-ui': patch
---

Improved agent editor variables section: replaced editable key-value inputs with a read-only tree view that correctly displays variables from requestContextSchema, including nested object properties. Fixed requestContextSchema not loading for code agents by using superjson parsing to unwrap the serialized schema envelope.
