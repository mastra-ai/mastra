# Smoke Test Domains

This folder contains domain-specific smoke test instructions for Mastra Studio. Each `.md` file defines a test domain that can be selected when running `/all-the-smoke`.

## How to add a new domain

1. Create a new `.md` file in this folder (e.g., `my-feature.md`)
2. Use the template below
3. Commit and push - the domain will automatically appear in `/all-the-smoke`

## Template

```markdown
---
name: my-feature
description: Short description shown in the domain picker
---

# My Feature

## Routes

- `/my-feature` - Main listing page
- `/my-feature/:id` - Detail view

## Tests

### Feature loads correctly
1. Navigate to `/my-feature`
2. Verify the page heading is visible
3. Screenshot

### Feature interaction works
1. Click on the first item in the list
2. Verify detail view loads
3. Fill in the input field with "test value"
4. Click Submit
5. Verify output appears
6. Screenshot

## Known Issues
- (optional) Document any known flaky behaviors or workarounds
```

## Guidelines

- **Be specific**: Write instructions that a browser automation agent can follow literally. "Click the blue button" is better than "interact with the form."
- **Include selectors when helpful**: If a button or input is hard to find, mention its label text, placeholder, or test ID.
- **Add expected wait times**: If something takes a while (e.g., AI responses), say so.
- **Document known issues**: If something is flaky or has a workaround, note it so the tester doesn't flag false positives.
- **Keep routes up to date**: If the studio routing changes, update your domain file.
- **One domain per file**: Don't combine unrelated features. It's fine to have small files.
