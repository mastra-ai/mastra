import { Badge } from '@/ds/components/Badge';
import { Row, Th, Thead, Tbody, Table, Cell, DateTimeCell, TxtCell } from '@/ds/components/Table';

export interface ScoreTableProps {
  scores: Array<{
    type: string;
    scoreId: string;
    scorerName: string;
    score: number;
    createdAt: string;
  }>;
  onItemClick: (scorerName: string) => void;
}

export const ScoreTable = ({ scores, onItemClick }: ScoreTableProps) => {
  return (
    <Table>
      <Thead>
        <Th>Type</Th>
        <Th>Scorer</Th>
        <Th>Score</Th>
        <Th>Created At</Th>
      </Thead>
      <Tbody>
        {scores.map(score => (
          <Row key={score.scoreId} onClick={() => onItemClick(score.scorerName)}>
            <TxtCell>
              <Badge>{score.type}</Badge>
            </TxtCell>
            <TxtCell>{score.scorerName}</TxtCell>
            <TxtCell>{score.score}</TxtCell>
            <DateTimeCell dateTime={new Date(score.createdAt)} />
          </Row>
        ))}
      </Tbody>
    </Table>
  );
};
