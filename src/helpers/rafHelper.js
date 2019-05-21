
function createBatchMaker (max = 100) {
  let hasJob = false
  const jobs = []
  return {
    queue (arr) {
      jobs.push(...arr)
      if(!hasJob) {
        hasJob = true
        requestAnimationFrame(doBatch)
      }
    }
  }
  function doBatch () {
    const batch = jobs.splice(0, max)
    batch.forEach(fn => fn())

    if (jobs.length === 0) hasJob = false
    if (hasJob) requestAnimationFrame(doBatch)
  }
}

const rafBatch = createBatchMaker()
export default rafBatch
