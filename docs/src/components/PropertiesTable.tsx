import React from 'react'

interface Parameter {
  name: string
  type: string
  isOptional?: boolean
  description: string
  properties?: Property[]
}

interface Property {
  type: string
  parameters: Parameter[]
}

interface ContentItem {
  name: string
  type: string
  isOptional?: boolean
  description: string
  properties?: Property[]
  defaultValue?: string
}

interface PropertiesTableProps {
  content?: ContentItem[]
}

const PropertiesTable: React.FC<PropertiesTableProps> = ({ content = [] }) => {
  const renderType = ({ properties = [] }: { properties: Property[] | undefined }) => {
    if (properties && properties.length > 0) {
      return (
        <div className="flex flex-col">
          {properties.map((prop, idx) => (
            <div
              key={idx}
              className="relative m-2 my-4 flex flex-col rounded-lg border border-(--ifm-color-emphasis-300)"
            >
              <div className="flex flex-col">
                {prop.type ? (
                  <div className="absolute -top-3 right-2 z-20 cursor-pointer rounded-md bg-(--ifm-color-emphasis-200) px-2 py-1 font-(family-name:--ifm-font-family-monospace) text-xs text-(--ifm-color-emphasis-700)">
                    {prop.type}
                  </div>
                ) : null}
                {prop.parameters &&
                  prop.parameters.map((param, paramIdx) => (
                    <div
                      key={paramIdx}
                      className="flex flex-col gap-1 border-b border-(--ifm-color-emphasis-300) p-3 last:border-none"
                    >
                      <div className="group relative flex flex-row items-start gap-2">
                        <h3 className="m-0 cursor-pointer font-(family-name:--ifm-font-family-monospace)! text-sm! font-medium!">
                          {param.name}
                          <span>{param.isOptional ? '?:' : ':'}</span>
                        </h3>
                        <div className="w-full font-(family-name:--ifm-font-family-monospace) text-sm text-(--ifm-color-emphasis-700)">
                          {param.type}
                        </div>
                      </div>
                      <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">{param.description}</div>
                      {renderType({ properties: param.properties })}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
  }

  return (
    <div className="mb-(--ifm-leading) flex flex-col">
      {content.map((item, index) => {
        return (
          <div
            key={index}
            id={item.name}
            className="flex flex-col gap-1 border-b border-(--ifm-color-emphasis-300) py-3"
          >
            <div className="group flex flex-row items-start gap-2">
              <h3 className="m-0 cursor-pointer border-b-0! pb-0! font-(family-name:--ifm-font-family-monospace)! text-sm! font-medium!">
                {item.name}
                <span>{item.isOptional ? '?:' : ':'}</span>
              </h3>
              <div className="font-(family-name:--ifm-font-family-monospace) text-sm leading-5 text-(--ifm-color-emphasis-700)">
                {item.type}
              </div>
              {item.defaultValue && (
                <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">= {item.defaultValue}</div>
              )}
            </div>
            <div className="text-sm leading-5 text-(--ifm-color-emphasis-700)">{item.description}</div>
            {renderType({ properties: item.properties })}
          </div>
        )
      })}
    </div>
  )
}

export default PropertiesTable
