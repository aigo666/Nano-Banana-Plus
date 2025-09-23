import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { authenticateToken } from '../middleware/auth.js';
import { ConfigService } from '../services/ConfigService.js';
const router = express.Router();
// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
// 配置multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名：时间戳 + 随机数 + 原扩展名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `image-${uniqueSuffix}${ext}`);
    }
});
// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('只允许上传图片文件'));
    }
};
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB限制
        files: 10 // 最多10个文件
    }
});
/**
 * @route POST /api/upload/images
 * @desc 上传图片文件
 * @access Private (需要登录)
 */
router.post('/images', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            const response = {
                success: false,
                message: '没有上传任何文件'
            };
            return res.status(400).json(response);
        }
        const userId = req.user.userId;
        console.log(`用户 ${userId} 上传了 ${files.length} 个图片文件`);
        // 生成文件URL列表
        const imageUrls = files.map(file => {
            const baseUrl = process.env.NODE_ENV === 'production'
                ? process.env.BASE_URL || 'http://localhost:8000'
                : 'http://localhost:8000';
            return `${baseUrl}/uploads/${file.filename}`;
        });
        console.log('上传的图片URLs:', imageUrls);
        const response = {
            success: true,
            message: `成功上传 ${files.length} 个图片文件`,
            data: {
                images: imageUrls,
                count: files.length
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('图片上传失败:', error);
        // 如果是multer错误，提供更友好的错误信息
        if (error instanceof multer.MulterError) {
            let message = '文件上传失败';
            switch (error.code) {
                case 'LIMIT_FILE_SIZE':
                    message = '文件大小超过限制（最大5MB）';
                    break;
                case 'LIMIT_FILE_COUNT':
                    message = '文件数量超过限制（最多10个）';
                    break;
                case 'LIMIT_UNEXPECTED_FILE':
                    message = '意外的文件字段';
                    break;
                default:
                    message = error.message;
            }
            const response = {
                success: false,
                message
            };
            return res.status(400).json(response);
        }
        const response = {
            success: false,
            message: error instanceof Error ? error.message : '图片上传失败'
        };
        res.status(500).json(response);
    }
});
/**
 * @route POST /api/upload/proxy
 * @desc 通过中转API上传图片
 * @access Private (需要登录)
 */
router.post('/proxy', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            const response = {
                success: false,
                message: '没有上传任何文件'
            };
            return res.status(400).json(response);
        }
        const userId = req.user.userId;
        console.log(`用户 ${userId} 请求通过中转API上传图片: ${file.originalname}`);
        // 获取可用的API令牌
        const apiToken = await ConfigService.getAvailableApiToken();
        if (!apiToken) {
            const response = {
                success: false,
                message: '系统暂无可用的API令牌，请联系管理员配置'
            };
            return res.status(503).json(response);
        }
        console.log(`使用API令牌: ${apiToken.name} (${apiToken.provider})`);
        // 创建FormData发送给中转API
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype
        });
        console.log('调用中转API上传接口...');
        // 调用中转API上传
        const response = await fetch('https://api.ablai.top/v1/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken.token}`,
                ...formData.getHeaders()
            },
            body: formData
        });
        console.log(`中转API响应状态: ${response.status}`);
        // 删除临时文件
        fs.unlinkSync(file.path);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('中转API上传失败:', errorText);
            const apiResponse = {
                success: false,
                message: `中转API上传失败: ${response.status} - ${errorText}`
            };
            return res.status(response.status).json(apiResponse);
        }
        const data = await response.json();
        console.log('中转API上传成功响应:', data);
        // 检查响应格式
        let imageUrl = null;
        if (data.url) {
            imageUrl = data.url;
        }
        else if (data.data?.url) {
            imageUrl = data.data.url;
        }
        else if (data.file_url) {
            imageUrl = data.file_url;
        }
        if (!imageUrl) {
            console.error('中转API未返回有效的图片URL:', data);
            const apiResponse = {
                success: false,
                message: '中转API未返回有效的图片URL'
            };
            return res.status(500).json(apiResponse);
        }
        console.log(`中转API上传成功: ${imageUrl}`);
        // 更新令牌使用统计
        await ConfigService.updateTokenUsage(apiToken.id, true);
        const apiResponse = {
            success: true,
            message: '中转API上传成功',
            data: {
                url: imageUrl,
                provider: 'proxy'
            }
        };
        res.json(apiResponse);
    }
    catch (error) {
        console.error('中转API上传失败:', error);
        // 如果有临时文件，删除它
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            }
            catch (cleanupError) {
                console.error('清理临时文件失败:', cleanupError);
            }
        }
        const response = {
            success: false,
            message: error instanceof Error ? error.message : '中转API上传失败'
        };
        res.status(500).json(response);
    }
});
/**
 * @route DELETE /api/upload/images/:filename
 * @desc 删除上传的图片文件
 * @access Private (需要登录)
 */
router.delete('/images/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        const userId = req.user.userId;
        // 验证文件名格式（防止路径遍历攻击）
        if (!/^image-\d+-\d+\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
            const response = {
                success: false,
                message: '无效的文件名'
            };
            return res.status(400).json(response);
        }
        const filePath = path.join(uploadDir, filename);
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            const response = {
                success: false,
                message: '文件不存在'
            };
            return res.status(404).json(response);
        }
        // 删除文件
        fs.unlinkSync(filePath);
        console.log(`用户 ${userId} 删除了图片文件: ${filename}`);
        const response = {
            success: true,
            message: '文件删除成功'
        };
        res.json(response);
    }
    catch (error) {
        console.error('删除图片文件失败:', error);
        const response = {
            success: false,
            message: error instanceof Error ? error.message : '删除文件失败'
        };
        res.status(500).json(response);
    }
});
export default router;
//# sourceMappingURL=upload.js.map