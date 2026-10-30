<template>
  <view class="profile-page">
    <view class="profile-content">
      <view class="profile-card">
        <view class="profile-card__body">
          <view class="profile-card__avatar">
            <image
              class="profile-card__avatar-image"
              :src="avatarSrc"
              mode="aspectFill"
              @error="handleAvatarError"
            />
          </view>

          <text class="profile-card__name">{{ displayName }}</text>

          <view v-if="maskedAccount" class="profile-card__badge-wrap">
            <view class="profile-card__badge">
              <view class="profile-card__badge-icon">
                <uni-icons
                  type="person"
                  :size="12"
                  color="rgba(255,255,255,0.9)"
                ></uni-icons>
              </view>
              <text class="profile-card__badge-text">{{ maskedAccount }}</text>
            </view>
          </view>

          <view class="profile-card__divider"></view>

          <view class="profile-card__project">
            <view class="profile-card__project-label">
              <uni-icons
                type="home"
                :size="14"
                color="rgba(255,255,255,0.78)"
              ></uni-icons>
              <text class="profile-card__project-label-text">所属项目</text>
            </view>
            <text class="profile-card__project-name">{{ projectName }}</text>
          </view>
        </view>
      </view>

      <view class="info-card">
        <view class="info-row">
          <view class="info-row__icon">
            <uni-icons type="person" :size="20" color="#3B82F6"></uni-icons>
          </view>
          <view class="info-row__body">
            <text class="info-row__label">常用联系人</text>
            <text class="info-row__value">{{ contactName }}</text>
          </view>
        </view>

        <view class="info-row__divider"></view>

        <view class="info-row">
          <view class="info-row__icon">
            <uni-icons type="phone" :size="20" color="#3B82F6"></uni-icons>
          </view>
          <view class="info-row__body">
            <text class="info-row__label">联系电话</text>
            <text class="info-row__value">{{ contactPhoneText }}</text>
          </view>
        </view>
      </view>

      <view
        v-if="loadError"
        class="profile-retry"
        hover-class="profile-retry--pressed"
        :hover-stay-time="60"
        @tap="loadProfile"
      >
        <uni-icons type="refresh" :size="14" color="#8A94A6"></uni-icons>
        <text class="profile-retry__text">账户信息加载失败，点击重试</text>
      </view>

      <view class="logout-wrap">
        <button
          class="logout-btn"
          :disabled="loggingOut"
          hover-class="logout-btn--pressed"
          :hover-stay-time="60"
          @tap="handleLogout"
        >
          退出登录
        </button>
      </view>
    </view>

    <business-tabbar active="profile" />
  </view>
</template>

<script>
import { getRepairAccountProfile } from "@/api/repair";
import request from "@/utils/request";
import { modal, toast } from "@/utils/extendApi";
import { getStorage } from "@/utils/storage";
import { clearSessionStorage } from "@/utils/session";
import {
  getContactCache,
  getLoginAccount,
  getProfileCache,
  setLoginAccount,
  setProfileCache
} from "@/utils/repairCache";

const LOGIN_PAGE = "/pages/login/login";
const DEFAULT_AVATAR = "/static/profile/default-avatar.png";

const maskAccount = (value) => {
  const text = String(value === null || value === undefined ? "" : value).trim();
  if (!text) return "";

  // 手机号只保留首尾，避免个人中心直接暴露完整账号
  const digits = text.replace(/[\s-]/g, "");
  if (/^1\d{10}$/.test(digits)) {
    return `${digits.slice(0, 3)}****${digits.slice(7)}`;
  }

  const atIndex = text.indexOf("@");
  if (atIndex > 1) {
    const name = text.slice(0, atIndex);
    const domain = text.slice(atIndex);
    return `${name.slice(0, Math.min(2, name.length))}***${domain}`;
  }

  if (text.length <= 4) return text;
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
};

const formatPhone = (value) => {
  const text = String(value === null || value === undefined ? "" : value).trim();
  if (!text) return "";

  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{11}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return text;
};

export default {
  name: "ProfilePage",
  data() {
    return {
      profile: {
        accountName: "",
        projectName: "",
        wxName: "",
        wxImgAvatar: ""
      },
      contact: {
        contactName: "",
        contactPhone: ""
      },
      avatarError: false,
      profileLoading: false,
      loadError: false,
      loggingOut: false
    };
  },
  computed: {
    avatarSrc() {
      const avatar = (this.profile.wxImgAvatar || "").trim();
      if (!this.avatarError && avatar) return avatar;
      return DEFAULT_AVATAR;
    },
    displayName() {
      const wxName = (this.profile.wxName || "").trim();
      // 微信默认昵称没有辨识度，优先展示客户账号
      if (wxName && wxName !== "微信用户" && wxName !== "WeChat User") {
        return wxName;
      }

      const accountName = (this.profile.accountName || "").trim();
      if (accountName && !/^1\d{10}$/.test(accountName)) {
        return accountName;
      }

      return "客户用户";
    },
    maskedAccount() {
      return maskAccount(this.profile.accountName);
    },
    projectName() {
      const name = (this.profile.projectName || "").trim();
      if (name) return name;
      return this.profileLoading ? "加载中..." : "未绑定项目";
    },
    contactName() {
      const name = (this.contact.contactName || "").trim();
      return name || this.displayName;
    },
    contactPhoneText() {
      const phone = formatPhone(this.contact.contactPhone);
      return phone || "未设置";
    }
  },
  onLoad() {
    if (!getStorage("token")) {
      uni.reLaunch({ url: LOGIN_PAGE });
      return;
    }

    this.restoreCache();
    this.loadProfile();
  },
  methods: {
    restoreCache() {
      const cachedProfile = getProfileCache() || {};
      const cachedContact = getContactCache() || {};
      const loginAccount = getLoginAccount();

      this.profile = {
        accountName: cachedProfile.accountName || loginAccount || "",
        projectName: cachedProfile.projectName || "",
        wxName: cachedProfile.wxName || "",
        wxImgAvatar: cachedProfile.wxImgAvatar || ""
      };
      this.contact = {
        contactName: cachedContact.contactName || "",
        contactPhone: cachedContact.contactPhone || ""
      };
    },
    async loadProfile() {
      if (this.profileLoading) return;

      this.profileLoading = true;
      this.loadError = false;

      try {
        const res = await getRepairAccountProfile();
        if (!res || res.status !== 1 || !res.obj) {
          this.loadError = true;
          if (!this.profile.accountName && !this.profile.projectName) {
            toast({
              title: (res && res.message) || "获取账户信息失败，请稍后重试"
            });
          }
          return;
        }

        const data = res.obj;
        this.avatarError = false;
        this.profile = {
          accountName: data.accountName || "",
          projectName: data.projectName || "",
          wxName: data.wxName || "",
          wxImgAvatar: data.wxImgAvatar || ""
        };

        // 兼容升级/直达场景：本地没有登录账号时，用后端账户名补齐缓存隔离键
        if (!getLoginAccount() && data.accountName) {
          setLoginAccount(data.accountName);
        }

        setProfileCache({
          projectName: data.projectName,
          accountName: data.accountName,
          wxName: data.wxName,
          wxImgAvatar: data.wxImgAvatar
        });

        // 联系人缓存可能已在报修页更新，进入个人中心时同步展示
        const cachedContact = getContactCache();
        if (cachedContact) {
          this.contact = {
            contactName: cachedContact.contactName || this.contact.contactName,
            contactPhone: cachedContact.contactPhone || this.contact.contactPhone
          };
        }
      } catch (error) {
        this.loadError = true;
        // 网络异常已由 request 层统一提示
      } finally {
        this.profileLoading = false;
      }
    },
    handleAvatarError() {
      if (this.avatarError) return;
      this.avatarError = true;
    },
    async handleLogout() {
      if (this.loggingOut) return;

      // 先置位，避免连续点击弹出多个确认框
      this.loggingOut = true;
      const confirmed = await modal({
        title: "退出登录",
        content: "确定要退出当前账号吗？",
        confirmColor: "#F3514F"
      });
      if (!confirmed) {
        this.loggingOut = false;
        return;
      }

      // 清除 token、登录账号、自动登录标记与记住的账号密码，退出后必须重新输入
      clearSessionStorage({ clearRememberedLogin: true });
      request.resetUnauthorized();
      uni.reLaunch({
        url: LOGIN_PAGE,
        fail: () => {
          this.loggingOut = false;
        }
      });
    }
  }
};
</script>

<style scoped>
.profile-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.profile-content {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 24rpx 56rpx 150rpx;
  padding: 24rpx 56rpx calc(150rpx + constant(safe-area-inset-bottom));
  padding: 24rpx 56rpx calc(150rpx + env(safe-area-inset-bottom));
}

.profile-card {
  position: relative;
  flex-shrink: 0;
  padding: 44rpx 36rpx 32rpx;
  overflow: hidden;
  background-color: #3b82f6;
  background-image: linear-gradient(150deg, #4f8dff 0%, #3b82f6 48%, #2f6bff 100%);
  border-radius: 28rpx;
  box-shadow: 0 16rpx 40rpx rgba(47, 107, 255, 0.18);
}

.profile-card::before {
  position: absolute;
  top: -180rpx;
  left: -120rpx;
  width: 440rpx;
  height: 440rpx;
  content: "";
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
}

.profile-card::after {
  position: absolute;
  right: -140rpx;
  bottom: -220rpx;
  width: 440rpx;
  height: 440rpx;
  content: "";
  background-color: rgba(255, 255, 255, 0.06);
  border-radius: 50%;
}

.profile-card__body {
  position: relative;
  z-index: 1;
}

.profile-card__avatar {
  box-sizing: border-box;
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto;
  overflow: hidden;
  background-color: #ffffff;
  border: 6rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.16);
}

.profile-card__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.profile-card__name {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 0 20rpx;
  margin-top: 26rpx;
  overflow: hidden;
  font-size: 40rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 1rpx;
}

.profile-card__badge-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16rpx;
}

.profile-card__badge {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  max-width: 100%;
  height: 48rpx;
  padding: 0 22rpx;
  background-color: rgba(255, 255, 255, 0.18);
  border: 2rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 24rpx;
}

.profile-card__badge-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.profile-card__badge-text {
  min-width: 0;
  margin-left: 8rpx;
  overflow: hidden;
  font-size: 24rpx;
  line-height: 1;
  color: rgba(255, 255, 255, 0.94);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card__divider {
  height: 2rpx;
  margin: 36rpx 0 24rpx;
  background-color: rgba(255, 255, 255, 0.16);
}

.profile-card__project {
  display: flex;
  align-items: center;
}

.profile-card__project-label {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.profile-card__project-label-text {
  margin-left: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.76);
}

.profile-card__project-name {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.4;
  color: #ffffff;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-card {
  flex-shrink: 0;
  margin-top: 24rpx;
  overflow: hidden;
  background-color: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.info-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 104rpx;
  padding: 0 28rpx;
}

.info-row__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  background-color: #eff6ff;
  border-radius: 18rpx;
}

.info-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  margin-left: 18rpx;
}

.info-row__label {
  font-size: 24rpx;
  line-height: 1.3;
  color: #8a94a6;
}

.info-row__value {
  margin-top: 6rpx;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.4;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-row__divider {
  height: 2rpx;
  margin-left: 106rpx;
  background-color: #f0f2f5;
}

.profile-retry {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  padding: 12rpx 0;
}

.profile-retry--pressed {
  opacity: 0.72;
}

.profile-retry__text {
  margin-left: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #8a94a6;
}

.logout-wrap {
  flex-shrink: 0;
  padding-top: 48rpx;
  margin-top: auto;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 96rpx;
  padding: 0;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 1;
  color: #f3514f;
  background-color: #e5e7eb;
  border: none;
  border-radius: 48rpx;
}

.logout-btn--pressed {
  background-color: #dde1e6;
  opacity: 0.9;
}

.logout-btn[disabled] {
  color: #f3514f;
  background-color: #e5e7eb;
  opacity: 0.6;
}

@media screen and (max-height: 700px) {
  .profile-card {
    padding-top: 32rpx;
  }

  .profile-card__avatar {
    width: 136rpx;
    height: 136rpx;
  }

  .logout-wrap {
    padding-top: 32rpx;
  }
}
</style>

<style>
/* 微信小程序 button 默认自带 ::after 边框，使用全局选择器确保重置生效 */
.logout-btn::after {
  border: none;
}
</style>
