import { useState } from 'react';

interface ExcelSheet {
  name: string;
  data: any[][];
}

interface Props {
  data: {
    sheets: ExcelSheet[];
  };
  onDownload?: () => void;
}

export default function ExcelPreview({ data, onDownload }: Props) {
  const [activeSheet, setActiveSheet] = useState(0);

  console.log('📊 ExcelPreview - received data:', data);
  console.log('📊 ExcelPreview - data type:', typeof data);
  console.log('📊 ExcelPreview - has sheets?', data?.sheets);

  if (!data?.sheets || data.sheets.length === 0) {
    console.error('❌ ExcelPreview - No sheets found! Data:', JSON.stringify(data)?.substring(0, 200));
    return (
      <div className="p-4 text-gray-400">
        <p>No data available</p>
        <p className="text-xs mt-2 text-red-400">Debug: Check console for details</p>
      </div>
    );
  }

  const currentSheet = data.sheets[activeSheet];

  if (!currentSheet?.data || currentSheet.data.length === 0) {
    return <div className="p-4 text-gray-400">No data in sheet</div>;
  }

  const headers = currentSheet.data[0] || [];
  const dataRows = currentSheet.data.slice(1);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Sheet tabs */}
      {data.sheets.length > 1 && (
        <div className="flex border-b bg-gray-100">
          {data.sheets.map((sheet, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSheet(idx)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSheet === idx
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700"
                >
                  {header || `Column ${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="border border-gray-300 px-3 py-2 text-gray-800"
                  >
                    {cell !== null && cell !== undefined ? String(cell) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Download button */}
      {onDownload && (
        <div className="p-3 border-t bg-gray-50">
          <button
            onClick={onDownload}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Excel
          </button>
        </div>
      )}
    </div>
  );
}
