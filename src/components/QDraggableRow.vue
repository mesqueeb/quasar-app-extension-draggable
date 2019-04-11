<template>
  <button
    :class="[
      'ext-draggable-row', {
      'ext-draggable-row--being-dragged': beingDragged,
      'ext-draggable-row--selected': selected,
    }]"
    @click.stop.prevent="tapped"
    v-touch-hold:200.mouse.stop.prevent="held"
    @keydown.up.exact.stop.prevent="rows.selectPrev(id)"
    @keydown.down.exact.stop.prevent="rows.selectNext(id)"
    @keydown.up.alt.exact.stop.prevent="rows.moveUp(id)"
    @keydown.up.meta.exact.stop.prevent="rows.moveUp(id)"
    @keydown.down.alt.exact.stop.prevent="rows.moveDown(id)"
    @keydown.down.meta.exact.stop.prevent="rows.moveDown(id)"
    @keydown.tab.exact.stop.prevent="incrementDepth"
    @keydown.shift.tab.exact.stop.prevent="decrementDepth"
    @keydown.esc.exact.stop.prevent="unselectAll"
    @blur="onBlur"
    :style="style"
    v-touch-pan.vertical.mouse="handlePan"
  >
    <div
      v-show="selected"
      class="ext-draggable-row__selection-indicator"
      :style="styleSelectionIndicator"
    >
      <slot name="selection-indicator">
        <div class="ext-draggable-row__selection-indicator__default"></div>
      </slot>
    </div>
    <slot :selected="selected"/>
  </button>
</template>

<style lang="stylus" scoped>

bs = 0 1px 8px rgba(0,0,0,0.2), 0 3px 4px rgba(0,0,0,0.14), 0 3px 3px -2px rgba(0,0,0,0.12) !important

shadow-3()
  -webkit-box-shadow bs
  box-shadow bs

.ext-draggable-row
  reset-button()
  flex 1
  display flex
  align-items center
  padding 0 .25rem
  cursor initial
  position relative
  z-index 2
  transition transform 0ms
  &:not(.ext-draggable-row--being-dragged)
    transition transform 150ms
  &:focus
    outline 0
  > *:not(.ext-draggable-row__selection-indicator)
    z-index 2
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
      box-shadow 0 0 0 3px var(--q-color-primary)
      opacity 0.6
  &--selected
    z-index 3
  &--being-dragged
    z-index 3
    .ext-draggable-row__selection-indicator
      > *
        shadow-3()

</style>

<script>
export default {
  name: 'QDraggableRow',
  props: {
    holdToSelect: Boolean,
    value: Number,
    id: String,
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
    this.rows.$on('select-id', id => { this.selectIdEvent(id) })
    this.rows.$on('set-depth', ({id, depth}) => {
      if (this.id !== id) return
      this.setDepth(depth)
    })
  },
  data () {
    return {
      selected: false,
      translateY: 0,
      beingDragged: false,
      rowHeight: 0, // reset on select every time
    }
  },
  computed: {
    depth () { return this.value },
    rows () { return this.$wrapper },
    rowOrder () { return this.rows.rowOrder },
    rowDepths () { return this.rows.rowDepths },
    baseDepth () { return this.rows.baseDepth },
    selectedId () { return this.rows.selectedId },
    isLastItem () {
      if (!this.rowOrder.length) return true
      return this.rowOrder.slice(-1)[0] === this.id
    },
    prevIdShown () {
      const index = this.rowOrder.indexOf(this.id)
      if (index === 0) return
      return this.rowOrder[index - 1]
    },
    nextIdShown () {
      const index = this.rowOrder.indexOf(this.id)
      if (index === this.rowOrder.length - 1) return
      return this.rowOrder[index + 1]
    },
    prevIdSameDepthOrParent () {
      const maxDepth = this.rowDepths[this.id]
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
    childrenIds () {
      const startDepth = this.rowDepths[this.id]
      let index = this.rowOrder.indexOf(this.id)
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
        const childEl = this.rows.rowElMap[id]
        const h = (childEl) ? childEl.height : 0
        return total + h
      }, this.rowHeight)
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
    held (details) {
      if (!this.holdToSelect) return this.$emit('held', this.selected)
      this.select()
      this.$emit('held', this.selected)
    },
    tapped () {
      if (this.selected) return this.unselectAll()
      if (this.selectedId) return this.select()
      if (this.holdToSelect) return this.$emit('click')
      this.select()
    },
    unselectAll () {
      this.$parent.$parent.unselectAll()
    },
    unselect () {
      this.selected = false
      this.$el.blur()
    },
    select () {
      this.rows.selectId(this.id)
    },
    selectIdEvent (selectedId) {
      if (this.id === selectedId) {
        this.selected = true
        this.rowHeight = this.$el.clientHeight
        this.$el.focus()
        return
      }
      this.unselect()
    },
    setDepth (depth) {
      // set the depth (value prop) via input event (for v-model)
      this.$emit('input', depth)
    },
    incrementDepth () {
      const prevIdDepth = this.rows.rowDepths[this.prevIdShown]
      if (this.depth >= prevIdDepth + 1) return
      this.setDepth(this.depth + 1)
    },
    decrementDepth () {
      if (this.depth === this.baseDepth) return
      this.setDepth(this.depth - 1)
    },
    onBlur () {
      setTimeout(_ => {
        if (document.activeElement.nodeName !== 'BODY') return
        this.unselectAll()
      }, 100)
    },
    handlePan (details) {
      if (!this.selected) return
      const { position, isFinal, offset, direction } = details
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
