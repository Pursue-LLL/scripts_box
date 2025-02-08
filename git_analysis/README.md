# GitLab 代码统计分析工具

这是一个用于分析 GitLab 仓库代码提交情况的工具，可以生成详细的代码统计报告，包括提交次数、代码行数、文件数等多维度统计信息。

## 功能特点

- 支持多项目批量分析
- 自动统计代码提交信息
- 支持按作者分组统计
- 统计维度包括：
  - 提交次数
  - 代码增删行数
  - 变更文件数
  - 代码量大小
  - 分支信息
  - 提交时间线
- 支持自定义文件类型过滤
- 支持忽略特定路径
- 自动重试机制
- 并发请求控制
- 生成 Markdown 格式报告

## 使用前提

- Node.js 环境
- GitLab API Token
- GitLab 仓库访问权限

## 配置说明

在 `gitlab_analysis.mjs` 中配置以下参数：

```javascript
const config = {
  GITLAB_API: 'your_gitlab_api_url', // gitlab api 地址
  GITLAB_TOKEN: 'your_gitlab_token', // gitlab token
  GROUP_ID: 'your_group_id', //项目组id
  START_DATE: 'YYYY-MM-DD', // 开始日期
  END_DATE: 'YYYY-MM-DD', // 结束日期
  PROJECTS_NUM: 100, // 项目数量，最大100
  EXCLUDED_PROJECTS: ['project1', 'project2'], // 排除项目
  VALID_EXTENSIONS: ['.js', '.ts', ...], // 有效文件类型
  MAX_CONCURRENT_REQUESTS: 20, // 最大并发请求数
  IGNORED_PATHS: ['dist', 'node_modules', ...] // 忽略路径和文件
}
```

## 安装依赖

```bash
pnpm install
```

## 使用方法

1. 配置参数
2. 运行脚本：

```bash
node gitlab_analysis.mjs
```

3. 查看生成的报告文件 `gitlab-stats.md`

## 报告内容

生成的报告包含以下内容：

- 按作者统计的代码信息
  - 总提交次数
  - 代码增删行数
  - 变更文件数
  - 代码量统计
- 按作者统计的提交信息
  - 提交时间
  - 分支信息
  - 提交信息
- 统计失败记录（如有）

## 注意事项

- 请确保 GitLab Token 具有足够的权限
- 合理配置并发请求数，避免对 GitLab 服务器造成压力
- 统计大型仓库可能需要较长时间

