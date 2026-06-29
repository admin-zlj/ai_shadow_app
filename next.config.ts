/**
 * Next.js 配置文件
 * 文档：https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 关闭开发模式下的路由指示器（页面右下角的浮动小圆点）
  devIndicators: false,

  // 输出 standalone 模式：next build 后在 .next/standalone 生成独立运行的最小化产物
  // 包含 server.js + 精简 node_modules，无需完整依赖即可 node server.js 启动
  // Docker 部署时只需 COPY 这部分文件，镜像体积大幅减小
  output: "standalone",

  // 自定义响应头：为所有路由设置 X-Accel-Buffering: no
  // 这是 nginx 专用响应头，告诉 nginx 对该响应禁用缓冲
  // SSE 流式响应（/api/chat-ins）如果不关闭缓冲，nginx 会等整个响应完成才发给客户端
  // 导致前端无法实时收到流式数据，体验等同于非流式
  async headers() {
    return [
      {
        // 匹配所有路由（含可选尾斜杠），Next.js 16 的路径匹配语法
        source: "/:path*{/}?",
        headers: [
          {
            key: "X-Accel-Buffering",
            value: "no",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
