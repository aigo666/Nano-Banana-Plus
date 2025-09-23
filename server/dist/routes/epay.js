import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { z } from 'zod';
import { createEpayService, EpayService } from '../services/EpayService.js';
import { RechargeService } from '../services/RechargeService.js';
import { PackageService } from '../services/PackageService.js';
const router = express.Router();
const createPaymentSchema = z.object({
    type: z.enum(['wxpay', 'alipay']),
    amount: z.number().min(0.01).max(99999.99),
    package_id: z.number().optional(),
    recharge_id: z.number().optional(),
    return_url: z.string().url().optional(),
    clientip: z.string().optional()
});
const getEpayService = async () => {
    try {
        return await createEpayService();
    }
    catch (error) {
        console.error('易支付服务获取失败:', error);
        throw error;
    }
};
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
        const outTradeNo = EpayService.generateOrderNo();
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
        let rechargeRecordId = recharge_id;
        if (!rechargeRecordId) {
            rechargeRecordId = await RechargeService.createRechargeRecord({
                user_id: userId,
                amount,
                payment_method: type === 'wxpay' ? '微信支付' : '支付宝',
                transaction_id: outTradeNo
            });
        }
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
router.post('/notify', async (req, res) => {
    try {
        const epayService = await getEpayService();
        console.log('收到易支付V1回调通知:', req.body);
        const notifyData = req.body;
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
        if (trade_status === 'TRADE_SUCCESS') {
            try {
                const rechargeRecord = await RechargeService.getRechargeRecordByTransactionId(out_trade_no);
                if (rechargeRecord) {
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
        res.send('success');
    }
    catch (error) {
        console.error('处理易支付V1回调失败:', error);
        res.status(500).send('fail');
    }
});
router.get('/return', async (req, res) => {
    try {
        const { out_trade_no, trade_no, trade_status } = req.query;
        console.log('易支付同步回调:', req.query);
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
router.get('/methods', async (req, res) => {
    try {
        const epayService = await getEpayService();
        const { ConfigService } = await import('../services/ConfigService.js');
        const epayConfig = await ConfigService.getEpayConfig();
        const methods = EpayService.getPaymentMethods(epayConfig.wxpayEnabled, epayConfig.alipayEnabled);
        res.json({
            success: true,
            message: '获取支付方式成功',
            data: methods
        });
    }
    catch (error) {
        console.error('获取支付方式失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        if (process.env.NODE_ENV === 'development') {
            console.log('易支付配置错误详情:', errorMessage);
        }
        res.status(500).json({
            success: false,
            message: '易支付未启用或配置不完整',
            error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
    }
});
export default router;
