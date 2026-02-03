import { JsonSchema, Rule, RuleBuilder } from '@/lib/rule-engine';

export type AgentCMSBlockRulesProps = {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  className?: string;
  schema: JsonSchema;
};

export const AgentCMSBlockRules = ({ rules, onChange, schema }: AgentCMSBlockRulesProps) => {
  return <RuleBuilder schema={schema} rules={rules} onChange={onChange} />;
};
