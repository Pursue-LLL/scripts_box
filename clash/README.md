# Clash 配置自动更新脚本

这是一个用于自动更新 Clash 配置文件并添加自定义规则的 Bash 脚本。

当使用 clash 订阅链接时，订阅链接的规则是预置的，很多情况下我们不会使用全局模式，而是规则模式，那么很多没有被预置的规则收录的网址依旧无法访问，需要手动添加，可是更新了配置文件之后添加过的自定义规则就没了，还需要再添加很麻烦，所以写了这个脚本，自动更新配置文件并添加自定义规则。

## 功能特性

- 自动从订阅链接获取最新的 Clash 配置
- 支持添加自定义规则
- 自动备份原有配置文件
- 将自定义规则插入到配置文件的 rules 部分

## 使用前提

- 已安装 Clash
- 已获取有效的 Clash 订阅链接

## 文件结构

- `update_clash_config.sh`: 主脚本，用于更新 Clash 配置文件
- `custom_rules.txt`: 自定义规则文件，用于添加自定义规则

## 配置说明

- 编辑 `update_clash_config.sh` 文件，将订阅链接替换为你的链接：
-  在 `custom_rules.txt` 中添加你的自定义规则，例如：

```
DOMAIN-SUFFIX,example.com,DIRECT
IP-CIDR,192.168.1.0/24,DIRECT
```

## 使用方法

1. 将 `update_clash_config.sh` 和 `custom_rules.txt` 文件复制到你的工作目录
2. 在 `update_clash_config.sh` 中修改订阅链接
3. 运行 `update_clash_config.sh` 脚本
4. 在 clash 客户端中选择config.yaml配置文件，并且重载。
5. enjoy!

