<template>
  <view class="repair-page">
    <view
      class="repair-header"
      :style="{ paddingTop: statusBarHeight + 'px' }"
    >
      <view class="repair-header__nav">
        <text class="repair-header__title">我要报修</text>
      </view>
      <view class="repair-header__project">
        <text class="repair-header__project-label">项目：</text>
        <text class="repair-header__project-name">{{ projectText }}</text>
      </view>
    </view>

    <view class="repair-sheet">
      <view class="form-section">
        <text class="form-label">故障描述</text>
        <view class="description-box">
          <textarea
            v-model="form.faultDescription"
            class="description-input"
            placeholder="请详细描述您遇到的问题..."
            placeholder-style="color:#9CA3AF;"
            maxlength="500"
            :show-confirm-bar="false"
            :cursor-spacing="24"
          />
        </view>
      </view>

      <view class="form-section">
        <view class="form-label-row">
          <text class="form-label">照片</text>
          <text class="form-label-hint">（选填）</text>
          <text class="photo-count">{{ photos.length }}/5</text>
        </view>

        <view class="photo-grid">
          <view
            v-for="(photo, index) in photos"
            :key="photo.key"
            class="photo-item"
          >
            <image
              class="photo-item__image"
              :src="photo.localPath"
              mode="aspectFill"
              @tap="previewPhoto(index)"
            />

            <view
              v-if="photo.status === 'uploading'"
              class="photo-item__mask"
            >
              <view class="photo-item__spinner">
                <uni-icons
                  type="spinner-cycle"
                  :size="24"
                  color="#FFFFFF"
                ></uni-icons>
              </view>
              <text class="photo-item__mask-text">上传中</text>
            </view>

            <view
              v-else-if="photo.status === 'error'"
              class="photo-item__mask photo-item__mask--error"
              @tap="retryPhoto(photo)"
            >
              <uni-icons type="refresh" :size="22" color="#FFFFFF"></uni-icons>
              <text class="photo-item__mask-text">点击重试</text>
            </view>

            <view class="photo-item__remove" @tap.stop="removePhoto(index)">
              <uni-icons
                type="closeempty"
                :size="14"
                color="#FFFFFF"
              ></uni-icons>
            </view>
          </view>

          <view
            v-if="photos.length < MAX_PHOTOS"
            class="photo-add"
            hover-class="photo-add--pressed"
            :hover-stay-time="60"
            @tap="choosePhotos"
          >
            <uni-icons
              type="camera-filled"
              :size="34"
              color="#B0B7C3"
            ></uni-icons>
            <text class="photo-add__text">添加照片</text>
          </view>
        </view>
      </view>

      <view class="contact-section">
        <view class="contact-row">
          <text class="contact-row__label">联系人：</text>
          <input
            v-model="form.contactName"
            class="contact-row__input"
            type="text"
            maxlength="50"
            placeholder="请填写联系人"
            placeholder-style="color:#9CA3AF;"
            :cursor-spacing="24"
            @blur="saveContactCache"
          />
        </view>
        <view class="contact-row">
          <text class="contact-row__label">联系电话：</text>
          <input
            v-model="form.contactPhone"
            class="contact-row__input"
            type="text"
            maxlength="20"
            placeholder="请填写联系电话"
            placeholder-style="color:#9CA3AF;"
            :cursor-spacing="24"
            @blur="saveContactCache"
          />
        </view>
      </view>

      <button
        class="submit-btn"
        :class="{ 'submit-btn--loading': submitting }"
        :disabled="submitting"
        hover-class="submit-btn--pressed"
        :hover-stay-time="60"
        @tap="handleSubmit"
      >
        {{ submitting ? "提交中..." : "确认报修" }}
      </button>
    </view>

    <business-tabbar active="repair" />
  </view>
</template>

<script>
import { toast, modal } from "@/utils/extendApi";
import { getStorage } from "@/utils/storage";
import {
  getContactCache,
  getLoginAccount,
  getProfileCache,
  setContactCache,
  setLoginAccount,
  setProfileCache
} from "@/utils/repairCache";
import {
  clearRepairDraft,
  getRepairDraft,
  getRepairDraftPhoto,
  setRepairDraft,
  updateRepairDraftPhoto
} from "@/utils/repairDraft";
import {
  createRepairOrder,
  getRepairAccountProfile,
  uploadRepairPhoto
} from "@/api/repair";

const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const LOGIN_PAGE = "/pages/login/login";

export default {
  data() {
    return {
      statusBarHeight: 0,
      projectName: "",
      profileLoading: false,
      pageAlive: true,
      cacheReady: false,
      form: {
        faultDescription: "",
        contactName: "",
        contactPhone: ""
      },
      photos: [],
      submitting: false,
      MAX_PHOTOS
    };
  },
  computed: {
    projectText() {
      if (this.projectName) return this.projectName;
      return this.profileLoading ? "加载中..." : "未获取到项目";
    },
    hasUploadingPhotos() {
      return this.photos.some((photo) => photo.status === "uploading");
    }
  },
  onLoad() {
    const token = getStorage("token");
    if (!token) {
      uni.reLaunch({
        url: LOGIN_PAGE
      });
      return;
    }

    this.pageAlive = true;
    const systemInfo = uni.getSystemInfoSync();
    this.statusBarHeight = systemInfo.statusBarHeight || 0;
    this.restoreCache();
    this.cacheReady = true;
    this.restoreDraft();
    this.loadProfile();
  },
  onHide() {
    this.saveContactCache();
    this.saveDraft();
  },
  onUnload() {
    this.pageAlive = false;
    this.saveContactCache();
    this.saveDraft();
  },
  methods: {
    restoreCache() {
      const profile = getProfileCache();
      if (profile) {
        this.projectName = profile.projectName || "";
        this.form.contactName = profile.accountName || "";
      }

      const contact = getContactCache();
      if (contact) {
        if (contact.contactName) {
          this.form.contactName = contact.contactName;
        }
        if (contact.contactPhone) {
          this.form.contactPhone = contact.contactPhone;
        }
      }
    },
    restoreDraft() {
      const draft = getRepairDraft();
      if (!draft) return;

      this.form.faultDescription = draft.faultDescription || "";

      // 页面卸载时仍未完成的上传，恢复后先按失败处理，用户可点击重试；
      // 若原上传随后完成，草稿会更新，重试时可直接复用结果。
      this.photos = (draft.photos || []).map((photo) => ({
        ...photo,
        status: photo.status === "uploading" ? "error" : photo.status
      }));
    },
    async loadProfile() {
      if (this.profileLoading) return;
      this.profileLoading = true;

      try {
        const res = await getRepairAccountProfile();
        if (!res || res.status !== 1 || !res.obj) {
          toast({
            title: (res && res.message) || "获取账户信息失败，请稍后重试"
          });
          return;
        }

        const profile = res.obj;

        // 升级/直达场景没有 login_account 时，用后端账户名补上，保证缓存按账号隔离
        if (!getLoginAccount() && profile.accountName) {
          setLoginAccount(profile.accountName);
        }

        this.projectName = profile.projectName || "";
        if (!this.form.contactName) {
          this.form.contactName = profile.accountName || "";
        }

        // 后端 Long 主键为 19 位，超过 JS 安全整数范围，前端暂不缓存精度已丢失的 ID。
        setProfileCache({
          projectName: profile.projectName,
          accountName: profile.accountName
        });
        this.saveContactCache();
      } catch (error) {
        // 网络异常已由 request 层统一提示
      } finally {
        this.profileLoading = false;
      }
    },
    choosePhotos() {
      const remaining = MAX_PHOTOS - this.photos.length;
      if (remaining <= 0) return;

      uni.chooseImage({
        count: remaining,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: (res) => {
          const files = res.tempFiles || [];
          (res.tempFilePaths || []).forEach((localPath, index) => {
            const file = files[index] || {};
            if (file.size && file.size > MAX_PHOTO_SIZE) {
              toast({ title: "图片大小不能超过10MB" });
              return;
            }

            const photo = {
              key: `${Date.now()}-${index}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
              localPath,
              fileStorePath: "",
              status: "uploading"
            };
            this.photos.push(photo);
            this.uploadPhoto(photo);
          });
        }
      });
    },
    async uploadPhoto(photo) {
      // 模板遍历 photos 拿到的是 Vue 的响应式代理，而 choosePhotos 里传入的是
      // 刚 push 进去的原始对象。直接修改原始对象不会触发视图更新，上传成功后
      // 遮罩会一直停留在“上传中”，所以这里按 key 找回列表中的响应式对象。
      const target =
        this.photos.find((item) => item.key === photo.key) || photo;

      target.status = "uploading";
      target.fileStorePath = "";

      // 记录上传发起时的账号，页面卸载后草稿仍写回原账号
      const draftAccount = getLoginAccount();

      try {
        const res = await uploadRepairPhoto(target.localPath);
        if (res && res.status === 1 && res.obj && res.obj.fileStorePath) {
          target.fileStorePath = res.obj.fileStorePath;
          target.status = "done";
          if (!this.pageAlive) {
            updateRepairDraftPhoto(
              target.key,
              {
                status: "done",
                fileStorePath: target.fileStorePath
              },
              draftAccount
            );
          }
          return;
        }

        target.status = "error";
        if (!this.pageAlive) {
          updateRepairDraftPhoto(target.key, { status: "error" }, draftAccount);
          return;
        }
        toast({
          title: (res && res.message) || "图片上传失败，请重试"
        });
      } catch (error) {
        target.status = "error";
        if (!this.pageAlive) {
          updateRepairDraftPhoto(target.key, { status: "error" }, draftAccount);
          return;
        }
        // 网络异常已由 request 层统一提示
      }
    },
    retryPhoto(photo) {
      if (photo.status === "uploading") return;

      // 页面卸载期间原上传可能已完成，优先复用草稿里的结果
      const draftPhoto = getRepairDraftPhoto(photo.key);
      if (
        draftPhoto &&
        draftPhoto.status === "done" &&
        draftPhoto.fileStorePath
      ) {
        photo.fileStorePath = draftPhoto.fileStorePath;
        photo.status = "done";
        return;
      }

      this.uploadPhoto(photo);
    },
    removePhoto(index) {
      this.photos.splice(index, 1);
    },
    previewPhoto(index) {
      const urls = this.photos.map((photo) => photo.localPath);
      uni.previewImage({
        current: urls[index],
        urls
      });
    },
    validateForm() {
      const faultDescription = this.form.faultDescription.trim();
      const contactName = this.form.contactName.trim();
      const contactPhone = this.form.contactPhone.trim();

      if (!faultDescription) {
        toast({ title: "请填写故障描述" });
        return null;
      }
      if (faultDescription.length > 500) {
        toast({ title: "故障描述不能超过500个字符" });
        return null;
      }
      if (!contactName) {
        toast({ title: "请填写联系人" });
        return null;
      }
      if (contactName.length > 50) {
        toast({ title: "联系人不能超过50个字符" });
        return null;
      }
      if (!contactPhone) {
        toast({ title: "请填写联系电话" });
        return null;
      }
      if (contactPhone.length > 20) {
        toast({ title: "联系电话不能超过20个字符" });
        return null;
      }

      return {
        faultDescription,
        contactName,
        contactPhone
      };
    },
    saveContactCache() {
      if (!this.cacheReady) return;

      setContactCache({
        contactName: this.form.contactName.trim(),
        contactPhone: this.form.contactPhone.trim()
      });
    },
    saveDraft() {
      if (!this.cacheReady) return;

      setRepairDraft({
        faultDescription: this.form.faultDescription,
        photos: this.photos.map((photo) => ({
          key: photo.key,
          localPath: photo.localPath,
          fileStorePath: photo.fileStorePath,
          status: photo.status
        }))
      });
    },
    resetForm() {
      this.form.faultDescription = "";
      this.photos = [];
    },
    async handleSubmit() {
      if (this.submitting) return;

      if (this.hasUploadingPhotos) {
        toast({ title: "图片上传中，请稍候" });
        return;
      }

      const failedPhoto = this.photos.find(
        (photo) => photo.status !== "done" || !photo.fileStorePath
      );
      if (failedPhoto) {
        toast({ title: "有图片上传失败，请重试或删除" });
        return;
      }

      const values = this.validateForm();
      if (!values) return;

      uni.hideKeyboard();
      this.form.faultDescription = values.faultDescription;
      this.form.contactName = values.contactName;
      this.form.contactPhone = values.contactPhone;
      this.submitting = true;

      try {
        const res = await createRepairOrder({
          contactName: values.contactName,
          contactPhone: values.contactPhone,
          faultDescription: values.faultDescription,
          photoUrls: this.photos.map((photo) => photo.fileStorePath)
        });

        if (!res || res.status !== 1 || !res.obj) {
          toast({
            title: (res && res.message) || "提交报修失败，请稍后重试"
          });
          return;
        }

        this.saveContactCache();
        const orderNo = res.obj.orderNo || "";
        this.resetForm();
        clearRepairDraft();
        // 弹窗展示期间不再显示“提交中”，避免按钮状态与结果不一致。
        this.submitting = false;

        await modal({
          title: "报修成功",
          content: orderNo
            ? `工单号：${orderNo}`
            : "我们已收到您的报修，请耐心等待处理。",
          showCancel: false,
          confirmColor: "#3B82F6"
        });

        uni.pageScrollTo({
          scrollTop: 0,
          duration: 0
        });
      } catch (error) {
        // 网络异常已由 request 层统一提示
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.repair-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.repair-header {
  flex-shrink: 0;
  padding-right: 40rpx;
  padding-left: 40rpx;
  background-color: #3b82f6;
}

.repair-header__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
}

.repair-header__title {
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.repair-header__project {
  display: flex;
  align-items: center;
  padding-top: 8rpx;
  padding-bottom: 44rpx;
  color: #ffffff;
}

.repair-header__project-label {
  flex-shrink: 0;
  font-size: 30rpx;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
}

.repair-header__project-name {
  overflow: hidden;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repair-sheet {
  position: relative;
  box-sizing: border-box;
  flex: 1;
  margin-top: -28rpx;
  padding: 36rpx 40rpx calc(160rpx + constant(safe-area-inset-bottom));
  padding: 36rpx 40rpx calc(160rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
}

.form-section {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #111827;
}

.form-label-row {
  display: flex;
  align-items: baseline;
}

.form-label-hint {
  margin-left: 4rpx;
  font-size: 28rpx;
  font-weight: 400;
  line-height: 1.4;
  color: #6b7280;
}

.photo-count {
  margin-left: auto;
  font-size: 24rpx;
  line-height: 1.4;
  color: #9ca3af;
}

.description-box {
  box-sizing: border-box;
  height: 228rpx;
  margin-top: 20rpx;
  padding: 20rpx 22rpx;
  background-color: #ffffff;
  border: 2rpx solid #e0e4ea;
  border-radius: 16rpx;
}

.description-input {
  width: 100%;
  height: 100%;
  padding: 0;
  font-size: 30rpx;
  line-height: 1.6;
  color: #1f2937;
  background-color: transparent;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20rpx;
}

.photo-item,
.photo-add {
  position: relative;
  box-sizing: border-box;
  width: 206rpx;
  height: 206rpx;
  margin-right: 19rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  border-radius: 16rpx;
}

.photo-item:nth-child(3n),
.photo-add:nth-child(3n) {
  margin-right: 0;
}

.photo-item {
  background-color: #f3f4f6;
}

.photo-item__image {
  display: block;
  width: 100%;
  height: 100%;
}

.photo-item__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(17, 24, 39, 0.45);
}

.photo-item__mask--error {
  background-color: rgba(17, 24, 39, 0.58);
}

.photo-item__spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: photo-spin 0.9s linear infinite;
}

.photo-item__mask-text {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.3;
  color: #ffffff;
}

@keyframes photo-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.photo-item__remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  background-color: rgba(17, 24, 39, 0.62);
  border-radius: 50%;
}

.photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f7f8fa;
  border: 2rpx dashed #d5dbe4;
}

.photo-add--pressed {
  background-color: #eef1f5;
}

.photo-add__text {
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.3;
  color: #9ca3af;
}

.contact-section {
  margin-top: 4rpx;
  border-top: 2rpx solid #eef0f3;
}

.contact-row {
  display: flex;
  align-items: center;
  height: 104rpx;
  border-bottom: 2rpx solid #eef0f3;
}

.contact-row__label {
  flex-shrink: 0;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #111827;
}

.contact-row__input {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.4;
  color: #111827;
  background-color: transparent;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 96rpx;
  margin-top: 48rpx;
  padding: 0;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 1;
  color: #ffffff;
  background-color: #3b82f6;
  border: none;
  border-radius: 48rpx;
  box-shadow: 0 12rpx 24rpx rgba(59, 130, 246, 0.22);
}

.submit-btn--pressed {
  opacity: 0.92;
}

.submit-btn--loading,
.submit-btn[disabled] {
  color: #ffffff;
  background-color: #3b82f6;
  opacity: 0.68;
}
</style>

<style>
/* 微信小程序 button 默认自带 ::after 边框，使用全局选择器确保重置生效 */
.submit-btn::after {
  border: none;
}
</style>
