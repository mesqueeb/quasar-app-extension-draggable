<template>
  <button
    :class="[
      'ext-draggable-row', {
      'ext-draggable-row--being-dragged': beingDragged,
      'ext-draggable-row--being-dragged-other': beingDraggedOther,
      'ext-draggable-row--selected': selected,
      'ext-draggable-row--selected-child': selectedChild,
    }]"
    @click.stop.prevent="tapped"
    v-touch-hold:200.mouse.stop.prevent="held"
    v-touch-pan.vertical.mightPrevent.mouse.mouseMightPrevent="handlePan"
    @keydown.up.stop.prevent="e => rows.selectPrev(id, e)"
    @keydown.down.stop.prevent="e => rows.selectNext(id, e)"
    @keydown.up.alt.exact.stop.prevent="rows.moveUpSelection"
    @keydown.down.alt.exact.stop.prevent="rows.moveDownSelection"
    @keydown.tab.exact.stop.prevent="rows.indentSelection"
    @keydown.shift.tab.exact.stop.prevent="rows.unindentSelection"
    @keydown.esc.exact.stop.prevent="unselectAll"
    @blur="onBlur"
    :style="style"
    :id="`js-${id}`"
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

.ext-draggable-row
  reset-button()
  flex 1
  display flex
  align-items center
  position relative
  z-index 2
  transition transform 0ms
  &:not(.ext-draggable-row--being-dragged)
    transition transform 150ms
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
  &--selected, &--selected-child
    z-index 3
  &--being-dragged
    z-index 3
    .ext-draggable-row__selection-indicator
      > *
        shadow-3()
  &--being-dragged-other
    opacity 0.5

</style>

<script>
import { TouchPan, TouchHold } from 'quasar'

export default {
  name: 'QDraggableRow',
  directives: {
    TouchPan,
    TouchHold
  },
  props: {
    value: Number,
    id: {
      type: String,
      required: true
    },
    holdToSelect: Boolean,
    selectedStyle: Object,
    hoverStyle: Object,
  },
  inject: {
    $wrapper: { default: null }
  },
  created () {
    if (!this.$wrapper) throw new Error('DraggableRow should be a child of DraggableRowsWrapper')
    this.$wrapper.mountRow(this)
  },
  mounted () {
    this.$el.addEventListener('mouseup', this.onMouseup)
    this.$el.addEventListener('touchend', this.onMouseup)
  },
  data () {
    return {
      depth: this.value,
      selected: false,
      selectedChild: false,
      beingDragged: false,
      beingDraggedOther: false,
      translateY: 0,
      elHeight: 0, // reset on select every time
      elOffsetTop: 0, // reset on select every time
    }
  },
  computed: {
    rows () { return this.$wrapper },
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
    rowHeightTotal () {
      const children = this.childrenIds
      const height = children.reduce((total, id) => {
        const vueComp = this.rows.rowComponents[id]
        const h = (vueComp) ? vueComp.elHeight : 0
        return total + h
      }, this.elHeight)
      return height
    },
    style () {
      const transform = `translateY(${this.translateY}px)`
      const depth = this.depth || 0
      const lvl = depth - this.baseDepth
      const x = lvl * 20
      const marginLeft = `${x}px`
      return { marginLeft, transform }
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
      // calc row heights to show selection indicator properly
      this.calcElPos()
      this.selected = true
      this.selectedChild = false
      this.rows.selectChildren(this.id)
      this.rows.lastSelected = this.id
      this.$el.focus()
    },
    selectAsChild () {
      this.calcElPos()
      this.selectedChild = true
      this.selected = false
    },
    unselect () {
      this.selected = false
      this.selectedChild = false
      this.$el.blur()
    },
    calcElPos () {
      this.elHeight = this.$el.offsetHeight
      const { top } = this.$el.getBoundingClientRect()
      this.elOffsetTop = top
    },
    updateDepth (depthChange) {
      const childrenIds = this.childrenIds
      const idAndChildren = [this.id, ...childrenIds]
      idAndChildren.forEach(id => {
        const row = this.rows.rowComponents[id]
        if (!row) return
        row.setAndEmitDepth(row.depth + depthChange)
      })
    },
    setAndEmitDepth (depth) {
      this.depth = depth
      // set the depth (value prop) via input event (for v-model)
      return new Promise((resolve, reject) => {
        this.$emit('input', depth)
        this.$nextTick(resolve)
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
