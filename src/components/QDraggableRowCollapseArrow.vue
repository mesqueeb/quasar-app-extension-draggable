<template>
  <div
    v-if="show"
    :class="[
      'ext-draggable-row__collapse-arrow',
      {'ext-draggable-row__collapse-arrow--reversed': collapsed}
    ]"
  >
    <slot>
      <q-icon
        size="1.5em"
        @click.stop.prevent="tapped"
        :name="$q.iconSet.expansionItem.icon"
      />
    </slot>
  </div>
</template>

<style lang="stylus" scoped>

.ext-draggable-row__collapse-arrow
  display flex
  align-items center
  transform scaleY(-1)
  transition transform 300ms
  &--reversed
    transform scaleY(1)

</style>

<script>
import { QIcon } from 'quasar'

export default {
  name: 'QDraggableRowCollapseArrow',
  components: {
    QIcon
  },
  props: {
    value: Boolean,
  },
  inject: {
    $extDraggableRow: { default: null },
  },
  data () {
    const row = this.$extDraggableRow
    return {
      row,
      collapsed: row.collapsed || false
    }
  },
  watch: {
    '$extDraggableRow.collapsed' (newVal, oldVal) {
      this.collapsed = newVal
    },
  },
  computed: {
    show () {
      return (this.row && this.row.childrenIds.length)
    },
  },
  methods: {
    tapped (event) {
      this.row.updateCollapsed()
    },
  }
}
</script>
