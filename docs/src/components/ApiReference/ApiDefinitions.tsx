import type { ApiEntry as Entry, ApiItem } from '../../api-reference/presentation'
import ApiEntry from './ApiEntry'
import ApiParameterDefinitions from './ApiParameterDefinitions'

export default function ApiDefinitions({ entries, definitions }: { entries: Entry[]; definitions: Entry[] }) {
  const parameters: Entry[] = []
  function collect(items: ApiItem[]) {
    for (const item of items) {
      if ('target' in item) continue
      if (item.parameterDefinition) parameters.push(item)
      collect(item.nested ?? [])
    }
  }
  collect(entries)
  const available = new Set(definitions.map(entry => entry.id))
  const owners = new Map<string, Entry>()
  for (const parameter of parameters) {
    for (const item of parameter.nested ?? []) {
      if (
        'target' in item &&
        item.target.startsWith('#') &&
        available.has(item.target.slice(1)) &&
        !owners.has(item.target.slice(1))
      )
        owners.set(item.target.slice(1), parameter)
    }
  }
  const rendered = new Set<string>()
  return (
    <>
      {definitions.map(entry => {
        const parameter = owners.get(entry.id)
        if (!parameter?.parameterDefinition) return <ApiEntry key={entry.id} entry={entry} depth={4} />
        if (rendered.has(parameter.name)) return undefined
        rendered.add(parameter.name)
        const overloads = parameters
          .filter(candidate => candidate.name === parameter.name)
          .map(candidate => ({
            parameter: candidate,
            entries: definitions.filter(definition => owners.get(definition.id) === candidate),
          }))
          .filter(definition => definition.entries.length > 0)
        return <ApiParameterDefinitions key={parameter.id} definitions={overloads} />
      })}
    </>
  )
}
