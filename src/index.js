/**
 * Quasar App Extension index/runner script
 * (runs on each dev/build)
 *
 * API: https://github.com/quasarframework/quasar/blob/master/app/lib/app-extension/IndexAPI.js
 */

function extendWithComponent (api, conf) {
  // add quasar dependencies
  if (!conf.framework) conf.framework = {}
  if (!conf.framework.directives) conf.framework.directives = []
  if (!conf.framework.directives.includes('TouchPan')) conf.framework.directives.push('TouchPan')
  if (!conf.framework.directives.includes('TouchHold')) conf.framework.directives.push('TouchHold')

  // add boot file
  if (!conf.boot) conf.boot = []
  const boot = conf.boot

  // make sure boot file is registered
  if (!boot.includes('~quasar-app-extension-draggable/src/boot/index.js')) {
    boot.push('~quasar-app-extension-draggable/src/boot/index.js')
    // make sure boot file transpiles
    conf.build.transpileDependencies.push(/quasar-app-extension-draggable[\\/]src[\\/]boot/)
    console.log(` App Extension (draggable) Info: 'Adding draggable boot reference to your quasar.conf.js'`)
  }
}

module.exports = function (api, ctx) {
  // register JSON api
  api.registerDescribeApi('QDraggableRows', './components/QDraggableRows.json')
  api.registerDescribeApi('QDraggableRow', './components/QDraggableRow.json')

  // extend quasar.conf
  api.extendQuasarConf(conf => extendWithComponent(api, conf))
}
