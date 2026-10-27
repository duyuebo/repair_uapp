import request from "@/utils/request";
import type { CommonResult, PagerResult } from "./common";

/**
 * 报修接口中的 Long 主键统一按 string 声明。
 * endpoint-repair 需保持 Long -> string 的序列化配置，否则运行时仍会丢失精度。
 */
export interface RepairAccountProfile {
  id: string;
  projectId: string | null;
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
  id: string;
  orderNo: string;
  status: number;
  statusText: string;
  dtCreate: string;
}

export type RepairStatusGroup = "processing" | "completed";

export interface RepairOrderListItem {
  id: string;
  orderNo: string;
  status: number;
  statusText: string;
  faultDescription: string | null;
  projectName: string | null;
  contactName: string | null;
  dtCreate: string | null;
  workerName: string | null;
  dtCompleted: string | null;
}

export interface RepairOrderListQuery {
  statusGroup: RepairStatusGroup;
  page?: number;
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
 * 查询当前账户的报修列表。
 * statusGroup：processing-处理中(0/1)，completed-已完成(2)。
 */
export const getRepairOrderList = (
  params: RepairOrderListQuery
): Promise<CommonResult<PagerResult<RepairOrderListItem>>> => {
  return request.get("/repair/orders", params, { isLoading: false });
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
