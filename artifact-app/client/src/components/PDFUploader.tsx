import { useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

interface ExtractionResult {
  pdf_name: string;
  output_dir: string;
  num_tables: number;
  status: string;
  cached?: boolean;
}

interface Props {
  onUploadComplete?: (results: ExtractionResult[]) => void;
}

export default function PDFUploader({ onUploadComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === 'application/pdf'
      );
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPDFs = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Uploading and extracting PDFs...');

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:8000/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status === 'success') {
        setUploadStatus(`✅ Successfully extracted ${result.results.length} PDFs!`);
        setFiles([]);

        // Notify parent component about successful extractions
        if (onUploadComplete) {
          onUploadComplete(result.results);
        }

        // Refresh after 2 seconds
        setTimeout(() => {
          setUploadStatus('');
        }, 3000);
      } else {
        setUploadStatus('❌ Extraction failed: ' + result.error);
      }
    } catch (error) {
      setUploadStatus('❌ Upload error: ' + String(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 border-b border-gray-700">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Upload size={20} />
        Upload PDFs
      </h2>

      {/* File Input */}
      <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors mb-3">
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <div className="text-center">
          <Upload className="mx-auto mb-2 text-gray-400" size={24} />
          <p className="text-sm text-gray-400">Click to select PDF files</p>
        </div>
      </label>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="space-y-2 mb-3">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-700 rounded p-2"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-400 hover:text-red-300"
                disabled={isUploading}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={uploadPDFs}
          disabled={isUploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg px-4 py-2 flex items-center justify-center gap-2 font-medium"
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>
              <Upload size={20} />
              Extract {files.length} PDF{files.length > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}

      {/* Status Message */}
      {uploadStatus && (
        <div className="mt-3 p-2 bg-gray-700 rounded text-sm">{uploadStatus}</div>
      )}
    </div>
  );
}
