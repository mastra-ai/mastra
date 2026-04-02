browser/agent-browser/src/thread-manager.ts
Comment on lines +94 to +95
    if (this.scope === 'thread') {
      // Full thread isolation - create a new browser manager
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

🧩 Analysis chain
Update comments to align with actual scope modes: 'shared' and 'thread'.

The code correctly uses the same scope literals ('shared' and 'thread') as the base ThreadManagerConfig, so the isolation branches at lines 94, 186, 196, and 234 are reachable. However, several comments incorrectly reference non-existent modes 'browser' and 'none':

Line 18: "For 'browser' mode" should reference 'thread' mode
Line 47: "for 'browser' mode" should reference 'thread' mode
Lines 175–176, 179, 201: "For 'browser' mode" and "For 'none' mode" should use 'thread' and 'shared'
Update these comments to accurately describe the actual scope modes defined by BrowserScope.

🤖 Prompt for AI Agents
@NikAiyer	Reply...
browser/agent-browser/src/thread-manager.ts
Comment on lines +119 to +130
      session.manager = manager;
      this.threadBrowsers.set(threadId, manager);

      // Restore browser state if available (before notifying parent to avoid screencast race)
      if (savedState && savedState.tabs.length > 0) {
        this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
        await this.restoreBrowserState(manager, savedState);
      }

      // Notify parent browser so it can set up close listeners
      // This is done after restoration so the screencast starts on the correct active page
      this.onBrowserCreated?.(manager, threadId);
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

Roll back the launched manager when onBrowserCreated fails.

The manager is published into session.manager and threadBrowsers before the callback runs. If that callback throws, createSession() rejects but the browser stays open and the thread remains tracked as active.

♻️ Suggested rollback
       session.manager = manager;
       this.threadBrowsers.set(threadId, manager);

-      // Restore browser state if available (before notifying parent to avoid screencast race)
-      if (savedState && savedState.tabs.length > 0) {
-        this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
-        await this.restoreBrowserState(manager, savedState);
-      }
-
-      // Notify parent browser so it can set up close listeners
-      // This is done after restoration so the screencast starts on the correct active page
-      this.onBrowserCreated?.(manager, threadId);
+      try {
+        if (savedState && savedState.tabs.length > 0) {
+          this.logger?.debug?.(`Restoring browser state for thread ${threadId}: ${savedState.tabs.length} tabs`);
+          await this.restoreBrowserState(manager, savedState);
+        }
+
+        this.onBrowserCreated?.(manager, threadId);
+      } catch (error) {
+        this.threadBrowsers.delete(threadId);
+        session.manager = undefined;
+        try {
+          await manager.close();
+        } catch {}
+        throw error;
+      }
📝 Committable suggestion
🤖 Prompt for AI Agents
@NikAiyer	Reply...
browser/stagehand/src/stagehand-browser.ts
Comment on lines +382 to +402
  override handleBrowserDisconnected(): void {
    const scope = this.threadManager.getScope();
    const threadId = this.getCurrentThread();

    if (scope === 'thread' && threadId !== DEFAULT_THREAD_ID) {
      // Only clear the specific thread's session - other threads have independent browsers
      this.threadManager.clearSession(threadId);
      this.logger.debug?.(`Cleared Stagehand session for thread: ${threadId}`);
      // Update status and notify only this thread's callbacks
      if (this.status !== 'closed') {
        this.status = 'closed';
        this.notifyBrowserClosed(threadId);
      }
    } else {
      // For 'shared' scope or default thread, the shared stagehand is gone
      this.stagehand = null;
      this.threadManager.clearStagehand();
      // Call base class which notifies all callbacks
      super.handleBrowserDisconnected();
    }
  }
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

Global status = 'closed' set for thread disconnect - same issue as was flagged in AgentBrowser.

In handleBrowserDisconnected(), when scope === 'thread' and a specific thread disconnects, the code sets this.status = 'closed' (line 392). This is incorrect for thread isolation - other threads may still have active browsers. The AgentBrowser implementation correctly avoids setting global status for thread disconnects.

🐛 Fix: Don't set global status for thread disconnect
     if (scope === 'thread' && threadId !== DEFAULT_THREAD_ID) {
       // Only clear the specific thread's session - other threads have independent browsers
       this.threadManager.clearSession(threadId);
       this.logger.debug?.(`Cleared Stagehand session for thread: ${threadId}`);
-      // Update status and notify only this thread's callbacks
-      if (this.status !== 'closed') {
-        this.status = 'closed';
-        this.notifyBrowserClosed(threadId);
-      }
+      // Notify only this thread's callbacks - do NOT set global status to 'closed'
+      // since other threads may still have active browsers
+      this.notifyBrowserClosed(threadId);
     } else {
🤖 Prompt for AI Agents
@NikAiyer	Reply...
browser/stagehand/src/stagehand-browser.ts
Comment on lines +460 to +468
  private requireStagehand(): Stagehand {
    const threadId = this.getCurrentThread();
    const stagehand = this.threadManager.getStagehandForThread(threadId ?? '') ?? this.stagehand;

    if (!stagehand) {
      throw new Error('Browser not launched');
    }
    return stagehand;
  }
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

requireStagehand() doesn't respect explicit threadId.

The method always uses getCurrentThread() to determine which Stagehand instance to use. Callers like act(), extract(), and observe() receive a threadId parameter but call requireStagehand() which ignores it. This could cause cross-thread operations in concurrent scenarios.

🐛 Fix: Accept threadId parameter
-  private requireStagehand(): Stagehand {
-    const threadId = this.getCurrentThread();
+  private requireStagehand(threadId?: string): Stagehand {
+    const effectiveThreadId = threadId ?? this.getCurrentThread();
-    const stagehand = this.threadManager.getStagehandForThread(threadId ?? '') ?? this.stagehand;
+    const stagehand = this.threadManager.getStagehandForThread(effectiveThreadId ?? '') ?? this.stagehand;

     if (!stagehand) {
       throw new Error('Browser not launched');
     }
     return stagehand;
   }
Then update callers:

   async act(input: ActInput, threadId?: string): Promise<...> {
-    const stagehand = this.requireStagehand();
+    const stagehand = this.requireStagehand(threadId);
Apply same pattern to extract() and observe().

🤖 Prompt for AI Agents
@NikAiyer	Reply...
browser/stagehand/src/stagehand-browser.ts
Comment on lines +751 to +763
          const newPage = await context.newPage(input.url);
          // newPage automatically becomes active in Stagehand
          await this.reconnectScreencast('new tab via tool');
          // Save state after new tab
          this.updateSessionBrowserState();
          return {
            success: true,
            index: context.pages().length - 1,
            url: newPage.url(),
            title: await newPage.title(),
            hint: 'New tab opened. Use stagehand_observe to discover actions.',
          };
        }
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

Missing threadId propagation in tabs() 'new' action - similar to AgentBrowser.

The reconnectScreencast() call at line 753 uses getCurrentThread() internally, but updateSessionBrowserState() at line 755 also uses the implicit current thread. Since tabs() receives an explicit threadId, it should be passed through.

🐛 Fix: Pass threadId consistently
         case 'new': {
           const newPage = await context.newPage(input.url);
-          await this.reconnectScreencast('new tab via tool');
+          await this.reconnectScreencastForThread(effectiveThreadId, 'new tab via tool');
           // Save state after new tab
-          this.updateSessionBrowserState();
+          this.updateSessionBrowserState(effectiveThreadId);
🤖 Prompt for AI Agents
@NikAiyer	Reply...
browser/stagehand/src/stagehand-browser.ts
          const targetPage = pages[input.index]!;
          const targetUrl = targetPage.url();
          context.setActivePage(targetPage);
          await this.reconnectScreencast('tab switch via tool');
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

tabs() 'switch' and 'close' actions also need threadId propagation.

Similar to the 'new' action, reconnectScreencast() and updateSessionBrowserState() calls should use effectiveThreadId instead of relying on implicit current thread.

🐛 Fix: Use effectiveThreadId consistently
         case 'switch': {
           ...
-          await this.reconnectScreencast('tab switch via tool');
+          await this.reconnectScreencastForThread(effectiveThreadId, 'tab switch via tool');
           ...
-          this.updateSessionBrowserState();
+          this.updateSessionBrowserState(effectiveThreadId);
           ...
         }
         case 'close': {
           ...
-          await this.reconnectScreencast('tab close via tool');
+          await this.reconnectScreencastForThread(effectiveThreadId, 'tab close via tool');
-          this.updateSessionBrowserState();
+          this.updateSessionBrowserState(effectiveThreadId);
           ...
         }
Also applies to: 792-792, 814-814, 816-816

🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/core/src/browser/screencast/screencast-stream.ts
Comment on lines +242 to +248
    try {
      await this.start();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[ScreencastStream.reconnect] Failed to reconnect:', err);
      this.emit('error', err);
      throw err;
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

Don't emit the same reconnect failure twice.

start() already emits 'error' before it rejects. Re-emitting in reconnect() means listeners process the same failure twice.

🔁 Suggested fix
     try {
       await this.start();
     } catch (error) {
       const err = error instanceof Error ? error : new Error(String(error));
       console.error('[ScreencastStream.reconnect] Failed to reconnect:', err);
-      this.emit('error', err);
       throw err;
     }
🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx
Comment on lines 89 to +102
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || 'overview';
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'overview';
    // Validate stored tab is still valid
    if (stored === 'browser') return 'overview'; // browser tab removed
    return stored;
  });

  const handleTabChange = (value: string) => {
  // Compute effective tab - handle unavailable tabs
  const effectiveTab = (() => {
    if (selectedTab === 'memory' && !isMemoryLoading && !hasMemory) {
      return 'overview';
    }
    return selectedTab;
  })();
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

Whitelist persisted tab values before controlling <Tabs>.

Lines 90-102 only special-case 'browser' and unavailable 'memory'. If sessionStorage still contains 'request-context' for an agent without a schema—or any other stale key—the controlled tabs get an invalid value and render with no matching content selected until the user clicks another tab. Normalize unknown/unavailable values back to 'overview' here too.

🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx
Comment on lines +120 to +179
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-8',
        'bg-black/60 backdrop-blur-sm transition-opacity duration-200',
        isPanelOpen && isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'flex flex-col w-full max-w-5xl max-h-full',
          'bg-surface2 rounded-xl border border-border1 shadow-2xl overflow-hidden',
          'transition-transform duration-200',
          isPanelOpen && isVisible ? 'scale-100' : 'scale-95',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with URL bar and controls */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border1 shrink-0">
          <Globe className="h-4 w-4 text-neutral4 shrink-0" />
          <div className="flex-1 min-w-0 px-3 py-1.5 bg-surface3 rounded-md border border-border1">
            <span className={cn('text-sm truncate block', currentUrl ? 'text-neutral5' : 'text-neutral3 italic')}>
              {currentUrl || 'No URL'}
            </span>
          </div>
          <StatusBadge variant={statusConfig.variant} size="sm" withDot pulse={statusConfig.pulse}>
            {statusConfig.label}
          </StatusBadge>
          <div className="flex items-center gap-1 ml-2">
            <IconButton variant="ghost" size="sm" tooltip="Open in sidebar" onClick={handleOpenSidebar}>
              <PanelRight className="h-4 w-4" />
            </IconButton>
            <IconButton variant="ghost" size="sm" tooltip="Minimize to chat" onClick={handleMinimize}>
              <Minimize2 className="h-4 w-4" />
            </IconButton>
            {currentUrl && (
              <IconButton variant="ghost" size="sm" tooltip="Open in new tab" onClick={handleOpenExternal}>
                <ExternalLink className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton variant="ghost" size="sm" tooltip="Close browser" onClick={handleClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Screencast */}
          <div className="p-4">
            <BrowserViewFrame className="w-full max-h-[60vh]" />
          </div>

          {/* Browser actions history */}
          <div className="px-4 pb-4">
            <BrowserToolCallHistory />
          </div>
        </div>
      </div>
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

Use a real modal dialog here.

Lines 120-179 render a fullscreen dialog with plain divs. There's no role="dialog" / aria-modal, no initial focus or focus restore, and the background page stays tabbable while the panel is open. This blocks keyboard and screen-reader flows; please switch to the shared dialog primitive or add full modal focus management.

🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/playground-ui/src/domains/agents/context/browser-session-context.tsx
Comment on lines +194 to +201
            setLatestFrameState(data);
          }
        } else {
          // Plain text is base64 frame data
          setLatestFrameState(data);
          // Ensure we're in streaming status when receiving frames
          setStatusState(prev => (prev !== 'streaming' ? 'streaming' : prev));
          setHasSession(true);
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

🧩 Analysis chain
Split high-frequency frame data from low-frequency session state to prevent consumer rerenders.

Lines 194-201 update latestFrame on every screencast frame, and lines 303-340 republish it through BrowserSessionContext.Provider alongside low-frequency fields like hasSession, viewMode, and status. When latestFrame changes (which is frequent), the entire context value object reference changes, forcing all consumers—including AgentInformation and Thread, which only need hasSession/viewMode—to rerender. Move frame data into a separate context or a ref-based store.

Also use useMutation from TanStack Query for the closeBrowser fetch call (lines 280-290) instead of raw fetch(), matching the established pattern in the codebase.

Context value structure (lines 303-340)
  const value = useMemo(
    () => ({
      hasSession,
      viewMode,
      isPanelOpen: viewMode === 'modal',
      isInSidebar: viewMode === 'sidebar',
      isActive: viewMode === 'modal',
      status,
      currentUrl,
      latestFrame,
      viewport,
      isClosing,
      setViewMode,
      show,
      hide,
      endSession,
      closeBrowser,
      sendMessage,
      connect,
      disconnect,
    }),
    [
      hasSession,
      viewMode,
      status,
      currentUrl,
      latestFrame,
      viewport,
      isClosing,
      setViewMode,
      show,
      hide,
      endSession,
      closeBrowser,
      sendMessage,
      connect,
      disconnect,
    ],
  );
🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/playground-ui/src/domains/agents/context/browser-session-context.tsx
Comment on lines +280 to +301
  const closeBrowser = useCallback(async () => {
    if (isClosing || !agentId) return;
    setIsClosing(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/browser/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to close browser: ${response.status}`);
      }
      // Only end session after successful API call
      endSession();
    } catch (error) {
      console.error('[BrowserSession] Error closing browser:', error);
      // Don't end session on failure - browser may still be running
    } finally {
      setIsClosing(false);
    }
  }, [agentId, threadId, isClosing, endSession]);
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
🛠️ Refactor suggestion | 🟠 Major

Move closeBrowser behind a TanStack Query mutation.

Line 285 issues a server mutation with raw fetch() from packages/playground-ui. That pushes loading/error/retry handling into this context and bypasses the package's server-state abstraction. Please expose this via a mutation hook instead.

As per coding guidelines, "Use TanStack Query for all server state management in packages/playground-ui".

🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/playground-ui/src/domains/agents/context/browser-session-context.tsx
Comment on lines +303 to +310
  const value = useMemo(
    () => ({
      hasSession,
      viewMode,
      isPanelOpen: viewMode === 'modal',
      isInSidebar: viewMode === 'sidebar',
      isActive: viewMode === 'modal', // backward compat
      status,
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

Keep isActive aligned with session activity.

Line 309 maps the deprecated compatibility field to modal visibility instead of browser-session state. Existing consumers still reading isActive will flip to false as soon as the view is collapsed, expanded inline, or moved to the sidebar even though the browser session is still active.

♻️ Suggested fix
-      isActive: viewMode === 'modal', // backward compat
+      isActive: hasSession, // backward compat
📝 Committable suggestion
🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/server/src/server/browser-stream/input-handler.ts
Comment on lines +104 to +123
  switch (message.type) {
    case 'mouse':
      void injectMouse(toolset, message, threadId).catch(err => {
        if (isDisconnectionError(err)) {
          notifyBrowserClosed(toolset, threadId);
        } else if (!isExpectedInjectionError(err)) {
          console.warn('[InputHandler] Mouse injection error:', err);
        }
      });
      break;
    case 'keyboard':
      void injectKeyboard(toolset, message, threadId).catch(err => {
        if (isDisconnectionError(err)) {
          notifyBrowserClosed(toolset, threadId);
        } else if (!isExpectedInjectionError(err)) {
          console.warn('[InputHandler] Keyboard injection error:', err);
        }
      });
      break;
  }
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟠 Major

Serialize browser input dispatch instead of firing it off concurrently.

These void ...catch() calls allow multiple injections to run at once. Input ordering matters, so a fast keydown/keyup, drag, or wheel sequence can overtake itself when one dispatch spends longer resolving the page/CDP session than the next.

🤖 Prompt for AI Agents
@NikAiyer	Reply...
packages/server/src/server/browser-stream/input-handler.ts
Comment on lines +232 to +245
function isValidInputMessage(msg: unknown): msg is ClientInputMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  const typed = msg as Record<string, unknown>;

  if (typed.type === 'mouse') {
    return typeof typed.eventType === 'string' && typeof typed.x === 'number' && typeof typed.y === 'number';
  }

  if (typed.type === 'keyboard') {
    return typeof typed.eventType === 'string';
  }
Contributor
@coderabbitai
coderabbitai bot
1 minute ago
⚠️ Potential issue | 🟡 Minor

Tighten the runtime validation before forwarding to CDP.

The guard currently accepts any string eventType, and keyboard payloads do not validate key, code, text, or modifiers at all. Invalid client messages will only fail later as injection-time errors instead of being rejected at the boundary.

🤖 Prompt for AI Agents
