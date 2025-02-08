import fetch from 'node-fetch';
import fs from 'fs/promises';

const config = {
  GITLAB_API: 'http://gitlab.xxx.cn/api/v4',
  // GITLAB_COOKIE: `xxx`, // 如果需要使用cookie，请在这里填写，cookie token 二选一
  GITLAB_TOKEN: "xxx",
  GROUP_ID: '2177',
  START_DATE: '2024-12-1',
  END_DATE: '2025-01-31',
  PROJECTS_NUM: 100, // 获取该组下需要统计的项目数量最大100
  EXCLUDED_PROJECTS: ['project1', 'project2'],
  VALID_EXTENSIONS: [
    '.js', '.mjs','.cjs', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass', '.html', '.sh', '.vue', '.svelte', '.rs'
  ],
  MAX_CONCURRENT_REQUESTS: 20, // 添加最大并发请求数配置
  IGNORED_PATHS: [
    "dist", "node_modules/", "build/", ".husky", "lintrc", "public/"
  ]
};

// 添加全局失败记录对象
const failureStats = {
  projects: [], // 获取项目列表失败
  commits: [], // 获取提交记录失败
  diffs: [] // 获取差异失败
};

// 添加请求计时和细节输出的重试函数
async function fetchWithRetry(url, options, context = {}) {
  const retries = 30;
  for (let i = 0; i < retries; i++) {
    // 每次重试都创建新的 AbortController
    const controller = new AbortController();
    const timeout = options.timeout || 5000;

    // 为每次尝试创建新的 options 对象
    const currentOptions = {
      ...options,
      signal: controller.signal
    };

    const startTime = Date.now();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, currentOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      clearTimeout(timeoutId);
      return response;
    } catch (error) {

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(`[请求失败] 第 ${i + 1}/${retries} 次尝试，耗时: ${duration}ms`);
      console.error(`错误信息: ${error.name === 'AbortError' ? '请求超时' : error.message}`);


      clearTimeout(timeoutId);

      if (i === retries - 1) {
        // 记录最终失败的请求
        if (context.type && context.details) {
          failureStats[context.type].push({
            url,
            ...context.details,
            error: error.message
          });
        }
        throw error;
      }

      console.log(`立即开始第 ${i + 2} 次重试...`);
    }
  }
}

// 获取群组项目
async function getGroupProjects() {
  try {
    const url = `${config.GITLAB_API}/groups/${config.GROUP_ID}/projects?per_page=${config.PROJECTS_NUM}&include_subgroups=true&order_by=last_activity_at&sort=desc`;
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          // 'Cookie': config.GITLAB_COOKIE,
          'Private-Token': config.GITLAB_TOKEN,
          'Content-Type': 'application/json',
        },
      },
      {
        type: 'projects',
        details: {
          operation: '获取项目列表'
        }
      }
    );

    const projects = await response.json();
    console.log(`[获取成功] 找到 ${projects.length} 个项目`);
    return projects;
  } catch (error) {
    console.error('[获取失败]', error.message);
    throw error;
  }
}

// 获取项目提交统计
async function getProjectCommitStats(projectId, authorEmail, since, until, projectName) {
  try {
    let page = 1;
    let allCommits = [];

    console.log(`正在处理项目: ${projectName}`);

    while (true) {
      // &with_stats=true 可以获取提交的统计信息，但是无法筛选文件
      const url = `${config.GITLAB_API}/projects/${projectId}/repository/commits?since=${since}&until=${until}&per_page=100&page=${page}&all=true&with_stats=true`;

      const response = await fetchWithRetry(
        url,
        {
          headers: {
            // 'Cookie': config.GITLAB_COOKIE,
            'Private-Token': config.GITLAB_TOKEN,
            'Content-Type': 'application/json',
          },
        },
        {
          type: 'commits',
          details: {
            projectName,
            authorEmail: authorEmail,
            operation: `获取提交记录`
          }
        }
      );

      // 获取当前页的提交
      const commits = await response.json();
      allCommits = allCommits.concat(commits);

      // 获取下一页页码
      const nextPage = response.headers.get('x-next-page');

      // 如果没有下一页或者本页没有数据，就退出循环
      if (!nextPage || commits.length === 0) {
        break;
      }

      // 继续获取下一页
      page = parseInt(nextPage);
    }

    return allCommits;

  } catch (error) {
    console.error(`获取项目 ${projectId} 的提交失败:`, error.message);
    return [];
  }
}

// 分析文件变更
async function analyzeCommitDiffs(projectId, projectName, sha, authorEmail) {
  try {
    const url = `${config.GITLAB_API}/projects/${projectId}/repository/commits/${sha}/diff`;
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          // 'Cookie': config.GITLAB_COOKIE,
          'Private-Token': config.GITLAB_TOKEN,
          'Content-Type': 'application/json',
        },
      },
      {
        type: 'diffs',
        details: {
          projectName,
          authorEmail: authorEmail,
          operation: '获取提交差异'
        }
      }
    );

    const diffs = await response.json();
    let stats = {
      additions: 0,
      deletions: 0,
      lines: 0,
      files: 0,
      size: 0
    };

    const validExtensions = config.VALID_EXTENSIONS;
    const ignoredPaths = config.IGNORED_PATHS;

    for (const diff of diffs) {
      const filePath = diff.new_path || diff.old_path;
      const ext = '.' + filePath.split('.').pop();

      // 检查是否应该忽略此文件
      if (ignoredPaths.some(path => filePath.includes(path))) {
        continue;
      }

      // 检查文件扩展名是否在允许列表中
      if (!validExtensions.includes(ext)) {
        continue;
      }

      stats.files++;

      if (diff.diff) {
        const lines = diff.diff.split('\n');
        let additions = 0;
        let deletions = 0;

        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            additions++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            deletions++;
          }
        }

        stats.additions += additions;
        stats.deletions += deletions;
        stats.lines += additions + deletions;
        stats.size += new TextEncoder().encode(diff.diff).length;  // 转换为UTF-8字节
      }
    }

    return stats;
  } catch (error) {
    console.error(`分析提交 ${sha} 的差异失败:`, error.message);
    return { additions: 0, deletions: 0, lines: 0, files: 0, size: 0 };
  }
}

// 获取提交所属的分支
async function getCommitBranches(projectId, commitSha, projectName, authorEmail) {
  try {
    const url = `${config.GITLAB_API}/projects/${projectId}/repository/commits/${commitSha}/refs`;
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'Private-Token': config.GITLAB_TOKEN,
          'Content-Type': 'application/json',
        },
      },
      {
        type: 'refs',
        details: {
          authorEmail,
          projectName,
          operation: '获取提交对应的分支信息'
        }
      }
    );

    const refs = await response.json();
    // 过滤出分支（type === 'branch'）
    const branches = refs.find(ref => ref.type === 'branch');
    const tags = refs.find(ref => ref.type === 'tag');

    return {
      branches: branches ? branches.name : 'unknown',
      tags: tags ? tags.name : 'unknown',
    };
  } catch (error) {
    console.error(`获取提交 ${commitSha} 的分支信息失败:`, error.message);
    return 'unknown';
  }
}

// 生成Markdown报告
async function generateReport(authorStats) {
  // 将作者数据转换为数组并按总代码量排序
  const sortedAuthors = Object.entries(authorStats)
    .map(([authorName, stats]) => ({
      authorName,
      ...stats,
    }))
    .sort((a, b) => b.totalSize - a.totalSize); // 按总代码量降序排序

  const report = [`# GitLab 代码提交统计报告\n`,
    `统计期间: ${config.START_DATE} 至 ${config.END_DATE}\n`,
    '## 按作者统计代码信息\n',
    '| 作者 | 邮箱 | 项目 | 提交次数 | 增加行数 | 删除行数 | 变更行数 | 文件数 | 代码量(KB) |',
    '|--------|------|------|----------|----------|----------|----------|---------|------------|'];

  // 使用排序后的数组生成报告
  for (const authorData of sortedAuthors) {
    const { authorEmail, authorName, projects, totalCommits, totalAdditions, totalDeletions, totalLines, totalFiles, totalSize } = authorData;

    // 输出作者总计
    report.push(
      `| 【${authorName || '未知'}】 | ${authorEmail} | 【总计】 | ${totalCommits} | ${totalAdditions} | ${totalDeletions} | ${totalLines} | ${totalFiles} | ${(totalSize / 1024).toFixed(2)} |`
    );

    // 输出各个项目的详细数据
    for (const [project, data] of Object.entries(projects)) {
      report.push(
        `| ${authorName || '未知'} | ${authorEmail} | ${project} | ${data.commits} | ${data.additions} | ${data.deletions} | ${data.lines} | ${data.files} | ${(data.size / 1024).toFixed(2)} |`
      );
    }

    // 添加分隔线
    report.push('|--------|------|------|----------|----------|----------|----------|---------|------------|');
  }

  // 添加新的提交信息表格
  report.push('\n## 按作者统计提交信息\n');
  report.push('| 作者 | 邮箱 | 项目 | 分支名 | 标签 | 提交时间 | 提交信息 |');
  report.push('|--------|------|------|--------|------|----------|------------|');

  for (const authorData of sortedAuthors) {
    const { authorEmail, authorName, commitDetails } = authorData;

    if (commitDetails && commitDetails.length > 0) {
      commitDetails.forEach(detail => {
        const sanitizedMessage = detail.message
          .replace(/\|/g, '\\|')
          .replace(/\n/g, ' ');

        // 格式化时间
        const datetime = new Date(detail.committed_date);
        const formattedDate = datetime.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');

        report.push(
          `| ${authorName || '未知'} | ${authorEmail} | ${detail.project} | ${detail.branch} | ${detail.tag} | ${formattedDate} | ${sanitizedMessage} |`
        );
      });
    }
  }

  // 多次重试之后仍然获取失败，添加失败统计部分
  if (failureStats.projects.length > 0 || failureStats.commits.length > 0 || failureStats.diffs.length > 0) {
    report.push('\n## 统计失败记录\n');

    if (failureStats.projects.length > 0) {
      report.push('### 项目列表获取失败');
      report.push('| 操作 | URL | 错误信息 |');
      report.push('|------|-----|------------|');
      failureStats.projects.forEach(failure => {
        report.push(`| ${failure.operation} | ${failure.url} | ${failure.error} |`);
      });
    }

    if (failureStats.commits.length > 0) {
      report.push('\n### 提交记录获取失败');
      report.push('| 项目 | 操作 | URL | 错误信息 |');
      report.push('|------|------|-----|------------|');
      failureStats.commits.forEach(failure => {
        report.push(`| ${failure.projectName} | ${failure.operation} | ${failure.url} | ${failure.error} |`);
      });
    }

    if (failureStats.diffs.length > 0) {
      report.push('\n### 提交差异获取失败');
      report.push('| 项目 | 作者 | 操作 | URL | 错误信息 |');
      report.push('|------|------------|------|-----|------------|');
      failureStats.diffs.forEach(failure => {
        report.push(`| ${failure.projectName} | ${failure.authorEmail} | ${failure.operation} | ${failure.url} | ${failure.error} |`);
      });
    }

    if (failureStats.refs.length > 0) {
      report.push('\n### 提交分支信息获取失败');
      report.push('| 项目 | 作者 | 操作 | URL | 错误信息 |');
      report.push('|------|------------|------|-----|------------|');
      failureStats.refs.forEach(failure => {
        report.push(`| ${failure.projectName} | ${failure.authorEmail} | ${failure.operation} | ${failure.url} | ${failure.error} |`);
      });
    }
  }

  await fs.writeFile('gitlab-stats.md', report.join('\n'));
  console.log('报告已生成: gitlab-stats.md');
}

// 添加正则表达式常量
const MERGE_BRANCH_RE = /Merge branch '([^']+)'/;

// 主函数
async function analyzeGitLabProjects() {
  const startTime = Date.now();
  console.log('开始分析 GitLab 仓库...');
  try {
    const projects = await getGroupProjects();
    const filteredProjects = projects.filter(project =>
      !config.EXCLUDED_PROJECTS.includes(project.name)
    );
    console.log(`排除 ${projects.length - filteredProjects.length} 个项目，实际分析 ${filteredProjects.length} 个项目`);

    const authorStats = {};

    // 使用分批处理的方式控制并发
    for (let i = 0; i < filteredProjects.length; i += config.MAX_CONCURRENT_REQUESTS) {
      const projectBatch = filteredProjects.slice(i, i + config.MAX_CONCURRENT_REQUESTS);
      console.log(`处理项目批次 ${i / config.MAX_CONCURRENT_REQUESTS + 1}, 包含 ${projectBatch.length} 个项目`);

      const projectPromises = projectBatch.map(async (project) => {
        const commits = await getProjectCommitStats(
          project.id,
          null,
          config.START_DATE,
          config.END_DATE,
          project.name
        );

        // 对每个项目的提交也使用分批处理
        for (let j = 0; j < commits.length; j += config.MAX_CONCURRENT_REQUESTS) {
          const commitBatch = commits.slice(j, j + config.MAX_CONCURRENT_REQUESTS);
          const commitPromises = commitBatch.map(async (commit) => {
            const authorEmail = commit.author_email;
            const authorName = commit.author_name;

            if (!authorStats[authorName]) {
              authorStats[authorName] = {
                authorName: authorName,
                authorEmail: authorEmail,
                projects: {},
                totalCommits: 0,
                totalAdditions: 0,
                totalDeletions: 0,
                totalLines: 0,
                totalFiles: 0,
                totalSize: 0,
                commitDetails: []
              };
            }

            if (!authorStats[authorName].projects[project.name]) {
              authorStats[authorName].projects[project.name] = {
                commits: 0,
                additions: 0,
                deletions: 0,
                lines: 0,
                files: 0,
                size: 0
              };
            }

            const [stats, branchInfo] = await Promise.all([
              analyzeCommitDiffs(project.id, project.name, commit.id, authorEmail),
              getCommitBranches(project.id, commit.id, project.name, authorEmail)
            ]);

            const projectStats = authorStats[authorName].projects[project.name];
            projectStats.commits++;
            projectStats.additions += stats.additions;
            projectStats.deletions += stats.deletions;
            projectStats.lines += stats.lines;
            projectStats.files += stats.files;
            projectStats.size += stats.size;

            authorStats[authorName].totalCommits++;
            authorStats[authorName].totalAdditions += stats.additions;
            authorStats[authorName].totalDeletions += stats.deletions;
            authorStats[authorName].totalLines += stats.lines;
            authorStats[authorName].totalFiles += stats.files;
            authorStats[authorName].totalSize += stats.size;

            // 如果是合并提交,从提交信息中提取分支名
            if (commit.message.startsWith("Merge branch")) {
              const matches = commit.message.match(MERGE_BRANCH_RE);
              if (matches && matches[1]) {
                branchInfo.branches = matches[1];
              }
            }
            authorStats[authorName].commitDetails.push({
              project: project.name,
              branch: branchInfo.branches,
              tag: branchInfo.tags,
              message: commit.message,
              committed_date: commit.committed_date
            });

            return { stats, branchInfo };
          });

          await Promise.allSettled(commitPromises);
        }
      });

      await Promise.allSettled(projectPromises);
    }

    await generateReport(authorStats);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n分析完成! 总耗时: ${duration.toFixed(2)}秒`);
  } catch (error) {
    console.error('分析失败:', error.message);
    process.exit(1);
  }
}

analyzeGitLabProjects();