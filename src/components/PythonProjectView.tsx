import React, { useState } from 'react';
import {
  X, Download, Copy, CheckCircle2, FileCode, Folder,
  Terminal, ExternalLink, Code, Layers, FileText, Check
} from 'lucide-react';
import { PYTHON_CODEBASE, PythonFileItem } from '../data/pythonCodebase';
import { generateAndDownloadProjectZip } from '../utils/exportZip';

interface PythonProjectViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonProjectView: React.FC<PythonProjectViewProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<PythonFileItem>(PYTHON_CODEBASE[0]);
  const [copied, setCopied] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    setDownloadSuccess(false);
    try {
      await generateAndDownloadProjectZip();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e) {
      console.error('ZIP generation error:', e);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-950/80 text-red-400 border border-red-800/40 rounded-lg">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-100 font-display">FireGuard AI - Python Source Studio</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                  Python 3.11 + PySide6
                </span>
              </div>
              <p className="text-xs text-neutral-400">Complete modular, commented desktop project ready for Diploma project submission</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>0 Duplicates • Validated & Clean ({PYTHON_CODEBASE.length} Files)</span>
            </div>

            <button
              id="btn-download-full-project-zip"
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className={`px-4 py-2 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg border disabled:opacity-50 ${
                downloadSuccess
                  ? 'bg-emerald-600 border-emerald-500 shadow-emerald-950/40'
                  : 'bg-red-600 hover:bg-red-500 border-red-500/40 shadow-red-950/40'
              }`}
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Clean ZIP Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isExportingZip ? 'Packaging Clean ZIP...' : 'Download Clean Project (.ZIP)'}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Body: Left File Tree (25%) + Right Code Viewer (75%) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: File Tree Explorer */}
          <div className="w-full md:w-64 bg-neutral-950 border-r border-neutral-800 p-3 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800/80 text-xs text-neutral-400 font-mono">
              <span>EXPLORER</span>
              <span className="text-[10px] text-neutral-500">{PYTHON_CODEBASE.length} files</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-neutral-300">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>FireGuard_AI/</span>
              </div>

              <div className="pl-4 space-y-0.5">
                {PYTHON_CODEBASE.map((file) => {
                  const isSelected = selectedFile.path === file.path;
                  return (
                    <button
                      key={file.path}
                      id={`file-tree-${file.name.replace(/\W/g, '-')}`}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-2 ${
                        isSelected
                          ? 'bg-neutral-800 text-red-300 font-bold border border-neutral-700/80'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                      }`}
                    >
                      <FileCode className={`w-3.5 h-3.5 ${
                        file.name.endsWith('.py') ? 'text-sky-400' :
                        file.name.endsWith('.ino') ? 'text-emerald-400' :
                        file.name.endsWith('.txt') ? 'text-amber-400' : 'text-neutral-400'
                      }`} />
                      <span className="truncate">{file.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Run Tip */}
            <div className="mt-auto pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 font-mono space-y-1">
              <p className="text-neutral-400 font-semibold">How to Run Locally:</p>
              <div className="p-2 bg-neutral-900 rounded border border-neutral-800 select-all text-[10px] text-neutral-300">
                pip install -r requirements.txt<br/>
                python main.py
              </div>
            </div>
          </div>

          {/* Right: Code Viewer */}
          <div className="flex-1 flex flex-col bg-neutral-900 overflow-hidden">
            {/* File Info Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-950/80 border-b border-neutral-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-200 font-bold">{selectedFile.path}</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-400">{selectedFile.description}</span>
              </div>

              <button
                id="btn-copy-selected-file-code"
                onClick={handleCopy}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono rounded border border-neutral-700 transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Source Code Display */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-neutral-200 bg-neutral-950/90 leading-relaxed selection:bg-red-500 selection:text-white">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span>Final Year Project Software • Modular OOP Python Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-semibold"
          >
            Close Studio
          </button>
        </div>
      </div>
    </div>
  );
};
