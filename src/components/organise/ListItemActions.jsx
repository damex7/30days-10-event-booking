import { Icon } from '../ui/Icon.jsx'

/** Move an item in a list (returns a new array). */
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/*
  Move up / Move down / Remove for one item in an editable list (tickets,
  questions, options, promo codes).
  Buttons, not drag and drop: they work with a keyboard, a screen reader
  and a thumb, and need no library. Each has a full accessible name
  ("Move “Size” up"), and an id built from the item's id, so after a move
  the caller can put focus back on the same button of the moved item.
*/
export function ListItemActions({ idBase, name, index, count, onMove, onRemove, removeDisabledReason, size = 'size-10' }) {
  const btn = `grid ${size} shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-panel-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35`
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        id={`${idBase}-up`}
        className={btn}
        onClick={() => onMove(index, index - 1, 'up')}
        disabled={index === 0}
        aria-label={`Move ${name} up`}
      >
        <Icon name="up" className="size-5" />
      </button>
      <button
        type="button"
        id={`${idBase}-down`}
        className={btn}
        onClick={() => onMove(index, index + 1, 'down')}
        disabled={index === count - 1}
        aria-label={`Move ${name} down`}
      >
        <Icon name="down" className="size-5" />
      </button>
      {onRemove && (
        <button
          type="button"
          className={`${btn} hover:bg-danger-soft hover:text-danger`}
          onClick={() => onRemove(index)}
          disabled={Boolean(removeDisabledReason)}
          aria-label={`Remove ${name}`}
          title={removeDisabledReason || undefined}
        >
          <Icon name="trash" className="size-5" />
        </button>
      )}
    </div>
  )
}

/** After a move, keep focus on the same button of the moved item (or its other arrow, if that one is now disabled). */
export function refocusMoved(idBase, direction) {
  requestAnimationFrame(() => {
    const same = document.getElementById(`${idBase}-${direction}`)
    const other = document.getElementById(`${idBase}-${direction === 'up' ? 'down' : 'up'}`)
    ;(same && !same.disabled ? same : other)?.focus()
  })
}
