import JSZip from 'jszip';
import { PYTHON_CODEBASE } from '../data/pythonCodebase';

export async function generateAndDownloadProjectZip(): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder('FireGuard_AI');
  if (!root) return;

  // Deduplicate all files by unique path to ensure clean download
  const seenPaths = new Set<string>();
  const uniqueFiles = PYTHON_CODEBASE.filter((file) => {
    const key = file.path.trim().toLowerCase();
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
    return true;
  });

  // Add all unique files
  for (const file of uniqueFiles) {
    if (file.path.includes('/')) {
      const parts = file.path.split('/');
      const filename = parts.pop()!;
      let currentFolder = root;
      for (const part of parts) {
        currentFolder = currentFolder.folder(part)!;
      }
      currentFolder.file(filename, file.content);
    } else {
      root.file(file.name, file.content);
    }
  }

  // Create empty directories
  root.folder('logs');
  root.folder('screenshots');
  root.folder('models');
  root.folder('assets');

  // Add dummy placeholder for weights readme
  root.file('models/README.txt', 'Place custom yolov8n-fire.pt weights here or let the application auto-download pretrained yolov8n.pt on first launch.');

  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FireGuard_AI_Diploma_Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
