# react-resizable-panels

React components for resizable panel groups/layouts

```jsx
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

<PanelGroup autoSaveId="example" direction="horizontal">
  <Panel defaultSize={25}>
    <SourcesExplorer />
  </Panel>
  <PanelResizeHandle />
  <Panel>
    <SourceViewer />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={25}>
    <Console />
  </Panel>
</PanelGroup>;
```

## If you like this project, 🎉 [become a sponsor](https://github.com/sponsors/bvaughn/) or ☕ [buy me a coffee](http://givebrian.coffee/)

## Props

### `PanelGroup`

| prop         | type                         | description                                                      |
| :----------- | :--------------------------- | :--------------------------------------------------------------- |
| `autoSaveId` | `?string`                    | Unique id used to auto-save group arrangement via `localStorage` |
| `children`   | `ReactNode`                  | Arbitrary React element(s)                                       |
| `className`  | `?string`                    | Class name to attach to root element                             |
| `direction`  | `"horizontal" \| "vertical"` | Group orientation                                                |
| `id`         | `?string`                    | Group id; falls back to `useId` when not provided                |
| `onLayout`   | `?(sizes: number[]) => void` | Called when group layout changes                                 |
| `storage`    | `?PanelGroupStorage`         | Custom storage API; defaults to `localStorage` <sup>1</sup>      |
| `style`      | `?CSSProperties`             | CSS style to attach to root element                              |
| `tagName`    | `?string = "div"`            | HTML element tag name for root element                           |

<sup>1</sup>: Storage API must define the following _synchronous_ methods:

- `getItem: (name:string) => string`
- `setItem: (name: string, value: string) => void`

`PanelGroup` components also expose an imperative API for manual resizing:
| method                        | description                                                      |
| :---------------------------- | :--------------------------------------------------------------- |
| `getId(): string`             | Gets the panel group's ID.                                       |
| `getLayout(): number[]`       | Gets the panel group's current _layout_ (`[1 - 100, ...]`).      |
| `setLayout(layout: number[])` | Resize panel group to the specified _layout_ (`[1 - 100, ...]`). |

### `Panel`

| prop            | type                      | description                                                                                   |
| :-------------- | :------------------------ | :-------------------------------------------------------------------------------------------- |
| `children`      | `ReactNode`               | Arbitrary React element(s)                                                                    |
| `className`     | `?string`                 | Class name to attach to root element                                                          |
| `collapsedSize` | `?number=0`               | Panel should collapse to this size                                                            |
| `collapsible`   | `?boolean=false`          | Panel should collapse when resized beyond its `minSize`                                       |
| `defaultSize`   | `?number`                 | Initial size of panel (numeric value between 1-100)                                           |
| `id`            | `?string`                 | Panel id (unique within group); falls back to `useId` when not provided                       |
| `maxSize`       | `?number = 100`           | Maximum allowable size of panel (numeric value between 1-100); defaults to `100`              |
| `minSize`       | `?number = 10`            | Minimum allowable size of panel (numeric value between 1-100); defaults to `10`               |
| `onCollapse`    | `?() => void`             | Called when panel is collapsed                                                                |
| `onExpand`      | `?() => void`             | Called when panel is expanded                                                                 |
| `onResize`      | `?(size: number) => void` | Called when panel is resized; `size` parameter is a numeric value between 1-100. <sup>1</sup> |
| `order`         | `?number`                 | Order of panel within group; required for groups with conditionally rendered panels           |
| `style`         | `?CSSProperties`          | CSS style to attach to root element                                                           |
| `tagName`       | `?string = "div"`         | HTML element tag name for root element                                                        |

<sup>1</sup>: If any `Panel` has an `onResize` callback, the `order` prop should be provided for all `Panel`s.

`Panel` components also expose an imperative API for manual resizing:
| method                   | description                                                                        |
| :----------------------- | :--------------------------------------------------------------------------------- |
| `collapse()`             | If panel is `collapsible`, collapse it fully.                                      |
| `expand()`               | If panel is currently _collapsed_, expand it to its most recent size.              |
| `getId(): string`        | Gets the ID of the panel.                                                          |
| `getSize(): number`      | Gets the current size of the panel as a percentage (`1 - 100`).                    |
| `isCollapsed(): boolean` | Returns `true` if the panel is currently _collapsed_ (`size === 0`).               |
| `isExpanded(): boolean`  | Returns `true` if the panel is currently _not collapsed_ (`!isCollapsed()`).       |
| `getSize(): number`      | Returns the most recently committed size of the panel as a percentage (`1 - 100`). |
| `resize(size: number)`   | Resize panel to the specified _percentage_ (`1 - 100`).                            |

### `PanelResizeHandle`

| prop             | type                                          | description                                                                     |
| :--------------- | :-------------------------------------------- | :------------------------------------------------------------------------------ |
| `children`       | `?ReactNode`                                  | Custom drag UI; can be any arbitrary React element(s)                           |
| `className`      | `?string`                                     | Class name to attach to root element                                            |
| `hitAreaMargins` | `?{ coarse: number = 15; fine: number = 5; }` | Allow this much margin when determining resizable handle hit detection          |
| `disabled`       | `?boolean`                                    | Disable drag handle                                                             |
| `id`             | `?string`                                     | Resize handle id (unique within group); falls back to `useId` when not provided |
| `onDragging`     | `?(isDragging: boolean) => void`              | Called when group layout changes                                                |
| `style`          | `?CSSProperties`                              | CSS style to attach to root element                                             |
| `tagName`        | `?string = "div"`                             | HTML element tag name for root element                                          |

---

## FAQ

### Can panel sizes be specified in pixels?

No. Pixel-based constraints [added significant complexity](https://github.com/bvaughn/react-resizable-panels/pull/176) to the initialization and validation logic and so I've decided not to support them. You may be able to implement a version of this yourself following [a pattern like this](https://github.com/bvaughn/react-resizable-panels/issues/46#issuecomment-1368108416) but it is not officially supported by this library.

### How can I fix layout/sizing problems with conditionally rendered panels?

The `Panel` API doesn't _require_ `id` and `order` props because they aren't necessary for static layouts. When panels are conditionally rendered though, it's best to supply these values.

```tsx
<PanelGroup direction="horizontal">
  {renderSideBar && (
    <>
      <Panel id="sidebar" minSize={25} order={1}>
        <Sidebar />
      </Panel>
      <PanelResizeHandle />
    </>
  )}
  <Panel minSize={25} order={2}>
    <Main />
  </Panel>
</PanelGroup>
```

### Can a attach a ref to the DOM elements?

No. I think exposing two refs (one for the component's imperative API and one for a DOM element) would be awkward. This library does export several utility methods for accessing the underlying DOM elements though. For example:

```tsx
import {
  getPanelElement,
  getPanelGroupElement,
  getResizeHandleElement,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

export function Example() {
  const refs = useRef();

  useEffect(() => {
    const groupElement = getPanelGroupElement("group");
    const leftPanelElement = getPanelElement("left-panel");
    const rightPanelElement = getPanelElement("right-panel");
    const resizeHandleElement = getResizeHandleElement("resize-handle");

    // If you want to, you can store them in a ref to pass around
    refs.current = {
      groupElement,
      leftPanelElement,
      rightPanelElement,
      resizeHandleElement,
    };
  }, []);

  return (
    <PanelGroup direction="horizontal" id="group">
      <Panel id="left-panel">{/* ... */}</Panel>
      <PanelResizeHandle id="resize-handle" />
      <Panel id="right-panel">{/* ... */}</Panel>
    </PanelGroup>
  );
}
```

### Why don't I see any resize UI?

This likely means that you haven't applied any CSS to style the resize handles. By default, a resize handle is just an empty DOM element. To add styling, use the `className` or `style` props:

```tsx
// Tailwind example
<PanelResizeHandle className="w-2 bg-blue-800" />
```

### Can panel sizes be persistent?

Yes. Panel groups with an `autoSaveId` prop will automatically save and restore their layouts on mount.

### How can I use persistent layouts with SSR?

By default, this library uses `localStorage` to persist layouts. With server rendering, this can cause a flicker when the default layout (rendered on the server) is replaced with the persisted layout (in `localStorage`). The way to avoid this flicker is to also persist the layout with a cookie like so:

#### Server component

```tsx
import ResizablePanels from "@/app/ResizablePanels";
import { cookies } from "next/headers";

export function ServerComponent() {
  const layout = cookies().get("react-resizable-panels:layout");

  let defaultLayout;
  if (layout) {
    defaultLayout = JSON.parse(layout.value);
  }

  return <ClientComponent defaultLayout={defaultLayout} />;
}
```

#### Client component

```tsx
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export function ClientComponent({
  defaultLayout = [33, 67],
}: {
  defaultLayout: number[] | undefined;
}) {
  const onLayout = (sizes: number[]) => {
    document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
  };

  return (
    <PanelGroup direction="horizontal" onLayout={onLayout}>
      <Panel defaultSize={defaultLayout[0]}>{/* ... */}</Panel>
      <PanelResizeHandle className="w-2 bg-blue-800" />
      <Panel defaultSize={defaultLayout[1]}>{/* ... */}</Panel>
    </PanelGroup>
  );
}
```

> [!NOTE]
> Be sure to specify a `defaultSize` prop for **every** `Panel` component to avoid layout flicker.

A demo of this is available [here](https://github.com/bvaughn/react-resizable-panels-demo-ssr).

#### How can I set the [CSP `"nonce"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce) attribute?

```js
import { setNonce } from "react-resizable-panels";

setNonce("your-nonce-value-here");
```

#### How can I disable global cursor styles?

```js
import { disableGlobalCursorStyles } from "react-resizable-panels";

disableGlobalCursorStyles();
```
