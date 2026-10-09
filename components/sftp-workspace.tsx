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

  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputVal, setPathInputVal] = useState('');

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

  const [renameItem, setRenameItem] = useState<FsItem | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const [createModal, setCreateModal] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDirectory = useCallback(
    async (targetPath?: string) => {
      setLoading(true);
      setErrorMsg(null);

      if (activeHost.isLocalWorkspace) {
        const pathToCheck = targetPath || currentPath || '/root';
        if (pathToCheck !== '/root' && !pathToCheck.startsWith('/root/')) {
          setLoading(false);
          setErrorMsg('EISDIR: illegal operation on a directory, read');
          return;
        }
      }

      try {
        if (activeHost.isLocalWorkspace) {
          const query = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
          const res = await fetch(`/api/fs${query}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to list directory');
          setCurrentPath(data.path);
          setPathInputVal(data.path);
          setItems(data.items);
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
    [activeHost, currentPath, keys]
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
      } catch {}
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

  const handleOpenFile = async (item: FsItem) => {
    if (activeHost.isLocalWorkspace && item.path !== '/root' && !item.path.startsWith('/root/')) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }
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

  const handleDownloadItem = async (item: FsItem) => {
    setDownloadingPath(item.path);
    try {
      if (activeHost.isLocalWorkspace) {
        const downloadUrl = `/api/fs?path=${encodeURIComponent(item.path)}&download=true`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

        if (activeHost.isLocalWorkspace && !targetPath.startsWith('/root')) {
          throw new Error('EISDIR: illegal operation on a directory, read');
        }

        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
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

  const handleCreateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !createModal) return;

    const newPath = currentPath.endsWith('/')
      ? `${currentPath}${newItemName.trim()}`
      : `${currentPath}/${newItemName.trim()}`;

    if (activeHost.isLocalWorkspace && !newPath.startsWith('/root')) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }

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

  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem || !renameNewName.trim()) return;

    const parentDir = renameItem.path.slice(0, renameItem.path.lastIndexOf('/'));
    const newPath = `${parentDir}/${renameNewName.trim()}`;

    if (activeHost.isLocalWorkspace && !newPath.startsWith('/root')) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }

    setRenameLoading(true);
    try {
      if (activeHost.isLocalWorkspace) {
        await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rename',
            oldPath: renameItem.path,
            newPath,
          }),
        });
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

  const handleDeleteItem = async (item: FsItem) => {
    if (!confirm(`Hapus "${item.name}"?`)) return;

    if (activeHost.isLocalWorkspace && (item.path === '/root' || !item.path.startsWith('/root/'))) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }

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
    if (activeHost.isLocalWorkspace) {
      if (!currentPath || currentPath === '/root' || currentPath === '/root/') {
        setErrorMsg('EISDIR: illegal operation on a directory, read');
        return;
      }
    }
    if (!currentPath || currentPath === '/' || currentPath === '.') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = currentPath.startsWith('/') ? '/' + parts.join('/') : parts.join('/') || '.';
    if (activeHost.isLocalWorkspace && !upPath.startsWith('/root')) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }
    loadDirectory(upPath);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const handleBreadcrumbClick = (index: number) => {
    const subSegments = pathSegments.slice(0, index + 1);
    const target = currentPath.startsWith('/') ? '/' + subSegments.join('/') : subSegments.join('/');
    if (activeHost.isLocalWorkspace && !target.startsWith('/root')) {
      setErrorMsg('EISDIR: illegal operation on a directory, read');
      return;
    }
    loadDirectory(target || '/');
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-none sm:rounded-lg overflow-hidden font-sans">
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 p-2 sm:p-3 bg-zinc-900/60 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1">
            <DistroIcon host={activeHost} className="w-4 h-4 shrink-0" />
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

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFiles}
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs rounded flex items-center gap-1.5 transition-colors"
            title="Upload Files"
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={() => {
              setCreateModal('file');
              setNewItemName('');
            }}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs rounded flex items-center gap-1.5 transition-colors"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New File</span>
          </button>

          <button
            onClick={() => {
              setCreateModal('folder');
              setNewItemName('');
            }}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs rounded flex items-center gap-1.5 transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Folder</span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-black/60 gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            onClick={handleNavigateUp}
            disabled={loading || (activeHost.isLocalWorkspace && (currentPath === '/root' || currentPath === '/root/'))}
            className="p-1 hover:bg-zinc-800 disabled:opacity-40 rounded text-zinc-400 hover:text-white transition-colors shrink-0"
            title="Up directory"
          >
            <CornerLeftUp className="w-4 h-4" />
          </button>

          {isEditingPath ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsEditingPath(false);
                if (activeHost.isLocalWorkspace && !pathInputVal.startsWith('/root')) {
                  setErrorMsg('EISDIR: illegal operation on a directory, read');
                  return;
                }
                loadDirectory(pathInputVal);
              }}
              className="flex-1 flex items-center gap-1"
            >
              <input
                type="text"
                value={pathInputVal}
                onChange={(e) => setPathInputVal(e.target.value)}
                onBlur={() => setIsEditingPath(false)}
                className="w-full bg-zinc-900 border border-zinc-700 text-xs text-white px-2 py-0.5 rounded font-mono outline-none"
                autoFocus
              />
            </form>
          ) : (
            <div
              onClick={() => setIsEditingPath(true)}
              className="flex-1 flex items-center gap-1 text-xs font-mono text-zinc-300 overflow-x-auto scrollbar-none py-0.5 px-1 rounded hover:bg-zinc-900/60 cursor-pointer min-w-0"
              title="Click to edit path"
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeHost.isLocalWorkspace) {
                    loadDirectory('/root');
                  } else {
                    loadDirectory('/');
                  }
                }}
                className="text-zinc-500 hover:text-white"
              >
                /
              </span>
              {pathSegments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBreadcrumbClick(idx);
                    }}
                    className="hover:text-white truncate max-w-[120px]"
                  >
                    {seg}
                  </span>
                  {idx < pathSegments.length - 1 && <span className="text-zinc-600">/</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 max-w-[130px] sm:max-w-[200px]">
          <Search className="w-3 h-3 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari file..."
            className="w-full bg-transparent text-[11px] text-white outline-none placeholder-zinc-500"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border-b border-red-500/40 text-red-300 px-3 py-1.5 text-xs flex items-center justify-between shrink-0 font-mono">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Membaca direktori...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-500 text-xs font-mono">
            Direktori kosong atau file tidak ditemukan.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 select-none bg-zinc-900/40">
                <th className="py-2 px-3">Nama</th>
                <th className="py-2 px-3 hidden sm:table-cell">Ukuran</th>
                <th className="py-2 px-3 hidden md:table-cell">Izin</th>
                <th className="py-2 px-3 hidden lg:table-cell">Dimodifikasi</th>
                <th className="py-2 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredItems.map((item) => {
                const isDir = item.type === 'dir';
                const isDownloading = downloadingPath === item.path;
                return (
                  <tr
                    key={item.path}
                    className="hover:bg-zinc-900/60 transition-colors group text-zinc-300 cursor-pointer"
                    onDoubleClick={() => {
                      if (isDir) {
                        loadDirectory(item.path);
                      } else {
                        handleOpenFile(item);
                      }
                    }}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isDir ? (
                          <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <span
                          onClick={() => {
                            if (isDir) loadDirectory(item.path);
                            else handleOpenFile(item);
                          }}
                          className={`truncate max-w-[160px] sm:max-w-[260px] md:max-w-none ${
                            isDir ? 'text-white font-medium hover:underline' : 'hover:text-white'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-zinc-400 hidden sm:table-cell">
                      {isDir ? '—' : formatSize(item.size)}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 hidden md:table-cell">
                      {item.permissions}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 hidden lg:table-cell">
                      {item.modified}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {!isDir && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadItem(item);
                            }}
                            disabled={isDownloading}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Download file"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {!isDir && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFile(item);
                            }}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Edit file"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameItem(item);
                            setRenameNewName(item.name);
                          }}
                          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-[10px]"
                          title="Rename"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item);
                          }}
                          className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-colors"
                          title="Hapus"
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

      {editingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-semibold text-white font-mono truncate">
                  {editingFile.name}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline truncate">
                  ({editingFile.path})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
                >
                  {savingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden bg-black flex">
              <div
                ref={lineNumbersRef}
                className="w-10 bg-zinc-950 text-zinc-600 font-mono text-xs select-none p-3 text-right leading-5 border-r border-zinc-900 overflow-hidden"
              >
                {editingFile.content.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              <textarea
                value={editingFile.content}
                onChange={(e) =>
                  setEditingFile((prev) => (prev ? { ...prev, content: e.target.value } : null))
                }
                onScroll={(e) => {
                  if (lineNumbersRef.current) {
                    lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                className="flex-1 h-full w-full bg-black text-zinc-200 font-mono text-xs p-3 leading-5 outline-none resize-none overflow-auto"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {renameItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none">
          <form
            onSubmit={handleRenameConfirm}
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Rename</h3>
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              className="w-full bg-black border border-zinc-700 text-xs text-white p-2 rounded outline-none font-mono"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={renameLoading || !renameNewName.trim()}
                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded"
              >
                {renameLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none">
          <form
            onSubmit={handleCreateConfirm}
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">
                {createModal === 'folder' ? 'New Folder' : 'New File'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={createModal === 'folder' ? 'nama-folder' : 'nama-file.txt'}
              className="w-full bg-black border border-zinc-700 text-xs text-white p-2 rounded outline-none font-mono"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded"
              >
                Buat
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
