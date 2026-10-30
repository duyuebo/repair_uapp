import env from "@/utils/env";
import { modal, toast } from "@/utils/extendApi";
import { clearSessionStorage, silentLogin } from "@/utils/session";
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
    isLoading: true, // 默认显示 Loading，可通过单个请求传入 { isLoading: false } 静默请求
    auth: true // 默认携带 token；登录接口传 { auth: false } 跳过注入与 401 续期
  };

  activeRequests = 0;
  timerId = null;
  unauthorizedTask: Promise<void> | null = null;
  refreshTask: Promise<boolean> | null = null;

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
   * 判断请求发送时使用的 Authorization 是否已被本地新 token 取代。
   * 用于处理错峰返回的 401：此时直接重试即可，不应再次静默登录。
   */
  hasNewerToken(sentAuthorization): boolean {
    const currentToken = getStorage("token");
    if (!currentToken) return false;

    return sentAuthorization !== `Bearer ${currentToken}`;
  }

  /**
   * 登录态失效时先尝试静默登录。
   * 并发 401 共享同一个 Promise，确保只发起一次静默登录。
   */
  restoreSession(): Promise<boolean> {
    if (this.refreshTask) return this.refreshTask;

    // 退出登录或 token 已被清理时不再自动续期，避免退出后又被后台请求重新登录
    if (!getStorage("token")) {
      return Promise.resolve(false);
    }

    this.refreshTask = silentLogin()
      .then((result) => {
        if (result.status === "success") {
          // 新 token 已生效，允许后续 401 重新触发登录失效处理
          this.unauthorizedTask = null;
          return true;
        }

        // 微信未绑定或账户被禁用时清除本机会话，等待用户手动登录
        if (result.status === "unbound") {
          clearSessionStorage();
        }

        return false;
      })
      .finally(() => {
        this.refreshTask = null;
      });

    return this.refreshTask;
  }

  /**
   * 静默登录无法恢复时提示并回到登录页。
   * 并发 401 只弹一次；已经在登录页时不再重复提示。
   */
  notifyLoginExpired(): Promise<void> {
    if (this.unauthorizedTask) return this.unauthorizedTask;

    const pages = getCurrentPages();
    const currentPage = pages.length ? pages[pages.length - 1] : null;
    if (currentPage && currentPage.route === "pages/login/login") {
      return Promise.resolve();
    }

    this.unauthorizedTask = (async () => {
      try {
        await modal({
          title: "登录已过期",
          content: "请重新登录后再继续操作",
          showCancel: false
        });
      } catch (error) {
        // 弹窗异常不应阻塞跳转登录页
      }

      uni.reLaunch({
        url: "/pages/login/login?expired=1"
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
      const isRetried = Boolean(options._retried);
      const { _retried, ...requestOptions } = options;

      // 1. 合并 header 与配置项
      const header = Object.assign(
        {},
        this.defaults.header,
        requestOptions.header
      );
      const opts = Object.assign({}, this.defaults, requestOptions, { header });

      // 2. 拼接完整的请求地址（若传入的已是 http/https 绝对路径则不拼接）
      const isExternal = /^https?:\/\//.test(opts.url);
      opts.url = isExternal ? opts.url : opts.baseUrl + opts.url;

      // 3. 调用请求拦截器
      const configs = this.interceptors.request(opts);
      // 记录本次请求实际使用的凭证，用于识别错峰返回的 401
      const sentAuthorization =
        configs.header && configs.header.Authorization;

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
            const canRefresh = configs.auth !== false;
            // 错峰返回的 401：token 已被其他请求刷新，直接重试原请求
            const tokenRefreshed = this.hasNewerToken(sentAuthorization);

            // 首次 401：token 已刷新或静默登录成功后重试原请求一次
            if (
              canRefresh &&
              !isRetried &&
              (tokenRefreshed || (await this.restoreSession()))
            ) {
              try {
                resolve(
                  await this.request(
                    Object.assign({}, requestOptions, { _retried: true })
                  )
                );
              } catch (error) {
                reject(error);
              }
              return;
            }

            if (canRefresh) {
              await this.notifyLoginExpired();
            }

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
      const isRetried = Boolean(config._retried);
      const { _retried, ...uploadConfig } = config;

      const opts = Object.assign({}, this.defaults, uploadConfig, {
        url,
        filePath,
        name,
        method: "POST",
        header: Object.assign({}, uploadConfig.header)
      });

      const isExternal = /^https?:\/\//.test(opts.url);
      opts.url = isExternal ? opts.url : opts.baseUrl + opts.url;

      const configs = this.interceptors.request(opts);
      // 记录本次上传实际使用的凭证，用于识别错峰返回的 401
      const sentAuthorization =
        configs.header && configs.header.Authorization;
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
            const canRefresh = configs.auth !== false;
            // 错峰返回的 401：token 已被其他请求刷新，直接重试上传
            const tokenRefreshed = this.hasNewerToken(sentAuthorization);

            // 首次 401：token 已刷新或静默登录成功后重新上传一次
            if (
              canRefresh &&
              !isRetried &&
              (tokenRefreshed || (await this.restoreSession()))
            ) {
              try {
                resolve(
                  await this.upload(url, filePath, name, {
                    ...uploadConfig,
                    _retried: true
                  })
                );
              } catch (error) {
                reject(error);
              }
              return;
            }

            if (canRefresh) {
              await this.notifyLoginExpired();
            }

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
  if (config.auth === false) {
    // 登录接口不能携带旧 token：后端 JWT 过滤器会在进入登录逻辑前直接返回 401
    Object.keys(config.header || {}).forEach((key) => {
      if (key.toLowerCase() === "authorization") {
        delete config.header[key];
      }
    });
    return config;
  }

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
