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
 * 首次绑定或换绑时需同时传 accountName、accountPwd，成功后返回 JWT（sessionValue）。
 */
export const wxLogin = (
  data: WxLoginPayload
): Promise<CommonResult<WxLoginResult>> => {
  return request.post("/wx/login", data, { isLoading: false });
};
