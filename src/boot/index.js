import QDraggableRows from 'quasar-app-extension-draggable/src/components/QDraggableRows'
import QDraggableRow from 'quasar-app-extension-draggable/src/components/QDraggableRow'
import QDraggableRowCollapseArrow from 'quasar-app-extension-draggable/src/components/QDraggableRowCollapseArrow'

export default ({ Vue }) => {
  Vue.component('QDraggableRows', QDraggableRows)
  Vue.component('QDraggableRow', QDraggableRow)
  Vue.component('QDraggableRowCollapseArrow', QDraggableRowCollapseArrow)
  Vue.component('q-draggable-rows', QDraggableRows)
  Vue.component('q-draggable-row', QDraggableRow)
  Vue.component('q-draggable-row-collapse-arrow', QDraggableRowCollapseArrow)
}
