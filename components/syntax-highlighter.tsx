'use client';

import React, { useMemo } from 'react';
import hljs from 'highlight.js';

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function highlightCode(rawCode: string, lang?: string): string {
  if (!rawCode) return '';
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(rawCode, { language: lang, ignoreIllegals: true }).value;
    }
    // Auto detection
    return hljs.highlightAuto(rawCode).value;
  } catch {
    // Fallback escaped text
    return rawCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export default function SyntaxHighlighter({
  code,
  language = 'bash',
  className = '',
  showLineNumbers = false,
}: SyntaxHighlighterProps) {
  const highlightedHtml = useMemo(() => {
    return highlightCode(code, language);
  }, [code, language]);

  const lines = useMemo(() => {
    return highlightedHtml.split('\n');
  }, [highlightedHtml]);

  if (!showLineNumbers) {
    return (
      <code
        className={`hljs font-mono text-xs ${className}`}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    );
  }

  return (
    <pre className={`hljs font-mono text-xs p-2 overflow-x-auto ${className}`}>
      <code>
        {lines.map((line, idx) => (
          <div key={idx} className="flex leading-relaxed hover:bg-zinc-900/40">
            <span className="text-zinc-600 select-none text-right pr-3 shrink-0 w-8 text-[11px]">
              {idx + 1}
            </span>
            <span
              className="flex-1 whitespace-pre"
              dangerouslySetInnerHTML={{ __html: line || ' ' }}
            />
          </div>
        ))}
      </code>
    </pre>
  );
}
