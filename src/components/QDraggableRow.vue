<template>
  <button
    :class="[
      'ext-draggable-row__row-wrapper', {
      'ext-draggable-row__row-wrapper--being-dragged': beingDragged,
      'ext-draggable-row__row-wrapper--being-dragged-other': beingDraggedOther,
      'ext-draggable-row--selected': selected,
      'ext-draggable-row--selected-child': selectedChild,
    }]"
    @click.stop.prevent="tapped"
    v-touch-hold:200.mouse.stop.prevent="held"
    v-touch-pan.vertical.mightPrevent.mouse.mouseMightPrevent="handlePan"
    v-touch-swipe.mouse.horizontal="swiped"
    @keydown.up.stop.prevent="e => rows.selectPrev(id, e)"
    @keydown.down.stop.prevent="e => rows.selectNext(id, e)"
    @keydown.exact.alt.up.stop.prevent="rows.moveUpSelection"
    @keydown.exact.alt.down.stop.prevent="rows.moveDownSelection"
    @keydown.exact.tab.stop.prevent="rows.indentSelection"
    @keydown.exact.shift.tab.stop.prevent="rows.unindentSelection"
    @keydown.exact.alt.right.stop.prevent="rows.indentSelection"
    @keydown.exact.alt.left.stop.prevent="rows.unindentSelection"
    @keydown.exact.esc.stop.prevent="rows.unselectAll"
    @keydown.exact.left.stop.prevent="rows.collapseSelection"
    @keydown.exact.right.stop.prevent="rows.uncollapseSelection"
    @blur="onBlur"
    :style="styleWrapper"
  >
    <div
      v-show="!isHidden"
      class="ext-draggable-row"
      :style="styleRow"
    >
      <div
        v-show="selected"
        class="ext-draggable-row__selection-indicator"
        :style="styleSelectionIndicator"
      >
        <slot name="selection-indicator">
          <div class="ext-draggable-row__selection-indicator__default">
            <div></div>
          </div>
        </slot>
      </div>
      <slot :selected="selected"/>
    </div>
  </button>
</template>

<style lang="stylus" scoped>

bs = 0 1px 8px rgba(0,0,0,0.2), 0 3px 4px rgba(0,0,0,0.14), 0 3px 3px -2px rgba(0,0,0,0.12) !important
reset-button()
  margin 0
  padding 0
  background none
  border none
  &:focus
    outline 0

shadow-3()
  -webkit-box-shadow bs
  box-shadow bs

.ext-draggable-row__row-wrapper
  transition transform 150ms /* animation for the transition-group */
  reset-button()
  flex 1
  display flex
  &--being-dragged
    transition transform 0ms
    z-index 3
    .ext-draggable-row__selection-indicator
      > *
        shadow-3()
  &--being-dragged-other
    opacity 0.5
  &--selected, &--selected-child
    z-index 3

.ext-draggable-row
  flex 1
  display flex
  align-items center
  position relative
  z-index 2
  transition margin-left 150ms
  > *:not(.ext-draggable-row__selection-indicator)
    z-index 2
    height 100%
    width 100%
    text-align initial
  &__selection-indicator
    z-index 1
    position absolute
    top 0
    left 0
    right 0
    height 100%
    > *
      height 100%
      width 100%
    &__default
      background white
      > div
        box-shadow 0 0 0 3px var(--q-color-primary)
        opacity 0.6
        height 100%
        width 100%

</style>

<script>
import { TouchPan, TouchHold, TouchSwipe } from 'quasar'
import rafBatch from '../helpers/rafHelper'

export default {
  name: 'QDraggableRow',
  directives: {
    TouchPan,
    TouchHold,
    TouchSwipe
  },
  props: {
    value: Number,
    collapsed: Boolean,
    id: {
      type: String,
      required: true
    },
    holdToSelect: Boolean,
    selectedStyle: Object,
    hoverStyle: Object,
  },
  provide () {
    return { $extDraggableRow: this }
  },
  inject: {
    $extDraggableRows: { default: null }
  },
  created () {
    if (!this.$extDraggableRows) throw new Error('DraggableRow should be a child of DraggableRowsWrapper')
    this.$extDraggableRows.mountRow(this)
    rafBatch.queue([this.adjustIsHidden])
  },
  mounted () {
    this.$el.addEventListener('mouseup', this.onMouseup)
    this.$el.addEventListener('touchend', this.onMouseup)
  },
  data () {
    return {
      depth: this.value || 0,
      isCollapsed: this.collapsed || false,
      isHidden: false,
      selected: false,
      selectedChild: false,
      beingDragged: false,
      beingDraggedOther: false,
      draggingDepth: null,
      translateY: 0,
      elHeight: 0, // reset on select every time
      elOffsetTop: 0, // reset on select every time
    }
  },
  watch: {
    value (newVal, oldVal) { this.depth = newVal },
    depth (newVal, oldVal) { this.rows.rowDepths[this.id] = newVal },
    collapsed (newVal, oldVal) { this.isCollapsed = newVal },
    isCollapsed (newVal, oldVal) {
      if (newVal === oldVal) return
      if (this.selected) rafBatch.queue([this.select])
      if (this.selectedChild) this.allParentIds.forEach(id => {
        const row = this.rows.rowComponents[id]
        if (row.selected) rafBatch.queue([row.select])
      })
    },
  },
  computed: {
    rows () { return this.$extDraggableRows },
    rowOrder () { return this.rows.rowOrder },
    rowDepths () { return this.rows.rowDepths },
    baseDepth () { return this.rows.baseDepth },
    index () { return this.rowOrder.indexOf(this.id) },
    isLastItem () {
      if (!this.rowOrder.length) return true
      return this.rowOrder.slice(-1)[0] === this.id
    },
    prevIdShown () {
      const index = this.index
      if (index === 0) return
      return this.rowOrder[index - 1]
    },
    nextIdShown () {
      const index = this.index
      if (index === this.rowOrder.length - 1) return
      return this.rowOrder[index + 1]
    },
    prevIdSameDepthOrParent () {
      const maxDepth = this.depth
      let prevId = this.prevIdShown
      if (!prevId) return
      let prevDepth = this.rowDepths[prevId]
      // return parent
      if (prevDepth + 1 === maxDepth) return prevId
      // return prev sibling
      while (prevDepth && prevDepth > maxDepth) {
        prevId = this.rows.rowComponents[prevId].prevIdShown
        prevDepth = this.rowDepths[prevId]
      }
      return prevId
    },
    parentId () {
      const startDepth = this.depth
      let index = this.index
      if (index < 1) return
      let parentId
      while (!parentId && index > 0) {
        index--
        const prevId = this.rowOrder[index]
        const prevDepth = this.rowDepths[prevId]
        const oneLvlHigher = (prevDepth === startDepth - 1)
        if (oneLvlHigher) parentId = prevId
      }
      return parentId
    },
    allParentIds () {
      const parentIds = []
      let parentId = this.parentId
      while (parentId) {
        parentIds.unshift(parentId)
        parentId = this.rows.rowComponents[parentId].parentId
      }
      return parentIds
    },
    childrenIds () {
      const startDepth = this.depth
      let index = this.index
      let _continue = true
      const childrenIds = []
      while (_continue) {
        index++
        const nextId = this.rowOrder[index]
        // return if the item is not yet loaded yet
        const nextDepth = this.rowDepths[nextId]
        _continue = (nextDepth > startDepth)
        if (_continue) {
          childrenIds.push(nextId)
        }
      }
      return childrenIds
    },
    lastChildIdOrSelf () {
      const children = this.childrenIds
      return (children.length) ? children.slice(-1)[0] : this.id
    },
    lastVisibleChildIdOrSelf () {
      if (this.isCollapsed) return this.id
      const children = this.childrenIds
      const visibleChildren = children.filter(id => !this.rows.rowComponents[id].isHidden)
      return (visibleChildren.length) ? visibleChildren.slice(-1)[0] : this.id
    },
    rowHeightTotal () {
      const children = this.childrenIds
      const height = children.reduce((total, id) => {
        const vueComp = this.rows.rowComponents[id]
        const h = (vueComp) ? vueComp.elHeight : 0
        return total + h
      }, this.elHeight)
      return height
    },
    styleWrapper () {
      const transform = `translateY(${this.translateY}px)`
      return { transform }
    },
    styleRow () {
      const depth = (Number.isInteger(this.draggingDepth))
        ? this.draggingDepth
        : this.depth || 0
      const lvl = depth - this.baseDepth
      const x = lvl * 20
      const marginLeft = `${x}px`
      return { marginLeft }
    },
    styleSelectionIndicator () {
      return { height: this.rowHeightTotal + 'px' }
    },
  },
  methods: {
    tapped (event) {
      // select if there's a selection
      if (this.rows.hasSelection) return this.rows.selectId(this.id, event)
      // do not select if `holdToSelect` and there's no selection
      if (this.holdToSelect) return this.$emit('click')
      // select if no `holdToSelect`
      this.rows.selectId(this.id, event)
    },
    select () {
      this.selected = true
      this.selectedChild = false
      this.rows.selectChildren(this.id)
      this.rows.lastSelected = this.id
      this.$el.focus()
      // calc row heights to show selection indicator properly
      // this.$nextTick(this.calcElHeight)
      rafBatch.queue([this.calcElHeight])
      // nextTick fixes problems when the row changes after select
    },
    selectAsChild () {
      this.selectedChild = true
      this.selected = false
      // this.$nextTick(this.calcElHeight)
      rafBatch.queue([this.calcElHeight])
    },
    unselect () {
      this.selected = false
      this.selectedChild = false
      if (this.$el && this.$el.blur) this.$el.blur()
    },
    calcElHeight () {
      this.elHeight = this.$el.offsetHeight
    },
    calcElPos () {
      this.calcElHeight()
      if (this.isHidden) return
      const { top } = this.$el.getBoundingClientRect()
      this.elOffsetTop = top
    },
    setAndEmitCollapsed (setTo) {
      this.isCollapsed = setTo
      // set the depth (value prop) via input event (for v-model)
      return new Promise((resolve, reject) => {
        this.$emit('update:collapsed', setTo)
        this.$nextTick(resolve)
      })
    },
    updateCollapsed (setTo = !this.isCollapsed, customChildrenIds) {
      // you can bypass childrenIds calculation by passing an array
      const childrenIds = customChildrenIds || this.childrenIds
      // childrenIds.map(id => {
      //   const row = this.rows.rowComponents[id]
      //   if (!row) return
      //   row.adjustIsHidden()
      // })
      this.setAndEmitCollapsed(setTo)
      const queue = childrenIds
        .map(id => {
          const row = this.rows.rowComponents[id]
          if (!row) return
          return row.adjustIsHidden
        })
      // queue.push(_ => this.setAndEmitCollapsed(setTo))
      rafBatch.queue(queue)
    },
    adjustIsHidden () {
      const prevIdSameDepthOrParent = this.prevIdSameDepthOrParent
      const prevRow = this.rows.rowComponents[prevIdSameDepthOrParent]
      if (!prevRow) return
      const prevRowIsSibling = prevRow.depth === this.depth
      const siblingIsHidden = prevRow.isHidden && prevRowIsSibling
      const prevRowIsParent = prevRow.depth + 1 === this.depth
      const parentIsCollapsedOrHidden = (prevRow.isCollapsed || prevRow.isHidden) && prevRowIsParent
      this.isHidden = (siblingIsHidden || parentIsCollapsedOrHidden)
    },
    setAndEmitDepth (depth) {
      this.depth = depth
      // set the depth (value prop) via input event (for v-model)
      return new Promise((resolve, reject) => {
        this.$emit('input', depth)
        this.$nextTick(resolve)
      })
    },
    updateDepth (depthChange, customChildrenIds) {
      // you can bypass childrenIds calculation by passing an array
      const childrenIds = customChildrenIds || this.childrenIds
      const idAndChildren = [this.id, ...childrenIds]
      idAndChildren.forEach(id => {
        const row = this.rows.rowComponents[id]
        if (!row) return
        row.setAndEmitDepth(row.depth + depthChange)
      })
    },
    incrementDepth () {
      const prevId = this.prevIdShown
      if (!prevId) return
      const prevIdDepth = this.rows.rowDepths[prevId]
      if (this.depth >= prevIdDepth + 1) return
      this.updateDepth(1)
      this.rows.selectChildren(this.id)
    },
    decrementDepth () {
      if (this.depth === this.baseDepth) return
      this.updateDepth(-1)
      this.rows.selectChildren(this.id)
    },
    onBlur (event) {
      // we need to unselectAll in case the selection is blurred
      // otherwise our keyboard shortcuts stop working
      setTimeout(_ => {
        // unless if another row is selected
        if (document.activeElement.nodeName !== 'BODY') return
        this.rows.unselectAll()
      }, 200) // same length as `held` trigger
    },
    swiped (details) {
      const { direction } = details
      if (direction === 'right') this.incrementDepth()
      if (direction === 'left') this.decrementDepth()
    },
    held (details) {
      this.startDragHover()
      if (!this.holdToSelect) return this.$emit('held', this.selected)
      this.rows.selectId(this.id)
      this.$emit('held', this.selected)
    },
    startDragHover () {
      if (!this.selected) return
      const rowChildren = this.childrenIds || []
      const draggingIds = [this.id, ...rowChildren]
      draggingIds.forEach(id => {
        const vueComp = this.rows.rowComponents[id]
        if (!vueComp) return
        vueComp.beingDragged = true
        vueComp.translateY = -2
      })
    },
    stopDragHover () {
      const rowChildren = this.childrenIds || []
      const draggingIds = [this.id, ...rowChildren]
      draggingIds.forEach(id => {
        const vueComp = this.rows.rowComponents[id]
        if (!vueComp) return
        vueComp.beingDragged = false
        vueComp.translateY = 0
      })
    },
    onMouseup (event) {
      this.stopDragHover()
    },
    handlePan (details) {
      if (!this.selected) return
      const { position, isFinal, isFirst, offset, direction, evt } = details
      if (isFirst) this.rows.calcElPosAll()
      evt.preventDefault()
      const cursorPosition = position.top
      const dragOffsetY = offset.y
      this.rows.draggingRow(
        this.id,
        cursorPosition,
        direction,
        dragOffsetY,
        isFinal
      )
    },
  }
}
</script>
