# Model List UI Improvements Plan

## 🎯 Goal
Improve the model list UI in our branch to match the desired UX:
- Remove edit icon requirement - show provider/model pickers inline
- Enable drag-and-drop reordering while in "edit mode"
- Fix provider ID display (remove `.chat`/`.x` suffixes like `cerebras.chat`)
- Ensure keyboard navigation works (Tab cycles through provider→model→next provider→model)
- Pressing Enter on model picker should jump to chat input
- Verify model metadata display in chat UI works correctly

## 📊 Current State Analysis

### What We Have (Our Branch)

**Single Model Picker:**
- ✅ Always visible provider/model inputs (no edit icon)
- ✅ Provider logos with connection status (green/red dots)
- ✅ (i) icon for documentation links
- ✅ Keyboard navigation (Tab, Shift+Tab, Arrow keys, Enter)
- ✅ Custom model ID support
- ✅ Auto-save on selection

**Model List (Fallback Models):**
- ✅ Drag-and-drop reordering
- ✅ Enable/disable toggle (Switch component)
- ❌ **PROBLEM:** Requires clicking edit icon to change provider/model
- ❌ **PROBLEM:** Can't drag-and-drop while in edit mode
- ❌ **PROBLEM:** Provider IDs show with `.chat`/`.x` suffixes (e.g., `cerebras.chat`)

**Chat UI:**
- ✅ Shows model metadata when `hasModelList` is true
- ✅ Displays as `provider/modelId` format with brain icon
- ✅ Metadata comes from `data.metadata.custom.modelMetadata`

### What Main Has

**Model List Implementation:**
- Same as ours - also has edit icon requirement
- Same drag-and-drop and toggle functionality
- Same provider ID suffix issue

**Conclusion:** Main doesn't have the improvements we want - we need to implement them ourselves!

## 🔧 Required Changes

### Change 1: Remove Edit Icon from Model List Items ⚠️ HIGH PRIORITY

**Current behavior:**
```tsx
// packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-list.tsx
return isEditingModel ? (
  <AgentMetadataModelSwitcher ... />
) : (
  <div>
    <GripVertical /> {/* Drag handle */}
    <Badge>{modelConfig.model.modelId}</Badge>
    <Switch /> {/* Enable/disable */}
    <EditIcon onClick={() => setIsEditingModel(true)} /> {/* ❌ Remove this */}
  </div>
);
```

**Desired behavior:**
```tsx
// Always show provider/model pickers inline
<div>
  <GripVertical /> {/* Drag handle */}
  <AgentMetadataModelSwitcher
    defaultProvider={modelConfig.model.provider}
    defaultModel={modelConfig.model.modelId}
    updateModel={...}
    autoSave={true} // Auto-save on selection
  />
  <Switch /> {/* Enable/disable */}
</div>
```

**Implementation steps:**
. Remove `isEditingModel` state from `AgentMetadataModelListItem`
. Remove edit icon button
. Always render `AgentMetadataModelSwitcher` inline
. Set `autoSave={true}` to avoid showing save button
. Adjust layout to fit provider/model pickers inline with drag handle and toggle

**Challenges:**
- Need to ensure drag-and-drop still works with inline inputs
- Layout needs to be responsive and not too cramped
- Tab order should be: provider1 → model1 → provider2 → model2 → etc.

### Change 2: Fix Provider ID Display (Remove `.chat`/`.x` Suffixes) ⚠️ HIGH PRIORITY

**Current problem:**
When a model is configured with a provider like `cerebras("model")`, the provider ID becomes `cerebras.chat` in the UI.

**Root cause:**
The provider ID from the model object includes the suffix, but our provider registry uses clean IDs like `cerebras`.

**Current code:**
```tsx
// packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-list.tsx
const providerIcon =
  providerMapToIcon[(modelConfig.model.provider || 'openai.chat') as keyof typeof providerMapToIcon];
```

**Solution:**
Add a helper function to strip `.chat`, `.x`, `.messages`, etc. suffixes:

```tsx
const cleanProviderId = (providerId: string): string => {
  return providerId.replace(/\.(chat|x|messages|completion)$/i, '');
};

const providerIcon =
  providerMapToIcon[cleanProviderId(modelConfig.model.provider || 'openai') as keyof typeof providerMapToIcon];
```

**Files to update:**
. `packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-list.tsx` (line 107)
. `packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata.tsx` (line 66)
. `packages/playground-ui/src/domains/agents/components/agent-metadata/provider-logo.tsx` (add to `getFallbackProviderIcon`)

**Also need to update:**
- Display of provider name in model list items
- Provider selection in model switcher when editing model list items

### Change 3: Keyboard Navigation for Model List ⚠️ MEDIUM PRIORITY

**Desired behavior:**
- Tab should cycle: provider1 → model1 → toggle1 → provider2 → model2 → toggle2 → etc.
- Pressing Enter on model picker should jump to chat input
- Shift+Tab should work in reverse

**Current behavior:**
- Single model picker has great keyboard nav
- Model list items don't have keyboard nav (they're in edit mode behind a button)

**Implementation:**
- Once we remove edit icon and show pickers inline, keyboard nav should work automatically
- Need to ensure `AgentMetadataModelSwitcher` in model list has same keyboard behavior as single picker
- May need to add `onEnter` callback to jump to chat input

### Change 4: Verify Model Metadata in Chat UI ✅ ALREADY WORKING

**Current implementation:**
```tsx
// packages/playground-ui/src/components/assistant-ui/messages/assistant-message.tsx
const modelMetadata = data.metadata?.custom?.modelMetadata as 
  { modelId: string; modelProvider: string } | undefined;

const showModelUsed = hasModelList && modelMetadata;

{showModelUsed && (
  <>
    <BrainIcon className="size-4" />
    <span className="text-ui-sm leading-ui-sm text-icon6">
      {modelMetadata.modelProvider}/{modelMetadata.modelId}
    </span>
  </>
)}
```

**What to verify:**
- Test with model list configured
- Ensure metadata is passed from backend correctly
- Verify provider ID doesn't have `.chat`/`.x` suffix in display

## 📋 Implementation Order

### Phase 1: Fix Provider ID Display (Quick Win) ✅
**Estimated Time:** 30 minutes

. Create shared utility function `cleanProviderId()`
. Update `agent-metadata-model-list.tsx` to use clean provider IDs
. Update `agent-metadata.tsx` to use clean provider IDs
. Update `provider-logo.tsx` to handle clean IDs
. Test with `cerebras.chat` model to verify fix
. Run build to ensure no errors

### Phase 2: Remove Edit Icon from Model List ⚠️
**Estimated Time:** 1-2 hours

. Modify `AgentMetadataModelListItem` component:
   - Remove `isEditingModel` state
   - Remove conditional rendering
   - Always render `AgentMetadataModelSwitcher` inline
   - Set `autoSave={true}` prop
   
. Update layout:
   - Adjust grid/flex layout to fit all components
   - Ensure drag handle is still accessible
   - Make sure toggle switch is visible
   - Test responsive behavior

. Test drag-and-drop:
   - Verify dragging still works with inline inputs
   - Ensure drag handle doesn't interfere with input focus
   - Test on different screen sizes

. Test keyboard navigation:
   - Tab through provider → model → toggle → next item
   - Shift+Tab in reverse
   - Arrow keys in dropdowns
   - Enter to select

. Run build and verify no errors

### Phase 3: Add Enter Key to Jump to Chat Input ⚠️
**Estimated Time:** 30 minutes

. Add `onEnterPress` callback prop to `AgentMetadataModelSwitcher`
. In model input's `onKeyDown`, call callback when Enter is pressed after selection
. In parent component, implement callback to focus chat input
. Test that Enter on model picker jumps to chat
. Ensure this works for both single model and model list items

### Phase 4: Integration Testing ⚠️
**Estimated Time:** 1 hour

**Test with single model agent:**
- Provider/model selection works
- Auto-save on selection
- Keyboard navigation works
- Enter jumps to chat input

**Test with model list agent:**
- All models show inline pickers
- Drag-and-drop works with inline pickers
- Toggle enable/disable works
- Provider IDs display without suffixes
- Keyboard navigation: Tab cycles through all inputs
- Enter on any model picker jumps to chat

**Test chat UI:**
- Send message with model list configured
- Verify model metadata displays
- Verify provider ID is clean (no `.chat`/`.x`)
- Verify format is `provider/modelId`

**Test edge cases:**
- Model with `cerebras.chat` provider
- Model with `xai.x` provider
- Custom model IDs in model list
- Disabled models in list
- Single model in model list

## 📋 Testing Checklist

### Phase 1: Provider ID Display
- [ ] Test with `cerebras.chat` model - should show as `cerebras`
- [ ] Test with `xai.x` model - should show as `xai`
- [ ] Test with `anthropic.messages` model - should show as `anthropic`
- [ ] Verify provider logos display correctly
- [ ] Check model list items show clean provider names
- [ ] Run `pnpm run build` - should pass

### Phase 2: Inline Model Pickers
- [ ] Model list items show provider/model pickers inline
- [ ] No edit icon visible
- [ ] Drag handle still works
- [ ] Can drag items with inline pickers
- [ ] Toggle switch visible and functional
- [ ] Layout looks good on different screen sizes
- [ ] Tab cycles through: provider1 → model1 → toggle1 → provider2 → model2 → toggle2
- [ ] Shift+Tab works in reverse
- [ ] Arrow keys work in dropdowns
- [ ] Run `pnpm run build` - should pass

### Phase 3: Enter Key Navigation
- [ ] Enter on single model picker jumps to chat input
- [ ] Enter on model list item picker jumps to chat input
- [ ] Works after selecting from dropdown
- [ ] Works after typing custom model ID
- [ ] Run `pnpm run build` - should pass

### Phase 4: Integration Tests
- [ ] Single model agent works end-to-end
- [ ] Model list agent works end-to-end
- [ ] Chat UI shows model metadata correctly
- [ ] Provider IDs clean in chat display
- [ ] Custom model IDs work in model list
- [ ] Disabled models skipped during fallback
- [ ] Drag-and-drop persists order
- [ ] All keyboard navigation works
- [ ] Run `pnpm run build` - should pass

## 🔧 Known Issues & Considerations

### 1. Type Signature Changes
**Issue:** Main branch changed agent method signatures from `MastraModelConfig` to `MastraLanguageModel`

**Solution:** ✅ Fixed by reverting to `MastraModelConfig` in `packages/core/src/agent/agent.ts`

**Impact:** Allows universal router format to work with both single models and model lists

### 2. Provider Registry Compatibility
**Issue:** Some providers in registry may not have complete model lists

**Consideration:** 
- Custom model IDs allow users to specify any model
- Provider registry should be kept up-to-date
- Consider adding "Add Model" feature for providers

### 3. Model List UI in Edit Mode
**Issue:** Model list items show edit icon, which user previously wanted removed

**Consideration:**
- Edit icon is needed for model list items to change model
- Different from single model picker which should always be visible
- This is acceptable UX for model list feature

### 4. Save Button Mystery
**Issue:** User mentioned save button but we haven't found it yet

**Next steps:**
- Investigate main branch commits
- Check if it's auto-save vs manual save
- Determine if it's needed for our branch

## 📝 Documentation Needs

### 1. Universal Router Format
- Document `provider/modelId` format
- Explain how it works with model resolution
- Provide examples for custom model IDs

### 2. Model List Feature
- Document how to configure agent with model list
- Explain fallback behavior
- Document enable/disable toggle
- Explain reordering

### 3. Provider Registry
- Document how to add new providers
- Explain model list configuration
- Document connection status checking

### 4. Chat UI Model Display
- Document when "model used" displays
- Explain metadata format
- Document how to customize display

## 🎯 Success Criteria

### Must Have
- ✅ Build passes without errors
- ✅ Universal router format works for all features
- ✅ Single model picker works as before
- ✅ Model list feature fully functional
- ✅ Drag-and-drop reordering works
- ✅ Enable/disable toggle works
- ✅ Chat UI shows model used correctly
- ✅ Provider IDs display without suffixes
- ✅ Keyboard navigation works

### Should Have
- ⚠️ Save button implemented (if needed)
- ⚠️ Custom model IDs work in model list
- ⚠️ Provider logos display in model list
- ⚠️ Error handling for disconnected providers
- ⚠️ State persistence after page reload

### Nice to Have
- ⚠️ Provider logos in chat "model used" display
- ⚠️ Model list item preview without edit mode
- ⚠️ Bulk enable/disable for model list
- ⚠️ Model list templates/presets

## 🚀 Next Steps

1. **Immediate (Today):**
   - [ ] Investigate save button feature
   - [ ] Run full test suite on model list feature
   - [ ] Test drag-and-drop and toggle functionality
   - [ ] Verify chat UI model display

2. **Short-term (This Week):**
   - [ ] Fix any issues found during testing
   - [ ] Add missing documentation
   - [ ] Create test agents for different scenarios
   - [ ] Performance testing with large model lists

3. **Long-term (Next Sprint):**
   - [ ] Consider UI improvements for model list
   - [ ] Add model list templates/presets
   - [ ] Improve error handling and user feedback
   - [ ] Add analytics for model usage

## 📊 Architecture Overview

### Data Flow: Single Model
```
User selects provider/model
  ↓
AgentMetadataModelSwitcher
  ↓
updateModel({ provider, modelId })
  ↓
useUpdateAgentModel hook
  ↓
client.getAgent(agentId).updateModel()
  ↓
POST /api/agents/:agentId/model
  ↓
updateAgentModelHandler
  ↓
agent.__updateModel({ model: "provider/modelId" })
  ↓
Agent resolves model config internally
```

### Data Flow: Model List
```
User edits model in list
  ↓
AgentMetadataModelListItem (edit mode)
  ↓
AgentMetadataModelSwitcher
  ↓
updateModelInModelList({ modelConfigId, model: { provider, modelId } })
  ↓
useUpdateAgentModelInModelList hook
  ↓
client.getAgent(agentId).updateModelInModelList()
  ↓
POST /api/agents/:agentId/model-list/:modelConfigId
  ↓
updateAgentModelInModelListHandler
  ↓
agent.updateModelInModelList({ id, model: "provider/modelId" })
  ↓
Agent resolves model config internally
```

### Data Flow: Chat with Model List
```
User sends message
  ↓
Agent.generate() with model list
  ↓
Agent tries models in order (enabled only)
  ↓
First successful model used
  ↓
Response includes metadata.custom.modelMetadata
  ↓
AssistantMessage component
  ↓
Displays "provider/modelId" with brain icon
```

## 🔍 Key Files Reference

### Frontend Components
- `packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-switcher.tsx` - Main model picker UI
- `packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-list.tsx` - Model list UI with drag-and-drop
- `packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata.tsx` - Conditional rendering of single vs list
- `packages/playground-ui/src/components/assistant-ui/messages/assistant-message.tsx` - Chat message with model display

### Backend Handlers
- `packages/server/src/server/handlers/agents.ts` - Core agent handlers
- `packages/deployer/src/server/handlers/routes/agents/handlers.ts` - Deployer-specific handlers
- `packages/deployer/src/server/handlers/routes/agents/router.ts` - API routes

### Core Logic
- `packages/core/src/agent/agent.ts` - Agent class with model management
- `packages/core/src/llm/provider-registry.ts` - Provider registry
- `packages/core/src/llm/index.ts` - LLM utilities

### Client SDK
- `client-sdks/client-js/src/resources/agent.ts` - Client methods for agent operations
- `client-sdks/client-js/src/types.ts` - TypeScript types

## 💡 Implementation Notes

### Universal Router Format
The universal router format (`provider/modelId`) is the key to our implementation:
- Works with any provider in the registry
- Supports custom model IDs
- Resolved internally by agent's `resolveModelConfig` method
- No need for provider-specific imports or functions

### Model List vs Single Model
The agent can have either:
1. **Single Model:** `model: string | MastraLanguageModel`
2. **Model List:** `model: Array<{ id, model, enabled, maxRetries }>`

The UI conditionally renders based on `agent.modelList` existence.

### State Management
- Single model: Managed by `AgentMetadataModelSwitcher` component
- Model list: Managed by `AgentMetadataModelList` component with local state
- Persistence: API calls to backend handlers
- Real-time updates: State updates before API call for optimistic UI

### Error Handling
- Disconnected providers show red dot
- Invalid model IDs handled gracefully
- Fallback to next model in list on error
- User feedback via toast notifications

---

**Last Updated:** 2024-01-XX
**Branch:** feat/openaicompat-stream-playground-2
**Status:** Ready for testing
