import CodeBlock from '@theme/CodeBlock'
import type { ApiEntry as Entry } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import styles from './styles.module.css'

export interface ParameterDefinition {
  parameter: Entry
  entries: Entry[]
}

export default function ApiParameterDefinition({ definition }: { definition: ParameterDefinition }) {
  const { parameter, entries } = definition
  return (
    <section id={parameter.parameterDefinition?.id} data-api-definition={parameter.id}>
      <header className={styles.header}>
        <h4>
          <code>{parameter.label ?? parameter.name}</code>
        </h4>
        <span className={styles.metadata}>{parameter.parameterDefinition?.context}</span>
      </header>
      <CodeBlock language="typescript">{parameter.type ?? ''}</CodeBlock>
      {parameter.nested?.map(
        item =>
          'target' in item &&
          !entries.some(entry => item.target === `#${entry.id}`) && (
            <p key={item.target}>
              <a href={item.target}>{item.name}</a>
            </p>
          ),
      )}
      {entries.map(entry => (
        <ApiEntry key={entry.id} entry={entry} depth={5} />
      ))}
    </section>
  )
}
