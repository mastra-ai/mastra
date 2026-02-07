# Dynamiczny wybór resourceId w Mastra Playground

## TL;DR

> **Quick Summary**: Dodanie selektora resourceId w nagłówku strony agenta, umożliwiającego podgląd wątków i danych memory dla dowolnego resourceId (nie tylko zahardkodowanego agentId).
>
> **Deliverables**:
>
> - Komponent `ResourceIdSelector` (Combobox: dropdown + custom input)
> - Propagacja `selectedResourceId` przez drzewo komponentów
> - Persystencja wyboru w localStorage
> - Naprawa cache invalidation w hookach memory
>
> **Estimated Effort**: Medium (11 plików do zmodyfikowania)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (typ) → Task 2 (stan) → Task 3 (komponent) → Tasks 4-6 (propagacja) → Task 7 (cache fix) → Task 8 (testy)

---

## Context

### Original Request

Aktualnie w mastra-playground (studio) jest zahardkowany resourceId jako nazwa agenta. Przez to nie da się podejrzeć wątków i wiadomości i danych agenta który ma inne resourceId. Potrzeba możliwości wyboru resourceId dla agenta zamiast zahardkodowanego.

### Interview Summary

**Key Discussions**:

- Źródło listy resourceId: Endpoint API (istniejący `GET /memory/threads`)
- Lokalizacja w UI: Nagłówek strony agenta
- Persystencja: localStorage (per agent)
- Testy: Po implementacji (E2E)

**Research Findings**:

- Backend API (`GET /memory/threads`) już zwraca wszystkie wątki bez filtra resourceId
- Hooki memory już przyjmują osobny resourceId - problem jest tylko w warstwie UI
- `MastraRuntimeProvider` NIE przyjmuje resourceId jako prop - trzeba dodać do `ChatProps`
- Cache invalidation w `useDeleteThread` i `useCloneThread` jest zepsuta gdy resourceId ≠ agentId

### Metis Review

**Critical Finding**: Cały zaplanowany etap backendowy (nowy endpoint, storage methods) jest ZBĘDNY - istniejące API wystarczy. Zakres zmniejszony o ~40%.

**Identified Gaps** (addressed):

- Brak `resourceId` w `ChatProps` → dodajemy
- Cache invalidation hardkoduje agentId → naprawiamy
- SelectField nie wspiera ręcznego wpisywania → używamy Combobox pattern

---

## Work Objectives

### Core Objective

Umożliwić użytkownikowi wybór dowolnego resourceId dla agenta w playground, zamiast zahardkodowanego agentId.

### Concrete Deliverables

- `packages/playground-ui/src/domains/agents/components/resource-id-selector.tsx` - nowy komponent
- Rozszerzenie `ChatProps` o `resourceId?: string`
- Propagacja `selectedResourceId` przez 11 plików
- Naprawa cache invalidation w hookach memory

### Definition of Done

- [ ] Selektor widoczny w nagłówku strony agenta gdy memory włączony
- [ ] Zmiana resourceId powoduje odświeżenie listy wątków
- [ ] Nowe wątki tworzone z wybranym resourceId
- [ ] Wybór zapamiętany w localStorage per agent
- [ ] Możliwość wpisania dowolnego resourceId (nie tylko z listy)

### Must Have

- Backward compatibility: domyślny resourceId = agentId
- Selektor widoczny TYLKO gdy memory jest włączone
- Combobox (dropdown + custom input), nie czysty dropdown
- Nawigacja na nowy wątek po zmianie resourceId
- agentId ZAWSZE jako pierwsza opcja w selektorze

### Must NOT Have (Guardrails)

- ❌ Nowy endpoint API (istniejący `GET /memory/threads` wystarczy)
- ❌ Modyfikacje `packages/core/`, `packages/server/`, `client-sdks/`, `stores/`
- ❌ Dedykowany React Context dla resourceId (prop drilling wystarczy)
- ❌ Testy jednostkowe hooków (user decision: tylko E2E)
- ❌ Modyfikacja network agents flow
- ❌ Filtrowanie wątków po metadata
- ❌ Edycja resourceId istniejącego wątku
- ❌ Nadmierne JSDoc/komentarze

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (Playwright w packages/playground)
- **Automated tests**: YES (Tests-after)
- **Framework**: Playwright E2E

### Agent-Executed QA Scenarios (MANDATORY)

**Verification Tool by Deliverable Type:**

| Type            | Tool                           | How Agent Verifies                          |
| --------------- | ------------------------------ | ------------------------------------------- |
| **Frontend/UI** | Playwright (playwright skill)  | Navigate, interact, assert DOM, screenshot  |
| **API**         | Browser DevTools / Network tab | Intercept requests, verify resourceId param |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Extend ChatProps type

Wave 2 (After Wave 1):
├── Task 2: Agent page state + localStorage
├── Task 3: ResourceIdSelector component
└── Task 7: Fix cache invalidation in hooks

Wave 3 (After Wave 2):
├── Task 4: Propagate to AgentChat + MastraRuntimeProvider
├── Task 5: Propagate to AgentSidebar + ChatThreads
└── Task 6: Propagate to AgentInformation + AgentMemory

Wave 4 (After Wave 3):
└── Task 8: E2E Tests

Critical Path: Task 1 → Task 2 → Task 4 → Task 8
```

### Dependency Matrix

| Task | Depends On | Blocks        | Can Parallelize With |
| ---- | ---------- | ------------- | -------------------- |
| 1    | None       | 2, 3, 4, 5, 6 | None (first)         |
| 2    | 1          | 3, 4, 5, 6    | 7                    |
| 3    | 2          | 4             | 7                    |
| 4    | 1, 3       | 8             | 5, 6                 |
| 5    | 2          | 8             | 4, 6                 |
| 6    | 2          | 8             | 4, 5                 |
| 7    | 1          | 8             | 2, 3                 |
| 8    | 4, 5, 6, 7 | None (final)  | None                 |

---

## TODOs

- [x] 1. Extend ChatProps with resourceId

  **What to do**:
  - Dodaj `resourceId?: string` do interface `ChatProps`
  - Typ jest opcjonalny - gdy undefined, używany jest agentId (backward compat)

  **Must NOT do**:
  - Modyfikować innych typów w tym samym pliku
  - Dodawać nadmiarowych komentarzy

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pojedyncza linijka zmiany w jednym pliku
  - **Skills**: [`vue`] (ogólny frontend skill)
    - `vue`: Ogólne wzorce frontend - choć to React, skill daje kontekst TS

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (alone)
  - **Blocks**: Tasks 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/playground-ui/src/types.ts:56-69` - ChatProps interface do rozszerzenia

  **API/Type References**:
  - Linia 59: `agentId: string` - wzorzec dla resourceId

  **WHY Each Reference Matters**:
  - `ChatProps` jest głównym interfejsem przekazywanym przez drzewo komponentów agenta

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: ChatProps type contains resourceId
    Tool: Bash (grep/ast-grep)
    Preconditions: Plik zmodyfikowany
    Steps:
      1. ast_grep_search pattern 'resourceId?: string' in packages/playground-ui/src/types.ts
      2. Assert: match found inside ChatProps interface
    Expected Result: Typ resourceId istnieje w ChatProps
    Evidence: ast-grep output

  Scenario: TypeScript compiles without errors
    Tool: Bash
    Preconditions: Zmiana wykonana
    Steps:
      1. cd packages/playground-ui && pnpm tsc --noEmit
      2. Assert: exit code 0
    Expected Result: Brak błędów TypeScript
    Evidence: Command output
  ```

  **Commit**: YES
  - Message: `feat(playground-ui): add resourceId to ChatProps interface`
  - Files: `packages/playground-ui/src/types.ts`
  - Pre-commit: `pnpm tsc --noEmit`

---

- [x] 2. Add selectedResourceId state to Agent page

  **What to do**:
  - Dodaj stan `selectedResourceId` w komponencie strony agenta
  - Zainicjalizuj z localStorage (`mastra-agent-resource-${agentId}`) lub domyślnie `agentId`
  - Zapisuj zmiany do localStorage
  - Dodaj handler `onResourceIdChange` który:
    - Aktualizuje stan
    - Zapisuje do localStorage
    - Nawiguje na nowy wątek: `navigate(\`/agents/${agentId}/chat/${uuid()}?new=true\`)`

  **Must NOT do**:
  - Tworzyć dedykowanego React Context
  - Modyfikować logiki tworzenia wątków (tylko nawigacja)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React state management + localStorage pattern
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: Stan React, useEffect, optymalizacja

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 7)
  - **Blocks**: Tasks 3, 4, 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/playground/src/pages/agents/agent/index.tsx:1-100` - Struktura strony agenta, hooks, nawigacja
  - `packages/playground-ui/src/domains/agents/hooks/use-agent-settings-state.ts` - Wzorzec localStorage persistence

  **API/Type References**:
  - `packages/playground/src/pages/agents/agent/index.tsx:41` - Nawigacja przy tworzeniu wątku: `navigate(\`/agents/${agentId}/chat/${uuid()}?new=true\`)`

  **WHY Each Reference Matters**:
  - Agent page to główny kontener stanu - tutaj żyje `selectedResourceId`
  - `use-agent-settings-state.ts` pokazuje dokładny wzorzec persystencji w localStorage

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: State initialized from localStorage
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, localStorage has saved resourceId
    Steps:
      1. page.evaluate(() => localStorage.setItem('mastra-agent-resource-testAgent', 'custom-resource'))
      2. Navigate to: http://localhost:3000/agents/testAgent/chat/new
      3. Wait for page load
      4. Assert: selectedResourceId state equals 'custom-resource' (via data attribute or selector value)
    Expected Result: Stan inicjalizowany z localStorage
    Evidence: .sisyphus/evidence/task-2-init-from-storage.png

  Scenario: State defaults to agentId when localStorage empty
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, no localStorage entry
    Steps:
      1. page.evaluate(() => localStorage.removeItem('mastra-agent-resource-testAgent'))
      2. Navigate to: http://localhost:3000/agents/testAgent/chat/new
      3. Wait for page load
      4. Assert: selectedResourceId equals agentId
    Expected Result: Domyślna wartość = agentId
    Evidence: .sisyphus/evidence/task-2-default-value.png

  Scenario: Changes persisted to localStorage
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Trigger resourceId change to 'new-resource'
      2. page.evaluate(() => localStorage.getItem('mastra-agent-resource-testAgent'))
      3. Assert: returned value equals 'new-resource'
    Expected Result: Zmiana zapisana w localStorage
    Evidence: localStorage value captured

  Scenario: Navigation to new thread on resourceId change
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, on existing thread
    Steps:
      1. Navigate to: http://localhost:3000/agents/testAgent/chat/existing-thread-id
      2. Trigger resourceId change
      3. Wait for navigation
      4. Assert: URL matches /agents/testAgent/chat/[uuid]?new=true
      5. Assert: URL is different from initial
    Expected Result: Nawigacja na nowy wątek
    Evidence: .sisyphus/evidence/task-2-navigation.png
  ```

  **Commit**: YES
  - Message: `feat(playground): add selectedResourceId state with localStorage persistence`
  - Files: `packages/playground/src/pages/agents/agent/index.tsx`
  - Pre-commit: `pnpm tsc --noEmit`

---

- [x] 3. Create ResourceIdSelector component

  **What to do**:
  - Stwórz nowy komponent `ResourceIdSelector` w `packages/playground-ui/src/domains/agents/components/`
  - Komponent typu Combobox: dropdown z opcjami + możliwość wpisania własnej wartości
  - Props:
    - `value: string` - aktualny resourceId
    - `onChange: (resourceId: string) => void`
    - `agentId: string` - zawsze pierwsza opcja
    - `availableResourceIds: string[]` - lista z wątków
    - `disabled?: boolean` - zablokowany podczas streamu
  - Pobierz listę unikalnych resourceId z useThreads (bez filtra resourceId, perPage: 100+)
  - agentId ZAWSZE jako pierwsza opcja, nawet jeśli nie ma wątków z tym resourceId
  - Usuń duplikaty z listy

  **Must NOT do**:
  - Tworzyć osobnego hooka `useResourceIds()` - logika inline
  - Używać czystego SelectField - potrzebny Combobox pattern

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Nowy komponent UI z Combobox pattern
  - **Skills**: [`react-best-practices`, `tailwind-best-practices`]
    - `react-best-practices`: Wzorce komponentów React
    - `tailwind-best-practices`: Styling zgodny z design system

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 7)
  - **Blocks**: Task 4
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `packages/playground-ui/src/domains/agents/components/agent-combobox.tsx` - Combobox pattern dla agentów (select + input)
  - `packages/playground-ui/src/ds/components/Select/select.tsx` - Base Select z @radix-ui/react-select
  - `packages/playground-ui/src/domains/memory/hooks/use-memory.ts:39-60` - useThreads hook

  **API/Type References**:
  - `packages/playground-ui/src/types/memory.ts` - StorageThreadType z resourceId

  **WHY Each Reference Matters**:
  - `agent-combobox.tsx` to dokładny wzorzec Combobox do skopiowania
  - useThreads już pobiera wątki - wystarczy wyciągnąć unikalne resourceId

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Component renders with agentId as first option
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, component mounted
    Steps:
      1. Navigate to agent page with memory enabled
      2. Click on ResourceIdSelector to open dropdown
      3. Get all options: page.locator('[data-testid="resource-id-option"]').allTextContents()
      4. Assert: first option equals agentId
    Expected Result: agentId jest pierwszą opcją
    Evidence: .sisyphus/evidence/task-3-first-option.png

  Scenario: Custom input allows typing any resourceId
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to agent page
      2. Focus on ResourceIdSelector input
      3. Type: 'custom-resource-123'
      4. Trigger change (Enter or blur)
      5. Assert: onChange called with 'custom-resource-123'
    Expected Result: Można wpisać dowolny resourceId
    Evidence: .sisyphus/evidence/task-3-custom-input.png

  Scenario: Dropdown shows unique resourceIds from threads
    Tool: Playwright (playwright skill)
    Preconditions: Multiple threads with different resourceIds exist
    Steps:
      1. Navigate to agent page
      2. Open selector dropdown
      3. Get all options
      4. Assert: no duplicates in options
      5. Assert: options include resourceIds from existing threads
    Expected Result: Lista zawiera unikalne resourceId z wątków
    Evidence: .sisyphus/evidence/task-3-unique-options.png

  Scenario: Component hidden when memory disabled
    Tool: Playwright (playwright skill)
    Preconditions: Agent without memory config
    Steps:
      1. Navigate to: /agents/{agentId-no-memory}/chat/new
      2. Assert: page.locator('[data-testid="resource-id-selector"]').count() equals 0
    Expected Result: Selektor niewidoczny
    Evidence: .sisyphus/evidence/task-3-hidden.png
  ```

  **Commit**: YES
  - Message: `feat(playground-ui): add ResourceIdSelector combobox component`
  - Files: `packages/playground-ui/src/domains/agents/components/resource-id-selector.tsx`
  - Pre-commit: `pnpm tsc --noEmit`

---

- [ ] 4. Propagate resourceId to AgentChat and MastraRuntimeProvider

  **What to do**:
  - Agent page: przekaż `selectedResourceId` jako prop `resourceId` do `AgentChat`
  - AgentChat: przyjmij `resourceId` prop i przekaż do `MastraRuntimeProvider`
  - MastraRuntimeProvider: użyj `resourceId` z props zamiast hardkodowanego `agentId`
    - Linia ~671: tworzenie wątku - użyj `resourceId ?? agentId`
    - Linia ~788: tworzenie wątku - użyj `resourceId ?? agentId`

  **Must NOT do**:
  - Modyfikować logiki streamingu
  - Dodawać nowych hooków

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Prop drilling - mechaniczne przekazywanie props
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `packages/playground/src/pages/agents/agent/index.tsx:150-200` - Montowanie AgentChat
  - `packages/playground-ui/src/domains/agents/components/agent-chat.tsx:1-50` - Props i montowanie MastraRuntimeProvider

  **API/Type References**:
  - `packages/playground-ui/src/services/mastra-runtime-provider.tsx:671` - Tworzenie wątku z hardkodowanym resourceId
  - `packages/playground-ui/src/services/mastra-runtime-provider.tsx:788` - Tworzenie wątku z hardkodowanym resourceId

  **WHY Each Reference Matters**:
  - MastraRuntimeProvider to miejsce gdzie wątki są faktycznie tworzone z resourceId
  - Linie 671 i 788 to KRYTYCZNE miejsca do zmiany

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: New thread created with selected resourceId
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, resourceId set to 'custom-resource'
    Steps:
      1. Set resourceId to 'custom-resource'
      2. Send a message to create new thread
      3. Intercept network request to /memory/threads
      4. Assert: request body contains resourceId: 'custom-resource'
    Expected Result: Wątek tworzony z prawidłowym resourceId
    Evidence: Network request captured

  Scenario: Fallback to agentId when resourceId undefined
    Tool: Playwright (playwright skill)
    Preconditions: resourceId prop not passed
    Steps:
      1. Navigate without setting resourceId
      2. Send a message
      3. Intercept network request
      4. Assert: resourceId in request equals agentId
    Expected Result: Fallback działa
    Evidence: Network request captured
  ```

  **Commit**: YES (group with Task 5, 6)
  - Message: `feat(playground): propagate resourceId through component tree`
  - Files:
    - `packages/playground/src/pages/agents/agent/index.tsx`
    - `packages/playground-ui/src/domains/agents/components/agent-chat.tsx`
    - `packages/playground-ui/src/services/mastra-runtime-provider.tsx`
  - Pre-commit: `pnpm tsc --noEmit`

---

- [ ] 5. Propagate resourceId to AgentSidebar and ChatThreads

  **What to do**:
  - Agent page: przekaż `selectedResourceId` do `AgentSidebar`
  - AgentSidebar: przyjmij prop i przekaż do `ChatThreads`
  - ChatThreads: użyj `resourceId` w useThreads hook
  - Zamień `resourceId={agentId}` na `resourceId={selectedResourceId}`

  **Must NOT do**:
  - Modyfikować logiki sidebar poza prop drilling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Prop drilling
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `packages/playground/src/domains/agents/agent-sidebar.tsx` - Sidebar z prop `resourceId={agentId}`
  - `packages/playground-ui/src/domains/agents/components/chat-threads.tsx` - Lista wątków

  **API/Type References**:
  - `packages/playground-ui/src/domains/memory/hooks/use-memory.ts:39` - useThreads({ resourceId, agentId })

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Thread list filters by selected resourceId
    Tool: Playwright (playwright skill)
    Preconditions: Threads exist for multiple resourceIds
    Steps:
      1. Set resourceId to 'resource-A'
      2. Wait for thread list to load
      3. Assert: all visible threads have resourceId 'resource-A'
      4. Change resourceId to 'resource-B'
      5. Wait for thread list to reload
      6. Assert: all visible threads have resourceId 'resource-B'
    Expected Result: Lista filtrowana po resourceId
    Evidence: .sisyphus/evidence/task-5-filtering.png
  ```

  **Commit**: NO (grouped with Task 4)

---

- [ ] 6. Propagate resourceId to AgentInformation and AgentMemory

  **What to do**:
  - Agent page: przekaż `selectedResourceId` do `AgentInformation`
  - AgentInformation: przyjmij prop i przekaż do `AgentMemory`
  - AgentMemory:
    - Użyj `resourceId` prop zamiast `agentId` (linie 34, 42, 115)
    - Przekaż do `AgentObservationalMemory` (linia 115)
  - Usuń komentarze "In playground, agentId is the resourceId"

  **Must NOT do**:
  - Modyfikować AgentObservationalMemory (już przyjmuje resourceId prop)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Prop drilling + usunięcie komentarzy
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx` - Container
  - `packages/playground-ui/src/domains/agents/components/agent-information/agent-memory.tsx:34,42,115` - Hardkodowane resourceId: agentId

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Observational memory shows data for selected resourceId
    Tool: Playwright (playwright skill)
    Preconditions: Thread with observations for 'custom-resource'
    Steps:
      1. Set resourceId to 'custom-resource'
      2. Select thread with observations
      3. Assert: observational memory panel shows data
      4. Assert: API call includes resourceId='custom-resource'
    Expected Result: Observational memory dla wybranego resourceId
    Evidence: .sisyphus/evidence/task-6-obs-memory.png

  Scenario: No stale comments about agentId=resourceId
    Tool: Bash (grep)
    Preconditions: Changes applied
    Steps:
      1. grep -r "agentId is the resourceId" packages/playground-ui/
      2. Assert: no matches found
    Expected Result: Stare komentarze usunięte
    Evidence: grep output
  ```

  **Commit**: NO (grouped with Task 4)

---

- [x] 7. Fix cache invalidation in memory hooks

  **What to do**:
  - `useDeleteThread`:
    - Dodaj `resourceId` jako parametr hooka
    - Zmień queryKey invalidation z `['memory', 'threads', agentId, agentId]` na `['memory', 'threads', resourceId, agentId]`
  - `useCloneThread`:
    - Dodaj `resourceId` jako parametr hooka
    - Zmień queryKey invalidation analogicznie
  - Upewnij się że wywołania tych hooków przekazują prawidłowy resourceId

  **Must NOT do**:
  - Modyfikować innych hooków memory
  - Zmieniać logiki delete/clone

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Drobna poprawka w 2 miejscach
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/playground-ui/src/domains/memory/hooks/use-memory.ts:79` - useDeleteThread invalidation
  - `packages/playground-ui/src/domains/memory/hooks/use-memory.ts:120` - useCloneThread invalidation
  - `packages/playground-ui/src/domains/memory/hooks/use-memory.ts:45` - useThreads queryKey pattern

  **WHY Each Reference Matters**:
  - Linie 79 i 120 to BUGI - hardkodują `agentId` zamiast dynamicznego `resourceId`
  - Linia 45 pokazuje prawidłowy wzorzec queryKey

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Delete thread invalidates correct cache
    Tool: Playwright (playwright skill)
    Preconditions: Thread exists for resourceId 'custom-resource'
    Steps:
      1. Set resourceId to 'custom-resource'
      2. Load thread list
      3. Delete a thread
      4. Assert: thread disappears from list immediately (no page refresh)
    Expected Result: Cache invalidacja działa
    Evidence: .sisyphus/evidence/task-7-delete.png

  Scenario: Clone thread appears in list
    Tool: Playwright (playwright skill)
    Preconditions: Thread exists for resourceId 'custom-resource'
    Steps:
      1. Set resourceId to 'custom-resource'
      2. Clone a thread
      3. Assert: cloned thread appears in list immediately
    Expected Result: Sklonowany wątek widoczny
    Evidence: .sisyphus/evidence/task-7-clone.png
  ```

  **Commit**: YES
  - Message: `fix(playground-ui): fix cache invalidation for dynamic resourceId`
  - Files: `packages/playground-ui/src/domains/memory/hooks/use-memory.ts`
  - Pre-commit: `pnpm tsc --noEmit`

---

- [ ] 8. E2E Tests for resourceId selection

  **What to do**:
  - Stwórz plik testów E2E w odpowiednim katalogu playground
  - Zaimplementuj scenariusze z sekcji Acceptance Criteria
  - Uruchom testy i upewnij się że przechodzą

  **Must NOT do**:
  - Testy jednostkowe hooków
  - Mocki API - testy na żywym dev serverze

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Playwright E2E testy
  - **Skills**: [`playwright`, `e2e-tests-studio`]
    - `playwright`: Automatyzacja przeglądarki
    - `e2e-tests-studio`: Wzorce testów E2E dla playground

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (alone, final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 4, 5, 6, 7

  **References**:

  **Pattern References**:
  - `e2e-tests/` - Istniejące testy E2E w projekcie
  - `packages/playground/` - Konfiguracja Playwright

  **Test References**:
  - Scenariusze QA z zadań 1-7

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All E2E tests pass
    Tool: Bash
    Preconditions: Dev server running, all tasks completed
    Steps:
      1. cd packages/playground && pnpm test:e2e
      2. Assert: all tests pass
      3. Assert: no flaky tests
    Expected Result: Wszystkie testy przechodzą
    Evidence: Test output + screenshots

  Scenario: Tests cover all AC criteria
    Tool: Bash (grep)
    Preconditions: Tests written
    Steps:
      1. Count test scenarios
      2. Assert: >= 10 scenarios (from AC-1 to AC-10)
    Expected Result: Pełne pokrycie
    Evidence: Test file content
  ```

  **Commit**: YES
  - Message: `test(playground): add E2E tests for resourceId selection`
  - Files: `packages/playground/e2e/resource-id-selection.spec.ts` (lub podobny)
  - Pre-commit: `pnpm test:e2e`

---

## Commit Strategy

| After Task | Message                                                                        | Files                    | Verification |
| ---------- | ------------------------------------------------------------------------------ | ------------------------ | ------------ |
| 1          | `feat(playground-ui): add resourceId to ChatProps interface`                   | types.ts                 | tsc          |
| 2          | `feat(playground): add selectedResourceId state with localStorage persistence` | agent/index.tsx          | tsc          |
| 3          | `feat(playground-ui): add ResourceIdSelector combobox component`               | resource-id-selector.tsx | tsc          |
| 4+5+6      | `feat(playground): propagate resourceId through component tree`                | 6 files                  | tsc          |
| 7          | `fix(playground-ui): fix cache invalidation for dynamic resourceId`            | use-memory.ts            | tsc          |
| 8          | `test(playground): add E2E tests for resourceId selection`                     | e2e spec                 | test:e2e     |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compiles
pnpm tsc --noEmit

# E2E tests pass
cd packages/playground && pnpm test:e2e

# No hardcoded resourceId: agentId remains
grep -r "resourceId: agentId" packages/playground-ui/src/domains/agents/ | wc -l
# Expected: 0
```

### Final Checklist

- [ ] Selektor widoczny w nagłówku strony agenta (gdy memory włączone)
- [ ] Zmiana resourceId odświeża listę wątków
- [ ] Nowe wątki tworzone z wybranym resourceId
- [ ] Wybór zapamiętany w localStorage
- [ ] Można wpisać dowolny resourceId ręcznie
- [ ] Cache invalidation działa poprawnie
- [ ] agentId jest domyślną wartością (backward compat)
- [ ] Wszystkie testy E2E przechodzą
- [ ] Żaden plik w packages/core, packages/server, stores/, client-sdks/ nie został zmodyfikowany
