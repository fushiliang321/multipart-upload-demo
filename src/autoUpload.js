import { axiosMultipartUpload } from 'multipart-upload-zct'
import { statusTags } from 'multipart-upload-zct/MultipartUpload'
import axios from "axios"
import { group } from 'multipart-upload-zct/cache'
import axiosAdapter from 'multipart-upload-zct/requestAdapters/axios'

export const cacheGroup = group(1)

const url = {
    upload: import.meta.env.VITE_API_BASE_URL + 'upload/index',
    multipart: import.meta.env.VITE_API_BASE_URL + 'upload/'
}

const headers = {
    // token: 'xxxx',
    // system: 'xxx'
}

const maxFileSize = 1024 * 1024 * 10 //单文件上传最大10M

const adapterConfig = {
    baseURL: url.multipart,
    headers,
}

export const adapter = new axiosAdapter(adapterConfig)

//分片上传
function multipart(file, params) {
    const mp = axiosMultipartUpload(adapterConfig, cacheGroup)
    return mp.upload(file, params)
}

//单文件上传
function single(file, params) {
    const formData = new FormData()
    formData.append('file', file)
    const controller = new AbortController()
    const signal = controller.signal
    const progressListeners = []

    const triggerUploadProgress = (progress) => {
        progressListeners.forEach(listener => {
            listener(progress)
        })
    }

    let progressEvent = {
        total: file.size,
        loaded: 0,
        progress: 0,
    }

    const req = new Promise(async resolve => {
        try {
            const req = axios.post(url.upload, formData, {
                params,
                signal,
                headers,
                onUploadProgress: e => {
                    progressEvent = {
                        progress: e.progress,
                        total: e.total,
                        loaded: e.loaded,
                    }
                    triggerUploadProgress({
                        ...progressEvent,
                        status: statusTags.uploading,
                    })
                }
            })
            const res = await req
            triggerUploadProgress({
                total: file.size,
                loaded: file.size,
                progress: 1,
                status: statusTags.completed,
            })
            resolve(res)
            console.log(res)
        } catch (error) {
            console.warn(error)
            triggerUploadProgress({
                ...progressEvent,
                status: statusTags.abnormal,
            })
            resolve(false)
        }
    })
    req.onUploadProgress = fun => {
        progressListeners.push(fun)
    }
    req.abort = reason => controller.abort(reason)
    return req
}

export default function(file, params) {
    if (file.size > maxFileSize) {
        return multipart(file, params)
    }
    return single(file, params)
}