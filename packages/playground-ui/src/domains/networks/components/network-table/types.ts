export type NetworkTableColumn = {
  id: string;
  name: string;
  instructions: string;
  agentsSize: number;
  routingModel: string;
  workflowsSize?: number;
  toolsSize?: number;
};
