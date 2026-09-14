import type { ApiEntry } from '../../api-reference/presentation'
import ApiComment from './ApiComment'
import ApiDescription from './ApiDescription'
import ApiNested from './ApiNested'
import ApiSource from './ApiSource'

export default function ApiTypeParameters({ items }: { items: ApiEntry[] }) {
  return (
    <div data-api-generics>
      {items.map(item => (
        <section key={item.id} id={item.id} data-api-entry={item.id}>
          <header>
            <span>Type parameters: </span>
            <a href={`#${item.id}`}>
              <code>{item.label ?? item.name}</code>
            </a>
            {item.type && (
              <>
                {' '}
                extends{' '}
                <code>
                  <ApiComment nodes={item.typeContent ?? [{ kind: 'text', value: item.type }]} />
                </code>
              </>
            )}
            {item.defaultType && (
              <>
                {' '}
                = <code>{item.defaultType}</code>
              </>
            )}
            <ApiSource source={item.source} sourceUrl={item.sourceUrl} />
          </header>
          {item.path && (
            <span>
              Path: <code>{item.path}</code>
            </span>
          )}
          <ApiDescription entry={item} />
          {Boolean(item.nested?.length) && <ApiNested items={item.nested ?? []} depth={4} />}
        </section>
      ))}
    </div>
  )
}
