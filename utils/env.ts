// 获取当前小程序账号信息（仅在小程序端生效）
const { miniProgram } = uni.getAccountInfoSync();
const { envVersion } = miniProgram;

let env = {
  baseUrl: ""
};

switch (envVersion) {
  case "develop":
    env.baseUrl = "http://127.0.0.1:9024/endpoint-repair"; // 开发版本地后端
    break;
  case "trial":
    env.baseUrl = "https://trial.api.example.com"; // 替换为体验版地址
    break;
  case "release":
    env.baseUrl = "https://api.example.com"; // 替换为正式版地址
    break;
  default:
    env.baseUrl = "http://127.0.0.1:9024/endpoint-repair";
    break;
}

export default env;