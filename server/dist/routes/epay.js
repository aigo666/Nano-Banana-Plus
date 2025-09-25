import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { z } from 'zod';
import { createEpayService, EpayService } from '../services/EpayService.js';
import { RechargeService } from '../services/RechargeService.js';
import { PackageService } from '../services/PackageService.js';
const router = express.Router();
// 创建支付订单schema
const createPaymentSchema = z.object({
    type: z.enum(['wxpay', 'alipay']),
    amount: z.number().min(0.01).max(99999.99),
    package_id: z.number().optional(),
    recharge_id: z.number().optional(),
    return_url: z.string().url().optional(),
    clientip: z.string().optional()
});
// 余额支付schema
const balancePaymentSchema = z.object({
    amount: z.number().min(0.01).max(99999.99),
    package_id: z.number().optional(),
    recharge_id: z.number().optional()
});
// 获取易支付服务实例（异步）
const getEpayService = async () => {
    try {
        return await createEpayService();
    }
    catch (error) {
        console.error('易支付服务获取失败:', error);
        throw error;
    }
};
/**
 * 创建支付订单
 */
router.post('/create', authenticateToken, validateRequest(createPaymentSchema), async (req, res) => {
    try {
        const epayService = await getEpayService();
        const { type, amount, package_id, recharge_id, return_url, clientip } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: '用户未登录'
            });
        }
        // 生成订单号
        const outTradeNo = EpayService.generateOrderNo();
        // 确定商品名称
        let productName = '充值服务';
        if (package_id) {
            try {
                const packageInfo = await PackageService.getPackageById(package_id);
                if (packageInfo) {
                    productName = `套餐购买 - ${packageInfo.name}`;
                }
            }
            catch (error) {
                console.error('获取套餐信息失败:', error);
            }
        }
        // 创建充值记录
        let rechargeRecordId = recharge_id;
        if (!rechargeRecordId) {
            rechargeRecordId = await RechargeService.createRechargeRecord({
                user_id: userId,
                amount,
                payment_method: type === 'wxpay' ? '微信支付' : '支付宝',
                transaction_id: outTradeNo
            });
        }
        // 调用易支付API创建订单
        const orderResult = await epayService.createOrder({
            type,
            out_trade_no: outTradeNo,
            name: productName,
            money: amount.toFixed(2),
            clientip: clientip || req.ip || '127.0.0.1',
            device: 'pc',
            param: JSON.stringify({
                user_id: userId,
                recharge_id: rechargeRecordId,
                package_id: package_id || null
            }),
            return_url
        });
        // 返回支付信息
        res.json({
            success: true,
            message: '订单创建成功',
            data: {
                out_trade_no: outTradeNo,
                recharge_id: rechargeRecordId,
                trade_no: orderResult.trade_no,
                payurl: orderResult.payurl,
                qrcode: orderResult.qrcode,
                amount,
                payment_method: type === 'wxpay' ? '微信支付' : '支付宝'
            }
        });
    }
    catch (error) {
        console.error('创建易支付订单失败:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '创建订单失败'
        });
    }
});
/**
 * 易支付V1异步通知回调
 */
router.post('/notify', async (req, res) => {
    try {
        const epayService = await getEpayService();
        console.log('收到易支付V1回调通知:', req.body);
        const notifyData = req.body;
        // 验证签名
        if (!epayService.verifyNotify(notifyData)) {
            console.error('易支付V1回调签名验证失败');
            return res.status(400).send('fail');
        }
        const { pid, trade_no, out_trade_no, type, name, money, trade_status } = notifyData;
        console.log('易支付V1回调数据:', {
            pid,
            trade_no,
            out_trade_no,
            type,
            name,
            money,
            trade_status
        });
        // 处理支付成功
        if (trade_status === 'TRADE_SUCCESS') {
            try {
                // 根据订单号查找充值记录
                const rechargeRecord = await RechargeService.getRechargeRecordByTransactionId(out_trade_no);
                if (rechargeRecord) {
                    // 更新充值记录状态
                    await RechargeService.updateRechargeStatus(rechargeRecord.id, 'completed', trade_no);
                    console.log(`充值记录 ${rechargeRecord.id} 支付成功，金额: ${money}`);
                }
                else {
                    console.error(`未找到订单号为 ${out_trade_no} 的充值记录`);
                }
            }
            catch (error) {
                console.error('处理支付成功回调失败:', error);
                return res.status(500).send('fail');
            }
        }
        // 返回成功响应（易支付V1要求返回success）
        res.send('success');
    }
    catch (error) {
        console.error('处理易支付V1回调失败:', error);
        res.status(500).send('fail');
    }
});
/**
 * 易支付同步回调
 */
router.get('/return', async (req, res) => {
    try {
        const { out_trade_no, trade_no, trade_status } = req.query;
        console.log('易支付同步回调:', req.query);
        // 重定向到前端支付结果页面
        const redirectUrl = trade_status === 'TRADE_SUCCESS'
            ? `/payment/success?out_trade_no=${out_trade_no}&trade_no=${trade_no}`
            : `/payment/failed?out_trade_no=${out_trade_no}`;
        res.redirect(redirectUrl);
    }
    catch (error) {
        console.error('处理易支付同步回调失败:', error);
        res.redirect('/payment/failed');
    }
});
/**
 * 查询订单状态
 */
router.get('/query/:out_trade_no', authenticateToken, async (req, res) => {
    try {
        const epayService = await getEpayService();
        const { out_trade_no } = req.params;
        const result = await epayService.queryOrder(out_trade_no);
        res.json({
            success: true,
            message: '查询成功',
            data: result
        });
    }
    catch (error) {
        console.error('查询订单状态失败:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '查询失败'
        });
    }
});
/**
 * 获取支付方式列表
 */
router.get('/methods', async (req, res) => {
    try {
        // 获取支付配置，包括支付方式开关
        const { ConfigService } = await import('../services/ConfigService.js');
        const paymentConfig = await ConfigService.getPaymentConfig();
        // 获取可用的支付方式
        const methods = [];
        // 添加余额支付（如果启用）
        if (paymentConfig.balanceEnabled) {
            methods.push({
                type: 'balance',
                name: '账户余额',
                icon: '💰',
                description: '使用账户余额支付'
            });
        }
        // 添加第三方支付方式（如果易支付启用且配置完整）
        if (paymentConfig.epayEnabled && paymentConfig.pid && paymentConfig.key && paymentConfig.apiUrl) {
            // 检查易支付服务可用性
            try {
                await getEpayService();
                // 添加微信支付和支付宝
                const epayMethods = EpayService.getPaymentMethods(paymentConfig.wxpayEnabled, paymentConfig.alipayEnabled, false // 余额支付已经单独添加了
                );
                methods.push(...epayMethods);
            }
            catch (epayError) {
                console.log('易支付服务不可用，跳过第三方支付方式');
            }
        }
        res.json({
            success: true,
            message: '获取支付方式成功',
            data: methods
        });
    }
    catch (error) {
        console.error('获取支付方式失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        res.json({
            success: true,
            message: '获取支付方式成功',
            data: [] // 即使出错也返回空数组，避免前端报错
        });
    }
});
/**
 * 余额支付
 */
router.post('/balance-pay', authenticateToken, validateRequest(balancePaymentSchema), async (req, res) => {
    try {
        const { ConfigService } = await import('../services/ConfigService.js');
        const { UserService } = await import('../services/UserService.js');
        const { RechargeService } = await import('../services/RechargeService.js');
        const paymentConfig = await ConfigService.getPaymentConfig();
        // 检查余额支付是否启用
        if (!paymentConfig.balanceEnabled) {
            return res.status(400).json({
                success: false,
                message: '余额支付功能未启用'
            });
        }
        const { amount, package_id, recharge_id } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: '用户未登录'
            });
        }
        // 获取用户余额
        const userBalance = await UserService.getUserBalance(userId);
        if (!userBalance) {
            return res.status(400).json({
                success: false,
                message: '获取用户余额失败'
            });
        }
        // 检查余额是否足够
        const currentBalance = typeof userBalance.balance === 'string' ? parseFloat(userBalance.balance) : userBalance.balance;
        if (currentBalance < amount) {
            return res.status(400).json({
                success: false,
                message: '账户余额不足',
                data: {
                    currentBalance,
                    requiredAmount: amount,
                    shortfall: amount - currentBalance
                }
            });
        }
        // 生成订单号
        const outTradeNo = EpayService.generateOrderNo();
        // 创建充值记录
        let rechargeRecordId = recharge_id;
        if (!rechargeRecordId) {
            rechargeRecordId = await RechargeService.createRechargeRecord({
                user_id: userId,
                amount,
                payment_method: '余额支付',
                transaction_id: outTradeNo
            });
        }
        // 扣减用户余额
        await UserService.updateUserBalance(userId, -amount, `余额支付 - 订单号: ${outTradeNo}`);
        // 更新充值记录状态为已完成
        await RechargeService.updateRechargeStatus(rechargeRecordId, 'completed', outTradeNo);
        // 处理套餐购买逻辑
        if (package_id) {
            try {
                const { PackageService } = await import('../services/PackageService.js');
                await PackageService.purchasePackage(userId, {
                    package_id,
                    payment_method: '余额支付'
                });
            }
            catch (error) {
                console.error('套餐购买失败:', error);
                // 如果套餐购买失败，需要退还用户余额
                await UserService.updateUserBalance(userId, amount, `余额支付退款 - 订单号: ${outTradeNo}`);
                throw error;
            }
        }
        res.json({
            success: true,
            message: '余额支付成功',
            data: {
                transaction_id: outTradeNo,
                amount,
                recharge_id: rechargeRecordId,
                remaining_balance: currentBalance - amount
            }
        });
    }
    catch (error) {
        console.error('余额支付失败:', error);
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '余额支付失败'
        });
    }
});
export default router;
//# sourceMappingURL=epay.js.map