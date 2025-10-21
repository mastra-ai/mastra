import React from 'react';

interface Parameter {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
}

interface Property {
  type: string;
  parameters: Parameter[];
}

interface ContentItem {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
  properties?: Property[];
  defaultValue?: string;
}

interface PropertiesTableProps {
  content?: ContentItem[];
}

export default function PropertiesTable({ content = [] }: PropertiesTableProps): React.JSX.Element {
  const renderType = ({ properties = [] }: { properties: Property[] | undefined }) => {
    if (properties && properties.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {properties.map((prop, idx) => (
            <div
              key={idx}
              style={{
                margin: '0.5rem',
                borderRadius: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                marginTop: '1rem',
                marginBottom: '1rem',
                border: '1px solid var(--ifm-color-emphasis-300)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'var(--ifm-font-family-monospace)',
                    fontSize: '0.75rem',
                    position: 'absolute',
                    top: '-0.75rem',
                    right: '0.5rem',
                    backgroundColor: 'var(--ifm-color-emphasis-200)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    color: 'var(--ifm-color-emphasis-700)',
                    zIndex: 20,
                  }}
                >
                  {prop.type}
                </div>
                {prop.parameters &&
                  prop.parameters.map((param, paramIdx) => (
                    <div
                      key={paramIdx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderBottom:
                          paramIdx === prop.parameters.length - 1 ? 'none' : '1px solid var(--ifm-color-emphasis-300)',
                        padding: '0.75rem',
                        gap: '0.25rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                        }}
                      >
                        <h3
                          style={{
                            fontFamily: 'var(--ifm-font-family-monospace)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            margin: 0,
                          }}
                        >
                          {param.name}
                          <span>{param.isOptional ? '?:' : ':'}</span>
                        </h3>
                        <div
                          style={{
                            fontFamily: 'var(--ifm-font-family-monospace)',
                            color: 'var(--ifm-color-emphasis-700)',
                            fontSize: '0.875rem',
                            width: '100%',
                          }}
                        >
                          {param.type}
                        </div>
                      </div>
                      <div
                        style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'var(--ifm-color-emphasis-700)' }}
                      >
                        {param.description}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {content.map((item, index) => {
        return (
          <div
            key={index}
            id={item.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--ifm-color-emphasis-300)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'flex-start' }}>
              <h3
                style={{
                  fontFamily: 'var(--ifm-font-family-monospace)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  margin: 0,
                }}
              >
                {item.name}
                <span>{item.isOptional ? '?:' : ':'}</span>
              </h3>
              <div style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'var(--ifm-color-emphasis-700)' }}>
                {item.type}
              </div>
              {item.defaultValue && (
                <div style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'var(--ifm-color-emphasis-700)' }}>
                  = {item.defaultValue}
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'var(--ifm-color-emphasis-700)' }}>
              {item.description}
            </div>
            {renderType({ properties: item.properties })}
          </div>
        );
      })}
    </div>
  );
}
