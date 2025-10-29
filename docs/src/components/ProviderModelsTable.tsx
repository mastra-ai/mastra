import React from "react";

interface Model {
  model: string;
  imageInput?: boolean;
  audioInput?: boolean;
  videoInput?: boolean;
  toolUsage?: boolean;
  streaming?: boolean;
  contextWindow?: number;
  tokenizer?: string;
}

interface ProviderModelsTableProps {
  models: Model[];
}

export default function ProviderModelsTable({
  models,
}: ProviderModelsTableProps): React.JSX.Element {
  return (
    <div style={{ marginTop: "2rem", marginBottom: "2rem", overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Image</th>
            <th>Audio</th>
            <th>Video</th>
            <th>Tools</th>
            <th>Streaming</th>
            <th>Context Window</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model, index) => (
            <tr key={index}>
              <td>
                <code>{model.model}</code>
              </td>
              <td>{model.imageInput ? "✓" : "✗"}</td>
              <td>{model.audioInput ? "✓" : "✗"}</td>
              <td>{model.videoInput ? "✓" : "✗"}</td>
              <td>{model.toolUsage ? "✓" : "✗"}</td>
              <td>{model.streaming ? "✓" : "✗"}</td>
              <td>
                {model.contextWindow
                  ? model.contextWindow.toLocaleString()
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
