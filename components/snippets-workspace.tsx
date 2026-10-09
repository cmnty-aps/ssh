'use client';

import React, { useState } from 'react';
import {
  Code,
  Plus,
  Play,
  Copy,
  Check,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { SshSnippet } from '@/lib/ssh-workspace';
import SyntaxHighlighter from '@/components/syntax-highlighter';

interface SnippetsWorkspaceProps {
  snippets: SshSnippet[];
  onAddSnippet: (snippet: SshSnippet) => void;
  onDeleteSnippet: (id: string) => void;
  onRunSnippet: (command: string) => void;
}

const CATEGORIES = ['All', 'System', 'Docker', 'Network', 'Logs', 'Git'] as const;

export default function SnippetsWorkspace({
  snippets,
  onAddSnippet,
  onDeleteSnippet,
  onRunSnippet,
}: SnippetsWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SshSnippet['category']>('System');
  const [formCommand, setFormCommand] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCommand.trim()) return;

    onAddSnippet({
      id: `snip-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      command: formCommand.trim(),
      description: formDesc.trim() || 'Custom snippet',
    });

    setShowAddModal(false);
    setFormName('');
    setFormCommand('');
    setFormDesc('');
  };

  const filteredSnippets = snippets.filter((s) => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.command.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-none sm:rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 p-2 sm:p-3 bg-zinc-900/60 gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white text-black font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded flex items-center gap-1 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Snippet</span>
        </button>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800 bg-black flex items-center">
        <Search className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commands..."
          className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-mono"
        />
      </div>

      <div className="flex-1 overflow-auto p-2.5 sm:p-4 space-y-2 min-h-0 min-w-0">
        {filteredSnippets.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
            No snippets found
          </div>
        ) : (
          filteredSnippets.map((s) => (
            <div
              key={s.id}
              className="bg-black border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white truncate max-w-[150px] sm:max-w-none">{s.name}</span>
                  <span className="text-[10px] text-zinc-500 border border-zinc-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                    {s.category}
                  </span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 mt-1 font-mono text-xs overflow-x-auto select-all">
                  <SyntaxHighlighter code={s.command} language="bash" />
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => onRunSnippet(s.command)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded flex items-center gap-1 transition-colors"
                  title="Run in Active Terminal"
                >
                  <Play className="w-3 h-3 text-white" />
                  <span>Run</span>
                </button>
                <button
                  onClick={() => copyToClipboard(s.id, s.command)}
                  className="p-1.5 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Copy command"
                >
                  {copiedId === s.id ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => onDeleteSnippet(s.id)}
                  className="p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCreate}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-5 w-[calc(100vw-1.5rem)] sm:w-full max-w-sm space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Add Snippet</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Snippet Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Check Ports"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white outline-none"
                >
                  <option value="System">System</option>
                  <option value="Docker">Docker</option>
                  <option value="Network">Network</option>
                  <option value="Logs">Logs</option>
                  <option value="Git">Git</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Command</label>
                <input
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="e.g. ss -tulpn"
                  className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formName.trim() || !formCommand.trim()}
                className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                Save Snippet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
