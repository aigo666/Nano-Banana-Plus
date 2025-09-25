import mysql from 'mysql2/promise';
export declare const dbConfig: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    waitForConnections: boolean;
    connectionLimit: number;
    queueLimit: number;
    charset: string;
};
export declare const pool: mysql.Pool;
export declare function testConnection(): Promise<boolean>;
export declare function initDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map