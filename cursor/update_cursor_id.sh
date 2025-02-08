#!/bin/bash

# 配置文件路径
CONFIG_FILE="$HOME/Library/Application Support/Cursor/User/globalStorage/storage.json"
BACKUP_FILE="$HOME/Library/Application Support/Cursor/User/globalStorage/storage.json.backup"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "错误：找不到配置文件"
    exit 1
fi

# 创建备份
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "已创建配置文件备份：$BACKUP_FILE"

# 生成新的随机ID (64个字符的十六进制)
NEW_ID=$(openssl rand -hex 32)

# 使用sed替换原有ID
# 使用临时文件来确保安全替换
sed "s/\"telemetry\.machineId\": \"[^\"]*\"/\"telemetry.machineId\": \"$NEW_ID\"/" "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "已成功更新 telemetry.machineId"
echo "新ID: $NEW_ID"