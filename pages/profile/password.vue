<template>
  <view class="password-page">
    <view class="password-content">
      <view class="password-tip">
        <uni-icons type="info" :size="16" color="#3B82F6"></uni-icons>
        <text class="password-tip__text">
          新密码长度不少于 6 位，且不能与原密码相同
        </text>
      </view>

      <view class="password-card">
        <view
          class="field"
          :class="{ 'field--active': activeField === 'old' }"
        >
          <text class="field__label">原密码</text>
          <view class="field__control">
            <input
              v-model="form.oldPwd"
              class="field__input"
              type="text"
              :password="!showPwd.old"
              maxlength="72"
              placeholder="请输入原密码"
              placeholder-style="color:#B6BFCC;"
              confirm-type="next"
              :cursor-spacing="24"
              @focus="handleFocus('old')"
              @blur="handleBlur('old')"
              @confirm="focusNewPwd"
            />
            <view class="field__eye" @tap="togglePwd('old')">
              <uni-icons
                :type="showPwd.old ? 'eye-filled' : 'eye-slash-filled'"
                :size="20"
                color="#A8AFBA"
              ></uni-icons>
            </view>
          </view>
        </view>

        <view
          class="field"
          :class="{ 'field--active': activeField === 'new' }"
        >
          <text class="field__label">新密码</text>
          <view class="field__control">
            <input
              v-model="form.newPwd"
              class="field__input"
              type="text"
              :password="!showPwd.new"
              maxlength="72"
              placeholder="请输入新密码（不少于 6 位）"
              placeholder-style="color:#B6BFCC;"
              confirm-type="next"
              :focus="newPwdFocus"
              :cursor-spacing="24"
              @focus="handleFocus('new')"
              @blur="handleBlur('new')"
              @confirm="focusConfirmPwd"
            />
            <view class="field__eye" @tap="togglePwd('new')">
              <uni-icons
                :type="showPwd.new ? 'eye-filled' : 'eye-slash-filled'"
                :size="20"
                color="#A8AFBA"
              ></uni-icons>
            </view>
          </view>
        </view>

        <view
          class="field field--last"
          :class="{ 'field--active': activeField === 'confirm' }"
        >
          <text class="field__label">重复新密码</text>
          <view class="field__control">
            <input
              v-model="form.confirmPwd"
              class="field__input"
              type="text"
              :password="!showPwd.confirm"
              maxlength="72"
              placeholder="请再次输入新密码"
              placeholder-style="color:#B6BFCC;"
              confirm-type="done"
              :focus="confirmPwdFocus"
              :cursor-spacing="24"
              @focus="handleFocus('confirm')"
              @blur="handleBlur('confirm')"
              @confirm="handleSubmit"
            />
            <view class="field__eye" @tap="togglePwd('confirm')">
              <uni-icons
                :type="showPwd.confirm ? 'eye-filled' : 'eye-slash-filled'"
                :size="20"
                color="#A8AFBA"
              ></uni-icons>
            </view>
          </view>
        </view>
      </view>

      <button
        class="submit-btn"
        :disabled="submitting"
        hover-class="submit-btn--pressed"
        :hover-stay-time="60"
        @tap="handleSubmit"
      >
        {{ submitting ? "提交中..." : "确定更改密码" }}
      </button>
    </view>
  </view>
</template>

<script>
import { updateRepairAccountPassword } from "@/api/repair";
import { toast } from "@/utils/extendApi";
import { getStorage, setStorage } from "@/utils/storage";
import { REMEMBER_KEY } from "@/utils/session";

const LOGIN_PAGE = "/pages/login/login";
const MIN_PASSWORD_LENGTH = 6;

export default {
  name: "ChangePasswordPage",
  data() {
    return {
      form: {
        oldPwd: "",
        newPwd: "",
        confirmPwd: ""
      },
      showPwd: {
        old: false,
        new: false,
        confirm: false
      },
      activeField: "",
      newPwdFocus: false,
      confirmPwdFocus: false,
      submitting: false
    };
  },
  onLoad() {
    if (!getStorage("token")) {
      uni.reLaunch({ url: LOGIN_PAGE });
    }
  },
  methods: {
    togglePwd(field) {
      this.showPwd[field] = !this.showPwd[field];
    },
    handleFocus(field) {
      this.activeField = field;
    },
    handleBlur(field) {
      if (this.activeField === field) {
        this.activeField = "";
      }
    },
    focusNewPwd() {
      this.newPwdFocus = false;
      this.$nextTick(() => {
        this.newPwdFocus = true;
      });
    },
    focusConfirmPwd() {
      this.confirmPwdFocus = false;
      this.$nextTick(() => {
        this.confirmPwdFocus = true;
      });
    },
    async handleSubmit() {
      if (this.submitting) return;

      // 密码不做 trim 后再提交，避免改变用户真实输入的密码
      const oldPwd = this.form.oldPwd;
      const newPwd = this.form.newPwd;
      const confirmPwd = this.form.confirmPwd;

      if (!oldPwd.trim()) {
        toast({ title: "请输入原密码" });
        return;
      }
      if (!newPwd.trim()) {
        toast({ title: "请输入新密码" });
        return;
      }
      if (newPwd.length < MIN_PASSWORD_LENGTH) {
        toast({ title: `新密码长度不能少于${MIN_PASSWORD_LENGTH}位` });
        return;
      }
      if (newPwd === oldPwd) {
        toast({ title: "新密码不能与原密码相同" });
        return;
      }
      if (!confirmPwd.trim()) {
        toast({ title: "请再次输入新密码" });
        return;
      }
      if (newPwd !== confirmPwd) {
        toast({ title: "两次输入的新密码不一致" });
        return;
      }

      uni.hideKeyboard();
      this.submitting = true;

      try {
        const res = await updateRepairAccountPassword({ oldPwd, newPwd });
        if (!res || res.status !== 1) {
          this.submitting = false;
          toast({
            title: (res && res.message) || "修改密码失败，请稍后重试"
          });
          return;
        }

        // “记住密码”中保存的是旧密码，修改成功后同步为新密码，避免下次登录被旧密码覆盖
        const remembered = getStorage(REMEMBER_KEY);
        if (remembered && remembered.account) {
          setStorage(REMEMBER_KEY, {
            ...remembered,
            password: newPwd
          });
        }

        toast({ title: "密码修改成功", icon: "success" });
        setTimeout(() => {
          this.leavePage();
        }, 600);
      } catch (error) {
        // 网络异常已由 request 层统一提示
        this.submitting = false;
      }
    },
    leavePage() {
      uni.navigateBack({
        fail: () => {
          uni.reLaunch({ url: "/pages/profile/profile" });
        }
      });
    }
  }
};
</script>

<style scoped>
.password-page {
  box-sizing: border-box;
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.password-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 640px;
  padding: 32rpx 56rpx 48rpx;
  padding-bottom: calc(48rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  margin: 0 auto;
}

.password-tip {
  display: flex;
  align-items: flex-start;
  padding: 20rpx 24rpx;
  background-color: #eff6ff;
  border-radius: 20rpx;
}

.password-tip__text {
  flex: 1;
  margin-left: 10rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #3b82f6;
}

.password-card {
  padding: 0 28rpx;
  margin-top: 24rpx;
  background-color: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.field {
  padding: 26rpx 0 22rpx;
  border-bottom: 2rpx solid #eef0f3;
  transition: border-color 0.2s ease;
}

.field--last {
  border-bottom: none;
}

.field--active {
  border-bottom-color: #3b82f6;
}

.field--last.field--active {
  border-bottom-color: transparent;
}

.field--active .field__label {
  color: #3b82f6;
}

.field__label {
  display: block;
  font-size: 24rpx;
  line-height: 1.4;
  color: #8a94a6;
  transition: color 0.2s ease;
}

.field__control {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.field__input {
  flex: 1;
  height: 64rpx;
  padding: 0;
  font-size: 32rpx;
  line-height: 64rpx;
  color: #1f2937;
  background-color: transparent;
}

.field__eye {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  margin-left: 8rpx;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  padding: 0;
  margin-top: 56rpx;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 1;
  color: #ffffff;
  background-color: #3b82f6;
  border: none;
  border-radius: 44rpx;
}

.submit-btn--pressed {
  background-color: #2f6bff;
  opacity: 0.92;
}

.submit-btn[disabled] {
  color: #ffffff;
  background-color: #3b82f6;
  opacity: 0.7;
}

@media screen and (max-height: 700px) {
  .password-content {
    padding-top: 24rpx;
  }

  .submit-btn {
    margin-top: 40rpx;
  }
}
</style>

<style>
/* 微信小程序 button 默认自带 ::after 边框，使用全局选择器确保重置生效 */
.submit-btn::after {
  border: none;
}
</style>
