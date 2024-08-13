// TODO: clean up types (properly type)

type Status = 'DRAFT' | 'PUBLISHED';

export interface Workflow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  actions: Action[];
  trigger: Trigger;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  workspaceId: string;
  owner: any;
  runs: any[];
}

export interface Action {
  id: string;
  type: string;
  subActions: SubAction[];
}

export interface SubAction {
  id: string;
  type: string;
  subActions: SubAction[];
  parentActionId: string;
}

export interface Trigger {
  id: string;
  type: string;
  payload: any;
}
