<template>
  <transition-group
    :class="[
      'ext-draggable-rows', {
      'ext-draggable-rows--has-selection': hasSelection,
      'ext-draggable-rows--dragging': dragging,
    }]"
    tag="div"
  >
    <slot />
  </transition-group>
</template>

<style lang="stylus" scoped>

.ext-draggable-rows
  display flex
  flex-wrap wrap
  flex-direction column

</style>

<script>
import sortBy from '../helpers/sortBy'
import { scroll } from 'quasar'
const { getScrollPosition } = scroll

export default {
  name: 'QDraggableRows',
  props: {
    value: Array,
  },
  provide () {
    return { $extDraggableRows: this }
  },
  data () {
    return {
      rowOrder: this.value,
      rows: [], // child vue components array
      rowComponents: {}, // child vue components by ID
      lastSelected: null,
      dragging: false,
      rowDepths: {}, // manually update this
      baseDepth: 0, // manually update this
    }
  },
  computed: {
    rowElMap () {
      return this.rows.reduce((carry, row) => {
        if (!row) return carry
        const top = row.elOffsetTop
        const height = row.elHeight
        const bottom = top + height
        const middle = top + (height / 2)
        carry[row.id] = {id: row.id, top, bottom, middle, height}
        return carry
      }, {})
    },
    rowElMapOrdered () {
      const rowElArray = Object.values(this.rowElMap)
      rowElArray.sort(sortBy('top', 'asc'))
      return rowElArray
    },
    selectedIds () {
      return this.rows.reduce((carry, row) => {
        if (row.selected) carry.push(row.id)
        return carry
      }, [])
    },
    selectedIdsPlusChildren () {
      return this.rows.reduce((carry, row) => {
        if (row.selected || row.selectedChild) carry.push(row.id)
        return carry
      }, [])
    },
    selectedIdsAsc () {
      const idsIndexes = this.selectedIds.map(id => {
        return {id, index: this.rowComponents[id].index}
      })
      idsIndexes.sort(sortBy('index', 'asc'))
      return idsIndexes.map(obj => obj.id)
    },
    selectedIdsDesc () {
      const idsIndexes = this.selectedIds.map(id => {
        return {id, index: this.rowComponents[id].index}
      })
      idsIndexes.sort(sortBy('index', 'desc'))
      return idsIndexes.map(obj => obj.id)
    },
    hasSelection () {
      return this.selectedIds.length
    },
  },
  methods: {
    mountRow (rowComponent) {
      const { id, depth } = rowComponent
      this.rows.push(rowComponent)
      this.$set(this.rowComponents, id, rowComponent)
      this.$set(this.rowDepths, id, depth)
      if (depth < this.baseDepth) this.baseDepth = depth
      rowComponent.$on('hook:beforeDestroy', _ => {
        const index = this.rows.findIndex(row => row.id === id)
        if (index === -1) return
        this.rows.splice(index, 1)
        this.$set(this.rowComponents, id, null)
      })
    },
    setNewOrder (newOrder) {
      this.rowOrder = newOrder
      return new Promise((resolve, reject) => {
        this.$emit('input', newOrder)
        this.$nextTick(resolve)
      })
    },
    selectId (id, event = {}) {
      const { metaKey, shiftKey } = event
      // META
      if (metaKey) return this.selectAdditional(id)
      // SHIFT
      if (shiftKey) return this.selectUntil(id)
      // NONE
      const row = this.rowComponents[id]
      if (!row) return
      this.unselectAll()
      row.select()
    },
    unselectAll (but) {
      this.rows.forEach(row => {
        if (row.id === but) return
        row.unselect()
      })
    },
    selectChildren (id) {
      const row = this.rowComponents[id]
      if (!row) return
      row.childrenIds.forEach(childId => {
        this.rowComponents[childId].selectAsChild()
      })
    },
    selectAdditional (id) {
      // prerequisites
      const row = this.rowComponents[id]
      if (!row) return
      // unselect if it was already selected
      if (this.selectedIds.includes(id)) {
        this.focusRowOtherThan(id)
        return row.unselect()
      }
      // selection is a child of an already selected id
      if (this.selectedIdsPlusChildren.includes(id)) return
      return row.select()
    },
    focusRow (id) {
      const row = this.rowComponents[id]
      if (!row || !row.$el) return
      row.$el.focus()
    },
    focusRowOtherThan (idThatWillBeUnselected) {
      let lastId = this.lastSelected
      if (lastId === idThatWillBeUnselected) {
        lastId = this.selectedIds
          .filter(_id => _id !== idThatWillBeUnselected)
          .slice(-1)[0]
      }
      if (!lastId) return
      this.focusRow(lastId)
    },
    selectUntil (id) {
      // remove text selection
      if (typeof window.getSelection === 'function') window.getSelection().removeAllRanges()
      // prerequisites
      const row = this.rowComponents[id]
      const lastId = this.lastSelected
      const lastRow = this.rowComponents[lastId]
      if (!row || !lastRow) return
      // define from where to where to select
      const fromIndex = lastRow.index
      if (fromIndex === -1) return
      const toIndex = row.index
      if (toIndex === -1 || fromIndex === toIndex) return
      const selectingDownwards = (fromIndex < toIndex)
      // adjust selection indexes based on selection direction
      const {from, to} = (selectingDownwards)
        ? {from: fromIndex + 1, to: toIndex + 1}
        : {from: toIndex, to: fromIndex}
      // get children ids for selection range
      const rowOrderSlice = this.rowOrder.slice(from, to)
      // create idsToSelect array with some depth rules
      let maxDepth = (selectingDownwards)
        ? this.rowDepths[lastId]
        : this.rowDepths[id]
      const idsToSelect = rowOrderSlice.reduce((carry, siblingId) => {
        // get potential candidate to select
        const siblingDepth = this.rowDepths[siblingId]
        if (siblingDepth > maxDepth) return carry
        maxDepth = siblingDepth
        // add candidate
        carry.push(siblingId)
        return carry
      }, [])
      // select each item from the idsToSelect array
      idsToSelect.forEach(_id => this.rowComponents[_id].select())
    },
    selectPrev (focussedId, event = {}) {
      const { altKey, metaKey } = event
      if (altKey || metaKey) return
      const row = this.rowComponents[focussedId]
      if (!row) return
      const newId = row.prevIdShown
      this.selectId(newId, event)
    },
    selectNext (focussedId, event = {}) {
      const { altKey, metaKey } = event
      if (altKey || metaKey) return
      const row = this.rowComponents[focussedId]
      if (!row) return
      const newId = row.nextIdShown
      this.selectId(newId, event)
    },
    calcElPosAll () {
      this.rows.forEach(row => row.calcElPos())
    },
    collapseSelection () {
      this.selectedIds.forEach(id => this.rowComponents[id].updateCollapsed(true))
    },
    uncollapseSelection () {
      this.selectedIds.forEach(id => this.rowComponents[id].updateCollapsed(false))
    },
    indentSelection () {
      this.selectedIds.forEach(id => this.rowComponents[id].incrementDepth())
    },
    unindentSelection () {
      this.selectedIds.forEach(id => this.rowComponents[id].decrementDepth())
    },
    moveUpSelection () {
      this.selectedIdsAsc.forEach(id => this.moveUp(id))
    },
    moveUp (id) {
      const targetId = this.rowComponents[id].prevIdSameDepthOrParent
      if (!targetId) return
      this.moveIdAndChildrenToPlaceOfTargetId(id, targetId)
    },
    moveDownSelection () {
      this.selectedIdsDesc.forEach(id => this.moveDown(id))
    },
    moveDown (id) {
      const lastChildIdOrSelf = this.rowComponents[id].lastChildIdOrSelf
      const nextId = this.rowComponents[lastChildIdOrSelf].nextIdShown
      if (!nextId) return
      const nextDepth = this.rowDepths[nextId]
      if (nextDepth < this.rowDepths[id]) {
        const nextNextId = (this.rowComponents[nextId].isLastItem)
          ? '__end__'
          : this.rowComponents[nextId].nextIdShown
        this.moveIdAndChildrenToPlaceOfTargetId(id, nextNextId)
        return
      }
      const nextIdLastChildIdOrSelf = this.rowComponents[nextId].lastChildIdOrSelf
      if (!nextIdLastChildIdOrSelf) return
      const targetId = (this.rowComponents[nextIdLastChildIdOrSelf].isLastItem)
        ? '__end__'
        : this.rowComponents[nextIdLastChildIdOrSelf].nextIdShown
      this.moveIdAndChildrenToPlaceOfTargetId(id, targetId)
    },
    moveIdAndChildrenToPlaceOfTargetId (id, targetId, depthChange) {
      const row = this.rowComponents[id]
      const childrenIds = row.childrenIds
      const all = [id, ...childrenIds]
      const newOrderClean = this.rowOrder.filter(_id => !all.includes(_id))
      const index = (targetId === '__end__')
        ? newOrderClean.length
        : newOrderClean.indexOf(targetId)
      const newOrder = [
        ...newOrderClean.slice(0, index),
        ...all,
        ...newOrderClean.slice(index)
      ]
      this.setNewOrder(newOrder)
      if (Number.isInteger(depthChange)) {
        // pass the childrenIds that was calculated before the newOrder
        row.updateDepth(depthChange, childrenIds)
      }
      this.adjustDepthsAfterMove(id)
      this.$nextTick(_ => this.focusRow(id))
    },
    adjustDepthsAfterMove (id) {
      const depth = this.rowDepths[id]
      const row = this.rowComponents[id]
      const prevId = row.prevIdShown
      const topRow = prevId === undefined
      const prevDepth = this.rowDepths[prevId]
      if (topRow || depth > prevDepth + 1) {
        const newDepth = (topRow) ? this.baseDepth : prevDepth + 1
        const depthChange = newDepth - depth
        row.updateDepth(depthChange)
      }
    },
    draggingAboveRow (cursorPosition, direction, draggingIds) {
      const below = this.rowElMapOrdered
        .find(element => {
          if (draggingIds.includes(element.id)) return false
          return (direction === 'up')
            ? (element.bottom > cursorPosition)
            : (element.top > cursorPosition)
        })
      const idBelow = below ? below.id : '__end__'
      return idBelow
    },
    draggingRow (rowId, cursorPosition, direction, dragOffsetY, isFinal) {
      const draggingRow = this.rowComponents[rowId]
      const rowChildren = draggingRow.childrenIds || []
      const draggingIds = [rowId, ...rowChildren]
      const lastChildIdOrSelf = draggingRow.lastVisibleChildIdOrSelf
      const outerId = (direction === 'up') ? rowId : lastChildIdOrSelf
      const differenceIdOuterId = this.rowElMap[outerId].top - this.rowElMap[rowId].top
      const cursorPositionAdjusted = cursorPosition + differenceIdOuterId
      const hoveringAbove = this.draggingAboveRow(cursorPositionAdjusted, direction, draggingIds)
      const hoveringAboveDepth = this.rowDepths[hoveringAbove]
      const depth = this.rowDepths[rowId]
      const depthChange = hoveringAboveDepth - depth
      if (isFinal) {
        return this.dropRow(rowId, hoveringAbove, depthChange)
      }
      const otherSelectedIds = this.selectedIdsPlusChildren
        .filter(id => !draggingIds.includes(id))
      const rowHeight = draggingRow.rowHeightTotal
      const indexOriginal = this.rowOrder.indexOf(outerId)
      const indexHovering = (hoveringAbove === '__end__')
        ? this.rowOrder.length
        : this.rowOrder.indexOf(hoveringAbove)
      this.rowOrder.forEach((id, i) => {
        const row = this.rowComponents[id]
        if (!row) return
        if (draggingIds.includes(id)) {
          row.beingDragged = true
          row.translateY = dragOffsetY
          row.draggingDepth = row.depth + depthChange
          return
        }
        if (otherSelectedIds.includes(id)) {
          row.beingDraggedOther = true
        }
        if (direction === 'up') {
          row.translateY = (i < indexHovering || i >= indexOriginal)
            ? 0
            : rowHeight
        }
        if (direction === 'down') {
          row.translateY = (i > indexHovering - 1 || i < indexOriginal)
            ? 0
            : -rowHeight
        }
      })
    },
    resetHoverPositions () {
      this.rows.forEach(row => {
        row.translateY = 0
        row.beingDragged = false
        row.beingDraggedOther = false
        row.draggingDepth = null
      })
    },
    dropRow (rowId, rowIdBelow, depthChange) {
      this.moveIdAndChildrenToPlaceOfTargetId(rowId, rowIdBelow, depthChange)
      this.resetHoverPositions()
    },
  }
}
</script>
