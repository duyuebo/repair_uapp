import { getLoginAccount } from "./repairCache";

export type RepairPhotoStatus = "uploading" | "done" | "error";

export interface RepairDraftPhoto {
  key: string;
  localPath: string;
  fileStorePath: string;
  status: RepairPhotoStatus;
}

export interface RepairDraft {
  faultDescription: string;
  photos: RepairDraftPhoto[];
}

// reLaunch 不会重启 JS 运行时，内存中的草稿可以跨 tab 切换保留。
// 小程序退出后草稿清空；本地临时图片路径也只在当前会话内有效。
const drafts = new Map<string, RepairDraft>();

const normalizeAccount = (account: string) => account || "anonymous";
const currentAccount = () => normalizeAccount(getLoginAccount());

export const getRepairDraft = (): RepairDraft | null => {
  return drafts.get(currentAccount()) || null;
};

export const setRepairDraft = (draft: RepairDraft) => {
  drafts.set(currentAccount(), draft);
};

export const getRepairDraftPhoto = (
  key: string,
  account = currentAccount()
): RepairDraftPhoto | null => {
  const draft = drafts.get(normalizeAccount(account));
  if (!draft) return null;

  return draft.photos.find((item) => item.key === key) || null;
};

/**
 * 页面卸载后，未完成的上传仍会继续。这里按照片 key 把结果同步回草稿，
 * 避免用户切回页面时图片一直停留在“上传中”。
 */
export const updateRepairDraftPhoto = (
  key: string,
  patch: Partial<RepairDraftPhoto>,
  account = currentAccount()
) => {
  const draft = drafts.get(normalizeAccount(account));
  if (!draft) return;

  const photo = draft.photos.find((item) => item.key === key);
  if (!photo) return;

  Object.assign(photo, patch);
};

export const clearRepairDraft = () => {
  drafts.delete(currentAccount());
};
