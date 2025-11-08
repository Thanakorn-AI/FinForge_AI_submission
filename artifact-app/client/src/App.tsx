import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ChatInterface from './components/ChatInterface';
import ConversationArea from './components/ConversationArea';
import ArtifactPanel from './components/ArtifactPanel';
import { Message, Artifact } from './types/artifact.types';

interface ExtractionResult {
  pdf_name: string;
  output_dir: string;
  num_tables: number;
  status: string;
  cached?: boolean;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [availableExtractions, setAvailableExtractions] = useState<ExtractionResult[]>([]);
  const [isArtifactPanelClosed, setIsArtifactPanelClosed] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);

  // Streaming artifact state
  const [streamingArtifact, setStreamingArtifact] = useState<{
    artifact: Artifact | null;
    code: string;
    isComplete: boolean;
  } | null>(null);

  // Show panel if we have artifacts OR if streaming, AND user hasn't manually closed it
  const showArtifactPanel = !isArtifactPanelClosed && (artifacts.length > 0 || streamingArtifact !== null);

  // Auto-open panel when new artifacts are created
  useEffect(() => {
    if (artifacts.length > 0 || streamingArtifact !== null) {
      setIsArtifactPanelClosed(false);
    }
  }, [artifacts.length, streamingArtifact]);

  useEffect(() => {
    console.log('🔴 App.tsx - streamingArtifact changed:', streamingArtifact ? {id: streamingArtifact.artifact?.id, codeLen: streamingArtifact.code.length, complete: streamingArtifact.isComplete} : null);
    console.log('🔴 App.tsx - artifacts length:', artifacts.length);
    console.log('🔴 App.tsx - artifacts:', artifacts.map(a => a.id));
    console.log('🔴 App.tsx - showArtifactPanel:', showArtifactPanel);
  }, [streamingArtifact, artifacts]);

  // Handler for when PDFs are uploaded and processed
  const handleUploadComplete = (results: ExtractionResult[]) => {
    console.log('📤 Upload complete:', results);
    const successfulExtractions = results.filter(r => r.status === 'success');
    setAvailableExtractions(prev => [...prev, ...successfulExtractions]);
  };

  return (
    <div className="h-screen bg-gray-900 text-white relative">
      <PanelGroup direction="horizontal">
        {/* Left Panel: Chat History - Collapsible */}
        {!isSidebarCollapsed && (
          <>
            <Panel defaultSize={25} minSize={20} maxSize={40}>
              <ChatInterface
                messages={messages}
                onUploadComplete={handleUploadComplete}
                onCloseSidebar={() => setIsSidebarCollapsed(true)}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500" />
          </>
        )}

        {/* Middle Panel: Active Conversation */}
        <Panel defaultSize={isSidebarCollapsed ? 75 : 50} minSize={30}>
          {/* Show sidebar button - only when collapsed */}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute top-4 left-4 z-10 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors"
              title="Show sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <ConversationArea
            messages={messages}
            setMessages={setMessages}
            setArtifacts={setArtifacts}
            setStreamingArtifact={setStreamingArtifact}
            availableExtractions={availableExtractions}
            showReopenButton={isArtifactPanelClosed && artifacts.length > 0}
            onReopenPanel={() => setIsArtifactPanelClosed(false)}
            agentSessionId={agentSessionId}
            setAgentSessionId={setAgentSessionId}
          />
        </Panel>

        {showArtifactPanel && (
          <>
            <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500" />

            {/* Right Panel: Artifacts */}
            <Panel defaultSize={25} minSize={20}>
              <ArtifactPanel
                artifacts={artifacts}
                activeArtifactId={activeArtifactId}
                setActiveArtifactId={setActiveArtifactId}
                streamingArtifact={streamingArtifact}
                onClose={() => setIsArtifactPanelClosed(true)}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

export default App;
