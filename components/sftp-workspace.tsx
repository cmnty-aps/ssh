'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  FileText,
  FolderPlus,
  FilePlus,
  Upload,
  Download,
  Trash2,
  CornerLeftUp,
  RefreshCw,
  Search,
  X,
  Save,
  Server,
  Loader2,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import { SshHost, FsItem, SshKeyItem } from '@/lib/ssh-workspace';
import DistroIcon from '@/components/distro-icon';
import { highlightCode } from '@/components/syntax-highlighter';

interface SftpWorkspaceProps {
  hosts: SshHost[];
  selectedHostId: string;
  keys: SshKeyItem[];
  onSelectHost: (hostId: string) => void;
}

export default function SftpWorkspace({
  hosts,
  selectedHostId,
  keys,
  onSelectHost,
}: SftpWorkspaceProps) {
  const activeHost = hosts.find((h) => h.id === selectedHostId) || hosts[0];

  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Path Manual Input Mode
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputVal, setPathInputVal] = useState('');

  // Editor Modal State
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const preHighlightRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'mjs':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'py':
        return 'python';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'bash';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'html':
      case 'htm':
        return 'xml';
      case 'css':
        return 'css';
      case 'sql':
        return 'sql';
      case 'md':
        return 'markdown';
      case 'env':
      case 'ini':
      case 'conf':
        return 'ini';
      default:
        return 'bash';
    }
  };

  // Rename Modal State
  const [renameItem, setRenameItem] = useState<FsItem | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // New File/Folder Modals
  const [createModal, setCreateModal] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch Directory Listing
  const loadDirectory = useCallback(
    async (targetPath?: string) => {
      setLoading(true);
      setErrorMsg(null);

      try {
        if (activeHost.isLocalWorkspace) {
          // Real local filesystem
          const query = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
          const res = await fetch(`/api/fs${query}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to list directory');
          setCurrentPath(data.path);
          setPathInputVal(data.path);
          setItems(data.items);
        } else {
          // Real remote SFTP over SSH
          const selectedKey = keys.find((k) => k.id === activeHost.keyId);
          const res = await fetch('/api/ssh/sftp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: activeHost.hostname,
              port: activeHost.port,
              username: activeHost.username,
              password: activeHost.password,
              privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
              action: 'list',
              remotePath: targetPath || '.',
            }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'SFTP connection failed');
          setCurrentPath(data.path || targetPath || '.');
          setPathInputVal(data.path || targetPath || '.');
          setItems(data.items || []);
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    },
    [activeHost, keys]
  );

  useEffect(() => {
    let ignore = false;
    const initFetch = async () => {
      try {
        if (activeHost.isLocalWorkspace) {
          const res = await fetch('/api/fs');
          const data = await res.json();
          if (!ignore && res.ok) {
            setCurrentPath(data.path);
            setPathInputVal(data.path);
            setItems(data.items);
          }
        } else {
          const selectedKey = keys.find((k) => k.id === activeHost.keyId);
          const res = await fetch('/api/ssh/sftp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: activeHost.hostname,
              port: activeHost.port,
              username: activeHost.username,
              password: activeHost.password,
              privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
              action: 'list',
              remotePath: '.',
            }),
          });
          const data = await res.json();
          if (!ignore && res.ok && !data.error) {
            setCurrentPath(data.path || '.');
            setPathInputVal(data.path || '.');
            setItems(data.items || []);
          }
        }
      } catch {
        // Ignore unmounted race
      }
    };
    initFetch();
    return () => {
      ignore = true;
    };
  }, [
    activeHost.id,
    activeHost.isLocalWorkspace,
    activeHost.hostname,
    activeHost.port,
    activeHost.username,
    activeHost.password,
    activeHost.authMethod,
    activeHost.keyId,
    keys,
  ]);

  // Read File into Modal Editor
  const handleOpenFile = async (item: FsItem) => {
    setEditorLoading(true);
    setErrorMsg(null);
    try {
      if (activeHost.isLocalWorkspace) {
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', path: item.path }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEditingFile({ path: item.path, name: item.name, content: data.content });
      } else {
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        const res = await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: 'read',
            remotePath: item.path,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error);
        setEditingFile({ path: item.path, name: item.name, content: data.content });
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setEditorLoading(false);
    }
  };

  // Save File from Modal Editor
  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      if (activeHost.isLocalWorkspace) {
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'write',
            path: editingFile.path,
            content: editingFile.content,
          }),
        });
        if (!res.ok) throw new Error('Save failed');
      } else {
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        const res = await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: 'write',
            remotePath: editingFile.path,
            content: editingFile.content,
          }),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      setEditingFile(null);
      loadDirectory(currentPath);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSavingFile(false);
    }
  };

  // Download File (1-Click)
  const handleDownloadItem = async (item: FsItem) => {
    setDownloadingPath(item.path);
    try {
      if (activeHost.isLocalWorkspace) {
        // Direct browser download stream from server
        const downloadUrl = `/api/fs?path=${encodeURIComponent(item.path)}&download=true`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Remote SFTP base64 read -> blob download
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        const res = await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: 'download_base64',
            remotePath: item.path,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Download failed');

        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingPath(null);
    }
  };

  // Upload File
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const targetPath = currentPath.endsWith('/')
          ? `${currentPath}${file.name}`
          : `${currentPath}/${file.name}`;

        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip data:*;base64, header
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (activeHost.isLocalWorkspace) {
          const res = await fetch('/api/fs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'write',
              path: targetPath,
              content: base64Content,
              isBase64: true,
            }),
          });
          if (!res.ok) throw new Error(`Upload of ${file.name} failed`);
        } else {
          const selectedKey = keys.find((k) => k.id === activeHost.keyId);
          const res = await fetch('/api/ssh/sftp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: activeHost.hostname,
              port: activeHost.port,
              username: activeHost.username,
              password: activeHost.password,
              privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
              action: 'write',
              remotePath: targetPath,
              content: base64Content,
              isBase64: true,
            }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `Upload of ${file.name} failed`);
        }
      }

      loadDirectory(currentPath);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create File or Folder
  const handleCreateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !createModal) return;

    const newPath = currentPath.endsWith('/')
      ? `${currentPath}${newItemName.trim()}`
      : `${currentPath}/${newItemName.trim()}`;

    try {
      if (activeHost.isLocalWorkspace) {
        await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: createModal === 'folder' ? 'mkdir' : 'write',
            path: newPath,
            content: '',
          }),
        });
      } else {
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: createModal === 'folder' ? 'mkdir' : 'write',
            remotePath: newPath,
            content: '',
          }),
        });
      }
      setCreateModal(null);
      setNewItemName('');
      loadDirectory(currentPath);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Create error');
    }
  };

  // Rename File/Folder
  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem || !renameNewName.trim() || renameNewName === renameItem.name) {
      setRenameItem(null);
      return;
    }

    setRenameLoading(true);
    const parent = renameItem.path.slice(0, renameItem.path.lastIndexOf('/')) || '';
    const newPath = parent ? `${parent}/${renameNewName.trim()}` : renameNewName.trim();

    try {
      if (activeHost.isLocalWorkspace) {
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rename',
            oldPath: renameItem.path,
            newPath,
          }),
        });
        if (!res.ok) throw new Error('Rename failed');
      } else {
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        const res = await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: 'rename',
            remotePath: renameItem.path,
            newPath,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Rename failed');
      }
      setRenameItem(null);
      loadDirectory(currentPath);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Rename error');
    } finally {
      setRenameLoading(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: FsItem) => {
    if (!confirm(`Permanently delete "${item.name}"?`)) return;

    try {
      if (activeHost.isLocalWorkspace) {
        await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', path: item.path }),
        });
      } else {
        const selectedKey = keys.find((k) => k.id === activeHost.keyId);
        await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: activeHost.hostname,
            port: activeHost.port,
            username: activeHost.username,
            password: activeHost.password,
            privateKey: activeHost.authMethod === 'key' ? selectedKey?.privateKey : undefined,
            action: 'delete',
            remotePath: item.path,
          }),
        });
      }
      loadDirectory(currentPath);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete error');
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath || currentPath === '/' || currentPath === '.') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = currentPath.startsWith('/') ? '/' + parts.join('/') : parts.join('/') || '.';
    loadDirectory(upPath);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Breadcrumbs segments
  const pathSegments = currentPath
    ? currentPath.split('/').filter(Boolean)
    : [];

  const handleBreadcrumbClick = (index: number) => {
    const subSegments = pathSegments.slice(0, index + 1);
    const target = currentPath.startsWith('/') ? '/' + subSegments.join('/') : subSegments.join('/');
    loadDirectory(target || '/');
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-none sm:rounded-lg overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 p-2 sm:p-3 bg-zinc-900/60 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1">
            <DistroIcon host={activeHost} className="w-4.5 h-4.5 shrink-0" />
          </div>
          <select
            value={activeHost.id}
            onChange={(e) => onSelectHost(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-xs text-white rounded px-2 py-1 outline-none font-medium truncate max-w-[140px] sm:max-w-[200px]"
          >
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} ({h.hostname})
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls: Upload, New File, New Folder, Refresh */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Hidden File Input for Upload */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUploadFiles}
            multiple
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Upload files from device"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={() => {
              setNewItemName('');
              setCreateModal('file');
            }}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded flex items-center gap-1 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">File</span>
          </button>

          <button
            onClick={() => {
              setNewItemName('');
              setCreateModal('folder');
            }}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded flex items-center gap-1 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Folder</span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Breadcrumbs & Search */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-black text-xs gap-2 shrink-0">
        <div className="flex items-center gap-1 min-w-0 flex-1 font-mono text-zinc-300 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={handleNavigateUp}
            disabled={!currentPath || currentPath === '/' || currentPath === '.'}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 rounded hover:bg-zinc-900 shrink-0"
            title="Go up one folder"
          >
            <CornerLeftUp className="w-3.5 h-3.5" />
          </button>

          {isEditingPath ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsEditingPath(false);
                loadDirectory(pathInputVal);
              }}
              className="flex items-center gap-1 flex-1 min-w-[120px]"
            >
              <input
                type="text"
                value={pathInputVal}
                onChange={(e) => setPathInputVal(e.target.value)}
                onBlur={() => setIsEditingPath(false)}
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-700 text-xs text-white px-2 py-0.5 rounded outline-none font-mono"
              />
            </form>
          ) : (
            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none">
              <button
                onClick={() => loadDirectory('/')}
                className="hover:text-white hover:bg-zinc-900 px-1 py-0.5 rounded text-zinc-400 shrink-0 font-mono font-medium"
                title="Root directory"
              >
                /
              </button>

              {pathSegments.map((segment, idx) => (
                <React.Fragment key={`${segment}-${idx}`}>
                  <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    className={`hover:text-white hover:bg-zinc-900 px-1 py-0.5 rounded shrink-0 font-mono ${
                      idx === pathSegments.length - 1 ? 'text-white font-medium' : 'text-zinc-400'
                    }`}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              ))}

              <button
                onClick={() => setIsEditingPath(true)}
                className="p-1 text-zinc-500 hover:text-zinc-300 ml-1 rounded hover:bg-zinc-900 shrink-0"
                title="Edit path directly"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* Filter Input */}
        <div className="relative shrink-0 w-28 sm:w-44">
          <Search className="w-3 h-3 absolute left-2 top-2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-700 font-mono"
          />
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-red-950/40 border-b border-red-800/40 text-red-300 text-xs flex items-center justify-between shrink-0">
          <span className="truncate">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File List Table */}
      <div className="flex-1 overflow-auto min-h-0 min-w-0">
        {loading && items.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-500 gap-2 font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading filesystem...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
            Empty directory
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-medium select-none bg-zinc-900/40 font-mono">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3 text-right hidden sm:table-cell">Size</th>
                <th className="py-2 px-3 hidden md:table-cell">Mode</th>
                <th className="py-2 px-3 text-right hidden sm:table-cell">Modified</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 font-mono">
              {filteredItems.map((item) => {
                const isDir = item.type === 'dir';
                const isDownloadingThis = downloadingPath === item.path;

                return (
                  <tr
                    key={item.path}
                    className="hover:bg-zinc-900/60 transition-colors group text-zinc-300"
                  >
                    <td className="py-2 px-3">
                      <div
                        onClick={() => (isDir ? loadDirectory(item.path) : handleOpenFile(item))}
                        className="flex items-center gap-2 cursor-pointer hover:text-white"
                      >
                        {isDir ? (
                          <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span className={`truncate max-w-[120px] sm:max-w-[240px] md:max-w-none ${isDir ? 'font-medium text-white' : ''}`}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-400 hidden sm:table-cell">
                      {isDir ? '—' : formatSize(item.size)}
                    </td>
                    <td className="py-2 px-3 text-zinc-400 hidden md:table-cell">
                      {item.permissions}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-400 hidden sm:table-cell">
                      {item.modified}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                        {/* 1-Click Download Button */}
                        {!isDir && (
                          <button
                            onClick={() => handleDownloadItem(item)}
                            disabled={isDownloadingThis}
                            className="p-1 hover:text-white text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                            title="Download file (1-click)"
                          >
                            {isDownloadingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Rename */}
                        <button
                          onClick={() => {
                            setRenameItem(item);
                            setRenameNewName(item.name);
                          }}
                          className="p-1 hover:text-white text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 hover:text-red-400 text-zinc-500 hover:bg-zinc-800 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor Modal with Automatic Live Syntax Highlighting */}
      {editingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-[calc(100vw-1.5rem)] sm:w-full max-w-4xl flex flex-col h-[85dvh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 sm:px-4 py-2.5 bg-zinc-900 shrink-0 min-w-0">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-200 truncate min-w-0 mr-2">
                <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{editingFile.path}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-3 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {savingFile ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  <span>Save</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden bg-black font-mono text-xs flex min-h-0">
              {/* Synchronized Line Numbers */}
              <div
                ref={lineNumbersRef}
                className="bg-zinc-950 border-r border-zinc-800/80 text-zinc-600 select-none py-3 px-2 text-right text-[11px] font-mono shrink-0 overflow-hidden"
              >
                {editingFile.content.split('\n').map((_, i) => (
                  <div key={i} className="h-5 leading-5">{i + 1}</div>
                ))}
              </div>

              {/* Automatic Syntax Highlight Layer + Textarea Input */}
              <div className="flex-1 relative overflow-hidden min-w-0">
                <pre
                  ref={preHighlightRef}
                  aria-hidden="true"
                  className="absolute inset-0 m-0 p-3 font-mono text-xs leading-5 whitespace-pre pointer-events-none select-none hljs bg-transparent overflow-hidden"
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(editingFile.content, getFileLanguage(editingFile.name)) + '\n',
                  }}
                />
                <textarea
                  value={editingFile.content}
                  onChange={(e) =>
                    setEditingFile((prev) => (prev ? { ...prev, content: e.target.value } : null))
                  }
                  onScroll={(e) => {
                    if (preHighlightRef.current) {
                      preHighlightRef.current.scrollTop = e.currentTarget.scrollTop;
                      preHighlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                    }
                    if (lineNumbersRef.current) {
                      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
                    }
                  }}
                  className="absolute inset-0 m-0 p-3 font-mono text-xs leading-5 whitespace-pre bg-transparent text-transparent caret-white outline-none resize-none overflow-auto border-0 focus:ring-0"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleRenameConfirm}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 w-[calc(100vw-1.5rem)] sm:w-full max-w-sm space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white truncate max-w-[240px]">
                Rename {renameItem.name}
              </h3>
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-xs text-white outline-none font-mono focus:border-zinc-500"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameLoading || !renameNewName.trim()}
                className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                {renameLoading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCreateConfirm}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 w-[calc(100vw-1.5rem)] sm:w-full max-w-sm space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">
                Create New {createModal === 'folder' ? 'Folder' : 'File'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={createModal === 'folder' ? 'folder-name' : 'filename.txt'}
              className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-xs text-white outline-none font-mono focus:border-zinc-500"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
