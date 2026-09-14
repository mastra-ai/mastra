import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'
import type { ApiItem } from '../../api-reference/presentation'
import ApiParameterDefinition from './ApiParameterDefinition'
import type { ParameterDefinition } from './ApiParameterDefinition'
import styles from './styles.module.css'
import useApiHash from './useApiHash'

function ownsAnchor(items: ApiItem[], hash: string): boolean {
  return items.some(item => !('target' in item) && (item.id === hash || ownsAnchor(item.nested ?? [], hash)))
}

export default function ApiParameterDefinitions({ definitions }: { definitions: ParameterDefinition[] }) {
  const hash = useApiHash()
  const selected =
    definitions.find(
      ({ parameter, entries }) => hash && (parameter.parameterDefinition?.id === hash || ownsAnchor(entries, hash)),
    ) ?? definitions[0]

  if (hash === undefined || definitions.length === 1)
    return definitions.map(definition => (
      <ApiParameterDefinition key={definition.parameter.id} definition={definition} />
    ))

  return (
    <div
      className={styles.overloads}
      role="group"
      aria-label={`${selected.parameter.name} overloads`}
      data-api-parameter-overloads
    >
      <Tabs key={selected.parameter.id} defaultValue={selected.parameter.id} lazy={false}>
        {definitions.map(definition => (
          <TabItem
            key={definition.parameter.id}
            value={definition.parameter.id}
            label={definition.parameter.parameterDefinition?.context}
          >
            <ApiParameterDefinition definition={definition} />
          </TabItem>
        ))}
      </Tabs>
    </div>
  )
}
