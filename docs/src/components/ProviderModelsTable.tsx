import * as React from 'react'
import { X as Cross, CircleCheck as Check } from 'lucide-react'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} {...props} />
  </div>
))

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ ...props }, ref) => <thead ref={ref} {...props} />,
)

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ ...props }, ref) => <tbody ref={ref} {...props} />,
)

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ ...props }, ref) => <tfoot ref={ref} {...props} />,
)

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ ...props }, ref) => <tr ref={ref} {...props} />,
)

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ ...props }, ref) => <th ref={ref} {...props} />,
)

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ ...props }, ref) => <td ref={ref} {...props} />,
)

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ ...props }, ref) => <caption ref={ref} {...props} />,
)

interface ModelData {
  model: string
  imageInput: boolean | null
  objectGeneration?: boolean
  toolUsage: boolean | null
  toolStreaming?: boolean
  audioInput?: boolean | null
  videoInput?: boolean | null
  reasoning?: boolean | null
  contextWindow?: number | null
  maxOutput?: number | null
  inputCost?: number | null
  outputCost?: number | null
}

interface ProviderModelsTableProps {
  models: ModelData[]
  totalCount?: number
  catalogOnly?: boolean
}

function Capability({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <span aria-label="Unknown">—</span>
  return value ? (
    <Check aria-label="Supported" className="inline-block h-[18px] w-[18px] text-green-600 dark:text-green-400" />
  ) : (
    <Cross aria-label="Unsupported" className="inline-block h-[18px] w-[18px]" />
  )
}

function ProviderModelsTable({ models, totalCount, catalogOnly = false }: ProviderModelsTableProps) {
  // Check if we have extended data
  const hasExtendedData = models.some(
    m => m.audioInput || m.videoInput || m.reasoning || m.contextWindow || m.inputCost,
  )

  const formatTokens = (tokens: number | null | undefined) => {
    if (!tokens) return '—'
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`
    }
    return `${tokens}`
  }

  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined) return '—'
    if (cost === 0) return 'Free'
    if (cost < 1) return `$${cost.toFixed(2)}`
    return `$${cost.toFixed(0)}`
  }

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
            <TableCell className="whitespace-nowrap">
              <code>{model.model}</code>
            </TableCell>
            {hasExtendedData && <TableCell>{formatTokens(model.contextWindow)}</TableCell>}
            <TableCell className="text-center">
              <Capability value={model.toolUsage} />
            </TableCell>
            {hasExtendedData && (
              <>
                <TableCell className="text-center">
                  <Capability value={model.reasoning} />
                </TableCell>
                <TableCell className="text-center">
                  <Capability value={model.imageInput} />
                </TableCell>
                <TableCell className="text-center">
                  <Capability value={model.audioInput} />
                </TableCell>
                <TableCell className="text-center">
                  <Capability value={model.videoInput} />
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
          : catalogOnly
            ? `${models.length} catalog ${models.length === 1 ? 'entry' : 'entries'}; availability depends on account eligibility`
            : `${models.length} available model${models.length !== 1 ? 's' : ''}`}
      </TableCaption>
    </Table>
  )
}

export default ProviderModelsTable
