import { useEffect } from 'react'
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'
import type { ApiEntry as Entry } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import styles from './styles.module.css'
import useApiHash from './useApiHash'

function ownsAnchor(entry: Entry, hash: string | undefined): boolean {
  return (
    entry.id === hash ||
    `${entry.id}-panel` === hash ||
    Boolean(entry.nested?.some(item => !('target' in item) && ownsAnchor(item, hash)))
  )
}

export default function ApiOverloads({ entries }: { entries: Entry[] }) {
  const hash = useApiHash()
  const selected = entries.find(entry => ownsAnchor(entry, hash)) ?? entries[0]

  useEffect(() => {
    if (hash && selected && (hash === selected.id || hash === `${selected.id}-panel`)) {
      document.getElementById(`${selected.id}-panel`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [hash, selected])

  if (hash === undefined)
    return (
      <>
        {entries.map(entry => (
          <ApiEntry key={entry.id} entry={entry} />
        ))}
      </>
    )

  return (
    <div className={styles.overloads} role="group" aria-label="Method overloads">
      <Tabs key={selected?.id} defaultValue={selected?.id} lazy={false}>
        {entries.map(entry => (
          <TabItem key={entry.id} value={entry.id} label={entry.name}>
            <ApiEntry entry={entry} hideHeading />
          </TabItem>
        ))}
      </Tabs>
    </div>
  )
}
