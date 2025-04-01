# Memory-Driven Plan Tracking

**Use Case**: Using memory to track the progress of multi-step plans, roadmaps, or complex workflows.

**Why Users Need This**:
- Monitor progress on long-running projects
- Track completion of steps in a complex workflow
- Maintain context across multiple sessions of project work

**Implementation Example**:
```typescript
const projectAgent = new Agent({
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        template: `<project>
  <title>Website Redesign</title>
  <status>in-progress</status>
  <timeline>
    <start_date>2023-06-01</start_date>
    <target_completion>2023-08-15</target_completion>
  </timeline>
  <phases>
    <phase id="1" status="completed">Requirements Gathering</phase>
    <phase id="2" status="in-progress">Design</phase>
    <phase id="3" status="not-started">Development</phase>
    <phase id="4" status="not-started">Testing</phase>
    <phase id="5" status="not-started">Deployment</phase>
  </phases>
  <current_focus>
    <task>Finalize color palette</task>
    <task>Complete responsive wireframes</task>
    <task>Get stakeholder approval on navigation</task>
  </current_focus>
  <blockers></blockers>
</project>`,
      },
    },
  }),
});

// Update project status
await projectAgent.stream("We've completed the wireframes and gotten stakeholder approval. Let's start on the development phase now.", {
  threadId: "website_redesign_project",
  resourceId: "project_manager",
});

// Later, check project status
await projectAgent.stream("What's our current project status? What's left to do?", {
  threadId: "website_redesign_project",
  resourceId: "project_manager",
});
``` 