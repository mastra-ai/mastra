---
'@mastra/factory': minor
---

Work Intake: what you select is what comes in.

- **One list per service, no sync switches.** Settings → Work Intake lists each connected service with its selected sources and an Add account button. A service with nothing selected brings in nothing. Dependabot alerts keep their own switch.
- **GitHub issues follow the list.** New GitHub issues become cards only for repositories in the GitHub list. Pull requests still come from every linked repository. On upgrade, every repository already linked to a Factory is added to the list once, so nothing stops arriving. Linking a repository adds it to the list unless the request sends `selectIntake: false`, and adding a repository to the list brings in its open issues.
  To link a repository without bringing in its issues:

  ```http
  POST /web/factory/projects/:projectId/source-control-connections/:connectionId/repositories
  { "repository": { "externalId": "99", "slug": "acme/app" }, "selectIntake": false }
  ```

- **Vanta follows its selection.** Vulnerabilities sync only while the Vanta source is selected. Organizations whose Vanta sync was on with nothing selected get the source selected once on upgrade.
- **Routing has its own page.** The intake order and the Not routed list moved from Settings to Routing in board settings.
