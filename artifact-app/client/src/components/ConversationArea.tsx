import { useState, useRef, useEffect } from 'react';
import { Send, Square, PanelRightOpen } from 'lucide-react';
import { Message, Artifact } from '../types/artifact.types';
import { detectArtifacts } from '../utils/artifactDetector';
import { stripCodeBlocksAndArtifacts } from '../utils/messageFormatter';

interface ExtractionResult {
  pdf_name: string;
  output_dir: string;
  num_tables: number;
  status: string;
  cached?: boolean;
}

interface Props {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  setStreamingArtifact: (artifact: { artifact: Artifact | null; code: string; isComplete: boolean; } | null) => void;
  availableExtractions: ExtractionResult[];
  showReopenButton?: boolean;
  onReopenPanel?: () => void;
  agentSessionId: string | null;
  setAgentSessionId: (sessionId: string | null) => void;
}

export default function ConversationArea({ messages, setMessages, setArtifacts, setStreamingArtifact, availableExtractions, showReopenButton, onReopenPanel, agentSessionId, setAgentSessionId }: Props) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const userMessageRef = useRef<Message | null>(null);
  const assistantMessageRef = useRef<Message | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-notify when new PDFs are extracted
  const prevExtractionsLengthRef = useRef(0);

  useEffect(() => {
    if (availableExtractions.length > prevExtractionsLengthRef.current) {
      // Get only the newly added extractions
      const newExtractions = availableExtractions.slice(prevExtractionsLengthRef.current);
      console.log('📤 New extractions available:', newExtractions);

      // Create notification message for all new PDFs
      const pdfList = newExtractions
        .map(e => `• **${e.pdf_name}** - ${e.num_tables} tables extracted`)
        .join('\n');

      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: `✅ PDF${newExtractions.length > 1 ? 's' : ''} processed successfully!\n\n${pdfList}\n\nYou can now ask questions about ${newExtractions.length > 1 ? 'this data' : 'this data'}!`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, systemMessage]);
      prevExtractionsLengthRef.current = availableExtractions.length;
    }
  }, [availableExtractions.length]); // Only trigger when length changes

  const stopStreaming = () => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setIsStreaming(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    // Prepare message with context about available PDFs
    let messageWithContext = input;

    // If there are available extractions, prepend context for the agent
    if (availableExtractions.length > 0) {
      const extractionInfo = availableExtractions
        .map(e => `- ${e.pdf_name}: ${e.output_dir} (${e.num_tables} tables)`)
        .join('\n');

      messageWithContext = `[Available PDF data:\n${extractionInfo}]\n\nUser question: ${input}`;
      console.log('📨 Sending message with context:', messageWithContext);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input, // Display user's original message
      timestamp: new Date(),
    };

    // Don't add user message here - it will be added together with assistant message below
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:3001/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageWithContext,
          sessionId: agentSessionId // Resume previous session if exists
        }),
      });

      const reader = response.body?.getReader();
      readerRef.current = reader || null;
      const decoder = new TextDecoder();

      let assistantContent = '';
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      // Add both user and assistant messages together atomically
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      let insideArtifact = false;
      let openingTagIndex = -1;
      let codeStart = -1;
      let metadataStr = '';
      let artifactBuffer = '';
      let artifactCodeBuffer = ''; // Streaming code content
      let artifactMetadata: any = null;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Capture session ID
              if (data.type === 'session_init' && data.session_id) {
                console.log('🔗 Session ID captured:', data.session_id);
                setAgentSessionId(data.session_id);
              }

              if (data.type === 'text_delta') {
                // Streaming delta - append each token
                console.log('📥 Received text_delta:', data.content);
                assistantContent += data.content;

                // Artifact detection and streaming
                if (!insideArtifact && assistantContent.includes('<antArtifact')) {
                  console.log('🎨 ARTIFACT DETECTED! assistantContent:', assistantContent.substring(0, 200));
                  insideArtifact = true;
                  openingTagIndex = assistantContent.lastIndexOf('<antArtifact');
                  codeStart = -1;
                  metadataStr = '';
                  artifactMetadata = null;
                  artifactCodeBuffer = '';
                }

                if (insideArtifact) {
                  if (codeStart === -1) {
                    const afterOpening = assistantContent.substring(openingTagIndex + 11);
                    const gtIndex = afterOpening.indexOf('>');
                    if (gtIndex !== -1) {
                      metadataStr = afterOpening.substring(0, gtIndex).trim();
                      codeStart = openingTagIndex + 11 + gtIndex + 1;
                      console.log('Metadata extraction:', metadataStr);
                      const idMatch = metadataStr.match(/identifier\s*=\s*"([^"]+)"/i);
                      const typeMatch = metadataStr.match(/type\s*=\s*"([^"]+)"/i);
                      const titleMatch = metadataStr.match(/title\s*=\s*"([^"]*)"/i);
                      const languageMatch = metadataStr.match(/language\s*=\s*"([^"]+)"/i);
                      if (idMatch && typeMatch) {
                        const id = idMatch[1];
                        const type = typeMatch[1];
                        const title = titleMatch ? titleMatch[1] : 'Untitled Artifact';
                        const language = languageMatch ? languageMatch[1] : '';
                        artifactMetadata = { id, type, title, language };
                        const artType = type.includes('spreadsheet') ? 'excel' :
                                       (type.includes('code') && (language === 'html' || language === 'javascript')) ? 'html' :
                                       (type.includes('html')) ? 'html' : 'text';
                        const initArtifact: Artifact = {
                          id,
                          type: artType,
                          title,
                          content: '',
                          code: '',
                          createdAt: new Date(),
                        };
                        console.log('🎨 Calling setStreamingArtifact NOW with:', initArtifact);
                        setStreamingArtifact({
                          artifact: initArtifact,
                          code: '',
                          isComplete: false,
                        });
                        console.log('🎨 setStreamingArtifact called');
                      } else {
                        console.log('Failed to parse metadata from:', metadataStr);
                      }
                    }
                  }

                  if (artifactMetadata && codeStart !== -1) {
                    let fullCode = assistantContent.substring(codeStart);
                    const closingIndex = fullCode.indexOf('</antArtifact>');
                    if (closingIndex !== -1) {
                      artifactCodeBuffer = fullCode.substring(0, closingIndex).trim();
                      const artType = artifactMetadata.type.includes('spreadsheet') ? 'excel' :
                                     (artifactMetadata.type.includes('code') && (artifactMetadata.language === 'html' || artifactMetadata.language === 'javascript')) ? 'html' :
                                     (artifactMetadata.type.includes('html')) ? 'html' : 'text';
                      const completeArtifact: Artifact = {
                        id: artifactMetadata.id,
                        type: artType,
                        title: artifactMetadata.title,
                        content: artifactCodeBuffer,
                        code: artifactCodeBuffer,
                        createdAt: new Date(),
                      };
                      console.log('💾 Adding complete artifact during streaming:', completeArtifact.id);
                      setArtifacts((prev) => {
                        console.log('💾 Current artifacts before add:', prev.map(a => a.id));
                        // Check if artifact with this ID already exists
                        const exists = prev.some(a => a.id === completeArtifact.id);
                        if (exists) {
                          console.log('⚠️ Artifact already exists, skipping duplicate:', completeArtifact.id);
                          return prev;
                        }
                        console.log('✅ Adding artifact:', completeArtifact.id, 'New array will have', prev.length + 1, 'artifacts');
                        return [...prev, completeArtifact];
                      });
                      setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1].artifacts = [completeArtifact];
                        return updated;
                      });
                      setStreamingArtifact({
                        artifact: completeArtifact,
                        code: artifactCodeBuffer,
                        isComplete: true,
                      });
                      insideArtifact = false;
                      codeStart = -1;
                      artifactMetadata = null;
                      artifactCodeBuffer = '';
                    } else {
                      artifactCodeBuffer = fullCode.trim();
                      console.log('🔵 Updating streaming code, length:', artifactCodeBuffer.length);
                      setStreamingArtifact((prev) => ({
                        ...prev!,
                        code: artifactCodeBuffer,
                      }));
                    }
                  }
                }

                // Update display content
                const displayContent = insideArtifact ? stripCodeBlocksAndArtifacts(assistantContent) : assistantContent;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = displayContent;
                  return updated;
                });
              } else if (data.type === 'text_complete') {
                assistantContent = data.content;
                const detectedArtifacts = detectArtifacts(assistantContent);
                console.log('📝 text_complete - detected artifacts:', detectedArtifacts.map(a => a.id));
                if (detectedArtifacts.length > 0) {
                  setArtifacts((prev) => {
                    console.log('📝 text_complete - existing artifacts:', prev.map(a => a.id));
                    // Only add artifacts that don't already exist (check by ID)
                    const existingIds = new Set(prev.map(a => a.id));
                    const newArtifacts = detectedArtifacts.filter(a => !existingIds.has(a.id));
                    console.log('📝 text_complete - new artifacts to add:', newArtifacts.map(a => a.id));
                    return newArtifacts.length > 0 ? [...prev, ...newArtifacts] : prev;
                  });
                  const displayContent = stripCodeBlocksAndArtifacts(assistantContent);
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1].content = displayContent;
                    updated[updated.length - 1].artifacts = detectedArtifacts;
                    return updated;
                  });
                } else {
                  const displayContent = stripCodeBlocksAndArtifacts(assistantContent);
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1].content = displayContent;
                    return updated;
                  });
                }
                setStreamingArtifact(null);
              } else if (data.type === 'text') {
                // Complete message - use as is
                assistantContent = data.content;
                const displayContent = stripCodeBlocksAndArtifacts(assistantContent);
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = displayContent;
                  return updated;
                });
              } else if (data.type === 'done') {
                // Ensure artifacts if not set (check by ID to avoid duplicates)
                const detectedArtifacts = detectArtifacts(assistantContent);
                console.log('🏁 Done event - detected artifacts:', detectedArtifacts.map(a => a.id));
                if (detectedArtifacts.length > 0) {
                  setArtifacts((prev) => {
                    console.log('🏁 Existing artifacts before done:', prev.map(a => a.id));
                    // Only add artifacts that don't already exist (check by ID)
                    const existingIds = new Set(prev.map(a => a.id));
                    const newArtifacts = detectedArtifacts.filter(a => !existingIds.has(a.id));
                    console.log('🏁 New artifacts to add:', newArtifacts.map(a => a.id));
                    return newArtifacts.length > 0 ? [...prev, ...newArtifacts] : prev;
                  });
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1].artifacts = detectedArtifacts;
                    return updated;
                  });
                }
                setStreamingArtifact(null);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      // Note: Artifact detection is now handled in the streaming loop and done event
      // No need for fallback detection here (it caused duplicates due to stale closure)
      setTimeout(() => setStreamingArtifact(null), 500);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsStreaming(false);
      // Clear streaming artifact on error/cancel
      setStreamingArtifact(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          // Strip code blocks and artifacts from assistant messages for cleaner display
          const displayContent = msg.role === 'assistant'
            ? stripCodeBlocksAndArtifacts(msg.content)
            : msg.content;

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{displayContent}</p>
                {msg.artifacts && msg.artifacts.length > 0 && showReopenButton && onReopenPanel && (
                  <button
                    onClick={onReopenPanel}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded border border-gray-500 transition-all"
                    title="Open artifact panel"
                  >
                    <PanelRightOpen size={14} />
                    <span>Show Artifacts</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isStreaming) sendMessage();
              if (e.key === 'Escape' && isStreaming) stopStreaming();
            }}
            placeholder={isStreaming ? "Press ESC to stop..." : "Message the AI..."}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 flex items-center gap-2"
              title="Stop (ESC)"
            >
              <Square size={20} />
              <span className="text-sm">Stop</span>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
