'use client';

import React, { useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  X,
  Shield,
  Loader2,
} from 'lucide-react';
import { SshKeyItem } from '@/lib/ssh-workspace';

interface KeychainWorkspaceProps {
  keys: SshKeyItem[];
  onAddKey: (key: SshKeyItem) => void;
  onDeleteKey: (id: string) => void;
}

export default function KeychainWorkspace({
  keys,
  onAddKey,
  onDeleteKey,
}: KeychainWorkspaceProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Keygen state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyAlgo, setNewKeyAlgo] = useState<'ed25519' | 'rsa-4096'>('ed25519');
  const [newKeyComment, setNewKeyComment] = useState('root@localhost');
  const [isGenerating, setIsGenerating] = useState(false);

  // Import state
  const [importLabel, setImportLabel] = useState('');
  const [importPrivKey, setImportPrivKey] = useState('');
  const [importPubKey, setImportPubKey] = useState('');

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownloadPrivateKey = (key: SshKeyItem) => {
    const blob = new Blob([key.privateKey], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key.label}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPublicKey = (key: SshKeyItem) => {
    const blob = new Blob([key.publicKey], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key.label}.pub`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ssh/keygen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm: newKeyAlgo,
          comment: newKeyComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate key');

      onAddKey({
        id: `key-${Date.now()}`,
        label: newKeyLabel.trim(),
        algorithm: data.algorithm,
        bits: data.bits,
        fingerprint: data.fingerprint,
        publicKey: data.publicKey,
        privateKey: data.privateKey,
        createdAt: new Date().toISOString().slice(0, 10),
      });

      setShowGenerateModal(false);
      setNewKeyLabel('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Keygen failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importLabel.trim() || !importPrivKey.trim()) return;

    onAddKey({
      id: `key-import-${Date.now()}`,
      label: importLabel.trim(),
      algorithm: importPrivKey.includes('OPENSSH') ? 'Ed25519' : 'RSA',
      bits: 256,
      fingerprint: 'SHA256:imported-manual-key',
      publicKey: importPubKey.trim() || 'ssh-imported-key user@host',
      privateKey: importPrivKey.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    });

    setShowImportModal(false);
    setImportLabel('');
    setImportPrivKey('');
    setImportPubKey('');
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-none sm:rounded-lg overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-3 bg-zinc-900/60 gap-2">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-medium text-white uppercase tracking-wider font-mono">
            SSH Keychain ({keys.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate</span>
          </button>
        </div>
      </div>

      {/* Key List */}
      <div className="flex-1 overflow-auto p-2.5 sm:p-4 space-y-3 min-h-0 min-w-0">
        {keys.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
            No keys saved. Click Generate to create an Ed25519 or RSA key pair.
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className="bg-black border border-zinc-800 rounded-lg p-3 sm:p-4 space-y-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate font-mono max-w-[150px] sm:max-w-[260px]">
                      {k.label}
                    </span>
                    <span className="text-[10px] text-zinc-400 border border-zinc-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                      {k.algorithm} {k.bits}b
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                    {k.fingerprint}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyToClipboard(`pub-${k.id}`, k.publicKey)}
                    className="p-1.5 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Copy Public Key"
                  >
                    {copiedId === `pub-${k.id}` ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDownloadPrivateKey(k)}
                    className="p-1.5 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Download Private Key (.pem)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteKey(k.id)}
                    className="p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Public Key Display */}
              <div className="bg-zinc-950 border border-zinc-900 rounded p-2 text-[11px] font-mono text-zinc-400 break-all select-all">
                {k.publicKey}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Generate Key Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleGenerateKey}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 w-[calc(100vw-1.5rem)] sm:w-full max-w-sm space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Generate SSH Key</h3>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Key Label</label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="e.g. id_ed25519_prod"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Algorithm</label>
                <select
                  value={newKeyAlgo}
                  onChange={(e) => setNewKeyAlgo(e.target.value as any)}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none font-mono"
                >
                  <option value="ed25519">Ed25519 (Recommended, 256-bit)</option>
                  <option value="rsa-4096">RSA (4096-bit)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Comment</label>
                <input
                  type="text"
                  value={newKeyComment}
                  onChange={(e) => setNewKeyComment(e.target.value)}
                  placeholder="root@localhost"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating || !newKeyLabel.trim()}
                className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Generate</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleImportKey}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 w-[calc(100vw-1.5rem)] sm:w-full max-w-md space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Import SSH Key</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Label</label>
                <input
                  type="text"
                  value={importLabel}
                  onChange={(e) => setImportLabel(e.target.value)}
                  placeholder="e.g. imported_key"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Private Key (PEM)</label>
                <textarea
                  value={importPrivKey}
                  onChange={(e) => setImportPrivKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                  rows={4}
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Public Key (Optional)</label>
                <input
                  type="text"
                  value={importPubKey}
                  onChange={(e) => setImportPubKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3... root@localhost"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!importLabel.trim() || !importPrivKey.trim()}
                className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                Import Key
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
