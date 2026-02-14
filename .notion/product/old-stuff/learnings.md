# Learnings

Historical notes and demo script from early Mastra/Kepler development.

---

## Key Areas

- Architecture
- Documentation
- Real world examples
- Integrations
- Custom Integrations

---

## Demo Script

### 1. Talk about the pains of integrations

1. OAuth
2. Different APIs between them
3. Documentation hell
4. Glue code that you shouldn't have to write, it has nothing to do with your business

### 2. What Kepler is

1. Integration Framework
2. Show Admin and why it exists
3. Show adding an Integration
   1. Show testing an integration in admin
   2. Show code for connecting in nextjs
4. API Playground demo
5. Talk about syncs and why an application would need to sync data
   1. Show a sync integration
   2. Show querying synced data
6. Talk about side effects in application dev
   1. Show workflows
   2. Make a workflow
   3. Trigger
7. Talk about event driven architecture
   1. "system" events and handlers
