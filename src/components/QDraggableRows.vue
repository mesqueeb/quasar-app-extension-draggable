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
    depthMap: Object,
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
    baseDepth () {
      if (!this.depthMap) return 0
      const depthArray = Object.values(this.depthMap)
      return Math.min(...depthArray)
    },
    rowElMap () {
      const rowElMap = this.rows.reduce((carry, row) => {
        if (!row.$el) return carry
        const top = row.$el.offsetTop
        const height = row.$el.clientHeight
        const bottom = top + height
        const middle = top + (height / 2)
        carry[row.id] = {id: row.id, top, bottom, middle, height}
        return carry
      }, {})
      return rowElMap
    },
    rowElMapOrdered () {
      const rowElArray = Object.values(this.rowElMap)
      rowElArray.sort(sortBy('top', 'asc'))
      return rowElArray
    },
    rowOrder () { return this.value },
    rowDepths () {
      if (!this.depthMap) return this.rowOrder.reduce(id => { return {[id]: 0} })
      return this.depthMap
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
    selectId (id) {
      this.selectedId = id
      this.$emit('select-id', id)
    },
    setDepth (id, depth) {
      this.$emit('set-depth', {id, depth})
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
      this.$emit('input', newOrder)
      setTimeout(_ => {
        this.adjustDepthsAfterMove(id)
        this.selectId(id)
      }, 1)
    },
    adjustDepthsAfterMove (id) {
      const childrenIds = this.rowComponents[id].childrenIds
      const all = [id, ...childrenIds]
      all.forEach(_id => {
        const depth = this.rowDepths[_id]
        const prevId = this.rowComponents[_id].prevIdShown
        const prevDepth = this.rowDepths[prevId]
        if (depth > prevDepth + 1) {
          this.setDepth(_id, prevDepth + 1)
        }
      })
    },
    draggingAboveRow (cursorPosition, direction) {
      const windowScrollY = getScrollPosition(window)
      const below = this.rowElMapOrdered
        .find(element => {
          return (direction === 'up')
            ? (element.bottom - windowScrollY > cursorPosition)
            : (element.top - windowScrollY > cursorPosition)
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
      const hoveringAbove = this.draggingAboveRow(cursorPositionAdjusted, direction)
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
      const draggingUp = (indexHovering < indexOriginal)
      const draggingDown = (indexHovering > indexOriginal)
      this.rowOrder.forEach((id, i) => {
        const rowComponent = this.rowComponents[id]
        if (!rowComponent) return
        if (draggingIds.includes(id)) {
          rowComponent.translateY = dragOffsetY
          return
        }
        if (draggingUp) {
          rowComponent.translateY = (i < indexHovering || i >= indexOriginal)
            ? 0
            : rowHeight
        }
        if (draggingDown) {
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
