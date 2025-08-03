'use client'

import { useRef } from 'react';

function ReportModal({ isOpen, onClose, title, children, reportContent }) {
  const reportContentRef = useRef(null);

  if (!isOpen) return null;

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportContent);
      alert('レポート内容をコピーしました！');
    } catch (err) {
      console.error('レポートのコピーに失敗しました:', err);
      alert('レポートのコピーに失敗しました。');
    }
  };

  const handleSavePdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    if (reportContentRef.current) {
      html2pdf().from(reportContentRef.current).save('report.pdf');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center px-4">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl sm:text-4xl leading-none">&times;</button>
        </div>
        <div className="flex justify-end space-x-2 mb-4">
          <button 
            onClick={handleCopyReport} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md shadow-md transition duration-200 ease-in-out"
          >
            コピー
          </button>
          <button 
            onClick={handleSavePdf} 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md shadow-md transition duration-200 ease-in-out"
          >
            PDFで保存
          </button>
        </div>
        <div ref={reportContentRef} className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export default ReportModal;
