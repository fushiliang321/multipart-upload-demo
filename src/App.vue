
<template>
  <button @click="upload">upload</button>
  <div v-for="log in requestLogs" :key="log.id" class="log-list">
    <div class="info">
      <span class="name">{{ log.fileInfo.name }}</span>
      <div class="action">
        <button @click="log.abort" v-if="showAbortBtn(log.status)">中断</button>
        <button @click="log.resume" v-else-if="log.resume && showResumeBtn(log.status)">恢复</button> &nbsp;
        <button @click="log.remove">移除</button>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress" :style="{
        width: log.progress + '%',
        background: statusColorMap[log.status] ?? ''
      }">
      </div>
    </div>
    <div>
      <span>{{ (log.fileInfo.size/(1024*1024)).toFixed(2) }}M</span>
      <span class="progress">（{{ log.progress.toFixed(2) + '%' }}）</span>
    </div>
  </div>
</template>

<script setup>
  import { reactive } from 'vue'
  import autoUpload, { adapter, cacheGroup } from './autoUpload'
  import { statusTags } from 'multipart-upload-zct/MultipartUpload'
  import restoreToMultipartUpload from 'multipart-upload-zct/cache/restoreToMultipartUpload'

  async function start() {
    const tasks = await restoreToMultipartUpload(adapter, cacheGroup)

    tasks.forEach(task => {
      addUploadTask(task, {
        name: task.name,
        size: task.size,
        type: task.contentType
      })
      task.triggerUploadProgress()
    })
  }
  start()
  
  const statusColorMap = {}
  statusColorMap[statusTags.uploading] = 'blue'
  statusColorMap[statusTags.merging] = 'blue'
  statusColorMap[statusTags.completed] = 'green'
  statusColorMap[statusTags.abnormal] = 'red'
  statusColorMap[statusTags.abort] = 'yellow'

  const requestLogs = reactive([])

  let i = 0

  function showAbortBtn(status) {
    return (status === statusTags.initializing || status === statusTags.uploading || status === statusTags.merging) 
  }

  function showResumeBtn(status) {
    return (status === statusTags.abnormal || status === statusTags.abort) 
  }

  async function upload() {
    const files = await showOpenFilePicker({
      multiple: true
    })

    const tasks = []

    for (const file of files) { 
      const fileData = await file.getFile() 
      tasks.push(addUploadTask(autoUpload(fileData), {
        name: fileData.name,
        size: fileData.size,
        type: fileData.type
      }))
    }

    await Promise.all(tasks)
  }
  
  async function addUploadTask(uploadTask, fileInfo) {
    const log = reactive({
      id: ++i,
      request: uploadTask,
      progress: 0,
      status: 0,
      fileInfo,
      response: null
    })
    
    log.abort = () => {
      log.request.abort && log.request.abort()
    }
    log.remove = () => {
      log.abort()
      log.request.clearCache && log.request.clearCache()
      for (const i in requestLogs) {
        if (requestLogs[i].id === log.id) {
          requestLogs.splice(i, 1)
        }
      }
    }
    if (log.request.resume) {
      log.resume = async () => {
        log.response = await log.request.resume()
        console.log('上传结束', log.response)
      }
    }

    log.request.onUploadProgress( e => {
      if (e.status) {
        log.status = e.status
      }
      log.progress = e.progress * 100
    })

    requestLogs.push(log)
    log.response = await log.request
    // console.log('上传结束', log.response)
  }


</script>

<style scoped>
.log-list{
  border-radius: 5px;
  border: 1px solid #eee;
  padding: 10px;
  margin-top: 10px;
}
.info{
  display: flex;
}
.info .name{
  flex: 1;
}
.progress-bar{
  background: #eee;
  width: 100%;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-bar .progress{
  height: 100%;
  background: green;
  width: 0%;
  border-radius: 5px;
}
</style>
