# 读懂岗位 · Job Reader

面向转行初学者的JD解读与学习路线工具。输入招聘要求和自己的基础，获得白话解释、分阶段学习目标、官方课程链接和练习检验标准。

**这是一款网页应用，不需要安装浏览器插件。** 附带可选WebMCP接口，支持兼容浏览器中的AI助手操作当前页面。

源码仓库：https://github.com/ruobingzhang523-blip/job-reader

在线网页：https://read-job-requirements.ruby-birch-5493.chatgpt.site

当前网页与课程已公开；在线模型生成仍等待管理员配置，详见发布状态。

## 功能

- 区分岗位最终要求、个人入门目标和仍需补足的能力。
- 从人工核实的课程目录中选择资源，模型不能自造课程链接。
- 保留招聘原文，供学习建议追溯。
- 公网可浏览课程；无需访问码即可提交生成请求，模型用量由网站管理者承担。
- 不建账号，不设数据库，不持久保存输入或生成结果。
- 支持本机Node.js、Docker服务器和Cloudflare Workers兼容运行时。

## 本机快速启动

安装Node.js 24或更新版本。下载本仓库ZIP并解压，或用Git克隆仓库；在解压后的项目目录打开终端。

```sh
git clone https://github.com/ruobingzhang523-blip/job-reader.git
cd job-reader
cp .env.example .env.local
```

使用文本编辑器填写`.env.local`里的`OPENAI_API_KEY`。密钥由运行服务的管理员提供，不是每位访客的ChatGPT账号。OpenAI API需要单独的可用额度。

```sh
npm start
```

打开 http://127.0.0.1:4317/ 。没有第三方npm运行依赖，不需要先执行npm install。未配置密钥时仍能阅读课程目录。

Windows PowerShell用`Copy-Item .env.example .env.local`复制配置；之后同样使用`npm start`。macOS还可双击`启动读懂岗位.command`。

## 公网服务器部署

完整步骤见 [部署说明](docs/DEPLOYMENT.md)。准备自己的服务器、域名和模型密钥。示例使用Docker Compose和Caddy提供HTTPS。

```sh
cp .env.example .env.local
# 编辑配置：OPENAI_API_KEY、PUBLIC_ORIGIN
# PUBLIC_ORIGIN形如 https://learn.your-domain.com
chmod 600 .env.local
docker compose up -d --build
```

Compose只把应用端口映射到服务器本机；把`deploy/Caddyfile`里的域名替换为自己的真实域名并配置Caddy。外部用户通过HTTPS域名访问，不能通过自己电脑上的127.0.0.1访问你的服务器。

## 架构与数据

浏览器 → 自己部署的服务端 → OpenAI API → 服务端验证结果 → 浏览器。

- 前端：原生HTML、CSS、JavaScript，位于`dist/`。
- Node入口：`start.mjs`、`server.mjs`；共享服务逻辑：`service.mjs`。
- 模型调用与校验：`analyze.mjs`；课程数据：`courses.mjs`。
- 数据库：无。输入和输出不写入应用文件或历史表。
- `.env.local`仅用于部署者的本机/服务器配置，不在开源包和容器镜像中。
- Worker使用托管平台的运行时秘密变量，不使用`.env.local`。
- 单实例默认每小时最多30次生成、同时1次请求；不是跨实例硬预算，也不是个人账户系统。

## 文档与开发

- [使用手册](docs/使用手册.md)：交互、使用步骤、架构、存储、服务端位置与故障处理。
- [部署说明](docs/DEPLOYMENT.md)：Node、Docker和Worker部署。
- [当前发布状态](docs/发布状态.md)：本项目实际部署与验证状态。
- [安全说明](SECURITY.md)：密钥与公开部署限制。

```sh
npm test
npm run build
```

构建只生成`dist/server/index.js`，其中包含网页资源和Worker入口，不读取本地密钥。Node本机运行不需要构建。当前测试使用固定测试响应，不会产生API费用；真实模型质量需另行评估。

## 许可证与第三方资源

项目代码采用 [MIT](LICENSE) 许可证。第三方课程仅保留标题、链接及简短学习建议，课程内容、名称与商标归各自权利人所有。开源许可不包含免费的模型调用额度或托管资源。
