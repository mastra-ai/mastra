import {
  PlanActionGroup,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanExpandButton,
  PlanFile,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanRoot,
  PlanStatus,
  PlanTitle,
} from './plan';

export * from './plan';

export const Plan = Object.assign(PlanRoot, {
  ActionGroup: PlanActionGroup,
  Body: PlanBody,
  Content: PlanContent,
  Controls: PlanControls,
  CopyButton: PlanCopyButton,
  ExpandButton: PlanExpandButton,
  File: PlanFile,
  Header: PlanHeader,
  HeaderActions: PlanHeaderActions,
  Intro: PlanIntro,
  Label: PlanLabel,
  Main: PlanMain,
  Path: PlanPath,
  Status: PlanStatus,
  Title: PlanTitle,
});
