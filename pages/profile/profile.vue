<template>
  <view class="profile-page">
    <view class="profile-content">
      <view class="profile-card">
        <view class="profile-card__body">
          <!-- #ifdef MP-WEIXIN -->
          <!-- 微信已不再通过 getUserProfile 返回真实资料，头像需使用 chooseAvatar 能力获取 -->
          <button
            class="profile-card__avatar profile-card__avatar-btn"
            open-type="chooseAvatar"
            hover-class="none"
            @chooseavatar="handleChooseAvatar"
          >
            <image
              class="profile-card__avatar-image"
              :src="avatarSrc"
              mode="aspectFill"
              @error="handleAvatarError"
            />
            <view class="profile-card__avatar-edit">
              <uni-icons
                type="camera-filled"
                :size="14"
                color="#FFFFFF"
              ></uni-icons>
            </view>
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <view class="profile-card__avatar">
            <image
              class="profile-card__avatar-image"
              :src="avatarSrc"
              mode="aspectFill"
              @error="handleAvatarError"
            />
          </view>
          <!-- #endif -->

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

    <view v-if="editorVisible" class="profile-editor">
      <view class="profile-editor__mask" @tap="closeEditor"></view>
      <view class="profile-editor__panel">
        <view class="profile-editor__handle"></view>
        <text class="profile-editor__title">更新微信资料</text>
        <text class="profile-editor__subtitle">
          头像与昵称将展示在个人中心
        </text>

        <view class="profile-editor__avatar-wrap">
          <image
            class="profile-editor__avatar"
            :src="editorAvatarSrc"
            mode="aspectFill"
          />
        </view>

        <view class="profile-editor__field">
          <text class="profile-editor__label">微信昵称</text>
          <input
            class="profile-editor__input"
            type="nickname"
            v-model="editor.wxName"
            :maxlength="32"
            :disabled="savingProfile"
            placeholder="点击输入，可选择“使用微信昵称”"
            placeholder-class="profile-editor__placeholder"
            :adjust-position="true"
            :cursor-spacing="24"
            @blur="handleNicknameBlur"
            @confirm="handleNicknameConfirm"
          />
        </view>

        <text class="profile-editor__tip">
          若昵称未自动填入，点击输入框后可在键盘上方选择微信昵称
        </text>

        <view class="profile-editor__actions">
          <button
            class="profile-editor__cancel"
            hover-class="profile-editor__cancel--pressed"
            :disabled="savingProfile"
            @tap="closeEditor"
          >
            取消
          </button>
          <button
            class="profile-editor__save"
            hover-class="profile-editor__save--pressed"
            :disabled="savingProfile"
            @tap="saveProfile"
          >
            {{ savingProfile ? "保存中..." : "保存" }}
          </button>
        </view>
      </view>
    </view>

    <business-tabbar active="profile" />
  </view>
</template>

<script>
import {
  getRepairAccountProfile,
  updateRepairAccountProfile,
  uploadRepairAvatar
} from "@/api/repair";
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
      loggingOut: false,
      editorVisible: false,
      savingProfile: false,
      editor: {
        avatarLocalPath: "",
        uploadedPath: "",
        uploadedPreview: "",
        wxName: ""
      }
    };
  },
  computed: {
    avatarSrc() {
      const avatar = (this.profile.wxImgAvatar || "").trim();
      if (!this.avatarError && avatar) return avatar;
      return DEFAULT_AVATAR;
    },
    editorAvatarSrc() {
      return this.editor.avatarLocalPath || this.avatarSrc;
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
    getEditableWxName() {
      const wxName = (this.profile.wxName || "").trim();
      // 旧版默认昵称没有展示价值，留空让用户直接选择微信昵称
      if (wxName === "微信用户" || wxName === "WeChat User") return "";
      return wxName;
    },
    handleChooseAvatar(event) {
      const avatarUrl =
        event && event.detail ? event.detail.avatarUrl : "";
      if (!avatarUrl) {
        toast({ title: "未获取到头像，请重试" });
        return;
      }

      this.avatarError = false;
      this.editor = {
        avatarLocalPath: avatarUrl,
        uploadedPath: "",
        uploadedPreview: "",
        wxName: this.getEditableWxName()
      };
      this.editorVisible = true;
    },
    handleNicknameBlur(event) {
      const value = event && event.detail ? event.detail.value : undefined;
      // 微信「使用微信昵称」可能在 blur 时才回填，兜底同步一次
      if (typeof value === "string") {
        this.editor.wxName = value;
      }
    },
    handleNicknameConfirm(event) {
      this.handleNicknameBlur(event);
      this.saveProfile();
    },
    resetEditor() {
      this.editor = {
        avatarLocalPath: "",
        uploadedPath: "",
        uploadedPreview: "",
        wxName: ""
      };
    },
    closeEditor() {
      if (this.savingProfile) return;
      this.editorVisible = false;
      this.resetEditor();
    },
    async saveProfile() {
      if (this.savingProfile) return;

      const wxName = String(this.editor.wxName || "").trim();
      if (!wxName) {
        toast({ title: "请输入微信昵称" });
        return;
      }

      if (!this.editor.uploadedPath && !this.editor.avatarLocalPath) {
        toast({ title: "请先选择微信头像" });
        return;
      }

      this.savingProfile = true;

      try {
        let fileStorePath = this.editor.uploadedPath;
        let avatarPreview =
          this.editor.uploadedPreview || this.editor.avatarLocalPath;

        // 头像上传成功但资料保存失败时，重试直接复用已上传的 fileStorePath
        if (!fileStorePath) {
          const uploadRes = await uploadRepairAvatar(
            this.editor.avatarLocalPath
          );
          const uploadData = uploadRes && uploadRes.obj;
          if (
            !uploadRes ||
            uploadRes.status !== 1 ||
            !uploadData ||
            !uploadData.fileStorePath
          ) {
            toast({
              title:
                (uploadRes && uploadRes.message) || "头像上传失败，请重试"
            });
            return;
          }

          fileStorePath = uploadData.fileStorePath;
          avatarPreview = uploadData.fileAccessPath || avatarPreview;
          this.editor.uploadedPath = fileStorePath;
          this.editor.uploadedPreview = avatarPreview;
        }

        const updateRes = await updateRepairAccountProfile({
          wxName,
          wxImgAvatar: fileStorePath
        });
        if (!updateRes || updateRes.status !== 1) {
          toast({
            title: (updateRes && updateRes.message) || "资料更新失败，请重试"
          });
          return;
        }

        const updated = updateRes.obj || {};
        this.avatarError = false;
        this.profile = {
          accountName: updated.accountName || this.profile.accountName,
          projectName: updated.projectName || this.profile.projectName,
          wxName: updated.wxName || wxName,
          wxImgAvatar: avatarPreview || updated.wxImgAvatar || fileStorePath
        };

        setProfileCache({
          projectName: this.profile.projectName,
          accountName: this.profile.accountName,
          wxName: this.profile.wxName,
          wxImgAvatar: this.profile.wxImgAvatar
        });

        this.editorVisible = false;
        this.resetEditor();
        toast({ title: "资料已更新", icon: "success" });
      } catch (error) {
        // 网络异常已由 request 层统一提示
      } finally {
        this.savingProfile = false;
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
  position: relative;
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

.profile-card__avatar-btn {
  display: block;
  flex-shrink: 0;
  padding: 0;
  overflow: hidden;
  font-size: 0;
  line-height: 0;
  text-align: center;
  background-color: #ffffff;
}

.profile-card__avatar-edit {
  position: absolute;
  right: 4rpx;
  bottom: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  background-color: rgba(15, 23, 42, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
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

.profile-editor {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.profile-editor__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(15, 23, 42, 0.45);
}

.profile-editor__panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 640px;
  padding: 24rpx 40rpx 32rpx;
  padding-bottom: calc(32rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  margin: 0 auto;
  background-color: #ffffff;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -12rpx 40rpx rgba(15, 23, 42, 0.12);
}

.profile-editor__handle {
  width: 72rpx;
  height: 8rpx;
  margin: 0 auto 24rpx;
  background-color: #e5e7eb;
  border-radius: 4rpx;
}

.profile-editor__title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #1f2937;
  text-align: center;
}

.profile-editor__subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #8a94a6;
  text-align: center;
}

.profile-editor__avatar-wrap {
  display: flex;
  justify-content: center;
  margin-top: 28rpx;
}

.profile-editor__avatar {
  width: 128rpx;
  height: 128rpx;
  background-color: #f5f7fa;
  border: 4rpx solid #eff6ff;
  border-radius: 50%;
}

.profile-editor__field {
  box-sizing: border-box;
  margin-top: 32rpx;
  padding: 20rpx 28rpx;
  background-color: #f7f9fc;
  border-radius: 20rpx;
}

.profile-editor__label {
  display: block;
  font-size: 24rpx;
  line-height: 1.4;
  color: #8a94a6;
}

.profile-editor__input {
  box-sizing: border-box;
  width: 100%;
  height: 64rpx;
  padding: 0;
  margin-top: 8rpx;
  font-size: 30rpx;
  line-height: 64rpx;
  color: #1f2937;
}

.profile-editor__tip {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: #a0a8b5;
  text-align: center;
}

.profile-editor__actions {
  display: flex;
  margin-top: 36rpx;
}

.profile-editor__cancel,
.profile-editor__save {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 88rpx;
  padding: 0;
  margin: 0;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1;
  border: none;
  border-radius: 44rpx;
}

.profile-editor__cancel {
  flex: 0 0 200rpx;
  color: #5b6575;
  background-color: #f0f2f5;
}

.profile-editor__save {
  flex: 1;
  margin-left: 20rpx;
  color: #ffffff;
  background-color: #3b82f6;
}

.profile-editor__cancel--pressed {
  background-color: #e5e8ec;
}

.profile-editor__save--pressed {
  background-color: #2f6bff;
  opacity: 0.92;
}

.profile-editor__cancel[disabled] {
  color: #5b6575;
  background-color: #f0f2f5;
  opacity: 0.6;
}

.profile-editor__save[disabled] {
  color: #ffffff;
  background-color: #3b82f6;
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
.logout-btn::after,
.profile-card__avatar-btn::after,
.profile-editor__cancel::after,
.profile-editor__save::after {
  border: none;
}

/* placeholder-class 作用在微信原生输入框生成的占位节点上，需要非 scoped 样式 */
.profile-editor__placeholder {
  color: #b6bfcc;
}
</style>
