import env from "@/utils/env";
import { modal, toast } from "@/utils/extendApi";
import { getStorage } from "@/utils/storage";

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
    isLoading: true // 新增：默认显示 Loading，可通过单个请求传入 { isLoading: false } 静默请求
  };

  loadingQueue = [];
  timerId = null;

  interceptors = {
    request: (config) => config,
    response: (response) => response
  };

  request(options) {
    return new Promise((resolve, reject) => {
      // 1. 深度合并 header 与配置项
      const header = Object.assign({}, this.defaults.header, options.header);
      const opts = Object.assign({}, this.defaults, options, { header });

      // 2. 拼接完整的请求地址（若传入的已是 http/https 绝对路径则不拼接）
      const isExternal = /^https?:\/\//.test(opts.url);
      opts.url = isExternal ? opts.url : opts.baseUrl + opts.url;

      // 3. 调用请求拦截器
      const configs = this.interceptors.request(opts);

      // 4. 控制 Loading 显示与防抖队列
      if (configs.isLoading) {
        this.timerId && clearTimeout(this.timerId);
        this.loadingQueue.length === 0 && uni.showLoading({
          title: "加载中...",
          mask: true
        });
        this.loadingQueue.push("queue");
      }

      // 5. 发起网络请求
      uni.request({
        ...configs,
        success: async (res) => {
          if (res.statusCode === 200) {
            resolve(this.interceptors.response({
              response: res,
              success: true
            }));
          } else if (res.statusCode === 401) {
            // 认证失败处理（若后端采用 HTTP 200 + 业务码判定，可将此逻辑移至 statusCode === 200 分支内）
            await modal({
              title: "认证失败",
              content: "登录已失效，请重新登录!",
              showCancel: false
            });
            uni.reLaunch({
              url: "/pages/login/login"
            });
            reject(this.interceptors.response({
              response: res,
              success: false
            }));
          } else {
            reject(this.interceptors.response({
              response: res,
              success: false
            }));
          }
        },
        fail: (err) => {
          reject(this.interceptors.response({
            response: err,
            success: false
          }));
        },
        complete: () => {
          if (configs.isLoading) {
            this.loadingQueue.pop();
            // 只有当所有并发请求全部完成（队列清空）时，才压入缓冲占位符并启动 500ms 延迟关闭
            if (this.loadingQueue.length === 0) {
              this.loadingQueue.push("queue");
              this.timerId = setTimeout(() => {
                this.loadingQueue.pop();
                if (this.loadingQueue.length === 0) {
                  uni.hideLoading();
                }
              }, 500);
            }
          }
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
instance.interceptors.response = ({ response, success }) => {
  if (!success) {
    toast({
      title: "系统出错，请稍后重试！",
      icon: "error"
    });
    return response;
  }
  // 直接返回业务数据层 res.data，方便页面直接解构使用
  return response.data;
};

export default instance;