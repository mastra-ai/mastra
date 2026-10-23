import { InlineCode } from '@/ds/components/InlineCode';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Txt } from '@/ds/components/Txt';

export type HelperExample = readonly [call: string, result: string | number | boolean | undefined];

export function HelperExamples({ examples }: { examples: readonly HelperExample[] }) {
  return (
    <div className="w-full max-w-2xl">
      <Table>
        <Thead>
          <Th>Call</Th>
          <Th>Result</Th>
        </Thead>
        <Tbody>
          {examples.map(([call, result]) => (
            <Row key={call}>
              <Cell>
                <InlineCode>{call}</InlineCode>
              </Cell>
              <Cell>
                <Txt font="mono">{result === undefined ? 'undefined' : String(result)}</Txt>
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
