import { SideDialogCodeSection } from '@/components/ui/elements';

export function SpanDetails({ span }: { span: any }) {
  return (
    <div className="grid gap-[1.5rem] mb-[2rem]">
      <SideDialogCodeSection title="Input" codeStr={JSON.stringify(span?.input || null, null, 2)} />
      <SideDialogCodeSection title="Output" codeStr={JSON.stringify(span?.output || null, null, 2)} />
      <SideDialogCodeSection title="Metadata" codeStr={JSON.stringify(span?.metadata || null, null, 2)} />
      <SideDialogCodeSection title="Attributes" codeStr={JSON.stringify(span?.attributes || null, null, 2)} />
    </div>
  );
}
