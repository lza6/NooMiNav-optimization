@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    FlarePortal 完整CF功能模拟服务器启动器
echo ========================================
echo.

REM 检查Node.js是否已安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js
    echo 请先安装 Node.js 从 https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo 启动完整CF功能模拟服务器...
echo.
echo 提示:
echo   - 主页: http://localhost:8787
echo   - 管理后台: http://localhost:8787/admin
echo   - 管理密码: test123
echo.
echo 功能说明:
echo   - 完整模拟Cloudflare Workers功能
echo   - 模拟D1数据库操作
echo   - 支持环境变量配置
echo   - 完整的统计和日志功能
echo.
echo 按 Ctrl+C 可停止服务器
echo ========================================

REM 启动本地服务器
node local_server_full_cf_simulation.js