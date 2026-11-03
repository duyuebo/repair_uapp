import request from "@/utils/request";
import type { CommonResult } from "./common";

export type { CommonResult } from "./common";

export interface WxLoginPayload {
  code: string;
  accountName?: string;
  accountPwd?: string;
}

export interface WxLoginResult {
  sessionValue: string | null;
  inSystem: number;
}

/**
 * 微信小程序登录
 *
 * 仅传 code 时执行静默登录；未绑定账户返回 inSystem = 0。
 * 账号密码登录时需同时传 accountName、accountPwd，成功后返回 JWT（sessionValue）。
 * 微信与账户的绑定关系由后端自动处理：登录成功时自动绑定当前微信，
 * 已绑定其他账户时先解绑旧账户再绑定当前账户。
 */
export const wxLogin = (
  data: WxLoginPayload
): Promise<CommonResult<WxLoginResult>> => {
  // 登录接口不能携带旧 token，否则后端会在进入登录逻辑前直接返回 401
  return request.post("/wx/login", data, {
    isLoading: false,
    auth: false
  });
};
