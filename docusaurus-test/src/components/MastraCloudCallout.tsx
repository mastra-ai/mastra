import React from 'react';

export default function MastraCloudCallout(): JSX.Element {
  return (
    <div
      style={{
        backgroundColor: 'var(--ifm-color-primary-lightest)',
        border: '1px solid var(--ifm-color-primary-light)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem',
        marginTop: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '1.5rem',
            flexShrink: 0,
            marginTop: '0.125rem',
          }}
        >
          ☁️
        </div>
        <div>
          <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Mastra Cloud</h4>
          <p style={{ marginBottom: 0 }}>
            Deploy your Mastra application to{' '}
            <a href="https://mastra.ai/cloud" target="_blank" rel="noopener noreferrer">
              Mastra Cloud
            </a>{' '}
            for automated deployment, monitoring, and management.
          </p>
        </div>
      </div>
    </div>
  );
}
