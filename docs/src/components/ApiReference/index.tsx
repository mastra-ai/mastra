import { useEffect } from 'react'
import type { ApiSurface } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import ApiOverloads from './ApiOverloads'
import ApiDefinitions from './ApiDefinitions'
import styles from './styles.module.css'
import useApiHash from './useApiHash'

export default function ApiReference({ data }: { data: ApiSurface }) {
  const hash = useApiHash()
  useEffect(() => {
    let frame = 0
    function reveal() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = document.getElementById(window.location.hash.slice(1))
        if (!target || !document.querySelector(`[data-api-surface="${data.id}"]`)?.contains(target)) return
        let ancestor = target.parentElement
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
          if (ancestor.matches('[role="tabpanel"][hidden]') && ancestor.closest('[data-api-parameter-overloads]')) {
            const index = Array.from(ancestor.parentElement?.children ?? []).indexOf(ancestor)
            const tab =
              ancestor.parentElement?.previousElementSibling?.querySelectorAll<HTMLElement>('[role="tab"]')[index]
            if (tab) {
              tab.click()
              reveal()
              return
            }
          }
          ancestor = ancestor.parentElement
        }
        const scrollTarget = target.matches('[data-api-definition]')
          ? (target.closest('[data-api-parameter-overloads]') ?? target)
          : target
        scrollTarget.scrollIntoView({ block: 'start' })
      })
    }
    function revealRepeatedLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = event.target instanceof Element ? event.target.closest('a') : undefined
      if (link instanceof HTMLAnchorElement && link.href === window.location.href) reveal()
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    window.addEventListener('click', revealRepeatedLink)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', reveal)
      window.removeEventListener('click', revealRepeatedLink)
    }
  }, [data.id, hash])
  return (
    <section
      className={styles.surface}
      data-api-reference
      data-api-surface={data.id}
      data-api-section={data.section}
      aria-label={data.title}
    >
      {!data.externalHeading && <h2 id={data.id}>{data.title}</h2>}
      <div className={styles.entries}>
        {data.section !== 'properties' ? (
          <ApiOverloads entries={data.entries} />
        ) : (
          data.entries.map(entry => <ApiEntry entry={entry} key={entry.id} />)
        )}
      </div>
      {data.appendix && (
        <p>
          <a href={data.appendix.href}>{data.appendix.title}</a>: complete definitions for the types linked from this
          method.
        </p>
      )}
      {Boolean(data.definitions?.length) && (
        <section aria-label={`${data.title} type definitions`}>
          <h3>Type definitions</h3>
          <ApiDefinitions entries={data.entries} definitions={data.definitions ?? []} />
        </section>
      )}
    </section>
  )
}
