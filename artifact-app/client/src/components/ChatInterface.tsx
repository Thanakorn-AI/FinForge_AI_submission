import { MessageCircle, X } from 'lucide-react';
import { Message } from '../types/artifact.types';
import PDFUploader from './PDFUploader';

interface ExtractionResult {
  pdf_name: string;
  output_dir: string;
  num_tables: number;
  status: string;
  cached?: boolean;
}

interface Props {
  messages: Message[];
  onUploadComplete?: (results: ExtractionResult[]) => void;
  onCloseSidebar?: () => void;
}

export default function ChatInterface({ messages, onUploadComplete, onCloseSidebar }: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 relative">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle size={24} />
          Financial Analysis
        </h1>

        {/* Close button - top right */}
        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="absolute top-4 right-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Hide sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* PDF Uploader */}
      <PDFUploader onUploadComplete={onUploadComplete} />

      {/* Spacer - removed message list as requested */}
      <div className="flex-1 p-4">
        <div className="text-center text-gray-500 mt-8">
          <p className="text-sm">Upload PDFs above to analyze financial data</p>
          <p className="text-xs mt-2 text-gray-600">LandingAI → AI-powered Table Analyzer → AI Agent</p>
        </div>
      </div>
    </div>
  );
}
