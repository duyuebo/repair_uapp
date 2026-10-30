import env from "@/utils/env";
import { getStorage, removeStorage, setStorage } from "@/utils/storage";

export const AUTO_LOGIN_KEY = "session_auto_login";
export const REMEMBER_KEY = "login_remember";

// 会话版本号：退出登录时递增，防止正在进行的静默登录在退出后把 token 写回来
let sessionVersion = 0;

export type SilentLoginResult =
  | { status: "success"; token: string }
  | { status: "unbound" }
  | { status: "error"; error?: unknown };

interface WxLoginResponseBody {
  status: number;
  code: string;
  message: string;
  obj: {
    sessionValue: string | null;
    inSystem: number;
  } | null;
}

/**
 * 获取微信小程序登录 code。
 */
export const getWxCode = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success: (res) => {
        if (res.code) {
          resolve(res.code);
        } else {
          reject(new Error("未获取到微信登录 code"));
        }
      },
      fail: reject
    });
  });
};

export const enableAutoLogin = () => {
  setStorage(AUTO_LOGIN_KEY, true);
};

export const isAutoLoginEnabled = (): boolean => {
  return Boolean(getStorage(AUTO_LOGIN_KEY));
};

interface ClearSessionOptions {
  /** 用户主动退出时传 true，同时清除“记住密码”，下次必须重新输入 */
  clearRememberedLogin?: boolean;
}

/**
 * 清除本机登录会话。退出登录、静默登录确认未绑定或禁用时调用。
 * 默认保留 login_remember（登录页可回填）；用户主动退出时传
 * { clearRememberedLogin: true }，避免退出后仍能一键登录。
 */
export const clearSessionStorage = ({
  clearRememberedLogin = false
}: ClearSessionOptions = {}) => {
  sessionVersion += 1;
  removeStorage("token");
  removeStorage("login_account");
  removeStorage(AUTO_LOGIN_KEY);
  if (clearRememberedLogin) {
    removeStorage(REMEMBER_KEY);
  }
};

/**
 * 仅使用微信 code 执行静默登录。
 *
 * 该请求不能复用 utils/request：登录接口一旦携带失效 token，
 * 后端 JWT 过滤器会在进入登录逻辑前直接返回 401。
 */
export const silentLogin = async (): Promise<SilentLoginResult> => {
  const version = sessionVersion;

  let code = "";
  try {
    code = await getWxCode();
  } catch (error) {
    return { status: "error", error };
  }

  try {
    const response = await new Promise<any>((resolve, reject) => {
      uni.request({
        url: `${env.baseUrl}/wx/login`,
        method: "POST",
        header: {
          "Content-type": "application/json"
        },
        data: { code },
        timeout: 10000,
        success: resolve,
        fail: reject
      });
    });

    if (response.statusCode !== 200) {
      return { status: "error" };
    }

    const body: WxLoginResponseBody =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    if (body && body.status === 1 && body.obj && body.obj.sessionValue) {
      // 请求期间用户已退出登录，丢弃这次静默登录结果
      if (version !== sessionVersion) {
        return { status: "error" };
      }

      setStorage("token", body.obj.sessionValue);
      enableAutoLogin();
      return { status: "success", token: body.obj.sessionValue };
    }

    // inSystem = 0 表示当前微信未绑定报修账户，或账户已被禁用
    if (body && body.obj && body.obj.inSystem === 0) {
      return { status: "unbound" };
    }

    return { status: "error" };
  } catch (error) {
    return { status: "error", error };
  }
};
