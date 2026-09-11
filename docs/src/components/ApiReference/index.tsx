import { useEffect } from 'react'
import type { ApiSurface } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import ApiOverloads from './ApiOverloads'
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
          ancestor = ancestor.parentElement
        }
        target.scrollIntoView({ block: 'start' })
      })
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', reveal)
    }
  }, [data.id, hash])
  return (
    <section className={styles.surface} data-api-reference data-api-surface={data.id} aria-label={data.title}>
      {!data.externalHeading && <h2 id={data.id}>{data.title}</h2>}
      <div className={styles.entries}>
        {data.section !== 'properties' ? (
          <ApiOverloads entries={data.entries} />
        ) : (
          data.entries.map(entry => <ApiEntry entry={entry} key={entry.id} />)
        )}
      </div>
    </section>
  )
}
