# NooMiNav 数据库结构文档

## 概述

本文档详细描述了 NooMiNav 项目使用的数据库结构，包括表设计、字段说明、索引配置和数据关系。

## 数据库类型

- **平台**: Cloudflare D1 (基于 SQLite)
- **版本**: SQLite 3.x 兼容
- **编码**: UTF-8

## 表结构详情

### 1. logs 表 (访问日志表)

#### 表用途
- 记录每次链接访问的详细信息
- 支持按月查询访问历史
- 用于生成详细的访问报告

#### 字段定义

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| id | INTEGER | 自增 | 主键，唯一标识每条日志记录 |
| link_id | TEXT | 无 | 关联的链接ID，格式: `{original_id}` 或 `{original_id}_backup` |
| click_time | TEXT | 无 | 访问时间戳，格式: `YYYY-MM-DD HH:mm:ss` |
| month_key | TEXT | 无 | 月份标识，格式: `YYYY_MM` |
| ip_address | TEXT | 'unknown' | 用户IP地址，Cloudflare环境默认为'unknown' |
| user_agent | TEXT | 'unknown' | 用户代理字符串，Cloudflare环境默认为'unknown' |

#### 索引配置
```sql
-- 复合索引：按链接ID和月份快速查询
CREATE INDEX idx_logs_link_month ON logs(link_id, month_key);

-- 单列索引：按时间快速排序
CREATE INDEX idx_logs_time ON logs(click_time);
```

#### 示例数据
```
id: 1
link_id: "test1"
click_time: "2024-01-15 10:30:45"
month_key: "2024_01"
ip_address: "unknown"
user_agent: "unknown"
```

### 2. stats 表 (统计表)

#### 表用途
- 存储链接访问的汇总统计数据
- 支持实时查看访问量和趋势
- 用于管理后台的数据看板

#### 字段定义

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| id | TEXT | 无 | 主键，链接的唯一标识符 |
| name | TEXT | 无 | 链接名称 |
| type | TEXT | 无 | 链接类型 ('link' 或 'friend') |
| total_clicks | INTEGER | 0 | 总点击次数 |
| year_clicks | INTEGER | 0 | 当年点击次数 |
| month_clicks | INTEGER | 0 | 当月点击次数 |
| day_clicks | INTEGER | 0 | 当日点击次数 |
| last_year | TEXT | 无 | 最后访问年份，格式: `YYYY` |
| last_month | TEXT | 无 | 最后访问月份，格式: `YYYY_MM` |
| last_day | TEXT | 无 | 最后访问日期，格式: `YYYY-MM-DD` |
| last_time | TEXT | 无 | 最后访问时间，格式: `YYYY-MM-DD HH:mm:ss` |

#### 索引配置
- 主键索引: `id` (自动创建)

#### 示例数据
```
id: "test1"
name: "测试网站1"
type: "link"
total_clicks: 42
year_clicks: 15
month_clicks: 8
day_clicks: 2
last_year: "2024"
last_month: "2024_01"
last_day: "2024-01-15"
last_time: "2024-01-15 10:30:45"
```

## 数据库初始化脚本

```sql
-- 删除旧表（如果存在）
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS stats;

-- 创建日志表
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT,
    click_time TEXT,
    month_key TEXT,
    ip_address TEXT DEFAULT 'unknown',
    user_agent TEXT DEFAULT 'unknown'
);

-- 创建统计表
CREATE TABLE stats (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    total_clicks INTEGER DEFAULT 0,
    year_clicks INTEGER DEFAULT 0,
    month_clicks INTEGER DEFAULT 0,
    day_clicks INTEGER DEFAULT 0,
    last_year TEXT,
    last_month TEXT,
    last_day TEXT,
    last_time TEXT
);

-- 创建索引优化查询性能
CREATE INDEX idx_logs_link_month ON logs(link_id, month_key);
CREATE INDEX idx_logs_time ON logs(click_time);
```

## 数据操作逻辑

### 插入访问日志
```sql
INSERT INTO logs (link_id, click_time, month_key, ip_address, user_agent) 
VALUES (?, ?, ?, ?, ?)
```

### 更新统计数据（使用UPSERT）
```sql
INSERT INTO stats (
    id, name, type, total_clicks, year_clicks, month_clicks, day_clicks, 
    last_year, last_month, last_day, last_time
) 
VALUES (?1, ?2, ?3, 1, 1, 1, 1, ?4, ?5, ?7, ?6) 
ON CONFLICT(id) 
DO UPDATE SET 
    total_clicks = total_clicks + 1, 
    year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, 
    month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, 
    day_clicks = CASE WHEN last_day = ?7 THEN day_clicks + 1 ELSE 1 END, 
    last_year = ?4, 
    last_month = ?5, 
    last_day = ?7, 
    last_time = ?6, 
    name = ?2
```

### 查询特定链接的访问日志
```sql
SELECT click_time 
FROM logs 
WHERE link_id = ? AND month_key = ? 
ORDER BY id DESC 
LIMIT 50
```

### 获取所有统计数据
```sql
SELECT * FROM stats
```

## 数据生命周期管理

### 日志保留策略
- 日志数据按月存储和查询
- 系统保留所有历史日志
- 可通过手动执行SQL删除旧数据

### 统计数据更新规则
1. **总计更新**: 每次访问 +1
2. **年度更新**: 如果当年字段匹配则 +1，否则重置为1
3. **月度更新**: 如果当月字段匹配则 +1，否则重置为1
4. **日度更新**: 如果当日字段匹配则 +1，否则重置为1
5. **时间字段更新**: 每次访问都会更新对应的时间字段

## 性能优化建议

### 查询优化
1. 利用 `idx_logs_link_month` 索引进行链接和月份组合查询
2. 利用 `idx_logs_time` 索引进行时间排序查询
3. 对于频繁查询的链接ID建立额外索引

### 存储优化
1. 定期清理不需要的历史日志数据
2. 归档长期不用的统计数据
3. 监控数据库大小增长趋势

### 缓存策略
1. 统计数据可在应用层缓存
2. 热门查询结果可临时缓存
3. 使用适当的缓存失效策略

## 安全考虑

### 数据保护
- IP地址和User-Agent字段设置默认值保护隐私
- 不存储敏感的用户识别信息
- 遵循数据最小化原则

### 访问控制
- 通过应用程序逻辑控制数据库访问
- 防止SQL注入攻击
- 实施适当的权限管理

## 备份与恢复

### 备份策略
1. 定期导出数据库内容
2. 使用 Cloudflare D1 的备份功能
3. 在应用层面实现数据导出功能

### 恢复流程
1. 停止应用程序写入
2. 清空现有数据表
3. 导入备份数据
4. 验证数据完整性
5. 恢复应用程序服务

## 监控指标

### 数据库性能
- 查询响应时间
- 连接池使用率
- 数据库大小增长

### 业务指标
- 每日新增日志数量
- 统计数据更新频率
- 最热门的链接ID

### 错误监控
- 数据库连接错误
- 查询超时错误
- 数据完整性错误