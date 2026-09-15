/**
 * Swizzled Tabs component that removes the `key={String(isBrowser)}` workaround
 * from upstream Docusaurus. The upstream hack forces a full re-mount after
 * hydration (see https://github.com/facebook/docusaurus/issues/5653), which
 * causes content churn that search engines penalize. Since our tabs use static
 * default values (npm2yarn with groupId sync), the workaround is unnecessary.
 */
import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import { ThemeClassNames } from '@docusaurus/theme-common'
import {
  useScrollPositionBlocker,
  useTabs,
  useTabsContextValue,
  sanitizeTabsChildren,
  TabsProvider,
} from '@docusaurus/theme-common/internal'
import type { Props } from '@theme/Tabs'
import styles from './styles.module.css'

function TabList({ className }: Props) {
  const { selectedValue, selectValue, tabValues, block } = useTabs()
  const tabRefs: (HTMLLIElement | null)[] = []
  const { blockElementScrollPositionUntilNextRender } = useScrollPositionBlocker()

  const handleTabChange = (
    event: React.FocusEvent<HTMLLIElement> | React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>,
  ) => {
    const newTab = event.currentTarget
    const newTabIndex = tabRefs.indexOf(newTab)
    const newTabValue = tabValues[newTabIndex]!.value

    if (newTabValue !== selectedValue) {
      blockElementScrollPositionUntilNextRender(newTab)
      selectValue(newTabValue)
    }
  }

  const handleKeydown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    let focusElement: HTMLLIElement | null = null

    switch (event.key) {
      case 'Enter': {
        handleTabChange(event)
        break
      }
      case 'ArrowRight': {
        const nextTab = tabRefs.indexOf(event.currentTarget) + 1
        focusElement = tabRefs[nextTab] ?? tabRefs[0]!
        break
      }
      case 'ArrowLeft': {
        const prevTab = tabRefs.indexOf(event.currentTarget) - 1
        focusElement = tabRefs[prevTab] ?? tabRefs[tabRefs.length - 1]!
        break
      }
      default:
        break
    }

    focusElement?.focus()
  }

  return (
    <ul
      role="tablist"
      aria-orientation="horizontal"
      className={clsx(
        'tabs',
        {
          'tabs--block': block,
        },
        className,
      )}
    >
      {tabValues.map(({ value, label, attributes }) => (
        <li
          role="tab"
          tabIndex={selectedValue === value ? 0 : -1}
          aria-selected={selectedValue === value}
          key={value}
          ref={tabControl => {
            tabRefs.push(tabControl)
          }}
          onKeyDown={handleKeydown}
          onClick={handleTabChange}
          {...attributes}
          className={clsx('tabs__item', styles.tabItem, attributes?.className as string, {
            'tabs__item--active': selectedValue === value,
          })}
        >
          {label ?? value}
        </li>
      ))}
    </ul>
  )
}

function TabContent({ children }: Props) {
  return <div className="margin-top--md">{children}</div>
}

function TabsContainer({ className, children }: Props) {
  return (
    <div
      className={clsx(
        ThemeClassNames.tabs.container,
        // former name kept for backward compatibility
        // see https://github.com/facebook/docusaurus/pull/4086
        'tabs-container',
        styles.tabList,
      )}
    >
      <TabList className={className} />
      <TabContent>{children}</TabContent>
    </div>
  )
}

export default function Tabs(props: Props): ReactNode {
  const value = useTabsContextValue(props)
  return (
    <TabsProvider value={value}>
      <TabsContainer className={props.className}>{sanitizeTabsChildren(props.children)}</TabsContainer>
    </TabsProvider>
  )
}
