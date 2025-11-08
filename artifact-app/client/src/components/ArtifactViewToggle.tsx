import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Artifact } from '../types/artifact.types';
import ExcelPreview from './ExcelPreview';

interface Props {
  artifact: Artifact;
  onDownload?: () => void;
}

export default function ArtifactViewToggle({ artifact, onDownload }: Props) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  // Determine if artifact has both code and preview
  const hasCode = !!artifact.code;
  const hasPreview = artifact.type === 'excel' || artifact.type === 'html' || artifact.type === 'react' || artifact.type === 'chart';

  return (
    <div className="h-full flex flex-col">
      {/* Header with toggle */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">{artifact.title}</h3>

        {/* View toggle - only show if has both */}
        {hasCode && hasPreview && (
          <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Code
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' && hasCode ? (
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={artifact.code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full">
            {artifact.type === 'excel' && (
              <ExcelPreview
                data={typeof artifact.content === 'string' ? JSON.parse(artifact.content) : artifact.content}
                onDownload={onDownload}
              />
            )}
            {(artifact.type === 'html' || artifact.type === 'react') && (
              <iframe
                srcDoc={artifact.code || String(artifact.content)}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
              />
            )}
            {artifact.type === 'chart' && (
              <div className="p-4">
                <div className="text-gray-400">Chart preview not yet implemented</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
