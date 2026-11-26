---
'@mastra/factory': patch
---

The Factory now links each of the organization's Jira, incident.io, GitLab and Vanta connections to its Mastra platform project at most once.

- A connection you remove from the project, on its **Connect** page in Mastra Platform, stays removed when the Factory restarts. A connection created at the organization level later is linked on the next startup.
- `POST /web/integrations/platform/:provider/link-connections` also links again connections that were removed from the project. Connections removed from the project are listed under `detached` in the integration's diagnostics and connections listing. As an organization admin:

  ```bash
  curl -X POST "$FACTORY_URL/web/integrations/platform/jira/link-connections"
  ```

- If the Factory can't read which connections the project has had, it links nothing that startup and tries again on the next one.
- While a Vanta connection is removed from the project, the Vanta sync waits rather than read its vulnerabilities as resolved.
