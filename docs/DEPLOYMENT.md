# 部署说明

## 一、本机Node.js

准备Node.js 24或更新版本。复制.env.example为.env.local，填写OPENAI_API_KEY，然后运行npm start。打开http://127.0.0.1:4317/。

无需第三方npm依赖。npm test运行不调用真实模型的测试；npm run build生成Worker包。

macOS启动器会沿用电脑已经启用的HTTP代理；它不修改系统设置。Linux服务器可按自身网络要求配置HTTPS_PROXY和NO_PROXY，或使用直连。

## 二、自己的公网服务器：Docker与HTTPS

准备一台可访问模型API的服务器、一个指向该服务器的域名，以及已安装的Docker Compose和Caddy。以下配置以https://learn.example.com为示例，需要替换为自己的域名，示例地址不是本项目已上线地址。

1. 把开源代码下载到服务器上的独立目录。
2. 复制.env.example为.env.local；填写OPENAI_API_KEY，并设置PUBLIC_ORIGIN=https://你的域名。
3. 使用密码管理器生成至少20位的随机访问码，填写APP_ACCESS_TOKEN。访问码与模型密钥必须不同。
4. 在Linux/macOS执行chmod 600 .env.local，仅向可信管理员开放该文件。不要把它上传GitHub。
5. 执行docker compose up -d --build。配置文件把服务监听在容器内0.0.0.0，但只映射到宿主机127.0.0.1:4317。
6. 将deploy/Caddyfile的YOUR_DOMAIN替换为自己的域名，并用它配置宿主机Caddy。反向代理目标保持127.0.0.1:4317；保留浏览器的Host头。
7. DNS指向这台服务器，开放80和443端口。Caddy在满足域名验证条件时申请和续期HTTPS证书。不要把4317端口直接暴露给全网。
8. 从另一网络访问https://你的域名，先查看课程，再填写访问码测试生成。

查看运行状态：docker compose ps。查看应用日志：docker compose logs --tail=50。停止服务：docker compose down。更新源码后重新运行docker compose up -d --build。

.env.local通过Compose注入运行环境，不烘焙进镜像；有Docker管理权限的人可能读取容器配置。正式生产环境可以使用专门的秘密管理系统，并按相同环境变量提供给应用。

官方参考：

- Docker环境变量：https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
- Caddy自动HTTPS：https://caddyserver.com/docs/automatic-https

## 三、不用Docker

安装Node.js 24，配置.env.local。仅通过同机反向代理转发时可以保留HOST=127.0.0.1；设置PUBLIC_ORIGIN为真实HTTPS地址，并设置APP_ACCESS_TOKEN以保护模型接口。

如果宿主环境要求监听所有网卡，设置HOST=0.0.0.0、PORT为服务端口，同时必须配置PUBLIC_ORIGIN和至少20位的APP_ACCESS_TOKEN。使用进程管理器保持npm start运行，再配置HTTPS代理。

不要把0.0.0.0理解成可发给别人访问的地址，它只代表程序监听范围。公网访问仍需要服务器公网地址、域名、网络规则和运行中的服务。

## 四、Worker托管

运行npm run build，输出为dist/server/index.js，默认导出fetch(request, env)。此文件打包了前端和共享服务端逻辑，不依赖Node的文件系统或本地.env.local。

在兼容Cloudflare Workers的托管平台配置以下秘密变量：OPENAI_API_KEY、APP_ACCESS_TOKEN；可配置普通变量OPENAI_MODEL和MAX_REQUESTS_PER_HOUR。APP_ACCESS_TOKEN至少20位。未设置访问码或密钥时，课程和网页可查看，生成请求会明确拒绝。

PUBLIC_ORIGIN可设为实际HTTPS源站；不设置时Worker用请求URL的源站进行同源检查。使用自定义域名时相应更新。Sites拥有的站点使用Sites发布流程，不把它的项目标识复用为他人的新站点。

Sites环境变量更新后需要重新部署版本才会生效。Worker的并发/次数限制是实例内保护，不能保证全球统一限额。大规模公开使用需要统一鉴权和配额服务。

## 五、开源与GitHub

公开仓库：https://github.com/ruobingzhang523-blip/job-reader

打开仓库后选择Code，再选择Download ZIP即可下载，也可以使用git clone克隆。

源码包含MIT许可证、README、docs、测试和部署配置。不包含.env.local、Sites项目标识或任何用户凭证。自行部署不需要原作者的Sites账户。首次启动请复制.env.example并填写自己管理的密钥。

GitHub保存源码，不会自动替你运行应用服务端。实际公网运行状态见发布状态文件。
