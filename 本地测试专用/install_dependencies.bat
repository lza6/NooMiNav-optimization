@echo off
chcp 65001 >nul
echo.
echo ================================
echo    安装本地测试依赖
echo ================================
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

echo 正在安装项目依赖...
echo.

npm install express

if %errorlevel% equ 0 (
    echo.
    echo ✅ 依赖安装成功！
    echo.
    echo 现在您可以运行 start_local_test.bat 来启动本地测试服务器
    echo.
) else (
    echo.
    echo ❌ 依赖安装失败
    echo 请检查网络连接或手动运行: npm install express
    echo.
)

pause