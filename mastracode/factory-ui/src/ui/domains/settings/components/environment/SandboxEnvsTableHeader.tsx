import { Table } from '@mastra/playground-ui/components/Table';
import { InfoTooltip } from '@mastra/playground-ui/components/Tooltip';

export function SandboxEnvsTableHeader() {
  return (
    <Table.Header>
      <Table.Row>
        <Table.Head>Name</Table.Head>
        <Table.Head>Value</Table.Head>
        <Table.Head>
          <span className="inline-flex items-center gap-1">
            Applies to
            <InfoTooltip aria-label="About where variables apply">
              Runtime: every command in the sandbox, from the next one on. Build: only the template image build and
              setup commands, never runtime commands.
            </InfoTooltip>
          </span>
        </Table.Head>
        <Table.Head>Updated</Table.Head>
        <Table.Head align="end">
          <span className="sr-only">Actions</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
  );
}
