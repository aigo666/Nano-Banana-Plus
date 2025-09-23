import express from 'express';
import { ConfigService } from '../services/ConfigService.js';
import { PackageService } from '../services/PackageService.js';
import { GenerationHistoryService } from '../services/GenerationHistoryService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { z } from 'zod';
import fetch from 'node-fetch';
import FormData from 'form-data';
const router = express.Router();
const API_BASE_URL = 'https://api.ablai.top';
// 图片生成请求验证模式
const generateImageSchema = z.object({
    prompt: z.string().min(1, '提示词不能为空').max(1000, '提示词不能超过1000个字符'),
    images: z.array(z.string()).optional().default([])
});
/**
 * @route POST /api/generate/image
 * @desc 生成图片
 * @access Private (需要登录)
 */
router.post('/image', authenticateToken, validateRequest(generateImageSchema), async (req, res) => {
    try {
        const { prompt, images = [] } = req.body;
        const userId = req.user.userId;
        console.log(`用户 ${userId} 请求生成图片，提示词: ${prompt}, 参考图片数量: ${images.length}`);
        // 检查用户是否有可用次数
        const availableTimes = await PackageService.checkUserAvailableTimes(userId);
        if (availableTimes <= 0) {
            const response = {
                success: false,
                message: '您的剩余次数不足，请购买套餐或充值'
            };
            return res.status(400).json(response);
        }
        console.log(`用户 ${userId} 剩余次数: ${availableTimes}`);
        // 创建生成历史记录，初始不消耗次数
        const historyRecord = await GenerationHistoryService.createHistory({
            user_id: userId,
            prompt,
            original_images: images,
            consumed_times: 0 // 初始不消耗，成功后再更新
        });
        console.log(`创建历史记录: ${historyRecord.id}`);
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
        let imageUrl;
        let success = true;
        try {
            // 根据是否有参考图片选择不同的生成方式
            if (images && images.length > 0) {
                console.log('使用图生图模式');
                imageUrl = await generateImageFromImage(prompt, images, apiToken.token);
            }
            else {
                console.log('使用文生图模式');
                imageUrl = await generateImageFromText(prompt, apiToken.token);
            }
            console.log('图片生成成功:', imageUrl);
        }
        catch (error) {
            console.error('图片生成失败:', error);
            success = false;
            // 更新历史记录为失败状态，失败时不消耗次数
            await GenerationHistoryService.updateHistory(historyRecord.id, {
                status: 'failed',
                error_message: error instanceof Error ? error.message : '未知错误',
                consumed_times: 0 // 失败时不消耗次数
            });
            // 更新令牌错误统计
            await ConfigService.updateTokenUsage(apiToken.id, false);
            const response = {
                success: false,
                message: '图片生成失败: ' + (error instanceof Error ? error.message : '未知错误')
            };
            return res.status(500).json(response);
        }
        // 更新令牌使用统计
        await ConfigService.updateTokenUsage(apiToken.id, true);
        // 扣减用户使用次数
        const deductSuccess = await PackageService.usePackageTimes(userId, 1);
        if (!deductSuccess) {
            console.warn(`用户 ${userId} 次数扣减失败，但图片已生成`);
        }
        else {
            console.log(`用户 ${userId} 成功扣减 1 次使用次数`);
        }
        // 更新历史记录为完成状态，成功时消耗1次
        await GenerationHistoryService.updateHistory(historyRecord.id, {
            status: 'completed',
            generated_image: imageUrl,
            consumed_times: 1 // 成功时消耗1次
        });
        console.log(`历史记录 ${historyRecord.id} 更新完成`);
        const response = {
            success: true,
            message: '图片生成成功',
            data: { imageUrl }
        };
        res.json(response);
    }
    catch (error) {
        console.error('处理图片生成请求失败:', error);
        const response = {
            success: false,
            message: '处理请求失败',
            error: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
// 文生图函数
async function generateImageFromText(prompt, apiKey) {
    console.log('执行文生图，提示词:', prompt);
    const requestBody = {
        model: 'nano-banana',
        prompt: prompt,
        response_format: 'url'
    };
    console.log('文生图请求参数:');
    console.log('- model: nano-banana');
    console.log('- prompt:', prompt);
    console.log('- response_format: url');
    const response = await fetch(`${API_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    console.log('文生图API响应状态:', response.status);
    if (!response.ok) {
        const errorText = await response.text();
        console.error('文生图API错误:', errorText);
        throw new Error(`API调用失败: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log('文生图API成功响应:', data);
    if (!data.data?.[0]?.url) {
        console.error('API响应格式异常:', data);
        throw new Error('API未返回有效的图片URL');
    }
    return data.data[0].url;
}
// 图生图函数
async function generateImageFromImage(prompt, images, apiKey) {
    try {
        console.log('开始图生图处理，参考图片数量:', images.length);
        const formData = new FormData();
        formData.append('model', 'nano-banana');
        formData.append('prompt', prompt);
        // 处理所有参考图片
        for (let i = 0; i < images.length; i++) {
            const imageDataUrl = images[i];
            if (imageDataUrl.startsWith('http')) {
                console.log(`图片 ${i + 1} 是URL格式，需要下载转换...`);
                try {
                    const response = await fetch(imageDataUrl);
                    if (!response.ok) {
                        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
                    }
                    const buffer = await response.buffer();
                    // 检查响应的Content-Type头
                    const contentType = response.headers.get('content-type');
                    console.log(`图片 ${i + 1} Content-Type: ${contentType}`);
                    // 验证是否为有效的图片格式
                    if (!contentType || !contentType.startsWith('image/')) {
                        throw new Error(`无效的图片格式: ${contentType}`);
                    }
                    // 验证buffer不为空
                    if (!buffer || buffer.length === 0) {
                        throw new Error('下载的图片数据为空');
                    }
                    // 从Content-Type或URL中推断文件扩展名
                    let ext = 'png';
                    let mimeType = contentType;
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                        ext = 'jpg';
                        mimeType = 'image/jpeg';
                    }
                    else if (contentType.includes('png')) {
                        ext = 'png';
                        mimeType = 'image/png';
                    }
                    else if (contentType.includes('gif')) {
                        ext = 'gif';
                        mimeType = 'image/gif';
                    }
                    else if (contentType.includes('webp')) {
                        ext = 'webp';
                        mimeType = 'image/webp';
                    }
                    else {
                        // 如果Content-Type不明确，尝试从URL推断
                        const urlPath = new URL(imageDataUrl).pathname;
                        const urlExt = urlPath.split('.').pop()?.toLowerCase();
                        if (urlExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExt)) {
                            ext = urlExt === 'jpeg' ? 'jpg' : urlExt;
                            mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                        }
                    }
                    formData.append('image', buffer, {
                        filename: `reference_${i + 1}.${ext}`,
                        contentType: mimeType
                    });
                    console.log(`- 添加图片 ${i + 1}: [下载的文件] ${buffer.length} bytes, 类型: ${mimeType}`);
                }
                catch (downloadError) {
                    console.error(`下载图片 ${i + 1} 失败:`, downloadError);
                    const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
                    throw new Error(`无法下载参考图片 ${i + 1}: ${errorMessage}`);
                }
            }
            else if (imageDataUrl.startsWith('data:image/')) {
                console.log(`图片 ${i + 1} 是base64格式，转换为buffer...`);
                try {
                    // 验证base64格式
                    if (!imageDataUrl.includes(',')) {
                        throw new Error('无效的base64数据格式');
                    }
                    const base64Data = imageDataUrl.split(',')[1];
                    if (!base64Data) {
                        throw new Error('base64数据为空');
                    }
                    const buffer = Buffer.from(base64Data, 'base64');
                    // 验证buffer不为空
                    if (!buffer || buffer.length === 0) {
                        throw new Error('转换后的图片数据为空');
                    }
                    // 从base64 data URL中提取MIME类型
                    const mimeMatch = imageDataUrl.match(/^data:([^;]+);base64,/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                    // 验证MIME类型
                    if (!mimeType.startsWith('image/')) {
                        throw new Error(`无效的图片MIME类型: ${mimeType}`);
                    }
                    const ext = mimeType.split('/')[1] || 'png';
                    formData.append('image', buffer, {
                        filename: `reference_${i + 1}.${ext}`,
                        contentType: mimeType
                    });
                    console.log(`- 添加图片 ${i + 1}: [转换的文件] ${buffer.length} bytes, 类型: ${mimeType}`);
                }
                catch (base64Error) {
                    console.error(`处理base64图片 ${i + 1} 失败:`, base64Error);
                    const errorMessage = base64Error instanceof Error ? base64Error.message : String(base64Error);
                    throw new Error(`无法处理参考图片 ${i + 1}: ${errorMessage}`);
                }
            }
            else {
                throw new Error(`图片 ${i + 1} 格式不支持，必须是HTTP URL或base64数据`);
            }
        }
        formData.append('response_format', 'url');
        console.log('图生图请求参数:');
        console.log('- model: nano-banana');
        console.log('- prompt:', prompt);
        console.log('- 图片数量:', images.length);
        console.log('- response_format: url');
        const response = await fetch(`${API_BASE_URL}/v1/images/edits`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...formData.getHeaders()
            },
            body: formData
        });
        console.log('图生图API响应状态:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('图生图API错误响应:', errorText);
            throw new Error(`图生图API调用失败: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log('图生图API成功响应:', data);
        if (!data.data?.[0]?.url) {
            console.error('图生图API响应格式异常:', data);
            throw new Error('图生图API未返回有效的图片URL');
        }
        return data.data[0].url;
    }
    catch (error) {
        console.error('图生图处理失败:', error);
        throw error;
    }
}
export default router;
//# sourceMappingURL=generate.js.map