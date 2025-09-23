import Joi from 'joi';
import { z } from 'zod';
export const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                error: error.details[0].message
            });
        }
        next();
    };
};
export const registerSchema = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
        'string.alphanum': '用户名只能包含字母和数字',
        'string.min': '用户名至少需要3个字符',
        'string.max': '用户名不能超过30个字符',
        'any.required': '用户名是必需的'
    }),
    email: Joi.string()
        .email()
        .required()
        .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱是必需的'
    }),
    password: Joi.string()
        .min(6)
        .max(100)
        .required()
        .messages({
        'string.min': '密码至少需要6个字符',
        'string.max': '密码不能超过100个字符',
        'any.required': '密码是必需的'
    }),
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
        'any.only': '确认密码必须与密码相同',
        'any.required': '确认密码是必需的'
    })
});
export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱是必需的'
    }),
    password: Joi.string()
        .required()
        .messages({
        'any.required': '密码是必需的'
    })
});
export const updateUserStatusSchema = Joi.object({
    status: Joi.string()
        .valid('active', 'inactive', 'banned')
        .required()
        .messages({
        'any.only': '状态只能是 active、inactive 或 banned',
        'any.required': '状态是必需的'
    })
});
export const updateUserRoleSchema = Joi.object({
    role: Joi.string()
        .valid('user', 'admin')
        .required()
        .messages({
        'any.only': '角色只能是 user 或 admin',
        'any.required': '角色是必需的'
    })
});
export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('id', 'username', 'email', 'created_at', 'updated_at', 'last_login').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    search: Joi.string().allow('').default(''),
    vipStatus: Joi.string().valid('all', 'vip', 'normal').default('all'),
    status: Joi.string().valid('all', 'active', 'inactive', 'banned').default('all')
});
export const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: '查询参数验证失败',
                error: error.details[0].message
            });
        }
        req.query = value;
        next();
    };
};
export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: '数据验证失败',
                    error: error.issues[0].message
                });
            }
            return res.status(400).json({
                success: false,
                message: '数据验证失败'
            });
        }
    };
};
export const validateZodQuery = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.parse(req.query);
            req.query = result;
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: '查询参数验证失败',
                    error: error.issues[0].message
                });
            }
            return res.status(400).json({
                success: false,
                message: '查询参数验证失败'
            });
        }
    };
};
