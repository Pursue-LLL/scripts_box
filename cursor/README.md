# Cursor Device ID Changer (光标设备 ID 更改器)

用于修改 Cursor 编辑器的设备 ID。当因频繁切换账号导致设备被锁定时，可以使用此脚本重置设备 ID。

## 使用方法

1. 下载 `change_id.sh` 脚本
2. 给脚本添加执行权限：

```bash
chmod +x change_id.sh
```

1. 运行脚本：
   - 使用随机生成的设备 ID：
   ```bash
   ./change_id.sh
   ```
   - 使用自定义设备 ID：
   ```bash
   ./change_id.sh your_custom_id
   ```

## 注意事项

- 脚本会在修改前自动创建配置文件的备份
- 在运行脚本前关闭 Cursor 编辑器
- 仅支持 macOS 系统

## 免责声明

本脚本仅供学习和研究使用，请合理使用，风险自负，体验之后如果觉得好用，请购买PRO版本。
