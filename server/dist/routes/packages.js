import express from 'express';
import { PackageService } from '../services/PackageService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validation.js';
import Joi from 'joi';
const router = express.Router();
const createPackageSchema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
        'string.empty': '套餐名称不能为空',
        'string.max': '套餐名称不能超过100个字符',
        'any.required': '套餐名称是必填项'
    }),
    description: Joi.string().max(500).optional().messages({
        'string.max': '套餐描述不能超过500个字符'
    }),
    usage_count: Joi.number().integer().min(1).max(10000).required().messages({
        'number.base': '使用次数必须是数字',
        'number.integer': '使用次数必须是整数',
        'number.min': '使用次数至少为1',
        'number.max': '使用次数不能超过10000',
        'any.required': '使用次数是必填项'
    }),
    validity_days: Joi.number().integer().min(1).max(3650).required().messages({
        'number.base': '有效期必须是数字',
        'number.integer': '有效期必须是整数',
        'number.min': '有效期至少为1天',
        'number.max': '有效期不能超过3650天',
        'any.required': '有效期是必填项'
    }),
    price: Joi.number().positive().max(99999.99).required().messages({
        'number.base': '价格必须是数字',
        'number.positive': '套餐价格必须大于0元',
        'number.max': '价格不能超过99999.99元',
        'any.required': '价格是必填项'
    }),
    sort_order: Joi.number().integer().min(0).max(9999).optional().messages({
        'number.base': '排序必须是数字',
        'number.integer': '排序必须是整数',
        'number.min': '排序不能小于0',
        'number.max': '排序不能超过9999'
    })
});
const updatePackageSchema = Joi.object({
    name: Joi.string().min(1).max(100).optional().messages({
        'string.empty': '套餐名称不能为空',
        'string.max': '套餐名称不能超过100个字符'
    }),
    description: Joi.string().max(500).optional().messages({
        'string.max': '套餐描述不能超过500个字符'
    }),
    usage_count: Joi.number().integer().min(1).max(10000).optional().messages({
        'number.base': '使用次数必须是数字',
        'number.integer': '使用次数必须是整数',
        'number.min': '使用次数至少为1',
        'number.max': '使用次数不能超过10000'
    }),
    validity_days: Joi.number().integer().min(1).max(3650).optional().messages({
        'number.base': '有效期必须是数字',
        'number.integer': '有效期必须是整数',
        'number.min': '有效期至少为1天',
        'number.max': '有效期不能超过3650天'
    }),
    price: Joi.number().positive().max(99999.99).optional().messages({
        'number.base': '价格必须是数字',
        'number.positive': '套餐价格必须大于0元',
        'number.max': '价格不能超过99999.99元'
    }),
    is_active: Joi.boolean().optional().messages({
        'boolean.base': '状态必须是布尔值'
    }),
    sort_order: Joi.number().integer().min(0).max(9999).optional().messages({
        'number.base': '排序必须是数字',
        'number.integer': '排序必须是整数',
        'number.min': '排序不能小于0',
        'number.max': '排序不能超过9999'
    })
});
const purchasePackageSchema = Joi.object({
    package_id: Joi.number().integer().min(1).required().messages({
        'number.base': '套餐ID必须是数字',
        'number.integer': '套餐ID必须是整数',
        'number.min': '套餐ID必须大于0',
        'any.required': '套餐ID是必填项'
    }),
    payment_method: Joi.string().min(1).max(50).required().messages({
        'string.empty': '支付方式不能为空',
        'string.max': '支付方式不能超过50个字符',
        'any.required': '支付方式是必填项'
    })
});
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sortBy: Joi.string().valid('name', 'times', 'validity_days', 'price', 'sort_order', 'created_at').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    search: Joi.string().max(100).optional()
});
router.get('/active', async (req, res) => {
    try {
        const packages = await PackageService.getActivePackages();
        res.json({
            success: true,
            message: '获取套餐列表成功',
            data: packages
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取套餐列表失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.post('/purchase', authenticateToken, validate(purchasePackageSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const purchaseData = req.body;
        const userPackage = await PackageService.purchasePackage(req.user.userId, purchaseData);
        res.json({
            success: true,
            message: '套餐购买成功',
            data: userPackage
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '套餐购买失败'
        });
    }
});
router.get('/my-packages', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const userPackages = await PackageService.getUserPackages(req.user.userId);
        res.json({
            success: true,
            message: '获取用户套餐列表成功',
            data: userPackages
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取用户套餐列表失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/available-times', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证的访问'
            });
        }
        const availableTimes = await PackageService.checkUserAvailableTimes(req.user.userId);
        res.json({
            success: true,
            message: '获取可用次数成功',
            data: { availableTimes }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取可用次数失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.use('/admin', authenticateToken, requireAdmin);
router.get('/admin', validateQuery(paginationSchema), async (req, res) => {
    try {
        const query = req.query;
        const result = await PackageService.getPackages(query);
        res.json({
            success: true,
            message: '获取套餐列表成功',
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取套餐列表失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/admin/:id', async (req, res) => {
    try {
        const packageId = parseInt(req.params.id);
        if (isNaN(packageId)) {
            return res.status(400).json({
                success: false,
                message: '无效的套餐ID'
            });
        }
        const packageInfo = await PackageService.getPackageById(packageId);
        if (!packageInfo) {
            return res.status(404).json({
                success: false,
                message: '套餐不存在'
            });
        }
        res.json({
            success: true,
            message: '获取套餐详情成功',
            data: packageInfo
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取套餐详情失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.post('/admin', validate(createPackageSchema), async (req, res) => {
    try {
        const packageData = req.body;
        const newPackage = await PackageService.createPackage(packageData);
        res.status(201).json({
            success: true,
            message: '套餐创建成功',
            data: newPackage
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '套餐创建失败'
        });
    }
});
router.put('/admin/:id', validate(updatePackageSchema), async (req, res) => {
    try {
        const packageId = parseInt(req.params.id);
        if (isNaN(packageId)) {
            return res.status(400).json({
                success: false,
                message: '无效的套餐ID'
            });
        }
        const updateData = req.body;
        const updatedPackage = await PackageService.updatePackage(packageId, updateData);
        res.json({
            success: true,
            message: '套餐更新成功',
            data: updatedPackage
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '套餐更新失败'
        });
    }
});
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const packageId = parseInt(req.params.id);
        const force = req.query.force === 'true';
        if (isNaN(packageId)) {
            return res.status(400).json({
                success: false,
                message: '无效的套餐ID'
            });
        }
        await PackageService.deletePackage(packageId);
        res.json({
            success: true,
            message: force ? '套餐强制删除成功' : '套餐删除成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '套餐删除失败'
        });
    }
});
export default router;
