import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { Artifact } from '../types/artifact.types';
import ExcelPreview from './ExcelPreview';

interface Props {
  artifact: Artifact | null;
  streamingCode: string;
  isComplete: boolean;
  onDownload?: () => void;
}

export default function StreamingArtifactRenderer({
  artifact,
  streamingCode,
  isComplete,
  onDownload
}: Props) {
  console.log('🔵 StreamingRenderer - code length:', streamingCode?.length || 0, 'isComplete:', isComplete, 'title:', artifact?.title || 'unknown');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code');
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced render function
  const attemptRender = useCallback(() => {
    if (!streamingCode || !artifact) return;

    setIsRendering(true);

    // Clear previous timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Debounce rendering - try every 100ms
    renderTimeoutRef.current = setTimeout(() => {
      try {
        // For Excel artifacts, parse JSON
        if (artifact.type === 'excel') {
          console.log('🔄 Attempting to parse Excel JSON, code length:', streamingCode.length);
          const parsed = JSON.parse(streamingCode);
          console.log('✅ Successfully parsed JSON:', parsed);
          setPreviewContent(parsed);
          setIsRendering(false);
        }
        // For other types, we'll handle later
        else {
          setPreviewContent(streamingCode);
          setIsRendering(false);
        }
      } catch (e) {
        console.log('⏳ JSON not valid yet (expected during streaming):', (e as Error).message);
        // Code not valid yet - keep showing previous render or loading
        if (isComplete) {
          console.error('❌ Complete but parse failed:', e);
          // If complete but still failing, show error
          setIsRendering(false);
        }
        // Otherwise keep showing "Rendering..."
      }
    }, 100);
  }, [streamingCode, artifact, isComplete]);

  // Attempt render when code changes
  useEffect(() => {
    attemptRender();
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [attemptRender]);

  // Auto-switch to preview when rendering succeeds
  useEffect(() => {
    if (previewContent && isComplete && viewMode === 'code') {
      // Auto-switch to preview after generation completes
      setTimeout(() => setViewMode('preview'), 300);
    }
  }, [previewContent, isComplete, viewMode]);

  const hasCode = !!streamingCode;
  const hasPreview = artifact?.type === 'excel' || artifact?.type === 'html' || artifact?.type === 'react';

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header with title and view toggle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-100">
            {artifact?.title || 'Generating artifact...'}
          </h3>
          {!isComplete && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              Generating...
            </div>
          )}
        </div>

        {/* View toggle - show if has both code and preview capability */}
        {hasCode && hasPreview && (
          <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'code'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setViewMode('preview')}
              disabled={!previewContent && !isComplete}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' ? (
          // Code view - Monaco Editor with streaming code
          <div className="h-full relative">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={streamingCode}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderWhitespace: 'selection',
              }}
            />
            {!isComplete && (
              <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 flex items-center gap-2">
                <div className="animate-pulse h-2 w-2 bg-blue-400 rounded-full"></div>
                Streaming code...
              </div>
            )}
          </div>
        ) : (
          // Preview view
          <div className="h-full bg-white">
            {isRendering && !previewContent ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-gray-600">Rendering preview...</p>
                </div>
              </div>
            ) : previewContent && artifact?.type === 'excel' ? (
              <ExcelPreview data={previewContent} onDownload={onDownload} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {isComplete ? 'Failed to render preview' : 'Waiting for valid code...'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
