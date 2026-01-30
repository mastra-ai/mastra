# Mastra Notion Document Formats & Templates

This document captures the common formats and patterns used for design, spec, and PRD documents in the Mastra Notion workspace, based on analysis of recently created documents.

## Document Location

Design/spec/PRD documents are typically organized under:

- **Product > Product Specs** - Main location for feature specs
- **Engineering > [Feature Area]** - Technical design documents

## Document Types

The team uses several distinct document types, each with its own structure:

---

## 1. PRD (Product Requirements Document)

**Example:** [Experiments Feature PRD](https://www.notion.so/2f0ebffbc9f880a89f7aede8c77ade96)

**Purpose:** Comprehensive feature specification for major features requiring cross-functional alignment.

### Structure

```
# [Feature Name] PRD

**Document Version**: X.X
**Date**: [Date]
**Status**: Draft | Review | Approved
**Author**: [Team/Person]

---

## 1. Overview
### 1.1 Problem Statement
### 1.2 Solution
### 1.3 Goals
### 1.4 Non-Goals (Out of Scope for MVP)

---

## 2. User Personas
### 2.1 [Persona Name]
**Profile**: [Description]
**Goals**: [Bullet list]
**Workflow**: [Numbered steps]

---

## 3. Functional Requirements
### 3.x [Category]
| ID | Requirement | Priority |
|----|-------------|----------|
| F1.1 | Description | P0/P1/P2 |

---

## 4. Non-Functional Requirements
| ID | Requirement | Priority |
|----|-------------|----------|

---

## 5. Technical Design
### 5.1 Architecture Overview
[ASCII diagram or description]
### 5.2 [Component Details]
[Code examples]

---

## 6. Data Models
### 6.x [Entity Name]
[TypeScript interface]

### 6.x Database Schema
[SQL DDL]

---

## 7. API Design
### 7.1 SDK Methods
### 7.2 REST API Endpoints
### 7.3 Client SDK

---

## 8. UI Design
### 8.x [Page/Component Name]
[Layout description, wireframe text]

---

## 9. Storage Layer
[Storage domain structure, interfaces]

---

## 10. Server Handlers
[Handler file structure]

---

## 11. Playground UI Components
[Component file structure]

---

## 12. [Usage Examples]
[CI/CD, integration examples]

---

## 13. Implementation Plan
### Phase 1: [Name] (Week X)
[Numbered tasks]

---

## 14. Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|

---

## 15. Open Questions
[Numbered list of unresolved decisions]

---

## 16. Appendix
### A. Related Documents
### B. Glossary
| Term | Definition |
|------|------------|
```

### Key Characteristics

- Versioned document with metadata header
- Comprehensive coverage from problem to implementation
- Requirements in tabular format with IDs and priorities (P0/P1/P2)
- Technical sections include code examples
- Explicit non-goals section
- User personas with workflows
- Open questions tracked separately

---

## 2. Design Document

**Examples:**

- [MastraAdmin Design Document](https://www.notion.so/2f1ebffbc9f88032989fdecaf3bf3d76)
- [Unified Filesystem & Sandbox Design](https://www.notion.so/2efebffbc9f8819b8c33d5cd71d8ec96)

**Purpose:** Technical architecture and design for a system or component.

### Structure

```
# [Component/System] Design Document

[One-line description]

---

## Overview
[What it does, key capabilities]

### Design Principles
- [Principle 1]
- [Principle 2]

---

## Research Summary (optional)
| Platform | Key Aspects | Takeaway |
|----------|-------------|----------|

---

## Architecture
### [BYOP/Component] Summary
| Component | Interface | Implementations |
|-----------|-----------|-----------------|

### Component Diagram
[ASCII art diagram]

---

## Data Model
### [Entity] Entities
[TypeScript interfaces]

---

## Provider Interfaces
### [Provider Name]
[Abstract class/interface definition]
**Implementations:** [List]

---

## [Specific Technical Section]
### Why [Choice]?
[Rationale]

### [Technical Detail]
[Code examples, explanations]

---

## Database Schema
### [Database] ([Purpose])
[SQL DDL]

---

## Package Structure
[File tree]

---

## Next Steps
[Numbered implementation steps]
```

### Key Characteristics

- Starts with one-line description
- Design principles stated upfront
- Research/competitive analysis table (optional)
- Component diagrams in ASCII art
- TypeScript interfaces for data models
- Abstract class definitions for extensibility points
- SQL schemas for persistence
- Clear next steps / implementation order

---

## 3. Requirements Document

**Examples:**

- [Datasets Backend Requirements](https://www.notion.so/2f0ebffbc9f880f08476e03002023695)
- [Datasets Core Requirements](https://www.notion.so/2f1ebffbc9f88130a6a1f19647d36f40)

**Purpose:** Feature requirements breakdown, often referencing competitor parity.

### Structure

```
## OVERVIEW
[Brief description of feature purpose]

---

## FEATURE PARITY MATRIX (optional)
| Competitor Feature | Status | Requirement |
|--------------------|--------|-------------|
| Feature X | ✅ Done / ⚠️ Partial / ❌ Missing | R1 |

---

## REQUIREMENTS

### R1: [Requirement Name]
**What**: [Description of the requirement]
**Why**:
- [Reason 1]
- [Reason 2]
**[Competitor] Equivalent**: [How competitor does it]

---

### R2: [Requirement Name]
...

---

## PRIORITY ORDER
| Priority | Requirements | Rationale |
|----------|--------------|-----------|
| P0 | R5, R6 | [Why these first] |
| P1 | R4, R8 | [Why these next] |

---

## SUCCESS CRITERIA
1. [Measurable outcome 1]
2. [Measurable outcome 2]
```

### Alternative Format (Core Requirements)

```
## OVERVIEW
[Description]
**Branch:** [link]
**PR:** [link]
**Status:** ✅ Implemented | 🚧 In Progress

---

## FEATURE MATRIX
| Feature | Backend | UI | Status |
|---------|---------|----|---------|

---

## BACKEND REQUIREMENTS

### RC-B1: [Requirement Name]
**What**: [Description]
**Why**: [Rationale]
**Implementation**:
- [Implementation detail 1]
- [Implementation detail 2]

---

## UI REQUIREMENTS

### RC-UI1: [Requirement Name]
**What**: [Description]
**Surfaces**:
- [UI component/location 1]
- [UI component/location 2]

---

## DATABASE SCHEMA
| Table | Key Columns |
|-------|-------------|

---

## SUCCESS CRITERIA
✅ [Criterion 1]
✅ [Criterion 2]

---

## CODE REFERENCES
| Component | Location |
|-----------|----------|
```

### Key Characteristics

- Requirements have unique IDs (R1, RC-B1, etc.)
- What/Why format for each requirement
- Competitor reference for feature parity
- Priority matrix with rationale
- Clear success criteria (often checkboxes)
- Status indicators: ✅ ⚠️ ❌

---

## 4. UI Requirements Document

**Example:** [Dataset UI Requirements](https://www.notion.so/2f0ebffbc9f8807f99a9e1c7a3104140)

**Purpose:** UI-specific requirements derived from backend requirements.

### Structure

```
## [FEATURE] UI REQUIREMENTS

---

### UI-R1: [UI Feature Name] (from R1: [Backend Requirement])
**Surfaces:**
- [UI location/component 1]
- [UI location/component 2]

---

### UI-R2: [UI Feature Name] (from R2: [Backend Requirement])
**Surfaces:**
- [UI element details]

---

## PRIORITY (UI effort)
| Priority | UI Requirements | Notes |
|----------|-----------------|-------|
| P0 | UI-R5, UI-R6 | [Effort assessment] |

---

## SHARED UI COMPONENTS NEEDED
- **[Component Name]** — [description/usage]
```

### Key Characteristics

- References parent backend requirements
- "Surfaces" lists specific UI elements/locations
- Priority based on UI implementation effort
- Identifies reusable components

---

## 5. Architecture/Exploration Document

**Example:** [Workspace Sandbox Architecture](https://www.notion.so/2edebffbc9f8805ca35de80cdba320b8)

**Purpose:** Exploratory design for architectural decisions, often with multiple options.

### Structure

```
# [Component] Architecture

[Description of what this explores]

---

## Current State
[Code example of current approach]

**Issues:**
- [Problem 1]
- [Problem 2]

---

## Component Dependencies
| Component | Requires | Notes |
|-----------|----------|-------|

**Proposed:**
- [Change 1]
- [Change 2]

---

## [Compatibility/Constraint Analysis]
### [Scenario 1]
| Option A | Option B | Context |
|----------|----------|---------|

### [Scenario 2]
...

---

## Proposed Architecture
### 1. [Approach 1]
[Description with code]

### 2. [Approach 2]
[Description with code]

---

## Validation Rules
### [Rule Name] ✅ Implemented
[Description]

---

## Provider Matrix
| Provider | Package | Type | Compatible With |
|----------|---------|------|-----------------|

---

## Design Decisions
### [Decision Area] ✅ Implemented
[Details of decision and rationale]

---

## Open Questions
1. [Question 1]
2. [Question 2]

---

## Related Documents
- [Link 1]
- [Link 2]
```

### Key Characteristics

- Starts with current state/problems
- Explores multiple approaches
- Compatibility matrices
- Marks decisions as ✅ Implemented when resolved
- Open questions section
- Links to related documents

---

## 6. Specification Document

**Example:** [Agent Skills Specification](https://www.notion.so/2efebffbc9f881b78b34c34690d780a7)

**Purpose:** Document an external or internal specification/standard.

### Structure

```
# [Specification Name]

[Description and context - often references external spec]

## Overview
[What it is, where it came from]

### Key Benefits
- **For [Audience 1]**: [Benefit]
- **For [Audience 2]**: [Benefit]

## [Core Concept 1]
[File structure, format examples]

## [Core Concept 2]
### [Sub-section]
| Field | Constraints |
|-------|-------------|

### [Validation/Rules]
**Valid:**
- [Example 1]

**Invalid:**
- [Example 2]

## [Model/Pattern]
[Explanation with code/diagram]

## Integration with Mastra
### [Integration Point 1]
[Code examples]

## Security Considerations
- [Consideration 1]

## Best Practices
1. [Practice 1]

## Resources
- [External link 1]

## Related Documents
- [Internal link 1]
```

### Key Characteristics

- References external specifications
- Key benefits by audience
- Validation examples (valid/invalid)
- Integration section specific to Mastra
- Security considerations
- Best practices list

---

## Common Patterns Across All Documents

### Headers

- Use `##` for major sections, `###` for subsections
- Section numbers optional but common in PRDs
- UPPERCASE headers (e.g., `## OVERVIEW`) used in some requirements docs

### Tables

- Feature matrices: `| Feature | Status | Notes |`
- Requirements: `| ID | Requirement | Priority |`
- Provider/capability matrices common
- Status indicators: ✅ ⚠️ ❌ or Done/Partial/Missing

### Code Blocks

- TypeScript for interfaces and types
- SQL for database schemas
- ASCII art for architecture diagrams
- File trees for package structure

### Priority System

- P0: Must have / Core functionality
- P1: Should have / Important
- P2: Nice to have / Polish
- P3/P4: Future / Low priority

### Status Indicators

- ✅ Done / Implemented
- ⚠️ Partial
- ❌ Missing / Not Started
- 🚧 In Progress

### Linking

- Related documents linked at end
- Cross-references to other requirements (e.g., "from R1")
- External resources in Resources section

### Metadata

- Document version (for PRDs)
- Date
- Status (Draft/Review/Approved)
- Author/Team
- Branch/PR links (for implemented features)

---

## When to Use Each Format

| Document Type                | Use When                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| **PRD**                      | Major feature requiring cross-functional alignment, multiple personas, UI + backend |
| **Design Document**          | System architecture, pluggable components, multiple implementations                 |
| **Requirements Document**    | Feature breakdown, competitor parity analysis, tracking what's done                 |
| **UI Requirements**          | Companion to backend requirements, UI-specific surfaces                             |
| **Architecture Exploration** | Multiple valid approaches, need to document decision rationale                      |
| **Specification**            | Documenting a standard or protocol (internal or external)                           |

---

## Template Recommendations

1. **Start with the problem** - Every document should clearly state what problem it solves
2. **Use tables for tracking** - Feature matrices, requirements, priorities
3. **Include code examples** - TypeScript interfaces, SQL schemas, usage examples
4. **Track open questions** - Don't bury unresolved decisions
5. **Link related documents** - Build a connected knowledge base
6. **Mark implementation status** - ✅ ⚠️ ❌ for clear progress visibility
