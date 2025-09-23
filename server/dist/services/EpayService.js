import crypto from 'crypto';
import axios from 'axios';
export class EpayService {
    config;
    constructor(config) {
        this.config = config;
    }
    generateSign(params) {
        const filteredParams = Object.keys(params)
            .filter(key => key !== 'sign' &&
            key !== 'sign_type' &&
            params[key] !== '' &&
            params[key] !== null &&
            params[key] !== undefined)
            .sort()
            .reduce((result, key) => {
            result[key] = params[key];
            return result;
        }, {});
        const signStr = Object.keys(filteredParams)
            .map(key => `${key}=${filteredParams[key]}`)
            .join('&') + this.config.key;
        console.log('易支付V1签名字符串:', signStr);
        return crypto.createHash('md5').update(signStr).digest('hex');
    }
    verifySign(params, sign) {
        const { sign: _, ...paramsWithoutSign } = params;
        const calculatedSign = this.generateSign(paramsWithoutSign);
        return calculatedSign === sign;
    }
    async createOrder(params) {
        const orderParams = {
            pid: this.config.pid,
            type: params.type,
            out_trade_no: params.out_trade_no,
            notify_url: params.notify_url || this.config.notifyUrl,
            name: params.name,
            money: params.money,
            clientip: params.clientip || '127.0.0.1',
            sign_type: 'MD5'
        };
        const sign = this.generateSign(orderParams);
        const requestParams = { ...orderParams, sign, sign_type: 'MD5' };
        try {
            console.log('易支付V1创建订单请求参数:', requestParams);
            const response = await axios.post(`${this.config.apiUrl}/mapi.php`, new URLSearchParams(requestParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            });
            console.log('易支付V1 API响应:', response.data);
            let result;
            if (typeof response.data === 'string') {
                try {
                    result = JSON.parse(response.data);
                }
                catch {
                    if (response.data.startsWith('http')) {
                        result = {
                            code: 1,
                            msg: 'success',
                            payurl: response.data
                        };
                    }
                    else {
                        throw new Error(`易支付API返回格式错误: ${response.data}`);
                    }
                }
            }
            else {
                result = response.data;
            }
            if (result.code !== 1) {
                throw new Error(result.msg || '创建订单失败');
            }
            return result;
        }
        catch (error) {
            console.error('易支付V1创建订单失败:', error);
            if (axios.isAxiosError(error)) {
                throw new Error(`易支付API请求失败: ${error.message}`);
            }
            throw error;
        }
    }
    verifyNotify(notifyData) {
        const { sign, ...params } = notifyData;
        return this.verifySign(params, sign);
    }
    async queryOrder(outTradeNo) {
        const params = {
            pid: this.config.pid,
            out_trade_no: outTradeNo,
            sign_type: 'MD5'
        };
        const sign = this.generateSign(params);
        const requestParams = { ...params, sign, sign_type: 'MD5' };
        try {
            console.log('易支付V1查询订单请求参数:', requestParams);
            const response = await axios.post(`${this.config.apiUrl}/api.php`, new URLSearchParams(requestParams).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });
            console.log('易支付V1查询订单响应:', response.data);
            return response.data;
        }
        catch (error) {
            console.error('查询订单状态失败:', error);
            throw error;
        }
    }
    static getPaymentMethods(wxpayEnabled = true, alipayEnabled = true) {
        const methods = [];
        if (wxpayEnabled) {
            methods.push({
                type: 'wxpay',
                name: '微信支付',
                icon: '💚',
                description: '使用微信扫码支付'
            });
        }
        if (alipayEnabled) {
            methods.push({
                type: 'alipay',
                name: '支付宝',
                icon: '💙',
                description: '使用支付宝扫码支付'
            });
        }
        return methods;
    }
    static generateOrderNo() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `EP${timestamp}${random}`;
    }
}
import { ConfigService } from './ConfigService.js';
export const createEpayService = async () => {
    const epayConfig = await ConfigService.getEpayConfig();
    if (!epayConfig.enabled) {
        throw new Error('易支付功能未启用，请在系统设置中启用并配置相关参数');
    }
    if (!epayConfig.pid || !epayConfig.key || !epayConfig.apiUrl) {
        throw new Error('易支付配置不完整，请在系统设置中配置商户ID、密钥和API地址');
    }
    const config = {
        pid: epayConfig.pid,
        key: epayConfig.key,
        apiUrl: epayConfig.apiUrl,
        returnUrl: epayConfig.returnUrl,
        notifyUrl: epayConfig.notifyUrl
    };
    return new EpayService(config);
};
