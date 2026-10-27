import env from "@/utils/env";
import { modal, toast } from "@/utils/extendApi";
import { getStorage, removeStorage } from "@/utils/storage";

class UniRequest {
  constructor(config = {}) {
    this.defaults = Object.assign({}, this.defaults, config);
  }

  defaults = {
    baseUrl: env.baseUrl,
    data: null,
    method: "GET",
    header: {
      "Content-type": "application/json"
    },
    timeout: 60000,
    isLoading: true // 默认显示 Loading，可通过单个请求传入 { isLoading: false } 静默请求
  };

  activeRequests = 0;
  timerId = null;
  unauthorizedTask: Promise<void> | null = null;

  interceptors = {
    request: (config) => config,
    response: (response) => response
  };

  /**
   * 显示 Loading，并处理并发请求的延迟关闭。
   */
  startLoading(configs) {
    if (!configs.isLoading) return;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.activeRequests += 1;
    if (this.activeRequests === 1) {
      uni.showLoading({
        title: "加载中...",
        mask: true
      });
    }
  }

  /**
   * 所有并发请求结束后延迟关闭 Loading，避免页面闪烁。
   */
  finishLoading(configs) {
    if (!configs.isLoading) return;

    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests > 0) return;

    this.timerId = setTimeout(() => {
      this.timerId = null;
      if (this.activeRequests === 0) {
        uni.hideLoading();
      }
    }, 500);
  }

  /**
   * 登录失效统一处理：并发 401 只执行一次，避免重复弹窗和重复跳转。
   * 处理完成后保留标记，等待登录成功后由 resetUnauthorized() 清除。
   */
  handleUnauthorized(): Promise<void> {
    if (this.unauthorizedTask) return this.unauthorizedTask;

    // 先清理旧 token，避免弹窗期间其他请求继续携带失效凭证
    removeStorage("token");

    this.unauthorizedTask = (async () => {
      try {
        await modal({
          title: "认证失败",
          content: "登录已失效，请重新登录!",
          showCancel: false
        });
      } catch (error) {
        // 弹窗异常不应阻塞跳转登录页
      }

      uni.reLaunch({
        url: "/pages/login/login"
      });
    })();

    return this.unauthorizedTask;
  }

  /**
   * 登录成功后调用，允许下一次 401 重新触发登录失效处理。
   */
  resetUnauthorized() {
    this.unauthorizedTask = null;
  }

  request(options) {
    return new Promise((resolve, reject) => {
      // 1. 合并 header 与配置项
      const header = Object.assign({}, this.defaults.header, options.header);
      const opts = Object.assign({}, this.defaults, options, { header });

      // 2. 拼接完整的请求地址（若传入的已是 http/https 绝对路径则不拼接）
      const isExternal = /^https?:\/\//.test(opts.url);
      opts.url = isExternal ? opts.url : opts.baseUrl + opts.url;

      // 3. 调用请求拦截器
      const configs = this.interceptors.request(opts);

      // 4. 控制 Loading 显示
      this.startLoading(configs);

      // 5. 发起网络请求
      uni.request({
        ...configs,
        success: async (res) => {
          if (res.statusCode === 200) {
            resolve(
              this.interceptors.response({
                response: res,
                success: true
              })
            );
          } else if (res.statusCode === 401) {
            await this.handleUnauthorized();
            reject(
              this.interceptors.response({
                response: res,
                success: false,
                silent: true
              })
            );
          } else {
            reject(
              this.interceptors.response({
                response: res,
                success: false
              })
            );
          }
        },
        fail: (err) => {
          reject(
            this.interceptors.response({
              response: err,
              success: false
            })
          );
        },
        complete: () => {
          this.finishLoading(configs);
        }
      });
    });
  }

  /**
   * 上传文件。uni.uploadFile 不支持 uni.request 的 data/header 规则，
   * 这里复用 token 注入与 Loading 队列，并保持业务响应结构一致。
   */
  upload(url, filePath, name = "file", config = {}) {
    return new Promise((resolve, reject) => {
      const opts = Object.assign({}, this.defaults, config, {
        url,
        filePath,
        name,
        method: "POST",
        header: Object.assign({}, config.header)
      });

      const isExternal = /^https?:\/\//.test(opts.url);
      opts.url = isExternal ? opts.url : opts.baseUrl + opts.url;

      const configs = this.interceptors.request(opts);
      // 让 uni.uploadFile 自动生成 multipart/form-data 边界
      Object.keys(configs.header).forEach((key) => {
        if (key.toLowerCase() === "content-type") {
          delete configs.header[key];
        }
      });

      this.startLoading(configs);

      uni.uploadFile({
        url: configs.url,
        filePath,
        name,
        header: configs.header,
        formData: configs.formData || {},
        success: async (res) => {
          if (res.statusCode === 200) {
            try {
              const data =
                typeof res.data === "string" ? JSON.parse(res.data) : res.data;
              resolve(data);
            } catch (error) {
              toast({
                title: "上传响应解析失败，请稍后重试",
                icon: "error"
              });
              reject(error);
            }
          } else if (res.statusCode === 401) {
            await this.handleUnauthorized();
            reject(
              this.interceptors.response({
                response: res,
                success: false,
                silent: true
              })
            );
          } else {
            reject(
              this.interceptors.response({
                response: res,
                success: false
              })
            );
          }
        },
        fail: (err) => {
          reject(
            this.interceptors.response({
              response: err,
              success: false
            })
          );
        },
        complete: () => {
          this.finishLoading(configs);
        }
      });
    });
  }

  get(url, data = {}, config = {}) {
    return this.request(Object.assign({ url, data, method: "GET" }, config));
  }

  post(url, data = {}, config = {}) {
    return this.request(Object.assign({ url, data, method: "POST" }, config));
  }

  put(url, data = {}, config = {}) {
    return this.request(Object.assign({ url, data, method: "PUT" }, config));
  }

  delete(url, data = {}, config = {}) {
    return this.request(Object.assign({ url, data, method: "DELETE" }, config));
  }

  all(...promises) {
    return Promise.all(promises);
  }
}

const instance = new UniRequest();

// 请求拦截器
instance.interceptors.request = (config = {}) => {
  const token = getStorage("token");
  if (token) {
    config.header.Authorization = `Bearer ${token}`;
  }
  return config;
};

// 响应拦截器
instance.interceptors.response = ({ response, success, silent = false }) => {
  if (!success) {
    if (!silent) {
      toast({
        title: "系统出错，请稍后重试！",
        icon: "error"
      });
    }
    return response;
  }
  // 直接返回业务数据层 res.data，方便页面直接解构使用
  return response.data;
};

export default instance;
