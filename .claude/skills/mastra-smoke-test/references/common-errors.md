# Common Errors and Fixes

For detailed error documentation with infrastructure context, see the Notion page:
**[Common Errors and Fixes](https://www.notion.so/33bebffbc9f881da8415c12fae971872)**

## Quick Troubleshooting

### Traces Not Appearing

| Symptom                                   | Likely Cause                       | Quick Fix                                                 |
| ----------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Server traces missing, Studio traces work | Server has old token               | Redeploy server: `pnpx mastra@latest server deploy -y`    |
| No traces at all                          | Deploy warning about observability | Check deploy logs for `MASTRA_CLOUD_ACCESS_TOKEN` warning |
| "Session expired" in Studio logs          | Known cookie domain issue          | Re-authenticate in Studio                                 |

### Deploy Issues

| Symptom                         | Likely Cause              | Quick Fix                                                |
| ------------------------------- | ------------------------- | -------------------------------------------------------- |
| Deploy hangs/times out          | Network or platform issue | Check if deploy succeeded at `projects.mastra.ai`, retry |
| "Cannot determine project name" | Missing package.json      | Run from project root with valid package.json            |

### When to Escalate

Contact the platform team if:

- Redeploy doesn't fix trace issues
- You see `401` or `404` errors in deploy logs
- Issues persist across multiple projects

For infrastructure debugging (requires GCP access), see the detailed Notion docs.
