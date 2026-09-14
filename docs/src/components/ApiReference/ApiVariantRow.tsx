import type { ApiEntry } from '../../api-reference/presentation'
import ApiDescription from './ApiDescription'
import ApiSource from './ApiSource'
import ApiVariantField from './ApiVariantField'

export default function ApiVariantRow({ variant }: { variant: ApiEntry }) {
  const discriminator = variant.nested?.find(
    (item): item is ApiEntry => !('target' in item) && item.id === variant.variantDiscriminator,
  )
  const fields = variant.nested?.filter(item => 'target' in item || item.id !== variant.variantDiscriminator) ?? []
  return (
    <tr data-api-entry={variant.id}>
      <th scope="row">
        <span id={variant.id} />
        <ApiSource source={variant.source} sourceUrl={variant.sourceUrl} />
        {discriminator ? (
          <ApiVariantField field={discriminator} discriminator />
        ) : (
          <a href={`#${variant.id}`}>
            <code>{variant.variantValue}</code>
          </a>
        )}
        <ApiDescription entry={variant} />
      </th>
      <td>
        {fields.map(field =>
          'target' in field ? (
            <p key={field.target}>
              <a href={field.target}>{field.name}</a>
            </p>
          ) : (
            <ApiVariantField key={field.id} field={field} />
          ),
        )}
      </td>
    </tr>
  )
}
