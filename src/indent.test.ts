import { describe, expect, it } from 'vitest'
import { shiftIndent } from './indent'

function apply(text: string, start: number, end: number, direction: 1 | -1) {
  const edit = shiftIndent(text, start, end, direction)
  const result = text.slice(0, edit.blockStart) + edit.replacement + text.slice(edit.blockEnd)
  return { result, selected: result.slice(edit.start, edit.end), start: edit.start, end: edit.end }
}

describe('shiftIndent', () => {
  const text = 'a:\n  b: 1\n  c: 2\nd: 3\n'

  it('indents all lines touched by a partial selection and keeps the selection', () => {
    const start = text.indexOf('b: 1') + 2
    const end = text.indexOf('c: 2') + 1
    const { result, selected } = apply(text, start, end, 1)
    expect(result).toBe('a:\n    b: 1\n    c: 2\nd: 3\n')
    expect(selected).toBe(' 1\n    c') // same boundaries relative to the line content, with the inner indentation included
  })

  it('outdents by at most one unit and clamps the selection to the line start', () => {
    const start = text.indexOf('  b: 1') + 1
    const end = text.indexOf('d: 3') + 1
    const { result, start: newStart, selected } = apply(text, start, end, -1)
    expect(result).toBe('a:\nb: 1\nc: 2\nd: 3\n')
    expect(newStart).toBe(result.indexOf('b: 1'))
    expect(selected).toBe('b: 1\nc: 2\nd')
  })

  it('does not touch the line after a selection ending on a newline', () => {
    const start = text.indexOf('a:')
    const end = text.indexOf('  c') // right after the newline of the "b" line
    expect(apply(text, start, end, 1).result).toBe('  a:\n    b: 1\n  c: 2\nd: 3\n')
  })

  it('handles a collapsed selection and the last line without trailing newline', () => {
    expect(apply('x\n  y', 4, 4, -1).result).toBe('x\ny')
    expect(apply('x\n  y', 4, 4, 1).result).toBe('x\n    y')
  })
})
