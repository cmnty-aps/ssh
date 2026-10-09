import React from 'react';

interface AnsiSpan {
  text: string;
  color?: string;
  bold?: boolean;
}

export function parseAnsiToSpans(input: string): AnsiSpan[] {
  if (!input) return [];

  // Standard ANSI color codes mapping
  const colorMap: Record<number, string> = {
    30: 'text-zinc-600', // black
    31: 'text-red-400', // red
    32: 'text-emerald-400', // green
    33: 'text-amber-400', // yellow
    34: 'text-blue-400', // blue
    35: 'text-purple-400', // magenta
    36: 'text-cyan-400', // cyan
    37: 'text-zinc-200', // white
    90: 'text-zinc-500', // bright black
    91: 'text-red-300', // bright red
    92: 'text-emerald-300', // bright green
    93: 'text-yellow-300', // bright yellow
    94: 'text-blue-300', // bright blue
    95: 'text-purple-300', // bright magenta
    96: 'text-cyan-300', // bright cyan
    97: 'text-white', // bright white
  };

  const regex = /\u001b\[([0-9;]*)m/g;
  const spans: AnsiSpan[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let currentBold = false;

  let match;
  while ((match = regex.exec(input)) !== null) {
    const textChunk = input.slice(lastIndex, match.index);
    if (textChunk) {
      spans.push({
        text: textChunk,
        color: currentColor,
        bold: currentBold,
      });
    }

    const codeStr = match[1] || '0';
    const codes = codeStr.split(';').map((s) => parseInt(s, 10) || 0);

    for (const code of codes) {
      if (code === 0) {
        currentColor = undefined;
        currentBold = false;
      } else if (code === 1) {
        currentBold = true;
      } else if (colorMap[code]) {
        currentColor = colorMap[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  const trailing = input.slice(lastIndex);
  if (trailing) {
    spans.push({
      text: trailing,
      color: currentColor,
      bold: currentBold,
    });
  }

  return spans;
}

export function renderAnsiText(input: string): React.ReactNode {
  const spans = parseAnsiToSpans(input);
  if (spans.length === 0) return null;

  return spans.map((s, idx) => (
    <span
      key={idx}
      className={`${s.color || ''} ${s.bold ? 'font-bold' : ''}`}
    >
      {s.text}
    </span>
  ));
}
