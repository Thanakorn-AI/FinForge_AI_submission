import { useState } from 'react';
import { Download, Maximize2, Minimize2, X } from 'lucide-react';
import { Artifact } from '../types/artifact.types';
import ArtifactViewToggle from './ArtifactViewToggle';
import StreamingArtifactRenderer from './StreamingArtifactRenderer';

interface Props {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  setActiveArtifactId: (id: string) => void;
  streamingArtifact?: {
    artifact: Artifact | null;
    code: string;
    isComplete: boolean;
  } | null;
  onClose: () => void;
}

export default function ArtifactPanel({ artifacts, activeArtifactId, setActiveArtifactId, streamingArtifact, onClose }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // If streaming, show that; otherwise show completed artifacts
  const isStreaming = streamingArtifact && !streamingArtifact.isComplete;
  console.log('🟢 ArtifactPanel - isStreaming:', isStreaming, streamingArtifact ? 'streamingArtifact exists' : 'no');
  console.log('🟢 ArtifactPanel - artifacts array:', artifacts.map(a => ({id: a.id, title: a.title})));
  console.log('🟢 ArtifactPanel - artifacts.length:', artifacts.length);
  const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) || artifacts[0];

  const downloadArtifact = async (artifact: Artifact) => {
    // Implement download logic based on artifact type
    if (artifact.type === 'excel') {
      try {
        // Parse the JSON content (it's stored as a string)
        const data = typeof artifact.content === 'string'
          ? JSON.parse(artifact.content)
          : artifact.content;

        // Call Node.js server to generate Excel
        const response = await fetch('http://localhost:3001/api/artifacts/generate-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });

        if (!response.ok) {
          console.error('Failed to generate Excel:', await response.text());
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${artifact.title}.xlsx`;
        a.click();
      } catch (error) {
        console.error('Error downloading Excel:', error);
      }
    }
    // Add other download handlers...
  };

  return (
    <div className={`flex flex-col h-full bg-gray-800 ${
      isFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      {/* Show streaming artifact or completed artifacts */}
      {isStreaming ? (
        // Streaming view - no tabs, just the live artifact
        <StreamingArtifactRenderer
          artifact={streamingArtifact!.artifact}
          streamingCode={streamingArtifact!.code}
          isComplete={streamingArtifact!.isComplete}
          onDownload={streamingArtifact!.artifact ? () => {
            // Use streaming code instead of artifact.content (which might be empty)
            const artifactWithCode = {
              ...streamingArtifact!.artifact!,
              content: streamingArtifact!.code
            };
            downloadArtifact(artifactWithCode);
          } : undefined}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-700 overflow-x-auto">
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setActiveArtifactId(artifact.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                  activeArtifact?.id === artifact.id
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {artifact.title}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between p-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">{activeArtifact?.type}</span>
            <div className="flex gap-2">
              <button
                onClick={() => downloadArtifact(activeArtifact!)}
                className="p-2 hover:bg-gray-700 rounded"
                title="Download artifact"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-700 rounded"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded"
                title="Close artifact panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Artifact Content */}
          <div className="flex-1 overflow-hidden">
            {activeArtifact && (
              <ArtifactViewToggle
                artifact={activeArtifact}
                onDownload={() => downloadArtifact(activeArtifact)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
