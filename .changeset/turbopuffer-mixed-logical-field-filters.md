---
'@mastra/turbopuffer': patch
---

Fixed filters that combine a logical operator with sibling field conditions. A filter such as `{ $or: [{ status: 'active' }, { featured: true }], tenantId: 'tenant-a' }` previously dropped the sibling fields (or turned the logical operator into a bogus field condition when the fields came first). The conditions are now combined with AND, so results must satisfy both the logical operator and the sibling fields, regardless of key order.
