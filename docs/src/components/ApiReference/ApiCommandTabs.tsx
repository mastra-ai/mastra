import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'
import type { CommentNode } from '../../api-reference/presentation'
import ApiComment from './ApiComment'

export default function ApiCommandTabs({
  items,
}: {
  items: { value: string; label: string; content: CommentNode[] }[]
}) {
  return (
    <Tabs>
      {items.map(item => (
        <TabItem key={item.value} value={item.value} label={item.label}>
          <ApiComment nodes={item.content} />
        </TabItem>
      ))}
    </Tabs>
  )
}
