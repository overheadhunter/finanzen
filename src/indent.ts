export const INDENT = '  '

export interface IndentEdit {
  /** Offset of the first affected line's start. */
  blockStart: number
  /** Offset of the last affected line's end (exclusive, before its newline). */
  blockEnd: number
  /** New text for `[blockStart, blockEnd)`. */
  replacement: string
  /** Selection after the edit, keeping the originally selected text selected. */
  start: number
  end: number
}

/**
 * Indents or outdents every line touched by the selection `[start, end)`, including partially selected first and last lines.
 *
 * A selection ending right after a newline does not include the following line. Outdenting removes up to one indent unit of leading spaces per line.
 *
 * @param text the whole text
 * @param start selection start
 * @param end selection end
 * @param direction `1` to indent, `-1` to outdent
 * @return the edit to apply
 */
export function shiftIndent(text: string, start: number, end: number, direction: 1 | -1): IndentEdit {
  const blockStart = text.lastIndexOf('\n', start - 1) + 1
  const lastLineAnchor = end > start && text[end - 1] === '\n' ? end - 1 : end
  const newline = text.indexOf('\n', lastLineAnchor)
  const blockEnd = newline === -1 ? text.length : newline
  let firstDelta = 0
  let totalDelta = 0
  const lines = text
    .slice(blockStart, blockEnd)
    .split('\n')
    .map((line, i) => {
      const removed = direction < 0 ? Math.min(INDENT.length, line.length - line.trimStart().length) : 0
      const delta = direction > 0 ? INDENT.length : -removed
      if (i === 0) firstDelta = delta
      totalDelta += delta
      return direction > 0 ? INDENT + line : line.slice(removed)
    })
  const newStart = Math.max(blockStart, start + firstDelta)
  return { blockStart, blockEnd, replacement: lines.join('\n'), start: newStart, end: Math.max(newStart, end + totalDelta) }
}
