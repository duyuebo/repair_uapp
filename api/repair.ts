import request from "@/utils/request";
import type { CommonResult } from "./common";

export interface RepairAccountProfile {
  id: number;
  projectId: number | null;
  projectName: string | null;
  accountName: string | null;
  wxName: string | null;
  wxImgAvatar: string | null;
  wxOpenid: string | null;
}

export interface RepairPhotoUpload {
  fileStorePath: string;
  fileAccessPath: string;
}

export interface RepairOrderPayload {
  contactName: string;
  contactPhone: string;
  faultDescription: string;
  photoUrls: string[];
}

export interface RepairOrderCreateResult {
  // 后端 19 位 Long 主键，按字符串接收，避免 JS 精度丢失
  id: string;
  orderNo: string;
  status: number;
  statusText: string;
  dtCreate: string;
}

/**
 * 获取当前登录账户信息，用于展示项目名称和默认联系人。
 */
export const getRepairAccountProfile = (): Promise<
  CommonResult<RepairAccountProfile>
> => {
  return request.get("/repair/account/me", {}, { isLoading: false });
};

/**
 * 上传单张报修图片。
 * 后端使用 multipart/form-data，字段名为 file。
 */
export const uploadRepairPhoto = (
  filePath: string
): Promise<CommonResult<RepairPhotoUpload>> => {
  return request.upload("/repair/orders/photos", filePath, "file", {
    isLoading: false
  });
};

/**
 * 提交报修工单。
 */
export const createRepairOrder = (
  data: RepairOrderPayload
): Promise<CommonResult<RepairOrderCreateResult>> => {
  return request.post("/repair/orders", data);
};
