# PR 1.4: Exporter Signal Declarations

**Packages:** Individual exporter packages
**Scope:** Add signal support declarations to existing exporters

---

## 1.4.1 DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts`

**Tasks:**
- [ ] Implement `onTracingEvent()` (delegates to existing method)
- [ ] Stub `onScoreEvent()` for Phase 4
- [ ] Other handlers added in later phases

---

## 1.4.2 JsonExporter

**File:** `observability/mastra/src/exporters/json.ts`

**Tasks:**
- [ ] Implement `onTracingEvent()` (output spans as JSON)
- [ ] Implement all handlers for debugging purposes

---

## 1.4.3 LangfuseExporter

**Package:** `observability/langfuse`

**Tasks:**
- [ ] Implement `onTracingEvent()` (existing functionality)
- [ ] Stub `onScoreEvent()` for Phase 4

---

## 1.4.4 BraintrustExporter

**Package:** `observability/braintrust`

**Tasks:**
- [ ] Implement `onTracingEvent()` handler

---

## 1.4.5 OtelExporter

**Package:** `observability/otel-exporter`

**Tasks:**
- [ ] Implement `onTracingEvent()` handler

---

## 1.4.6 Other Exporters

**Tasks:**
- [ ] Audit all exporters in `observability/` directory
- [ ] Add `onTracingEvent()` handler to each

---

## PR 1.4 Testing

**Tasks:**
- [ ] Verify each exporter loads without error
- [ ] Verify handlers are called correctly
