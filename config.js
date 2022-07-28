import 'dotenv/config'

export const DB_CONFIG = {
    engine: 'mssql',
    user: process.env.DB_USERNAME,
    password: process.env.DB_USER_PASSWORD,
    database: 'Restman',
    server: 'localhost',
    port: 1433,
    options: {
        trustServerCertificate: true,
        trustedConnection: true,
        cryptoCredentialsDetails: {
            minVersion: 'TLSv1'
        }
    }
}
