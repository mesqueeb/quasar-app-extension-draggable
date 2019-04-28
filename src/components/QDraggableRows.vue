<template>
  <transition-group
    name="flip-list"
    :class="[
      'ext-draggable-rows', {
      'ext-draggable-rows--has-selection': selectedId,
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
      selectedId: null,
      rows: [], // child vue components array
      rowComponents: {}, // child vue components by ID
      dragging: false
    }
  },
  computed: {
    rowOrder () { return this.value },
    rowDepths () {
      return this.rows.reduce((carry, row) => {
        const id = row.id
        if (!id) return carry
        carry[id] = row.value
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
  },
  methods: {
    setNewOrder (newOrder) {
      return new Promise((resolve, reject) => {
        this.$emit('input', newOrder)
        this.$nextTick(resolve)
      })
    },
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
    selectId (id) {
      this.selectedId = id
      this.$emit('select-id', id)
    },
    setDepth (id, depth) {
      const row = this.rowComponents[id]
      if (!row) return
      return row.setDepth(depth)
    },
    selectPrev (currentId) {
      const index = this.value.indexOf(currentId)
      if (index === 0) return
      const newId = this.value[index - 1]
      this.selectId(newId)
    },
    selectNext (currentId) {
      const index = this.value.indexOf(currentId)
      if (index === this.value.length - 1) return
      const newId = this.value[index + 1]
      this.selectId(newId)
    },
    unselectAll () {
      this.selectId(null)
    },
    selectChildren (id) {
      const rowComponent = this.rowComponents[id]
      if (!rowComponent) return
      this.rows.forEach(rowComp => {
        rowComp.selectedChild = false
      })
      rowComponent.childrenIds.forEach(childId => {
        this.rowComponents[childId].selectedChild = true
      })
    },
    moveUp (id) {
      const targetId = this.rowComponents[id].prevIdSameDepthOrParent
      if (!targetId) return
      this.moveIdAndChildrenToPlaceOfTargetId(id, targetId)
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
    async moveIdAndChildrenToPlaceOfTargetId (id, targetId) {
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
      await this.setNewOrder(newOrder)
      this.adjustDepthsAfterMove(id)
      this.selectId(id)
    },
    adjustDepthsAfterMove (id) {
      const depth = this.rowDepths[id]
      const prevId = this.rowComponents[id].prevIdShown
      const topRow = prevId === undefined
      const prevDepth = this.rowDepths[prevId]
      if (topRow || depth > prevDepth + 1) {
        const newDepth = (topRow) ? this.baseDepth : prevDepth + 1
        const depthChange = newDepth - depth
        this.setDepth(id, newDepth)
        this.reflectDepthChangeToChildren(id, depthChange)
      }
    },
    async reflectDepthChangeToChildren (id, depthChange) {
      const childrenIds = this.rowComponents[id].childrenIds
      await Promise.all(childrenIds.map(_id => {
        const depth = this.rowDepths[_id]
        return this.setDepth(_id, depth + depthChange)
      }))
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
