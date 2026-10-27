import { getStorage, removeStorage, setStorage } from "./storage";

const LOGIN_ACCOUNT_KEY = "login_account";
const CONTACT_KEY_PREFIX = "repair_contact";
const PROFILE_KEY_PREFIX = "repair_profile";

// 旧版本的全局缓存键，登录时清理，避免跨账号串数据
const LEGACY_CONTACT_KEY = "repair_contact";
const LEGACY_PROFILE_KEY = "repair_profile";

export interface RepairContactCache {
  contactName: string;
  contactPhone: string;
}

export interface RepairProfileCache {
  projectName?: string | null;
  accountName?: string | null;
}

export const getLoginAccount = (): string => {
  return getStorage(LOGIN_ACCOUNT_KEY) || "";
};

export const setLoginAccount = (account: string) => {
  setStorage(LOGIN_ACCOUNT_KEY, account);
  removeStorage(LEGACY_CONTACT_KEY);
  removeStorage(LEGACY_PROFILE_KEY);
};

const scopedKey = (prefix: string) => {
  return `${prefix}:${getLoginAccount() || "anonymous"}`;
};

export const getContactCache = (): RepairContactCache | null => {
  return getStorage(scopedKey(CONTACT_KEY_PREFIX)) || null;
};

export const setContactCache = (value: RepairContactCache) => {
  setStorage(scopedKey(CONTACT_KEY_PREFIX), value);
};

export const getProfileCache = (): RepairProfileCache | null => {
  return getStorage(scopedKey(PROFILE_KEY_PREFIX)) || null;
};

export const setProfileCache = (value: RepairProfileCache) => {
  setStorage(scopedKey(PROFILE_KEY_PREFIX), value);
};
