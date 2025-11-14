import * as React from "react";
import { X as Cross, CircleCheck as Check } from "lucide-react";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} {...props} />
  </div>
));

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ ...props }, ref) => <thead ref={ref} {...props} />);

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ ...props }, ref) => <tbody ref={ref} {...props} />);

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ ...props }, ref) => <tfoot ref={ref} {...props} />);

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ ...props }, ref) => <tr ref={ref} {...props} />);

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ ...props }, ref) => <th ref={ref} {...props} />);

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ ...props }, ref) => <td ref={ref} {...props} />);

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ ...props }, ref) => <caption ref={ref} {...props} />);

interface ModelData {
  model: string;
  imageInput: boolean;
  objectGeneration: boolean;
  toolUsage: boolean;
  toolStreaming: boolean;
  audioInput?: boolean;
  videoInput?: boolean;
  reasoning?: boolean;
  contextWindow?: number | null;
  maxOutput?: number | null;
  inputCost?: number | null;
  outputCost?: number | null;
}

interface ProviderModelsTableProps {
  models: ModelData[];
  totalCount?: number;
}

function ProviderModelsTable({ models, totalCount }: ProviderModelsTableProps) {
  // Check if we have extended data
  const hasExtendedData = models.some(
    (m) =>
      m.audioInput ||
      m.videoInput ||
      m.reasoning ||
      m.contextWindow ||
      m.inputCost,
  );

  const formatTokens = (tokens: number | null | undefined) => {
    if (!tokens) return "—";
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return `${tokens}`;
  };

  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined) return "—";
    if (cost === 0) return "Free";
    if (cost < 1) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(0)}`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          {hasExtendedData && <TableHead>Context</TableHead>}
          <TableHead>Tools</TableHead>
          {hasExtendedData && (
            <>
              <TableHead>Reasoning</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Audio</TableHead>
              <TableHead>Video</TableHead>
              <TableHead>Input $/1M</TableHead>
              <TableHead>Output $/1M</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((model, index) => (
          <TableRow key={index}>
            <TableCell>
              <code>{model.model}</code>
            </TableCell>
            {hasExtendedData && (
              <TableCell>{formatTokens(model.contextWindow)}</TableCell>
            )}
            <TableCell className="text-center">
              {model.toolUsage ? (
                <Check className="dark:text-green-400 text-green-600 inline-block w-[18px] h-[18px]" />
              ) : (
                <Cross className="inline-block w-[18px] h-[18px]" />
              )}
            </TableCell>
            {hasExtendedData && (
              <>
                <TableCell className="text-center">
                  {model.reasoning ? (
                    <Check className="dark:text-green-400 text-green-600 inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {model.imageInput ? (
                    <Check className="dark:text-green-400 text-green-600 inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {model.audioInput ? (
                    <Check className="dark:text-green-400 text-green-600 inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {model.videoInput ? (
                    <Check className="dark:text-green-400 text-green-600 inline-block w-[18px] h-[18px]" />
                  ) : (
                    <Cross className="inline-block w-[18px] h-[18px]" />
                  )}
                </TableCell>
                <TableCell>{formatCost(model.inputCost)}</TableCell>
                <TableCell>{formatCost(model.outputCost)}</TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
      <TableCaption className="my-4 caption-bottom">
        {totalCount && models.length < totalCount
          ? `Showing ${models.length} of ${totalCount} available models`
          : `${models.length} available model${models.length !== 1 ? "s" : ""}`}
      </TableCaption>
    </Table>
  );
}

export default ProviderModelsTable;
