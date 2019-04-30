<template>
  <transition-group
    name="flip-list"
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

<style lang="stylus">

.ext-draggable-rows
  display flex
  flex-wrap wrap
  flex-direction column
.flip-list-move
  transition transform 150ms

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
    return { $wrapper: this } // Be careful how you name this to not overlap with Vue.js!!
  },
  data () {
    return {
      rowOrder: this.value,
      rows: [], // child vue components array
      rowComponents: {}, // child vue components by ID
      lastSelected: null,
      dragging: false
    }
  },
  computed: {
    rowDepths () {
      return this.rows.reduce((carry, row) => {
        const id = row.id
        if (!id) return carry
        carry[id] = row.depth
        return carry
      }, {})
    },
    baseDepth () {
      if (!this.rowDepths) return 0
      const depthArray = Object.values(this.rowDepths)
      return Math.min(...depthArray)
    },
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
      this.rows.push(rowComponent)
      this.rowComponents[rowComponent.id] = rowComponent
      rowComponent.$once('hook:beforeDestroy', _ => {
        const index = this.rows.findIndex(row => row.id === rowComponent.id)
        if (index === -1) return
        this.rows.splice(index, 1)
        this.rowComponents[rowComponent.id] = null
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
    moveIdAndChildrenToPlaceOfTargetId (id, targetId) {
      const childrenIds = this.rowComponents[id].childrenIds
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
      this.adjustDepthsAfterMove(id)
      this.$nextTick(_ => this.focusRow(id))
    },
    adjustDepthsAfterMove (id) {
      const depth = this.rowDepths[id]
      const prevId = this.rowComponents[id].prevIdShown
      const topRow = prevId === undefined
      const prevDepth = this.rowDepths[prevId]
      if (topRow || depth > prevDepth + 1) {
        const newDepth = (topRow) ? this.baseDepth : prevDepth + 1
        const depthChange = newDepth - depth
        const row = this.rowComponents[id]
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
      const rowComponent = this.rowComponents[rowId]
      const rowChildren = rowComponent.childrenIds || []
      const draggingIds = [rowId, ...rowChildren]
      const lastChildIdOrSelf = rowComponent.lastChildIdOrSelf
      const rowHeight = rowComponent.rowHeightTotal
      const outerId = (direction === 'up') ? rowId : lastChildIdOrSelf
      const differenceIdOuterId = this.rowElMap[outerId].top - this.rowElMap[rowId].top
      const cursorPositionAdjusted = cursorPosition + differenceIdOuterId
      const hoveringAbove = this.draggingAboveRow(cursorPositionAdjusted, direction, draggingIds)
      if (isFinal) {
        return this.dropRow(rowId, hoveringAbove)
      }
      if (!isFinal) {
        draggingIds.forEach(id => {
          this.rowComponents[id].beingDragged = true
        })
      }
      const indexOriginal = this.rowOrder.indexOf(outerId)
      const indexHovering = (hoveringAbove === '__end__')
        ? this.rowOrder.length
        : this.rowOrder.indexOf(hoveringAbove)
      this.rowOrder.forEach((id, i) => {
        const rowComponent = this.rowComponents[id]
        if (!rowComponent) return
        if (draggingIds.includes(id)) {
          rowComponent.translateY = dragOffsetY
          return
        }
        if (direction === 'up') {
          rowComponent.translateY = (i < indexHovering || i >= indexOriginal)
            ? 0
            : rowHeight
        }
        if (direction === 'down') {
          rowComponent.translateY = (i > indexHovering - 1 || i < indexOriginal)
            ? 0
            : -rowHeight
        }
      })
    },
    resetHoverPositions () {
      this.rows.forEach(rowComponent => {
        rowComponent.translateY = 0
        rowComponent.beingDragged = false
      })
    },
    dropRow (rowId, rowIdBelow) {
      this.resetHoverPositions()
      this.moveIdAndChildrenToPlaceOfTargetId(rowId, rowIdBelow)
    },
  }
}
</script>
