<template>
  <view class="login-page" :style="{ paddingTop: pageTop + 'px' }">
    <view class="login-content">
      <view class="brand">
        <image class="brand__logo" src="/static/login/logo.png" mode="aspectFit" />
        <text class="brand__title">客户服务报修</text>
      </view>

      <view class="login-form">
        <view class="field" :class="{ 'field--active': activeField === 'account' }">
          <input
            v-model="form.account"
            class="field__input"
            type="text"
            maxlength="50"
            placeholder="账号/手机号"
            placeholder-style="color:#9CA3AF;"
            confirm-type="next"
            :cursor-spacing="24"
            @focus="activeField = 'account'"
            @blur="activeField = ''"
            @confirm="focusPassword"
          />
        </view>

        <view class="field field--password" :class="{ 'field--active': activeField === 'password' }">
          <input
            v-model="form.password"
            class="field__input"
            :password="!showPassword"
            maxlength="64"
            placeholder="密码"
            placeholder-style="color:#9CA3AF;"
            confirm-type="done"
            :focus="passwordFocus"
            :cursor-spacing="24"
            @focus="handlePasswordFocus"
            @blur="handlePasswordBlur"
            @confirm="handleLogin"
          />
          <view class="field__eye" @tap="togglePassword">
            <uni-icons
              :type="showPassword ? 'eye-filled' : 'eye-slash-filled'"
              :size="20"
              color="#A8AFBA"
            ></uni-icons>
          </view>
        </view>

        <view class="remember" @tap="toggleRemember">
          <view
            class="remember__checkbox"
            :class="{ 'remember__checkbox--checked': rememberPassword }"
          >
            <view v-if="rememberPassword" class="remember__tick"></view>
          </view>
          <text class="remember__text">记住密码</text>
        </view>

        <button
          class="login-btn"
          :class="{ 'login-btn--loading': loading }"
          :disabled="loading"
          hover-class="login-btn--pressed"
          :hover-stay-time="80"
          @tap="handleLogin"
        >
          {{ loading ? '登录中...' : '立即登录' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { toast } from "@/utils/extendApi";
import { getStorage, setStorage, removeStorage } from "@/utils/storage";
import { wxLogin } from "@/api/auth";

const REMEMBER_KEY = "login_remember";
const REPAIR_PAGE = "/pages/repair/repair";

export default {
  data() {
    return {
      pageTop: 0,
      form: {
        account: "",
        password: ""
      },
      showPassword: false,
      rememberPassword: true,
      activeField: "",
      passwordFocus: false,
      loading: false
    };
  },
  onLoad() {
    this.setPageTop();
    this.restoreRememberedLogin();
  },
  methods: {
    setPageTop() {
      const systemInfo = uni.getSystemInfoSync();
      // 自定义导航下，内容从状态栏 + 导航栏高度之后开始，避免与微信胶囊重叠
      this.pageTop = (systemInfo.statusBarHeight || 0) + 44;
    },
    restoreRememberedLogin() {
      const remembered = getStorage(REMEMBER_KEY);
      if (remembered && remembered.account) {
        this.form.account = remembered.account;
        this.form.password = remembered.password || "";
        this.rememberPassword = true;
      }
    },
    focusPassword() {
      this.passwordFocus = false;
      this.$nextTick(() => {
        this.passwordFocus = true;
      });
    },
    handlePasswordFocus() {
      this.activeField = "password";
    },
    handlePasswordBlur() {
      this.activeField = "";
      this.passwordFocus = false;
    },
    togglePassword() {
      this.showPassword = !this.showPassword;
    },
    toggleRemember() {
      this.rememberPassword = !this.rememberPassword;
      if (!this.rememberPassword) {
        removeStorage(REMEMBER_KEY);
      }
    },
    getWxCode() {
      return new Promise((resolve, reject) => {
        uni.login({
          provider: "weixin",
          success: (res) => {
            if (res.code) {
              resolve(res.code);
            } else {
              reject(new Error("未获取到微信登录 code"));
            }
          },
          fail: reject
        });
      });
    },
    async handleLogin() {
      if (this.loading) return;

      const account = this.form.account.trim();
      const password = this.form.password;
      if (!account) {
        toast({ title: "请输入账号/手机号" });
        return;
      }
      if (!password.trim()) {
        toast({ title: "请输入密码" });
        return;
      }

      uni.hideKeyboard();
      this.form.account = account;
      this.loading = true;

      // 先获取小程序 code，再携带账号密码执行登录
      let code = "";
      try {
        code = await this.getWxCode();
      } catch (error) {
        this.loading = false;
        toast({ title: "获取微信登录凭证失败，请重试" });
        return;
      }

      let loggedIn = false;
      try {
        const res = await wxLogin({
          code,
          accountName: account,
          accountPwd: password
        });

        if (res && res.obj && res.obj.sessionValue) {
          loggedIn = true;
          setStorage("token", res.obj.sessionValue);

          if (this.rememberPassword) {
            setStorage(REMEMBER_KEY, { account, password });
          } else {
            removeStorage(REMEMBER_KEY);
          }

          toast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            uni.reLaunch({ url: REPAIR_PAGE });
          }, 450);
        } else {
          const inSystem = res && res.obj ? res.obj.inSystem : undefined;
          const fallback =
            inSystem === 0 ? "该微信尚未绑定报修账号" : "登录失败，请检查账号密码";
          toast({ title: (res && res.message) || fallback });
        }
      } catch (error) {
        // 网络异常已由 request.ts 统一提示，这里只负责复位按钮状态
      } finally {
        if (!loggedIn) {
          this.loading = false;
        }
      }
    }
  }
};
</script>

<style scoped>
.login-page {
  box-sizing: border-box;
  width: 100%;
  min-height: 100vh;
  padding-right: 56rpx;
  padding-bottom: calc(48rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  padding-left: 56rpx;
  background-color: #ffffff;
}

.login-content {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 48rpx;
}

.brand__logo {
  display: block;
  width: 136rpx;
  height: 136rpx;
}

.brand__title {
  margin-top: 28rpx;
  font-size: 48rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #1f2937;
  letter-spacing: 2rpx;
}

.login-form {
  margin-top: 80rpx;
}

.field {
  display: flex;
  align-items: center;
  height: 108rpx;
  border-bottom: 2rpx solid #e5e7eb;
  transition: border-color 0.2s ease;
}

.field--active {
  border-bottom-color: #3b82f6;
}

.field__input {
  flex: 1;
  height: 108rpx;
  padding: 0;
  font-size: 32rpx;
  line-height: 1.4;
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

.field--password .field__input {
  padding-right: 8rpx;
}

.remember {
  display: flex;
  align-items: center;
  margin-top: 28rpx;
  padding: 8rpx 0;
}

.remember__checkbox {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #cfd5de;
  border-radius: 6rpx;
  background-color: #ffffff;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.remember__checkbox--checked {
  border-color: #3b82f6;
  background-color: #3b82f6;
}

.remember__tick {
  width: 14rpx;
  height: 8rpx;
  border-bottom: 3rpx solid #ffffff;
  border-left: 3rpx solid #ffffff;
  transform: rotate(-45deg) translateY(-1rpx);
}

.remember__text {
  margin-left: 14rpx;
  font-size: 28rpx;
  line-height: 1.4;
  color: #374151;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  margin-top: 64rpx;
  padding: 0;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 1;
  color: #ffffff;
  background-color: #3b82f6;
  border: none;
  border-radius: 44rpx;
}

.login-btn--pressed {
  opacity: 0.9;
}

.login-btn--loading,
.login-btn[disabled] {
  color: #ffffff;
  background-color: #3b82f6;
  opacity: 0.7;
}

@media screen and (max-height: 700px) {
  .brand {
    margin-top: 24rpx;
  }

  .login-form {
    margin-top: 56rpx;
  }

  .login-btn {
    margin-top: 48rpx;
  }
}
</style>

<style>
/* 微信小程序 button 默认自带 ::after 边框，使用全局选择器确保重置生效 */
.login-btn::after {
  border: none;
}
</style>
