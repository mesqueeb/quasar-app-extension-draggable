import QDraggableRows from 'quasar-app-extension-draggable/src/components/QDraggableRows'
import QDraggableRow from 'quasar-app-extension-draggable/src/components/QDraggableRow'

export default async ({ Vue }) => {
  Vue.component('q-draggable-rows', QDraggableRows)
  Vue.component('q-draggable-row', QDraggableRow)
}
