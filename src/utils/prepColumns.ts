export type MeasuredGroup = {
  labelWidth: number
  chips: number[]
}

export type PrepRow = {
  kind: 'full'
  groups: number[]
} | {
  kind: 'split'
  left: number[]
  right: number[]
  template: string
}

export type PrepLayout = {
  rows: PrepRow[]
}

type Gaps = { column: number; chip: number; group: number }

const CHIP_ROW = 30

function needOf(group: MeasuredGroup) {
  return Math.max(group.labelWidth, ...group.chips, 0)
}

function columnHeight(groups: MeasuredGroup[], indexes: number[], width: number, gaps: Gaps) {
  let height = 0
  indexes.forEach((index, position) => {
    if (position > 0) height += gaps.group
    const group = groups[index]
    const headingLines = group.labelWidth > width ? Math.ceil(group.labelWidth / width) : 1
    height += headingLines * CHIP_ROW
    let used = 0
    let rows = 0
    for (const chip of group.chips) {
      if (chip > width) {
        if (used > 0) rows += 1
        rows += Math.ceil(chip / width)
        used = 0
      } else if (used === 0) {
        used = chip
      } else if (used + gaps.chip + chip <= width) {
        used += gaps.chip + chip
      } else {
        rows += 1
        used = chip
      }
    }
    if (used > 0) rows += 1
    height += rows * CHIP_ROW
  })
  return height
}

function widthChoices(min: number, max: number, groups: MeasuredGroup[], left: number[], right: number[], free: number, chipGap: number) {
  const values = new Set<number>()
  const add = (value: number) => {
    if (!Number.isFinite(value)) return
    const rounded = Math.round(value)
    if (rounded >= Math.floor(min) && rounded <= Math.ceil(max)) values.add(rounded)
  }
  add(min)
  add(max)
  add((min + max) / 2)
  const span = max - min
  if (span > 48) {
    for (let step = 1; step < 8; step++) add(min + (span * step) / 8)
  }
  const edges = (indexes: number[], side: 'left' | 'right') => {
    for (const index of indexes) {
      let sum = 0
      groups[index].chips.forEach((chip, chipIndex) => {
        sum = chipIndex === 0 ? chip : sum + chipGap + chip
        add(side === 'left' ? sum : free - sum)
      })
    }
  }
  edges(left, 'left')
  edges(right, 'right')
  return [...values]
}

function bestFit(groups: MeasuredGroup[], indexes: number[], free: number, gaps: Gaps): { left: number[]; right: number[]; leftPx: number } | null {
  if (indexes.length < 2 || free < 80) return null
  let best: { score: number[]; left: number[]; right: number[]; leftPx: number } | null = null
  const consider = (left: number[], right: number[]) => {
    const leftNeed = Math.max(...left.map((index) => needOf(groups[index])))
    const rightNeed = Math.max(...right.map((index) => needOf(groups[index])))
    if (leftNeed + rightNeed > free) return
    for (const leftPx of widthChoices(leftNeed, free - rightNeed, groups, left, right, free, gaps.chip)) {
      const rightPx = free - leftPx
      const leftHeight = columnHeight(groups, left, leftPx, gaps)
      const rightHeight = columnHeight(groups, right, rightPx, gaps)
      const score = [
        Math.round(Math.abs(leftHeight - rightHeight) / CHIP_ROW),
        leftHeight + rightHeight,
        Math.abs(leftPx - rightPx),
      ]
      if (!best || score.some((value, index) => value < best!.score[index] && score.slice(0, index).every((item, itemIndex) => item === best!.score[itemIndex]))) {
        best = { score, left, right, leftPx }
      }
    }
  }

  if (indexes.length > 12) {
    const ranked = [...indexes].sort((a, b) => needOf(groups[b]) - needOf(groups[a]) || a - b)
    const left = [ranked[0]]
    const right = [ranked[1]]
    for (const index of ranked.slice(2)) {
      const leftNeed = Math.max(...left.map((item) => needOf(groups[item])))
      const rightNeed = Math.max(...right.map((item) => needOf(groups[item])))
      const need = needOf(groups[index])
      const leftOk = Math.max(leftNeed, need) + rightNeed <= free
      const rightOk = leftNeed + Math.max(rightNeed, need) <= free
      if (rightOk && !leftOk) right.push(index)
      else if (leftOk && !rightOk) left.push(index)
      else if (columnHeight(groups, left, 1, gaps) <= columnHeight(groups, right, 1, gaps)) left.push(index)
      else right.push(index)
    }
    consider(left.sort((a, b) => a - b), right.sort((a, b) => a - b))
    return best
  }

  const masks = 1 << indexes.length
  for (let mask = 1; mask < masks - 1; mask++) {
    const left: number[] = []
    const right: number[] = []
    indexes.forEach((index, bit) => {
      if (mask & (1 << bit)) left.push(index)
      else right.push(index)
    })
    consider(left, right)
  }
  return best
}

function rowsFor(groups: MeasuredGroup[], indexes: number[], containerWidth: number, gaps: Gaps): PrepRow[] {
  if (indexes.length === 0) return []
  if (indexes.length === 1) return [{ kind: 'full', groups: indexes }]
  const free = containerWidth - gaps.column
  const fit = bestFit(groups, indexes, free, gaps)
  if (fit) {
    const rightPx = Math.max(1, free - fit.leftPx)
    return [{
      kind: 'split',
      left: fit.left,
      right: fit.right,
      template: `minmax(0, ${fit.leftPx}fr) minmax(0, ${rightPx}fr)`,
    }]
  }

  const needs = indexes.map((index) => needOf(groups[index]))
  const narrowest = Math.min(...needs)
  const blockers = indexes.filter((index) => needOf(groups[index]) + narrowest > free)
  if (blockers.length === 0 || blockers.length === indexes.length) {
    return indexes.map((index) => ({ kind: 'full', groups: [index] }))
  }

  const blocked = new Set(blockers)
  const rows: PrepRow[] = []
  let pending: number[] = []
  const flush = () => {
    if (pending.length === 0) return
    rows.push(...rowsFor(groups, pending, containerWidth, gaps))
    pending = []
  }
  for (const index of indexes) {
    if (blocked.has(index)) {
      flush()
      rows.push({ kind: 'full', groups: [index] })
    } else {
      pending.push(index)
    }
  }
  flush()
  return rows
}

export function planPrepColumns(groups: MeasuredGroup[], containerWidth: number, gaps: Gaps): PrepLayout {
  return { rows: rowsFor(groups, groups.map((_, index) => index), containerWidth, gaps) }
}

const SLACK = 2

export function measurePrepGroups(
  groups: { label: string; items: { label: string }[] }[],
): MeasuredGroup[] {
  const host = document.createElement('div')
  host.className = 'feeder-prep-group'
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:max-content;visibility:hidden;pointer-events:none;'
  const heading = document.createElement('h3')
  heading.style.cssText = 'display:inline-block;width:max-content;white-space:nowrap;'
  const chip = document.createElement('span')
  chip.className = 'feeder-prep-chip'
  chip.style.cssText = 'display:inline-block;width:max-content;white-space:nowrap;'
  host.append(heading, chip)
  document.body.append(host)
  const measured = groups.map((group) => {
    heading.textContent = group.label
    return {
      labelWidth: Math.ceil(heading.offsetWidth) + SLACK,
      chips: group.items.map((item) => {
        chip.textContent = item.label
        return Math.ceil(chip.offsetWidth) + SLACK
      }),
    }
  })
  host.remove()
  return measured
}
