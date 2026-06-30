# ============================================================
# Dockerfile — Next.js standalone 模式多阶段构建
# 共三个阶段：deps（安装依赖）→ builder（构建产物）→ runner（最终运行镜像）
# ============================================================

# ---- 第一阶段：deps ----
# 基于 Node.js 20 的 Alpine 精简镜像，体积小、启动快
# 命名为 deps，后续阶段可通过 --from=deps 引用
FROM crpi-dnxlyt733clbjdd3.cn-hangzhou.personal.cr.aliyuncs.com/striver_zlj/node:20-alpine AS deps

# 设置容器内工作目录为 /app，后续所有命令都在此目录下执行
WORKDIR /app

# 安装 yarn 并设置淘宝镜像源（yarn 比 npm 更稳定，避免 npm "Exit handler never called" 问题）
RUN rm -f /usr/local/bin/yarn && corepack enable && yarn set version stable || npm install -g yarn --force
RUN yarn config set npmRegistryServer https://registry.npmmirror.com 2>/dev/null || yarn config set registry https://registry.npmmirror.com

# 仅复制 package.json 和 yarn.lock，利用 Docker 层缓存
# 只要依赖不变，这一层就不会重新执行 yarn install，大幅加速后续构建
COPY package.json yarn.lock ./

# yarn install --frozen-lockfile 严格按照 lockfile 安装依赖（包含 devDependencies）
# 构建阶段需要 next、typescript 等 devDependencies 才能执行 next build
RUN yarn install --frozen-lockfile

# ---- 第二阶段：builder ----
# 再次使用 Node.js 20 Alpine 镜像作为构建环境
FROM crpi-dnxlyt733clbjdd3.cn-hangzhou.personal.cr.aliyuncs.com/striver_zlj/node:20-alpine AS builder

WORKDIR /app

# 从 deps 阶段拷贝已安装好的 node_modules（复用缓存，无需重新安装）
COPY --from=deps /app/node_modules ./node_modules

# 将项目所有源码拷入容器（受 .dockerignore 过滤，不会包含 node_modules 等）
COPY . .

# 关闭 Next.js 遥测上报，避免构建时向 Vercel 发送匿名统计数据
ENV NEXT_TELEMETRY_DISABLED=1

# 执行 next build，因 next.config.ts 中配置了 output: "standalone"
# 构建后会在 .next/standalone/ 下生成独立的 server.js 和精简的 node_modules
RUN yarn build

# ---- 第三阶段：runner（最终生产镜像）----
# 使用同一个精简镜像，但只保留运行所需的最少文件
FROM crpi-dnxlyt733clbjdd3.cn-hangzhou.personal.cr.aliyuncs.com/striver_zlj/node:20-alpine AS runner

WORKDIR /app

# 设置运行时环境变量
# 生产环境标识，Next.js 据此优化行为（如关闭 dev 模式）
ENV NODE_ENV=production
# 运行时也关闭遥测上报
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server.js 监听端口
ENV PORT=3000
# 监听所有网卡，容器内必须用 0.0.0.0 才能被外部访问
ENV HOSTNAME=0.0.0.0

# 创建非 root 用户 nodejs（组）和 nextjs（用户），降低容器被攻破后的权限风险
# --system 创建系统用户（无 home 目录、无登录 shell），--gid/--uid 指定固定 ID 保证一致性
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# 从 builder 阶段拷贝 standalone 产物到当前镜像根目录
# standalone 包含：server.js（最小化 Node 服务器）+ 运行所需的精简 node_modules
COPY --from=builder /app/.next/standalone ./

# standalone 默认不包含静态资源，需手动拷贝 .next/static（JS/CSS chunks 等）
COPY --from=builder /app/.next/static ./.next/static

# 拷贝 public 目录下的静态文件（favicon、图片等）
COPY --from=builder /app/public ./public

# 切换到非 root 用户 nextjs 运行后续命令，提升安全性
USER nextjs

# 声明容器暴露 3000 端口（仅文档声明，实际是否映射取决于 docker-compose 的 expose/ports）
EXPOSE 3000

# 容器启动命令：用 node 直接运行 standalone 输出的 server.js
CMD ["node", "server.js"]
