#!/bin/bash

# 指定Clash配置文件和自定义规则文件的路径
clash_config="$HOME/.config/clash/config.yaml"

# 获取执行命令所在的目录
script_dir=$(dirname "$0")
# 自定义配置文件地址
custom_rules_file="${script_dir}/custom_rules.txt"

# 如果自定义规则末尾没有空行则加入一个空行
if [ "$(tail -c1 "$custom_rules_file" | wc -l)" -eq 0 ]; then
  echo "" >> "$custom_rules_file"
fi

# 备份原始Clash配置文件
cp "$clash_config" "${clash_config}.bak"

# 获取最新Clash配置文件内容，【此处换为你自己购买的订阅链接】
curl -s -o "$clash_config" https://ekow8.xyz/NlpE/CsRPb/ch

echo "Clash配置文件已自动更新。"

# 读取自定义规则并将其插入到Clash配置文件中rules字段的开头
sed -i.bak '/rules:/r '"$custom_rules_file" "$clash_config"

echo "自定义规则已成功添加到Clash配置文件。"
