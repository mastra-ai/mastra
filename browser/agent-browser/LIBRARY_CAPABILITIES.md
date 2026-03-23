# agent-browser Library Capabilities Analysis

This document analyzes what the `agent-browser` npm package exposes as a library vs what's only available via CLI.

## BrowserManager Methods (Library API)

Based on `node_modules/agent-browser/dist/browser.d.ts`:

### ✅ Available via Library

#### Browser Lifecycle

- `launch(options)` - Launch browser
- `close()` - Close browser
- `isLaunched()` - Check if launched

#### Page Access

- `getPage()` - Get current Playwright Page
- `getPages()` - Get all pages
- `getActiveIndex()` - Get current page index
- `getBrowser()` - Get raw Browser instance
- `getFrame()` - Get current frame
- `getLocator(selector)` - Get locator (supports refs and selectors)
- `getLocatorFromRef(ref)` - Get locator from @e1 style ref
- `isRef(selector)` - Check if selector is a ref

#### Snapshots

- `getSnapshot(options)` - Get accessibility snapshot with refs
- `getRefMap()` - Get cached ref map from last snapshot

#### Tab Management

- `newTab()` - Create new tab → returns `{ index, total }`
- `newWindow(viewport?)` - Create new window
- `switchTo(index)` - Switch to tab by index → returns `{ index, url, title }`
- `closeTab(index?)` - Close tab → returns `{ closed, remaining }`
- `listTabs()` - List all tabs → returns `[{ index, url, title, active }]`

#### Frame Management

- `switchToFrame(options)` - Switch to frame by selector/name/URL
- `switchToMainFrame()` - Switch back to main frame

#### Dialogs

- `setDialogHandler(response, promptText?)` - Set dialog handler ('accept' | 'dismiss')
- `clearDialogHandler()` - Clear dialog handler

#### Network

- `startRequestTracking()` - Start tracking requests
- `getRequests(filter?)` - Get tracked requests
- `clearRequests()` - Clear tracked requests
- `addRoute(url, options)` - Intercept requests (mock responses, abort)
- `removeRoute(url?)` - Remove route
- `setOffline(offline)` - Toggle offline mode
- `setExtraHeaders(headers)` - Set global HTTP headers
- `setScopedHeaders(origin, headers)` - Set headers for specific origin
- `clearScopedHeaders(origin?)` - Clear scoped headers

#### Viewport & Device

- `setViewport(width, height)` - Set viewport size
- `setDeviceScaleFactor(factor, width, height, mobile?)` - Set device pixel ratio
- `clearDeviceMetricsOverride()` - Clear device metrics
- `getDevice(deviceName)` - Get device descriptor
- `listDevices()` - List available devices

#### Geolocation & Permissions

- `setGeolocation(lat, lng, accuracy?)` - Set geolocation
- `setPermissions(permissions, grant)` - Set permissions

#### Console & Errors

- `startConsoleTracking()` - Start tracking console messages
- `getConsoleMessages()` - Get console messages
- `clearConsoleMessages()` - Clear console messages
- `startErrorTracking()` - Start tracking page errors
- `getPageErrors()` - Get page errors
- `clearPageErrors()` - Clear page errors

#### Recording

- `isRecording()` - Check if recording
- `startRecording(outputPath, url?)` - Start video recording (WebM)
- `stopRecording()` - Stop recording → returns `{ path, frames, error? }`
- `restartRecording(outputPath, url?)` - Restart recording

#### Tracing

- `startTracing(options)` - Start Playwright tracing
- `stopTracing(path)` - Stop and save trace

#### HAR

- `startHarRecording()` - Start HAR recording
- `isHarRecording()` - Check if recording HAR

#### Storage

- `saveStorageState(path)` - Save cookies/localStorage to file

#### Screencast (for live view)

- `isScreencasting()` - Check if screencasting
- `startScreencast(callback, options)` - Start viewport streaming
- `stopScreencast()` - Stop screencast

#### CDP (Chrome DevTools Protocol)

- `getCDPSession()` - Get CDP session for advanced operations
- `injectMouseEvent(params)` - Inject mouse events via CDP
- `injectKeyboardEvent(params)` - Inject keyboard events via CDP
- `injectTouchEvent(params)` - Inject touch events via CDP

### Playwright Page Methods (via getPage())

Since `getPage()` returns a Playwright `Page`, we have access to:

- `page.goto(url)` - Navigate
- `page.goBack()` / `page.goForward()` / `page.reload()` - Navigation history
- `page.url()` / `page.title()` - Page info
- `page.content()` - Get full HTML
- `page.screenshot()` - Screenshot
- `page.evaluate(fn)` - Execute JavaScript
- `page.viewportSize()` / `page.setViewportSize()` - Viewport
- `page.keyboard` - Keyboard API (type, press, down, up, insertText)
- `page.context()` - Get context for cookies
- `page.waitForTimeout()` - Wait

### Playwright Locator Methods (via getLocator/getLocatorFromRef)

- `locator.click()` / `locator.dblclick()` - Click
- `locator.fill()` / `locator.type()` - Text input
- `locator.focus()` / `locator.hover()` - Focus/hover
- `locator.check()` / `locator.uncheck()` / `locator.isChecked()` - Checkboxes
- `locator.selectOption()` - Dropdowns
- `locator.inputValue()` - Get input value
- `locator.textContent()` / `locator.innerText()` - Get text
- `locator.getAttribute(name)` - Get attribute
- `locator.boundingBox()` - Get bounding box
- `locator.screenshot()` - Element screenshot
- `locator.scrollIntoViewIfNeeded()` - Scroll into view
- `locator.dragTo(target)` - Drag and drop
- `locator.waitFor(options)` - Wait for state
- `locator.evaluate(fn)` - Evaluate on element
- `locator.isVisible()` / `locator.isEnabled()` / `locator.isEditable()` - State checks
- `locator.count()` - Count matching elements

### Context Methods (via page.context())

- `context.cookies(urls?)` - Get cookies
- `context.addCookies(cookies)` - Add cookies
- `context.clearCookies()` - Clear cookies
- `context.storageState()` - Get storage state

---

## ❌ NOT Available via Library (CLI-only features)

Based on comparing CLI commands to library exports:

### Profiler (Chrome DevTools Profiler)

- `profiler start` / `profiler stop` - These use CDP directly in the CLI
- **Workaround**: Use `getCDPSession()` and send CDP commands manually

### Clipboard

- `clipboard copy` / `clipboard paste` - Not exposed
- **Workaround**: Use `page.evaluate()` with clipboard API

### Annotated Screenshots

- `screenshot --annotate` - Adds numbered labels to elements
- **Workaround**: Would need custom implementation

### iOS Provider

- `-p ios` commands (tap, swipe) - Appium integration is CLI-only

### Other Providers

- Browserbase, Kernel, BrowserUse connections are in the library but require env vars

---

## Summary: What We Can Implement

### Already Implemented ✅

- navigate, click, double-click, type, fill, select, check, scroll, screenshot, snapshot, close
- hover, focus, drag, press, keyboard (type, insertText, keyDown, keyUp)
- get-text, get-value, get-attribute, evaluate, scroll-into-view
- go-back, go-forward, reload
- set-viewport, get/set/clear cookies
- set-device, set-media, wait, batch, highlight, inspect

### Should Add (Easy - Library supports) 🟡

1. **uncheck** - `locator.uncheck()` ✅ Already in BrowserLocator interface
2. **get-title** - `page.title()`
3. **get-url** - `page.url()`
4. **get-count** - `locator.count()`
5. **get-box** - `locator.boundingBox()`
6. **is-visible** - `locator.isVisible()`
7. **is-enabled** - `locator.isEnabled()`
8. **is-checked** - `locator.isChecked()` ✅ Already in BrowserLocator interface
9. **frame-switch** - `switchToFrame()` / `switchToMainFrame()`
10. **dialog-handle** - `setDialogHandler()` / `clearDialogHandler()`
11. **set-geolocation** - `setGeolocation()`
12. **set-offline** - `setOffline()`
13. **set-headers** - `setExtraHeaders()` / `setScopedHeaders()`
14. **storage-local** - `page.evaluate()` with localStorage API
15. **network-tracking** - `startRequestTracking()` / `getRequests()`
16. **console-tracking** - `startConsoleTracking()` / `getConsoleMessages()`
17. **error-tracking** - `startErrorTracking()` / `getPageErrors()`
18. **tabs** - `listTabs()`, `newTab()`, `switchTo()`, `closeTab()`
19. **tracing** - `startTracing()` / `stopTracing()`
20. **recording** - `startRecording()` / `stopRecording()` ✅ IS available!

### Needs CDP Workaround (Medium effort) 🟠

1. **profiler** - Use `getCDPSession().send('Profiler.start')` etc.
2. **clipboard** - Use `page.evaluate()` with Clipboard API

### Not Feasible / Out of Scope ❌

1. **iOS provider** - Requires Appium, different architecture
2. **Annotated screenshots** - Custom rendering needed
3. **Other cloud providers** - Would need separate integration work
